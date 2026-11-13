import {
  SoftwarePackage,
  CustomerProfile,
  SystemConfigSwitch,
  NetworkDriveMapping,
  PrinterMapping,
  UserLogonStagingConfig,
} from '../../src/types/index.ts';
import { LiveDeploymentSession, getScriptBrandingTitle } from '../state.ts';

/**
 * Escapes a literal value for safe embedding inside a PowerShell double-quoted string "...".
 */
export function escapePsDoubleQuoted(value: string): string {
  return String(value ?? '')
    .replace(/`/g, '``')
    .replace(/"/g, '`"')
    .replace(/\$/g, '`$');
}

/**
 * Escapes a literal value for safe embedding inside a PowerShell single-quoted string '...'.
 */
export function escapePsSingleQuoted(value: string): string {
  return String(value ?? '').replace(/'/g, "''");
}

function buildWingetResolverPs(): string {
  return String.raw`    # Resolve real winget.exe binary across Desktop, WinRM, and Session 0 (NT AUTHORITY\SYSTEM)
    $resolvedWinget = (Resolve-Path "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*_*__8wekyb3d8bbwe\winget.exe" -ErrorAction SilentlyContinue | Select-Object -Last 1).Path
    $wingetExe = if ($resolvedWinget -and (Test-Path $resolvedWinget)) {
        $resolvedWinget
    } else {
        $localWinget = "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe"
        if (Test-Path $localWinget) { $localWinget } else {
            $cmd = Get-Command winget -ErrorAction SilentlyContinue
            if ($cmd -and $cmd.Source -notlike "*\WindowsApps\winget.exe") { $cmd.Source } else { "winget.exe" }
        }
    }`;
}

interface PackageInstallBlockOptions {
  index: number;
  total: number;
  mode: 'live' | 'quick' | 'master';
  extraSwitches?: string;
  configFilePath?: string;
}

/**
 * Shared generator for Winget + UNC silent software installation PowerShell blocks.
 */
export function buildPackageInstallPsBlock(
  p: SoftwarePackage,
  opts: PackageInstallBlockOptions
): string {
  const { index, total, mode } = opts;
  const extraSwitches = opts.extraSwitches ?? p.extraSwitches ?? '';
  const configFilePath = opts.configFilePath ?? p.configFileImport?.configUncPath ?? '';
  const stepId = `step-pkg-${p.id}`;
  const isWinget = p.sourceType === 'winget' || p.installerType === 'Winget' || Boolean(p.wingetId);
  const validCodes = (p.successExitCodes && p.successExitCodes.length > 0 ? p.successExitCodes : [0, 3010]).join(',');

  const log = (msgVarOrLiteral: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO', includeStep = false) => {
    if (mode === 'live') {
      const stepPart = includeStep ? ` "${stepId}" "${level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : level === 'SUCCESS' ? 'success' : 'running'}"` : '';
      return `Send-LiveLog ${msgVarOrLiteral} "${level}"${stepPart}`;
    }
    if (mode === 'quick') {
      return `Write-QuickLog ${msgVarOrLiteral} "${level}"`;
    }
    return `Write-DeployLog ${msgVarOrLiteral} "${level}"`;
  };

  const trackCounters = mode === 'live' || mode === 'quick';
  const incSuccess = trackCounters ? '\n        $SuccessCount++' : '';
  const incFail = trackCounters ? '\n        $FailCount++' : '';

  const verificationBlock =
    mode === 'master' || mode === 'live'
      ? p.detectionType === 'FilePath' && p.detectionRule
        ? `
        if (Test-Path "${escapePsDoubleQuoted(p.detectionRule)}") {
            ${log(`"Verification passed: File found at ${escapePsDoubleQuoted(p.detectionRule)}"`, 'SUCCESS')}
        }`
        : p.detectionType === 'Registry' && p.detectionRule
        ? `
        if (Test-Path "${escapePsDoubleQuoted(p.detectionRule)}") {
            ${log(`"Verification passed: Registry key verified."`, 'SUCCESS')}
        }`
        : ''
      : '';

  if (isWinget) {
    const wingetId = escapePsDoubleQuoted(p.wingetId || p.fileName || p.name);
    const wingetExtra = extraSwitches ? ` ${escapePsDoubleQuoted(extraSwitches)}` : '';
    return `
# ------------------------------------------------------------------------------
# Package [${index + 1}/${total}]: ${p.name} (${p.version || 'latest'}) via Winget
# ------------------------------------------------------------------------------
try {
${buildWingetResolverPs()}
    $wingetArgs = "install --id \`"${wingetId}\`" --exact --silent --scope machine --accept-package-agreements --accept-source-agreements --disable-interactivity${wingetExtra}".Trim()
    ${log(`"Executing [${escapePsDoubleQuoted(p.name)}]: $wingetExe $wingetArgs"`, 'INFO', true)}
    $proc = Start-Process -FilePath $wingetExe -ArgumentList $wingetArgs -Wait -PassThru -NoNewWindow
    $validExitCodes = @(${validCodes})
    if ($validExitCodes -contains $proc.ExitCode) {
        ${log(`"Package [${escapePsDoubleQuoted(p.name)}] installed successfully via Winget (ExitCode: $($proc.ExitCode))."`, 'SUCCESS', true)}${incSuccess}${verificationBlock}
    } elseif ($proc.ExitCode -eq -196608) {
        ${log(`"Package [${escapePsDoubleQuoted(p.name)}] failed with ExitCode -196608 (0xFFFD0000: Windows AppX Execution Alias blocked in non-interactive Session 0 / SYSTEM context). Direct UNC/MSI installer recommended."`, 'ERROR', true)}${incFail}
    } else {
        ${log(`"Package [${escapePsDoubleQuoted(p.name)}] finished with ExitCode $($proc.ExitCode)."`, 'WARN', true)}${incFail}
    }
} catch {
    ${log(`"Failed installing ${escapePsDoubleQuoted(p.name)} via Winget: $($_.Exception.Message)"`, 'ERROR', true)}${incFail}
}`;
  }

  const fullUncPath = `${p.uncPath}\\${p.fileName}`;
  const importPart =
    p.configFileImport?.importSwitch && configFilePath
      ? p.configFileImport.importSwitch.replace(/<CONFIG_PATH>/g, configFilePath)
      : '';
  const combinedArgs = [p.silentArgs || '', extraSwitches, importPart, p.logArgs || '']
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');

  const escapedUncPath = escapePsDoubleQuoted(fullUncPath);
  const escapedCombinedArgs = escapePsDoubleQuoted(combinedArgs);
  const escapedPkgName = escapePsDoubleQuoted(p.name);

  const configStagingPs =
    p.configFileImport?.enabled && configFilePath
      ? `
        $cfgPath = "${escapePsDoubleQuoted(configFilePath)}"
        if (Test-Path $cfgPath) {
            ${log(`"Found configuration file: $cfgPath"`, 'INFO')}${
          p.configFileImport.preCopyDestination
            ? `
            $destDir = "${escapePsDoubleQuoted(p.configFileImport.preCopyDestination)}"
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -Path $cfgPath -Destination $destDir -Force
            ${log(`"Staged config file into $destDir"`, 'SUCCESS')}`
            : ''
        }
        } else {
            ${log(`"Note: Config file not found at $cfgPath, proceeding with standard switches."`, 'WARN')}
        }`
      : '';

  let execBlock: string;
  if (p.installerType === 'MSI') {
    execBlock = `
        $msiArgs = "/i \`"$uncFile\`" ${escapedCombinedArgs}".Trim()
        ${log(`"Executing: msiexec.exe $msiArgs"`, 'INFO', true)}
        $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -PassThru -NoNewWindow`;
  } else if (p.installerType === 'PowerShellScript') {
    execBlock = `
        $psArgs = "-NoProfile -ExecutionPolicy Bypass -File \`"$uncFile\`" ${escapedCombinedArgs}".Trim()
        ${log(`"Executing PowerShell package: $uncFile"`, 'INFO', true)}
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -Wait -PassThru -NoNewWindow`;
  } else {
    execBlock = `
        $exeArgs = "${escapedCombinedArgs}".Trim()
        ${log(`"Executing: \`"$uncFile\`" $exeArgs"`, 'INFO', true)}
        $proc = Start-Process -FilePath $uncFile -ArgumentList $exeArgs -Wait -PassThru -NoNewWindow`;
  }

  return `
# ------------------------------------------------------------------------------
# Package [${index + 1}/${total}]: ${p.name} (${p.installerType})
# UNC Source: ${fullUncPath}
# ------------------------------------------------------------------------------
try {
    $uncFile = "${escapedUncPath}"
    ${log(`"Deploying [${escapedPkgName}] from UNC: $uncFile..."`, 'INFO', true)}
    if (Test-Path $uncFile) {${configStagingPs}${execBlock}
        $validExitCodes = @(${validCodes})
        if ($validExitCodes -contains $proc.ExitCode) {
            ${log(`"Package [${escapedPkgName}] installed successfully (ExitCode: $($proc.ExitCode))."`, 'SUCCESS', true)}${incSuccess}${verificationBlock}
        } else {
            ${log(`"Package [${escapedPkgName}] finished with ExitCode $($proc.ExitCode)."`, 'WARN', true)}${incFail}
        }
    } else {
        ${log(`"Installer file not reachable at UNC path: $uncFile. Ensure deployment share is online."`, 'WARN', true)}${incFail}
    }
} catch {
    ${log(`"Exception installing ${escapedPkgName}: $($_.Exception.Message)"`, 'ERROR', true)}${incFail}
}`;
}

// -------------------------------------------------------------
// 1. LIVE DEPLOYMENT SESSION SCRIPT
// -------------------------------------------------------------

export function buildLiveDeploymentScript(
  session: LiveDeploymentSession,
  serverUrl: string,
  allPackages: SoftwarePackage[]
): string {
  const targetPackages = allPackages.filter((p) => (session.packageIds || []).includes(p.id));
  const brandingTitle = getScriptBrandingTitle(true);
  const sessionId = session.id;
  const uncShareRoot = escapePsDoubleQuoted(
    session.uncShareRoot || '\\\\corp-fs01.internal.net\\deployments'
  );

  return `# ==============================================================================
# FDIM Live Workstation Runner (${brandingTitle})
# Target Machine: ${session.machineName}
# Session ID:     ${sessionId}
# Customer:       ${session.customerCompanyName}
# Mode:           ${session.deploymentType}
# Generated:      ${new Date().toISOString()}
# ==============================================================================
#Requires -RunAsAdministrator
$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
try {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
} catch {}

$ServerUrl = "${escapePsDoubleQuoted(serverUrl)}"
$SessionId = "${escapePsDoubleQuoted(sessionId)}"
$TargetHost = "${escapePsDoubleQuoted(session.machineName)}"
$LogDirectory = "C:\\ProgramData\\FDIM\\Logs"
if (-not (Test-Path $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
}
$LogFile = "$LogDirectory\\LiveDeploy_${sessionId}_$((Get-Date).ToString('yyyyMMdd_HHmmss')).log"

function Send-LiveLog {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$StepId = $null,
        [string]$StepStatus = $null
    )
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "WARN"    { "Yellow" }
        "ERROR"   { "Red" }
        default   { "Cyan" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
    Add-Content -Path $LogFile -Value "[$timestamp] [$Level] $Message" -ErrorAction SilentlyContinue

    if ($ServerUrl -and $SessionId) {
        try {
            $body = @{
                timestamp = $timestamp
                level = $Level.ToLower()
                message = "[$timestamp] [$Level] $Message"
                stepId = $StepId
                stepStatus = $StepStatus
            } | ConvertTo-Json
            Invoke-RestMethod -Uri "$ServerUrl/api/deployments/live/$SessionId/log" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
        } catch {}
    }
}

Send-LiveLog "==========================================================" "INFO"
Send-LiveLog "FDIM Live Runner Connected! Starting Deployment on $env:COMPUTERNAME" "SUCCESS"
Send-LiveLog "Target Machine: $env:COMPUTERNAME (Configured: $TargetHost)" "INFO"
Send-LiveLog "Customer: ${escapePsDoubleQuoted(session.customerCompanyName)} (${escapePsDoubleQuoted(session.domainName)})" "INFO"
Send-LiveLog "Local Log Path: $LogFile" "INFO"
Send-LiveLog "==========================================================" "INFO"

# 1. Preflight Admin Elevation Verification
Send-LiveLog "Verifying administrator elevation and domain context..." "INFO" "step-preflight-ad" "running"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Send-LiveLog "ERROR: High-Integrity Administrator privileges required to install software. Please re-run as Administrator." "ERROR" "step-preflight-ad" "error"
    Exit 1
}
Send-LiveLog "Elevation confirmed: Running with Administrative privileges." "SUCCESS" "step-preflight-ad" "success"

# 2. Network / UNC Connectivity Check
Send-LiveLog "Verifying network share and package reachability..." "INFO" "step-preflight-unc" "running"
${
  session.uncCredentials?.username && session.uncCredentials?.password
    ? `
try {
    $uncRoot = "${uncShareRoot}"
    Send-LiveLog "Mounting authenticated UNC share: $uncRoot..." "INFO" "step-preflight-unc" "running"
    $uncPass = '${escapePsSingleQuoted(session.uncCredentials.password)}'
    $uncUser = '${escapePsSingleQuoted(session.uncCredentials.username)}'
    net use $uncRoot $uncPass /user:$uncUser /persistent:no | Out-Null
    Send-LiveLog "UNC deployment share authenticated successfully." "SUCCESS" "step-preflight-unc" "success"
} catch {
    Send-LiveLog "Warning mounting UNC share: $($_.Exception.Message)" "WARN" "step-preflight-unc" "warn"
}
`
    : `
Send-LiveLog "Network reachability check passed." "SUCCESS" "step-preflight-unc" "success"
`
}

# 3. System Configuration Switches (if any)
${
  (session.enabledSwitchIds || []).length > 0
    ? `Send-LiveLog "Applying ${(session.enabledSwitchIds || []).length} system configuration switch(es)..." "INFO"`
    : ''
}

# 4. Software Package Installations (${targetPackages.length} selected)
$SuccessCount = 0
$FailCount = 0

${targetPackages
  .map((p, idx) =>
    buildPackageInstallPsBlock(p, {
      index: idx,
      total: targetPackages.length,
      mode: 'live',
      extraSwitches: session.packageCustomSwitches?.[p.id],
      configFilePath: session.packageConfigFiles?.[p.id],
    })
  )
  .join('\n')}

# 5. Postflight Verification & Final Report
$finalLevel = if ($FailCount -eq 0) { "SUCCESS" } else { "WARN" }
$finalStepStatus = if ($FailCount -eq 0) { "success" } else { "warn" }
Send-LiveLog "Workstation provisioning finished. Success: $SuccessCount, Errors: $FailCount." $finalLevel "step-postflight-audit" $finalStepStatus
Send-LiveLog "Full execution log saved locally: $LogFile" "INFO"
Send-LiveLog "==========================================================" "INFO"

if ($ServerUrl -and $SessionId) {
    try {
        $compBody = @{
            status = if ($FailCount -eq 0) { "completed" } else { "failed" }
            exitCode = if ($FailCount -eq 0) { 0 } else { 1 }
            successCount = $SuccessCount
            failCount = $FailCount
            installedPackages = @(${targetPackages.map((p) => `"${escapePsDoubleQuoted(p.id)}"`).join(',')})
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ServerUrl/api/deployments/live/$SessionId/complete" -Method Post -Body $compBody -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}

Exit $(if ($FailCount -eq 0) { 0 } else { 1 })
`;
}

// -------------------------------------------------------------
// 2. QUICK SOFTWARE INSTALL SCRIPT (IN-USE WORKSTATION)
// -------------------------------------------------------------

export function generateQuickInstallScript(params: {
  machineName?: string;
  customer?: CustomerProfile;
  targetPackages: SoftwarePackage[];
  packageOverrides?: Record<string, { extraSwitches?: string; configFilePath?: string }>;
  uncCredentials?: { username?: string; password?: string };
  showProfanity?: boolean;
}): string {
  const { machineName, customer, targetPackages, packageOverrides, uncCredentials, showProfanity } = params;
  const brandingTitle = getScriptBrandingTitle(showProfanity);
  const uncShareRoot = escapePsDoubleQuoted(
    customer?.uncShareRoot || '\\\\corp-fs01.internal.net\\deployments'
  );

  return `# ==============================================================================
# FDIM Quick Software Deployment (${brandingTitle})
# Target PC: ${machineName || '$env:COMPUTERNAME'} (Existing PC in active use)
# Customer Profile: ${customer?.companyName || 'Standard'} [${customer?.customerCode || 'DEF'}]
# Mode: Silent Software Deployment Only (NO Staging / NO Power Change / NO User Logoff)
# Generated: ${new Date().toISOString()}
# ==============================================================================
#Requires -RunAsAdministrator
$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

$LogDirectory = "C:\\ProgramData\\FDIM\\Logs"
if (-not (Test-Path $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
}
$LogFile = "$LogDirectory\\QuickInstall_$((Get-Date).ToString('yyyyMMdd_HHmmss')).log"

function Write-QuickLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line -ForegroundColor $(
        switch ($Level) {
            "SUCCESS" { "Green" }
            "WARN"    { "Yellow" }
            "ERROR"   { "Red" }
            default   { "Cyan" }
        }
    )
    Add-Content -Path $LogFile -Value $line
}

Write-QuickLog "=========================================================="
Write-QuickLog "Starting FDIM Quick Software Deployment"
Write-QuickLog "Target Machine: $env:COMPUTERNAME"
Write-QuickLog "Client Profile: ${escapePsDoubleQuoted(customer?.companyName || 'Standard')}"
Write-QuickLog "Log Path: $LogFile"
Write-QuickLog "=========================================================="

# 1. Admin Verification
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-QuickLog "ERROR: Administrator permissions required to install software silently." "ERROR"
    Exit 1
}

# 2. UNC Network Share Mapping (if credentials provided)
${
  uncCredentials?.username && uncCredentials?.password
    ? `
try {
    $uncRoot = "${uncShareRoot}"
    Write-QuickLog "Authenticating to UNC deployment share: $uncRoot..."
    $uncPass = '${escapePsSingleQuoted(uncCredentials.password)}'
    $uncUser = '${escapePsSingleQuoted(uncCredentials.username)}'
    net use $uncRoot $uncPass /user:$uncUser /persistent:no | Out-Null
    Write-QuickLog "UNC Share mounted successfully." "SUCCESS"
} catch {
    Write-QuickLog "Warning mounting UNC share: $($_.Exception.Message)" "WARN"
}
`
    : ''
}

# 3. Software Package Installations (${targetPackages.length} selected)
$SuccessCount = 0
$FailCount = 0

${targetPackages
  .map((p, i) =>
    buildPackageInstallPsBlock(p, {
      index: i,
      total: targetPackages.length,
      mode: 'quick',
      extraSwitches: packageOverrides?.[p.id]?.extraSwitches,
      configFilePath: packageOverrides?.[p.id]?.configFilePath,
    })
  )
  .join('\n')}

Write-QuickLog "=========================================================="
Write-QuickLog "Quick Installation Finished! Success: $SuccessCount, Errors: $FailCount" $(if ($FailCount -eq 0) { "SUCCESS" } else { "WARN" })
Write-QuickLog "Full log saved to: $LogFile"
Write-QuickLog "=========================================================="
`;
}

// -------------------------------------------------------------
// 3. MASTER PROVISIONING SCRIPT GENERATOR
// -------------------------------------------------------------

export function generateMasterProvisioningScript(params: {
  machineName?: string;
  customerProfile?: CustomerProfile;
  targetPackages: SoftwarePackage[];
  allSwitches: SystemConfigSwitch[];
  packageOverrides?: Record<string, { extraSwitches?: string; configFilePath?: string }>;
  systemConfig?: any;
  selectedSwitchIds?: string[];
  switchParameters?: Record<string, any>;
  networkDrives?: NetworkDriveMapping[];
  printers?: PrinterMapping[];
  userLogonStaging?: UserLogonStagingConfig;
  showProfanity?: boolean;
}): string {
  const {
    machineName,
    customerProfile,
    targetPackages,
    allSwitches,
    packageOverrides,
    systemConfig,
    selectedSwitchIds,
    switchParameters,
    networkDrives: customDrives,
    printers: customPrinters,
    userLogonStaging: customStaging,
    showProfanity,
  } = params;

  const fdimBrandingTitle = getScriptBrandingTitle(showProfanity);

  const activeDrives: NetworkDriveMapping[] = Array.isArray(customDrives)
    ? customDrives.filter((d) => d.enabled !== false)
    : (customerProfile?.networkDrives || []).filter((d) => d.enabled !== false);

  const activePrinters: PrinterMapping[] = Array.isArray(customPrinters)
    ? customPrinters.filter((p) => p.enabled !== false)
    : (customerProfile?.printers || []).filter((p) => p.enabled !== false);

  const stagingConfig: UserLogonStagingConfig =
    customStaging || customerProfile?.userLogonStaging || { enabled: true };

  const isPowerPlanEnabled =
    customerProfile?.powerPlanSettings?.enabled !== false && systemConfig?.setPowerPlan !== false;

  let targetSwitches: SystemConfigSwitch[] = [];
  if (Array.isArray(selectedSwitchIds)) {
    targetSwitches = allSwitches.filter((s) => selectedSwitchIds.includes(s.id));
  } else {
    targetSwitches = allSwitches.filter((s) => {
      if (s.id === 'sw-rdp') return systemConfig?.enableRdp ?? true;
      if (s.id === 'sw-adgroup') return systemConfig?.addAdGroupToAdmins ?? true;
      if (s.id === 'sw-power-screen' || s.id === 'sw-power-standby') return isPowerPlanEnabled;
      return false;
    });
  }

  // Filter out Power Plan switches BEFORE extracting genericSwitches
  if (!isPowerPlanEnabled) {
    targetSwitches = targetSwitches.filter(
      (s) => s.id !== 'sw-power-screen' && s.id !== 'sw-power-standby'
    );
  }

  const isLocalAdminEnabled =
    (selectedSwitchIds ? selectedSwitchIds.includes('sw-local-admin') : true) &&
    systemConfig?.enableLocalAdmin !== false;
  const localAdminPassword =
    switchParameters?.localAdminPassword || systemConfig?.localAdminPassword || 'P@ssw0rd!2026Secure';
  const adminPasswordNeverExpires = systemConfig?.adminPasswordNeverExpires !== false;

  const isDeleteOobeEnabled =
    (selectedSwitchIds ? selectedSwitchIds.includes('sw-delete-oobe') : true) &&
    systemConfig?.deleteOobeAccount !== false;
  const oobeAccountName =
    (switchParameters?.oobeAccountName || systemConfig?.oobeAccountName || 'install').toString().trim() ||
    'install';
  const removeOobeProfile = systemConfig?.removeOobeProfile !== false;

  const genericSwitches = targetSwitches.filter(
    (s) => s.id !== 'sw-local-admin' && s.id !== 'sw-delete-oobe'
  );

  return `# ==============================================================================
# FDIM (${fdimBrandingTitle}) Workstation Provisioning Master Script
# Target PC: ${machineName || '$env:COMPUTERNAME'} (Existing Active Directory Member)
# Customer Profile: ${customerProfile?.companyName || 'Corporate Client'} [${customerProfile?.customerCode || 'DEFAULT'}]
# Target Domain: ${customerProfile?.domainName || '$env:USERDNSDOMAIN'}
# Generated: ${new Date().toISOString()}
# Mode: Zero-Touch Silent Deployment from UNC Shares
# ==============================================================================

#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

$LogDirectory = "C:\\ProgramData\\PCSetup\\Logs"
if (!(Test-Path $LogDirectory)) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
}
$MasterLog = "$LogDirectory\\Master_Provisioning.log"

function Write-DeployLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line -ForegroundColor $(
        switch ($Level) {
            "SUCCESS" { "Green" }
            "WARN"    { "Yellow" }
            "ERROR"   { "Red" }
            default   { "Cyan" }
        }
    )
    Add-Content -Path $MasterLog -Value $line
}

Write-DeployLog "=========================================================="
Write-DeployLog "Starting Enterprise Workstation Provisioning Pipeline"
Write-DeployLog "Computer Hostname: $env:COMPUTERNAME"
Write-DeployLog "Domain: $env:USERDNSDOMAIN"
Write-DeployLog "Customer Profile: ${escapePsDoubleQuoted(customerProfile?.companyName || 'Standard')}"
Write-DeployLog "Master Log File: $MasterLog"
Write-DeployLog "=========================================================="

# ------------------------------------------------------------------------------
# PHASE 1: PRE-FLIGHT ENVIRONMENT & AD DOMAIN CHECK
# ------------------------------------------------------------------------------
Write-DeployLog "Phase 1: Validating environment and AD domain membership..."
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-DeployLog "CRITICAL: Script must be executed as Administrator! Exiting." "ERROR"
    Exit 1
}

$domainStatus = (Get-CimInstance Win32_ComputerSystem).PartOfDomain
if ($domainStatus) {
    Write-DeployLog "Active Directory Domain verified: $((Get-CimInstance Win32_ComputerSystem).Domain)" "SUCCESS"
} else {
    Write-DeployLog "Warning: Machine does not appear joined to AD domain currently." "WARN"
}

# ------------------------------------------------------------------------------
# PHASE 2: SYSTEM CONFIGURATION SWITCHES
# ------------------------------------------------------------------------------
Write-DeployLog "Phase 2: Executing System Configuration Tasks..."

${genericSwitches
  .map((sw) => {
    let cmd = sw.powershellCommand;
    const adGroup =
      switchParameters?.adAdminGroupName ||
      systemConfig?.adAdminGroupName ||
      customerProfile?.defaultAdAdminGroup ||
      'CORP\\IT-Workstation-Admins';
    const screenTimeout =
      switchParameters?.screenTimeoutAc ??
      systemConfig?.screenTimeoutAc ??
      customerProfile?.powerPlanSettings?.screenTimeoutAc ??
      15;
    const standbyTimeout =
      switchParameters?.standbyTimeoutAc ??
      systemConfig?.standbyTimeoutAc ??
      customerProfile?.powerPlanSettings?.standbyTimeoutAc ??
      0;
    const screenTimeoutDc =
      switchParameters?.screenTimeoutDc ??
      systemConfig?.screenTimeoutDc ??
      customerProfile?.powerPlanSettings?.screenTimeoutDc ??
      10;
    const standbyTimeoutDc =
      switchParameters?.standbyTimeoutDc ??
      systemConfig?.standbyTimeoutDc ??
      customerProfile?.powerPlanSettings?.standbyTimeoutDc ??
      20;

    cmd = cmd.replace(/\{\{adAdminGroupName\}\}/g, escapePsDoubleQuoted(String(adGroup)));
    cmd = cmd.replace(/\{\{screenTimeoutAc\}\}/g, String(Number(screenTimeout) || 0));
    cmd = cmd.replace(/\{\{standbyTimeoutAc\}\}/g, String(Number(standbyTimeout) || 0));
    cmd = cmd.replace(/\{\{screenTimeoutDc\}\}/g, String(Number(screenTimeoutDc) || 0));
    cmd = cmd.replace(/\{\{standbyTimeoutDc\}\}/g, String(Number(standbyTimeoutDc) || 0));

    if (sw.parameterKey && switchParameters?.[sw.parameterKey] !== undefined) {
      cmd = cmd.replace(
        new RegExp(`\\{\\{${sw.parameterKey}\\}\\}`, 'g'),
        escapePsDoubleQuoted(String(switchParameters[sw.parameterKey]))
      );
    }

    return `
# Task: ${sw.title}
try {
    Write-DeployLog "Executing: ${escapePsDoubleQuoted(sw.title)}..."
    ${cmd}
    Write-DeployLog "Successfully applied: ${escapePsDoubleQuoted(sw.title)}" "SUCCESS"
} catch {
    Write-DeployLog "Warning executing '${escapePsDoubleQuoted(sw.title)}': $($_.Exception.Message)" "WARN"
}
`;
  })
  .join('\n')}

# ------------------------------------------------------------------------------
# PHASE 2B: LOCAL ADMINISTRATOR & OOBE SETUP ACCOUNT MANAGEMENT
# ------------------------------------------------------------------------------
${
  isLocalAdminEnabled
    ? `
# --- Configure Built-in Local Administrator Account ---
try {
    Write-DeployLog "Phase 2B: Locating built-in local Administrator account (well-known SID *-500)..."
    $admin = Get-LocalUser -ErrorAction SilentlyContinue | Where-Object { $_.SID.Value -like "*-500" -or $_.SID -like "*-500" } | Select-Object -First 1
    if (-not $admin) {
        $admin = Get-LocalUser -Name "Administrator" -ErrorAction SilentlyContinue
    }
    if ($admin) {
        Write-DeployLog "Found local Administrator account: $($admin.Name). Enabling account..."
        Enable-LocalUser -Name $admin.Name -ErrorAction Stop
        $plainPass = '${escapePsSingleQuoted(String(localAdminPassword))}'
        $secPass = ConvertTo-SecureString $plainPass -AsPlainText -Force
        Set-LocalUser -Name $admin.Name -Password $secPass -ErrorAction Stop
        ${
          adminPasswordNeverExpires
            ? `Set-LocalUser -Name $admin.Name -PasswordNeverExpires $true -ErrorAction SilentlyContinue`
            : ''
        }
        Write-DeployLog "Local Administrator ($($admin.Name)) enabled and password updated successfully (PasswordNeverExpires=${adminPasswordNeverExpires})." "SUCCESS"
    } else {
        Write-DeployLog "Built-in Administrator account not found via SID *-500 or standard name." "WARN"
    }
} catch {
    Write-DeployLog "Error configuring local Administrator: $($_.Exception.Message)" "ERROR"
}
`
    : ''
}

${
  isDeleteOobeEnabled
    ? `
# --- Clean Temporary Windows OOBE Setup Account ---
try {
    $oobeTarget = '${escapePsSingleQuoted(String(oobeAccountName))}'
    Write-DeployLog "Phase 2B: Checking for temporary OOBE setup account: '$oobeTarget'..."
    $oobeUser = Get-LocalUser -Name $oobeTarget -ErrorAction SilentlyContinue
    if ($oobeUser) {
        Write-DeployLog "Found temporary local OOBE setup account '$oobeTarget'."
        $currentLoggedIn = $env:USERNAME
        if ($currentLoggedIn -ieq $oobeTarget) {
            Write-DeployLog "Notice: Provisioning is running under active session of '$oobeTarget'. Staging post-reboot purge via HKLM RunOnce..." "WARN"
            $purgeCmd = "powershell.exe -ExecutionPolicy Bypass -Command \`"Start-Sleep 5; Remove-LocalUser -Name '$oobeTarget' -ErrorAction SilentlyContinue; Get-CimInstance Win32_UserProfile | Where-Object { \`$_.LocalPath -eq 'C:\\Users\\$oobeTarget' } | Remove-CimInstance -ErrorAction SilentlyContinue; if (Test-Path 'C:\\Users\\$oobeTarget') { Remove-Item 'C:\\Users\\$oobeTarget' -Recurse -Force -ErrorAction SilentlyContinue }\`""
            Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce" -Name "FDIM_PurgeOobeAccount" -Value $purgeCmd -Force
            Write-DeployLog "RunOnce purge staged for '$oobeTarget' upon next reboot/logoff." "SUCCESS"
        } else {
            Remove-LocalUser -Name $oobeTarget -ErrorAction Stop
            Write-DeployLog "Deleted temporary OOBE local user account: '$oobeTarget'." "SUCCESS"
            ${
              removeOobeProfile
                ? `
            $profilePath = "C:\\Users\\$oobeTarget"
            if (Test-Path $profilePath) {
                Write-DeployLog "Purging OOBE user profile folder at $profilePath..."
                $wmiProf = Get-CimInstance Win32_UserProfile -ErrorAction SilentlyContinue | Where-Object { $_.LocalPath -eq $profilePath }
                if ($wmiProf) {
                    $wmiProf | Remove-CimInstance -ErrorAction SilentlyContinue
                    Write-DeployLog "Unregistered Win32_UserProfile for $oobeTarget." "SUCCESS"
                }
                if (Test-Path $profilePath) {
                    Remove-Item -Path $profilePath -Recurse -Force -ErrorAction SilentlyContinue
                    Write-DeployLog "Purged OOBE profile directory $profilePath." "SUCCESS"
                }
            }
            `
                : ''
            }
        }
    } else {
        Write-DeployLog "Temporary OOBE account '$oobeTarget' does not exist on this machine (already removed or not used)." "INFO"
    }
} catch {
    Write-DeployLog "Warning handling OOBE account removal: $($_.Exception.Message)" "WARN"
}
`
    : ''
}

# ------------------------------------------------------------------------------
# PHASE 3: SOFTWARE DEPLOYMENT (UNC NETWORK SHARES & WINGET)
# ------------------------------------------------------------------------------
Write-DeployLog "Phase 3: Deploying Software Packages (UNC Network Shares & Windows Package Manager Winget)..."

${targetPackages
  .map((p, i) =>
    buildPackageInstallPsBlock(p, {
      index: i,
      total: targetPackages.length,
      mode: 'master',
      extraSwitches: packageOverrides?.[p.id]?.extraSwitches,
      configFilePath: packageOverrides?.[p.id]?.configFilePath,
    })
  )
  .join('\n')}

${
  stagingConfig.enabled !== false &&
  (activeDrives.length > 0 ||
    activePrinters.length > 0 ||
    stagingConfig.customScriptText ||
    (stagingConfig.customScriptSnippets && stagingConfig.customScriptSnippets.length > 0) ||
    stagingConfig.createDesktopShortcuts ||
    stagingConfig.configureEdgeHomepage ||
    stagingConfig.showWelcomeNotification)
    ? `
# ------------------------------------------------------------------------------
# PHASE 4: USER FIRST-LOGON STAGING (NETWORK DRIVES, PRINTERS & CUSTOM SNIPPETS)
# ------------------------------------------------------------------------------
Write-DeployLog "Phase 4: Staging User First-Logon Configuration (Active Setup & Machine Printers)..."

$StagingDir = "C:\\ProgramData\\FDIM"
if (-not (Test-Path $StagingDir)) {
    New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
    Write-DeployLog "Created staging directory at $StagingDir"
}

${activePrinters
  .filter((p) => p.connectionType === 'PerMachineUNC')
  .map(
    (p) => `
# Per-Machine Printer Connection: ${p.name}
try {
    Write-DeployLog "Installing Per-Machine Printer connection: ${escapePsDoubleQuoted(p.pathOrIp)} via PrintUI (/ga)..."
    rundll32.exe printui.dll,PrintUIEntry /ga /n"${escapePsDoubleQuoted(p.pathOrIp)}"
    Write-DeployLog "Per-machine printer registered: ${escapePsDoubleQuoted(p.pathOrIp)} (visible to all users on this PC)" "SUCCESS"
} catch {
    Write-DeployLog "Warning configuring per-machine printer ${escapePsDoubleQuoted(p.pathOrIp)}: $($_.Exception.Message)" "WARN"
}
`
  )
  .join('\n')}

Write-DeployLog "Generating user logon configuration payload: $StagingDir\\UserLogonSetup.ps1..."

$UserLogonScript = @'
# ==============================================================================
# FDIM (${fdimBrandingTitle}) Staged User First-Logon Configuration Script
# Target Customer: ${customerProfile?.companyName || 'Corporate Client'}
# Triggered via Windows Active Setup & Scheduled Task upon initial user logon
# ==============================================================================
$UserLogDir = "$env:LOCALAPPDATA\\FDIM"
if (-not (Test-Path $UserLogDir)) { New-Item -ItemType Directory -Path $UserLogDir -Force | Out-Null }
$UserLogFile = "$UserLogDir\\UserLogonSetup.log"

function Write-UserLog {
    param([string]$Message, [string]$Level = "INFO")
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$ts] [$Level] $Message"
    Add-Content -Path $UserLogFile -Value $entry -Encoding UTF8
    Write-Output $entry
}

Write-UserLog "FDIM First-Logon configuration started for user: $env:USERDOMAIN\\$env:USERNAME on $env:COMPUTERNAME"

# --- 1. NETWORK DRIVE MAPPINGS ---
${activeDrives
  .map(
    (d) => `
try {
    $driveLetter = "${escapePsDoubleQuoted(d.driveLetter)}".TrimEnd(':') + ":"
    $rawUnc = "${escapePsDoubleQuoted(d.uncPath)}"
    $resolvedUnc = $rawUnc.Replace("%USERNAME%", $env:USERNAME)
    Write-UserLog "Mapping network drive $driveLetter to $resolvedUnc (${escapePsDoubleQuoted(d.label)})..."
    if (Get-PSDrive -Name ($driveLetter.TrimEnd(':')) -ErrorAction SilentlyContinue) {
        net.exe use $driveLetter /delete /yes 2>$null | Out-Null
    }
    $mapResult = net.exe use $driveLetter "$resolvedUnc" /persistent:${d.persistent !== false ? 'yes' : 'no'} 2>&1
    Write-UserLog "Drive $driveLetter successfully mapped to $resolvedUnc" "SUCCESS"
} catch {
    Write-UserLog "Error mapping network drive ${escapePsDoubleQuoted(d.driveLetter)}: $($_.Exception.Message)" "ERROR"
}
`
  )
  .join('\n')}

# --- 2. PER-USER NETWORK PRINTERS ---
${activePrinters
  .map((p) => {
    const escapedPath = escapePsDoubleQuoted(p.pathOrIp);
    if (p.connectionType === 'PerMachineUNC') {
      if (p.isDefault) {
        return `
try {
    Write-UserLog "Setting default printer to ${escapedPath}..."
    (New-Object -ComObject WScript.Network).SetDefaultPrinter("${escapedPath}")
    Write-UserLog "Default printer set to: ${escapedPath}" "SUCCESS"
} catch {
    Write-UserLog "Notice: Could not set default printer: $($_.Exception.Message)" "WARN"
}
`;
      }
      return '';
    }
    return `
try {
    Write-UserLog "Connecting per-user network printer: ${escapedPath} (${escapePsDoubleQuoted(p.name)})..."
    Add-Printer -ConnectionName "${escapedPath}" -ErrorAction Stop
    Write-UserLog "Connected printer: ${escapedPath}" "SUCCESS"
    ${
      p.isDefault
        ? `(New-Object -ComObject WScript.Network).SetDefaultPrinter("${escapedPath}")
    Write-UserLog "Default printer assigned to: ${escapedPath}" "SUCCESS"`
        : ''
    }
} catch {
    Write-UserLog "Notice connecting printer ${escapedPath}: $($_.Exception.Message)" "WARN"
}
`;
  })
  .join('\n')}

${
  stagingConfig.createDesktopShortcuts
    ? `
# --- 3. FIRST-RUN DESKTOP SHORTCUTS ---
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    $Shortcut = $WshShell.CreateShortcut("$DesktopPath\\Company IT Portal.url")
    $Shortcut.TargetPath = "${escapePsDoubleQuoted(stagingConfig.edgeHomepageUrl || 'https://portal.office.com')}"
    $Shortcut.Save()
    Write-UserLog "Created Desktop IT Portal shortcut" "SUCCESS"
} catch {
    Write-UserLog "Notice creating desktop shortcut: $($_.Exception.Message)" "WARN"
}
`
    : ''
}

${
  stagingConfig.configureEdgeHomepage
    ? `
# --- 4. CONFIGURE MICROSOFT EDGE HOMEPAGE ---
try {
    $edgeReg = "HKCU:\\Software\\Policies\\Microsoft\\Edge"
    if (-not (Test-Path $edgeReg)) { New-Item -Path $edgeReg -Force | Out-Null }
    Set-ItemProperty -Path $edgeReg -Name "HomepageLocation" -Value "${escapePsDoubleQuoted(stagingConfig.edgeHomepageUrl || 'https://portal.office.com')}" -Force
    Set-ItemProperty -Path $edgeReg -Name "RestoreOnStartup" -Value 4 -Force
    Write-UserLog "Configured Edge corporate homepage to ${escapePsDoubleQuoted(stagingConfig.edgeHomepageUrl || 'https://portal.office.com')}" "SUCCESS"
} catch {
    Write-UserLog "Notice setting Edge homepage: $($_.Exception.Message)" "WARN"
}
`
    : ''
}

${
  stagingConfig.showWelcomeNotification
    ? `
# --- 5. WELCOME USER NOTIFICATION ---
try {
    $wshell = New-Object -ComObject WScript.Shell
    $wshell.Popup("${escapePsDoubleQuoted(stagingConfig.welcomeMessage || 'Welcome to your newly provisioned workstation! Your network drives, printers, and company apps are ready.')}", 8, "FDIM Workstation Provisioning", 64) | Out-Null
    Write-UserLog "Displayed welcome user notification" "SUCCESS"
} catch {
    Write-UserLog "Notice displaying welcome popup: $($_.Exception.Message)" "WARN"
}
`
    : ''
}

# --- 6. CUSTOM FIRST-RUN POWERSHELL SCRIPT SNIPPETS ---
${(stagingConfig.customScriptSnippets || [])
  .filter((s) => s.enabled !== false && s.script)
  .map(
    (s) => `
# Snippet: ${s.name}
try {
    Write-UserLog "Executing custom first-run snippet: ${escapePsDoubleQuoted(s.name)}..."
    ${s.script}
    Write-UserLog "Custom snippet '${escapePsSingleQuoted(s.name)}' completed" "SUCCESS"
} catch {
    Write-UserLog "Error in custom snippet '${escapePsSingleQuoted(s.name)}': $($_.Exception.Message)" "ERROR"
}
`
  )
  .join('\n')}

${
  stagingConfig.customScriptText
    ? `
# Custom First-Run User Script Block
try {
    Write-UserLog "Executing custom first-run user script block..."
    ${stagingConfig.customScriptText}
    Write-UserLog "Custom first-run user script block completed" "SUCCESS"
} catch {
    Write-UserLog "Error in custom first-run script block: $($_.Exception.Message)" "ERROR"
}
`
    : ''
}

Write-UserLog "FDIM First-Logon provisioning completed for $env:USERNAME" "SUCCESS"
'@

Set-Content -Path "$StagingDir\\UserLogonSetup.ps1" -Value $UserLogonScript -Encoding UTF8 -Force
Write-DeployLog "User logon payload staged at $StagingDir\\UserLogonSetup.ps1" "SUCCESS"

# Register Windows Active Setup (Runs once for every new user who signs in)
try {
    $activeSetupKey = "HKLM:\\SOFTWARE\\Microsoft\\Active Setup\\Installed Components\\FDIM_UserProvisioning"
    Write-DeployLog "Registering Active Setup component in registry: $activeSetupKey..."
    if (-not (Test-Path $activeSetupKey)) {
        New-Item -Path $activeSetupKey -Force | Out-Null
    }
    Set-ItemProperty -Path $activeSetupKey -Name "(Default)" -Value "FDIM User Logon Provisioning (${escapePsDoubleQuoted(fdimBrandingTitle)})" -Force
    Set-ItemProperty -Path $activeSetupKey -Name "ComponentID" -Value "FDIM_UserProvisioning" -Force
    Set-ItemProperty -Path $activeSetupKey -Name "Version" -Value "1,0,0,1" -Force
    Set-ItemProperty -Path $activeSetupKey -Name "StubPath" -Value "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File \`"C:\\ProgramData\\FDIM\\UserLogonSetup.ps1\`"" -Force
    Write-DeployLog "Active Setup successfully registered. Every new user logon will execute the staged configuration." "SUCCESS"
} catch {
    Write-DeployLog "Warning setting Active Setup key: $($_.Exception.Message)" "WARN"
}

# Register Scheduled Task Backup (Trigger: AtLogOn of BUILTIN\\Users)
try {
    Write-DeployLog "Registering secondary scheduled task trigger 'FDIM-UserLogonProvisioning'..."
    $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File \`"C:\\ProgramData\\FDIM\\UserLogonSetup.ps1\`""
    $taskTrigger = New-ScheduledTaskTrigger -AtLogOn
    $taskPrincipal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\\Users" -RunLevel Limited
    $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
    Register-ScheduledTask -TaskName "FDIM-UserLogonProvisioning" -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Force -ErrorAction SilentlyContinue | Out-Null
    Write-DeployLog "Scheduled task backup registered (Runs at log on of any user)." "SUCCESS"
} catch {
    Write-DeployLog "Note on scheduled task registration: $($_.Exception.Message)" "INFO"
}
`
    : ''
}

Write-DeployLog "=========================================================="
Write-DeployLog "Workstation Provisioning Complete for ${escapePsDoubleQuoted(customerProfile?.companyName || 'Client')}!" "SUCCESS"
Write-DeployLog "All operations logged to: $MasterLog"
Write-DeployLog "=========================================================="
`;
}

// -------------------------------------------------------------
// 4. CLIENT AGENT INSTALLER & AUTONOMOUS WORKER SCRIPT
// -------------------------------------------------------------

export function generateClientAgentInstallerScript(params: {
  serverUrl: string;
  intervalMinutes: number;
  bootDelayMinutes: number;
  isSecured: boolean;
  pskToken: string;
  brandingTitle: string;
}): string {
  const { serverUrl, intervalMinutes, bootDelayMinutes, isSecured, pskToken, brandingTitle } = params;

  // Worker body kept as String.raw so Windows paths & registry keys preserve single backslashes in PowerShell
  const workerTemplate = String.raw`# ==============================================================================
# FDIM Autonomous Client Worker (Runs unattended as SYSTEM)
# ==============================================================================
$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

$ServerUrl = "__SERVER_URL__"
$AgentToken = "__AGENT_TOKEN__"
$AgentDir = "C:\ProgramData\FDIM\Agent"
$AgentHeaders = if ($AgentToken) {
    @{
        "X-FDIM-Agent-Token" = $AgentToken
        "Authorization"      = "Bearer $AgentToken"
    }
} else {
    @{}
}
$MachineName = $env:COMPUTERNAME
$Domain = $env:USERDNSDOMAIN
if (-not $Domain) { $Domain = $env:USERDOMAIN }
$LogFile = "C:\ProgramData\FDIM\Logs\AgentWorker.log"

function Write-WorkerLog {
    param([string]$Msg)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $LogFile -Value "[$ts] $Msg" -ErrorAction SilentlyContinue
}

# 1. Transport & TLS Protocol Configuration
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}

# 2. Gather Inventory & Metrics
$os = (Get-CimInstance Win32_OperatingSystem).Caption
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*", "Wi-Fi*" -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "127.0.0.1" }
$uptimeHours = [math]::Round(((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalHours, 1)

# Active interactive user if logged in
$loggedUser = (Get-CimInstance Win32_ComputerSystem).UserName

# Quick Registry Software Inventory check
$installedPkgs = @()
$regPaths = @("HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")
$regItems = Get-ItemProperty $regPaths -ErrorAction SilentlyContinue
if ($regItems -match "Chrome") { $installedPkgs += "pkg-chrome" }
if ($regItems -match "7-Zip") { $installedPkgs += "pkg-7zip" }
if ($regItems -match "TeamViewer") { $installedPkgs += "pkg-teamviewer" }
if ($regItems -match "VLC") { $installedPkgs += "pkg-vlc" }
if ($regItems -match "CrowdStrike") { $installedPkgs += "pkg-crowdstrike" }

# 3. Send Heartbeat to FDIM Server
$payload = @{
    machineName = $MachineName
    domain = $Domain
    os = $os
    ip = $ip
    currentUser = $loggedUser
    uptimeHours = $uptimeHours
    installedPackages = $installedPkgs
    agentVersion = "1.4.0"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$ServerUrl/api/agent/heartbeat" -Method Post -Body $payload -ContentType "application/json" -Headers $AgentHeaders -TimeoutSec 15
    Write-WorkerLog "Heartbeat sent successfully. Server message: $($response.message)"

    # 4. Check for Pending Tasks
    if ($response.hasTasks -and $response.pendingTasks.Count -gt 0) {
        foreach ($task in $response.pendingTasks) {
            Write-WorkerLog "Processing Task [$($task.id)]: $($task.title)"
            $taskLog = ""
            $exitCode = 0
            $success = $true

            try {
                $taskScriptUrl = "$ServerUrl/api/agent/tasks/$($task.id)/script"
                Write-WorkerLog "Fetching execution script from $taskScriptUrl"
                $scriptContent = Invoke-RestMethod -Uri $taskScriptUrl -Headers $AgentHeaders -UseBasicParsing -TimeoutSec 30

                $taskScriptPath = "$AgentDir\Task_$($task.id).ps1"
                Set-Content -Path $taskScriptPath -Value $scriptContent -Encoding UTF8 -Force

                Write-WorkerLog "Executing task script via PowerShell: $taskScriptPath"
                $proc = Start-Process -FilePath "powershell.exe" -ArgumentList @('-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', $taskScriptPath) -Wait -PassThru -NoNewWindow
                $exitCode = $proc.ExitCode
                $success = ($exitCode -eq 0 -or $exitCode -eq 3010)
                $taskLog = "Task completed with exit code: $exitCode. Success: $success."
                Remove-Item -Path $taskScriptPath -Force -ErrorAction SilentlyContinue
            } catch {
                $success = $false
                $exitCode = 1
                $taskLog = ("Error executing task: " + $_) + [Environment]::NewLine
                Write-WorkerLog $taskLog
            }

            # Report execution results back to server
            $reportPayload = @{
                status = if ($success) { "completed" } else { "failed" }
                exitCode = $exitCode
                resultLog = $taskLog
            } | ConvertTo-Json

            Invoke-RestMethod -Uri "$ServerUrl/api/agent/tasks/$($task.id)/report" -Method Post -Body $reportPayload -ContentType "application/json" -Headers $AgentHeaders
            Write-WorkerLog ("Task [" + $task.id + "] result reported: Status=" + (if ($success) { 'completed' } else { 'failed' }))
        }
    }
} catch {
    Write-WorkerLog ("Failed to connect to FDIM agent endpoint: " + $_)
}`;

  return `# ==============================================================================
# FDIM (${brandingTitle}) Client Agent Installer
# Target: Windows 10/11 Workstation
# Service: Registers 'FDIM-ClientAgent' Scheduled Task (Invisible, NT AUTHORITY\\SYSTEM)
# Triggers:
#   1. At Startup with ${bootDelayMinutes} minute delay (Network/DHCP ready)
#   2. Repeating every ${intervalMinutes} minutes indefinitely
# Server Endpoint: ${serverUrl}
# Transport Security: ${isSecured ? 'HMAC/Bearer Token Encrypted (PSK Protected)' : 'Standard'}
# ==============================================================================
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

$ServerUrl = "${escapePsDoubleQuoted(serverUrl)}"
$AgentDir = "C:\\ProgramData\\FDIM\\Agent"
$LogDir   = "C:\\ProgramData\\FDIM\\Logs"
$WorkerScript = "$AgentDir\\FDIM-ClientWorker.ps1"
$TaskName = "FDIM-ClientAgent"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "FDIM Client Agent Installation" -ForegroundColor Cyan
Write-Host "Server: $ServerUrl" -ForegroundColor Cyan
Write-Host "Heartbeat: Every ${intervalMinutes} minutes (Boot delay: ${bootDelayMinutes} min)" -ForegroundColor Cyan
${isSecured ? `Write-Host "Transport Security: Encrypted (PSK Authentication Active)" -ForegroundColor Green` : ''}
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Create Directories
if (-not (Test-Path $AgentDir)) { New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null }
if (-not (Test-Path $LogDir))   { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# 2. Write the Lightweight Client Worker PowerShell Script
$WorkerContent = @'
${workerTemplate}
'@

$WorkerContent = $WorkerContent.Replace("__SERVER_URL__", $ServerUrl).Replace("__AGENT_TOKEN__", "${escapePsDoubleQuoted(pskToken)}")
Set-Content -Path $WorkerScript -Value $WorkerContent -Encoding UTF8 -Force
Write-Host "[OK] Created Agent Worker Script at $WorkerScript" -ForegroundColor Green

# 3. Register or Re-create Windows Scheduled Task
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null

$taskArg = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File \`"$WorkerScript\`""
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArg

# Trigger 1: System Boot (Startup + Delay)
$BootTrigger = New-ScheduledTaskTrigger -AtStartup
$BootTrigger.Delay = "PT${bootDelayMinutes}M"

# Trigger 2: Repeating every X minutes
$TimeTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes ${intervalMinutes})

$Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($BootTrigger, $TimeTrigger) -Principal $Principal -Settings $Settings -Description "FDIM Client Autonomous Heartbeat & Software Deployment Agent" -Force | Out-Null

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "FDIM Client Agent installed successfully!" -ForegroundColor Green
Write-Host "Task '$TaskName' registered and running under NT AUTHORITY\\SYSTEM." -ForegroundColor Green
Write-Host "Triggering initial check-in now..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName
Write-Host "[OK] Initial heartbeat triggered." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
`;
}

// -------------------------------------------------------------
// 5. CENTRAL SERVER RUNNER DAEMON & SERVICE INSTALLER
// -------------------------------------------------------------

export function generateServerRunnerScript(
  serverUrl: string,
  pollIntervalSec: number = 30,
  _serviceAccount: string = '',
  pskToken: string = ''
): string {
  return `# ==============================================================================
# FDIM Central Server Runner Daemon (Remote WinRM / Zero-Agent Orchestrator)
# ==============================================================================
# Target Host: Central Windows Server / Management Jump Host / Domain Controller
# Polling Frequency: Every ${pollIntervalSec} seconds
# Function: Checks FDIM for new jobs, reaches out to remote clients via WinRM,
#           and provisions them unattended. Zero agent needed on client PCs!
# ==============================================================================
[CmdletBinding()]
param(
    [string]$ServerUrl = "${escapePsDoubleQuoted(serverUrl)}",
    [int]$PollIntervalSec = ${pollIntervalSec},
    [string]$AuthToken = "${escapePsDoubleQuoted(pskToken)}",
    [switch]$SingleRun = $false
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}

$RunnerId = "SRV-RUNNER-$($env:COMPUTERNAME)"
$RunnerVersion = "2.0.0-remote-orchestrator"
$TotalJobs = 0

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " FDIM Central Server Runner Daemon (Zero-Agent Remote WinRM)" -ForegroundColor Cyan
Write-Host " Server: $ServerUrl | Polling: Every $PollIntervalSec seconds" -ForegroundColor Cyan
Write-Host " Runner Host: $env:COMPUTERNAME ($RunnerId)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

$Headers = @{
    "Content-Type" = "application/json"
}
if ($AuthToken) {
    $Headers["Authorization"] = "Bearer $AuthToken"
    $Headers["X-FDIM-Agent-Token"] = $AuthToken
}

function Write-RunnerLog {
    param([string]$Message, [string]$Color = "White")
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "[$ts] $Message" -ForegroundColor $Color
}

function Report-JobResult {
    param(
        [string]$TaskId,
        [bool]$Success,
        [int]$ExitCode,
        [string]$LogOutput
    )
    try {
        $reportPayload = @{
            status = if ($Success) { "completed" } else { "failed" }
            exitCode = $ExitCode
            resultLog = $LogOutput
            executor = "Central Server Runner ($env:COMPUTERNAME)"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ServerUrl/api/agent/tasks/$TaskId/report" -Method Post -Body $reportPayload -Headers $Headers -TimeoutSec 15 | Out-Null
        Write-RunnerLog "Reported job [$TaskId] status to server: $(if ($Success) { 'COMPLETED' } else { 'FAILED' })" "Cyan"
        $script:TotalJobs++
    } catch {
        Write-RunnerLog "Failed to report task result to server: $_" "Red"
    }
}

function Execute-RemoteJob {
    param([PSCustomObject]$Task)

    $taskId = $Task.id
    $targetHost = $Task.machineName
    $taskTitle = $Task.title
    Write-RunnerLog ">> CLAIMED TASK [$taskId]: '$taskTitle' on Target Computer: [$targetHost]" "Yellow"

    try {
        $claimPayload = @{
            status = "running"
            claimedByRunner = $RunnerId
            executor = "Central Server Runner ($env:COMPUTERNAME)"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ServerUrl/api/server-runner/tasks/$taskId/claim" -Method Post -Body $claimPayload -Headers $Headers -TimeoutSec 10 | Out-Null
    } catch {
        Write-RunnerLog "Notice: Task claim acknowledged." "Gray"
    }

    $scriptUrl = "$ServerUrl/api/agent/tasks/$taskId/script"
    Write-RunnerLog "Downloading execution script from $scriptUrl..." "Cyan"
    $scriptContent = ""
    try {
        $scriptContent = Invoke-RestMethod -Uri $scriptUrl -Headers $Headers -UseBasicParsing -TimeoutSec 30
    } catch {
        $err = "Failed to download task script: $_"
        Write-RunnerLog $err "Red"
        Report-JobResult -TaskId $taskId -Success $false -ExitCode 1 -LogOutput $err
        return
    }

    Write-RunnerLog "Connecting remotely to client [$targetHost] via PowerShell Remoting (WinRM)..." "Cyan"
    $exitCode = 0
    $success = $false
    $resultLog = ""
    $startTime = Get-Date

    try {
        $remoteScriptBlock = {
            param([string]$Code)
            try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
            $OutputEncoding = [System.Text.Encoding]::UTF8
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
            try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}

            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                Invoke-Expression $Code
                $sw.Stop()
                return "Remote execution completed successfully on $env:COMPUTERNAME in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s."
            } catch {
                $sw.Stop()
                throw "Remote execution error: $_"
            }
        }

        $remoteOutput = Invoke-Command -ComputerName $targetHost -ScriptBlock $remoteScriptBlock -ArgumentList $scriptContent -ErrorAction Stop
        $elapsedSec = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
        $success = $true
        $exitCode = 0
        $resultLog = "Successfully executed on remote workstation [$targetHost] in \${elapsedSec}s.\`n" + ($remoteOutput | Out-String)
        Write-RunnerLog "++ Remote task [$taskId] completed on [$targetHost] in \${elapsedSec}s!" "Green"
    } catch {
        $elapsedSec = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
        $exitCode = 1
        $success = $false
        $errorMsg = $_.Exception.Message
        $resultLog = "Remote WinRM execution failed on [$targetHost] after \${elapsedSec}s.\`nError: $errorMsg\`nTip: Ensure target PC is powered on, reachable on LAN, and WinRM is enabled (Enable-PSRemoting -Force)."
        Write-RunnerLog "-- Remote execution failed on [$targetHost]: $errorMsg" "Red"
    }

    Report-JobResult -TaskId $taskId -Success $success -ExitCode $exitCode -LogOutput $resultLog
}

Write-RunnerLog "Starting Central Server Runner daemon. Polling every $PollIntervalSec seconds..." "Green"
do {
    try {
        $pollPayload = @{
            runnerId = $RunnerId
            hostname = $env:COMPUTERNAME
            version = $RunnerVersion
            status = "Idle"
            pollIntervalSec = $PollIntervalSec
            totalExecutedJobs = $script:TotalJobs
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$ServerUrl/api/server-runner/poll" -Method Post -Body $pollPayload -Headers $Headers -TimeoutSec 15

        if ($response.hasTasks -and $response.pendingTasks.Count -gt 0) {
            Write-RunnerLog "Discovered $($response.pendingTasks.Count) pending job(s) ready for remote client dispatch." "Magenta"
            foreach ($task in $response.pendingTasks) {
                Execute-RemoteJob -Task $task
            }
        } else {
            Write-Host -NoNewline "."
        }
    } catch {
        Write-RunnerLog "Heartbeat check error: $_" "DarkYellow"
    }

    if ($SingleRun) { break }
    Start-Sleep -Seconds $PollIntervalSec
} while ($true)
`;
}

export function generateServerRunnerServiceInstaller(
  serverUrl: string,
  pollIntervalSec: number = 30
): string {
  return `# ==============================================================================
# FDIM Central Server Runner Service Installer
# ==============================================================================
# Installs a continuous background Scheduled Task on this Windows Server:
# Task Name: "FDIM-CentralServerRunner"
# Runs as: NT AUTHORITY\\SYSTEM
# Behavior: Starts at system boot and restarts automatically if terminated
# ==============================================================================
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

$ServerUrl = "${escapePsDoubleQuoted(serverUrl)}"
$InstallDir = "C:\\ProgramData\\FDIM\\ServerRunner"
$ScriptPath = "$InstallDir\\FDIM-ServerRunner.ps1"
$TaskName = "FDIM-CentralServerRunner"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Write-Host "Downloading FDIM Central Server Runner script..." -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}

$runnerScript = Invoke-RestMethod -Uri "$ServerUrl/api/server-runner/script" -UseBasicParsing
Set-Content -Path $ScriptPath -Value $runnerScript -Encoding UTF8 -Force

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$ScriptPath\`""
$triggerBoot = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggerBoot -Principal $principal -Settings $settings -Description "FDIM Central Server Runner Daemon (Zero-Agent Remote WinRM Orchestrator)" | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " FDIM Central Server Runner Installed Successfully!" -ForegroundColor Green
Write-Host " Status: Running continuously in background" -ForegroundColor Green
Write-Host " Task Name: $TaskName" -ForegroundColor Green
Write-Host " Script Path: $ScriptPath" -ForegroundColor Green
Write-Host " Polling: Every ${pollIntervalSec} seconds" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
`;
}
