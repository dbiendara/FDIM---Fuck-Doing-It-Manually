export interface SoftwarePackage {
  id: string;
  name: string;
  version: string;
  category: 'RemoteSupport' | 'Browser' | 'Development' | 'Productivity' | 'Communication' | 'Security' | 'Utilities';
  sourceType?: 'unc' | 'winget'; // Distribution channel: UNC network share or Windows Package Manager
  wingetId?: string; // e.g. 7zip.7zip, VideoLAN.VLC, Microsoft.Outlook
  uncPath: string;
  fileName: string;
  installerType: 'MSI' | 'InnoSetup' | 'NSIS' | 'InstallShield' | 'WiX' | 'CustomEXE' | 'PowerShellScript' | 'Winget';
  silentArgs: string;
  extraSwitches?: string; // e.g., CUSTOMCONFIGID=xxxx APITOKEN=xxxx ASSIGNMENTOPTIONS="--alias %COMPUTERNAME%"
  configFileImport?: {
    enabled: boolean;
    configFileName: string; // e.g., TeamViewer_Settings.tvopt
    configUncPath: string; // e.g., \\corp-fs01\deployments\teamviewer\TeamViewer_Settings.tvopt
    importSwitch?: string; // e.g., SETTINGSFILE="<CONFIG_PATH>"
    preCopyDestination?: string; // e.g., C:\Program Files\TeamViewer\
  };
  logArgs?: string;
  rebootBehavior: 'Suppress' | 'Prompt' | 'Allow';
  detectionType: 'Registry' | 'FilePath' | 'PowerShellCheck';
  detectionRule: string;
  successExitCodes: number[];
  estimatedMinutes: number;
  description: string;
  testInstallStatus?: 'Verified' | 'Untested' | 'Failed';
  aiConfidence?: number;
  notes?: string;
}

export interface NetworkDriveMapping {
  id: string;
  driveLetter: string; // e.g., "S:", "P:", "H:"
  uncPath: string; // e.g., "\\corp-fs01\Shares\Logistics", "\\corp-fs01\Users\%USERNAME%"
  label: string; // e.g., "Department Shared Documents", "Personal Home Folder"
  persistent?: boolean; // Default true
  enabled?: boolean; // Active toggle for this PC deployment
}

export interface PrinterMapping {
  id: string;
  name: string; // e.g., "Office Floor 1 Canon MFP"
  connectionType: 'PerMachineUNC' | 'UserLogonUNC' | 'DirectIP'; // PerMachine via printui /ga or UserLogon via Active Setup
  pathOrIp: string; // e.g., "\\corp-print01\ACME-Color-MFP" or "192.168.1.50"
  driverName?: string;
  isDefault?: boolean;
  comment?: string;
  enabled?: boolean; // Active toggle for this PC deployment
}

export interface UserLogonStagingSnippet {
  id: string;
  name: string;
  description?: string;
  category?: 'Outlook & Mail' | 'Browser & Web' | 'Shortcuts & Desktop' | 'OneDrive & Cloud' | 'Security & Policies' | 'Custom' | string;
  script: string;
  enabled: boolean;
  author?: string;
  tags?: string[];
  isGlobalTemplate?: boolean;
  updatedAt?: string;
}

export interface UserLogonStagingConfig {
  enabled: boolean;
  stagingPath?: string; // Default: "C:\ProgramData\FDIM\UserLogonSetup.ps1"
  activeSetupKey?: string; // Default: "FDIM_UserProvisioning"
  scheduledTaskFallback?: boolean; // Register at-logon task as backup
  cleanUpAfterFirstRun?: boolean;
  // First-run enhancements & custom script snippets
  customScriptText?: string; // Custom PowerShell code executed at user logon
  customScriptSnippets?: UserLogonStagingSnippet[];
  createDesktopShortcuts?: boolean;
  configureEdgeHomepage?: boolean;
  edgeHomepageUrl?: string;
  enableDarkTheme?: boolean;
  showWelcomeNotification?: boolean;
  welcomeMessage?: string;
}

export interface CustomerProfile {
  id: string;
  companyName: string;
  customerCode: string;
  domainName: string;
  defaultAdAdminGroup: string;
  uncShareRoot: string;
  enableRdp: boolean;
  powerPlanSettings?: {
    enabled?: boolean;
    screenTimeoutAc: number;
    standbyTimeoutAc: number;
    screenTimeoutDc?: number; // Battery monitor timeout
    standbyTimeoutDc?: number; // Battery standby timeout
    hibernateTimeoutDc?: number; // Battery hibernate timeout
  };
  localAdminSettings?: {
    enableLocalAdmin: boolean;
    defaultPassword?: string;
    adminPasswordNeverExpires?: boolean;
    deleteOobeAccount: boolean;
    defaultOobeAccountName?: string;
    removeOobeProfile?: boolean;
  };
  packageIds: string[]; // Default software packages assigned to this customer
  packageCustomSwitches?: Record<string, string>; // packageId -> extra switches override
  packageConfigFiles?: Record<string, string>; // packageId -> config file path override
  // First-Logon Staged User Settings (Network Drives & Printers)
  networkDrives?: NetworkDriveMapping[];
  printers?: PrinterMapping[];
  userLogonStaging?: UserLogonStagingConfig;
  notes?: string;
}

export interface SystemConfigSwitch {
  id: string;
  key: string;
  title: string;
  description: string;
  category: 'RemoteAccess' | 'Security' | 'Power' | 'Network' | 'Optimization' | 'Custom';
  powershellCommand: string;
  hasParameter?: boolean;
  parameterKey?: string; // e.g. "adAdminGroupName", "screenTimeoutAc", "standbyTimeoutAc", "screenTimeoutDc", "standbyTimeoutDc"
  parameterType?: 'text' | 'number' | 'select';
  parameterLabel?: string;
  parameterDefaultValue?: string | number;
  parameterOptions?: Array<{ label: string; value: string | number }>;
  enabledByDefault: boolean;
  isRemovable: boolean;
}

export interface SystemConfigSettings {
  enableRdp: boolean;
  addAdGroupToAdmins: boolean;
  adAdminGroupName: string;
  setPowerPlan: boolean;
  screenTimeoutAc: number;
  standbyTimeoutAc: number;
  screenTimeoutDc?: number;
  standbyTimeoutDc?: number;
  hibernateTimeoutDc?: number;
  // Local Administrator Account Management
  enableLocalAdmin?: boolean;
  localAdminPassword?: string;
  adminPasswordNeverExpires?: boolean;
  // Temporary Windows OOBE Setup Account Cleanup
  deleteOobeAccount?: boolean;
  oobeAccountName?: string; // Default: 'install'
  removeOobeProfile?: boolean; // Default: true
}

export interface ComputerInstallationHistoryItem {
  id: string;
  machineName: string;
  packageName: string;
  packageVersion: string;
  category?: string;
  installedAt: string;
  method: 'FDIM Staging' | 'Quick Deploy' | 'Agent Task' | 'Winget' | 'ODT Click-to-Run';
  status: 'Success' | 'Failed';
  exitCode?: number;
  technician: string;
  deploymentRecordId?: string;
}

export interface ActiveSystemConfigState {
  enabledSwitchIds: string[];
  parameterValues: Record<string, string | number>; // switchKey or parameterKey -> value
}

export interface DeploymentRecord {
  id: string;
  machineName: string;
  domainName: string;
  customerProfileId: string;
  customerCompanyName: string;
  deploymentType?: 'FullStaging' | 'QuickSoftwareInstall';
  status: 'In Progress' | 'Completed' | 'Failed';
  startedAt: string;
  completedAt?: string;
  selectedPackageIds: string[];
  appliedSwitchIds?: string[];
  switchParameters?: Record<string, string | number>;
  systemConfig?: SystemConfigSettings;
  stagedDrives?: NetworkDriveMapping[];
  stagedPrinters?: PrinterMapping[];
  userLogonStaging?: UserLogonStagingConfig;
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;
  results: {
    packages: Record<string, { status: 'success' | 'failed' | 'skipped'; exitCode?: number; log?: string }>;
    systemConfigs: Record<string, { status: 'success' | 'failed' | 'skipped'; log?: string }>;
  };
  technicianName: string;
}

export interface CorporateColorsConfig {
  primaryColor?: string; // Hex color code, e.g. "#06b6d4" or "#0284c7"
  secondaryColor?: string; // Hex color code, e.g. "#2563eb" or "#10b981"
  companyBrandName?: string; // e.g. "FDIM Enterprise Workstation Suite"
  themeMode?: 'dark-cyan' | 'dark-blue' | 'dark-emerald' | 'dark-indigo' | 'dark-purple' | 'custom';
  customCssVarEnabled?: boolean;
}

export interface AppSettings {
  initialSetupCompleted?: boolean;
  setupCompletedAt?: string;
  defaultGlobalDomain: string;
  authMode: 'local' | 'active_directory' | 'keycloak';
  adLdapConfig: {
    ldapUrl: string;
    domain: string;
    baseDn: string;
    bindDn: string;
    bindPassword?: string;
    userSearchFilter: string;
    adminGroup: string;
    computerSearchOu?: string;
  };
  keycloakConfig: {
    serverUrl: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  runnerServiceAccount: {
    enabled: boolean;
    username: string; // e.g. "CORP\svc_fdim_runner"
    domain: string;
    description: string;
    delegatedHelpdeskAllowed: boolean;
  };
  proxmoxConfig: {
    enabled: boolean;
    apiUrl: string; // e.g. "https://pve01.corp.internal:8006/api2/json"
    node: string; // e.g. "pve-node1"
    vmTemplateId: number; // e.g. 9000
    cleanSnapshotName: string; // e.g. "clean-baseline"
    autoRollback: boolean;
  };
  agentConfig: {
    heartbeatIntervalMinutes: number; // e.g. 30
    bootDelayMinutes: number; // e.g. 5
    serverUrl: string; // e.g. "http://fdim.corp.internal:3000"
    encryptionMode?: 'none' | 'token-bearer' | 'hmac-sha256';
    preSharedKey?: string; // 256-bit agent secret key / PSK
    enforceHttps?: boolean;
  };
  corporateColors?: CorporateColorsConfig;
  geminiConfig?: {
    enabled: boolean;
    hasApiKey: boolean;
    model?: string;
    message?: string;
  };
}

export interface ADComputer {
  id: string;
  name: string; // NetBIOS name, e.g. "WS-FINANCE-01"
  fqdn?: string; // FQDN, e.g. "ws-finance-01.corp.internal.net"
  dnsHostName?: string;
  domain?: string;
  osName?: string;
  osBuild?: string;
  operatingSystem?: string; // e.g. "Windows 11 Pro 23H2"
  ouPath: string; // e.g. "OU=Finance,OU=Workstations,DC=corp,DC=internal,DC=net"
  ipAddress: string;
  macAddress?: string;
  status: 'Online' | 'Offline' | 'AgentConnected';
  pingMs?: number | null;
  lastSeen: string;
  agentInstalled?: boolean;
  agentStatus?: 'Installed' | 'Not Installed' | 'Outdated';
  agentVersion?: string | null;
  lastHeartbeat?: string;
  lastAgentHeartbeat?: string | null;
  loggedInUser?: string | null;
  hardwareModel?: string;
  ramGb?: number;
  diskFreeGb?: number;
  installedPackageIds?: string[];
  customerProfileId: string;
  description?: string;
  currentUser?: string;
  uptimeHours?: number;
}

export interface QueuedTask {
  id: string;
  machineName: string;
  taskType: 'SoftwareInstall' | 'SoftwareUpdate' | 'FullProvisioning' | 'ConfigSwitch' | 'ComplianceScan' | 'CustomScript' | 'AgentInstall' | 'SoftwareDeploy';
  title: string;
  status: 'queued' | 'dispatching' | 'running' | 'completed' | 'failed' | 'cancelled' | 'Queued' | 'Completed' | 'Failed';
  payload: {
    packageIds?: string[];
    customerProfileId?: string;
    customSwitches?: Record<string, string>;
    configFiles?: Record<string, string>;
    switchIds?: string[];
    switchParameters?: Record<string, string | number>;
    command?: string;
    customScript?: string;
  };
  executionMode: 'agent_system' | 'service_account' | 'interactive';
  serviceAccount?: string;
  createdAt: string;
  dispatchedAt?: string;
  completedAt?: string;
  resultLog?: string;
  exitCode?: number;
  createdBy: string;
  retryCount?: number;
  maxRetries?: number;
  claimedByRunner?: string;
  executor?: string;
}

export interface ServerRunnerInfo {
  runnerId: string;
  hostname: string;
  ipAddress?: string;
  version: string;
  status: 'Online' | 'Busy' | 'Idle' | 'Offline';
  lastPoll: string;
  pollIntervalSec: number;
  activeJobsCount: number;
  totalExecutedJobs: number;
  serviceAccount?: string;
}

export interface PackageSandboxTest {
  id: string;
  packageId: string;
  packageName: string;
  environmentType: 'proxmox' | 'hyperv' | 'local_sandbox';
  proxmoxConfig?: {
    node: string;
    vmId: number;
    templateName: string;
    snapshotName: string;
    autoRollback: boolean;
  };
  status: 'running' | 'passed' | 'failed' | 'rolled_back';
  startedAt: string;
  completedAt?: string;
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;
  exitCode?: number;
  detectionVerified: boolean;
  rollbackExecuted: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  domain?: string;
  role: 'Administrator' | 'Technician' | 'Operator';
  authProvider: 'local' | 'active_directory' | 'keycloak';
  avatarInitials?: string;
  showProfanity?: boolean; // User preference: true = "Fuck Doing It Manually", false = "Forget Doing It Manually"
  passwordHash?: string; // Hashed password (managed server-side)
}

export interface AIDetectionResult {
  installerType: 'MSI' | 'InnoSetup' | 'NSIS' | 'InstallShield' | 'WiX' | 'CustomEXE' | 'PowerShellScript';
  silentArgs: string;
  extraSwitches?: string;
  configFileAdvice?: string;
  logArgs?: string;
  rebootBehavior: 'Suppress' | 'Prompt' | 'Allow';
  successExitCodes: number[];
  detectionType: 'Registry' | 'FilePath' | 'PowerShellCheck';
  detectionRule: string;
  estimatedMinutes: number;
  category: 'RemoteSupport' | 'Browser' | 'Development' | 'Productivity' | 'Communication' | 'Security' | 'Utilities';
  prerequisites: string[];
  confidenceScore: number;
  analysisExplanation: string;
  powershellSnippet: string;
}

export interface AITestInstallResult {
  verdict: 'PASS' | 'WARN' | 'FAIL';
  confidenceScore: number;
  summary: string;
  hangingRisks: string[];
  simulatedTimeline: Array<{
    step: string;
    durationSec: number;
    status: string;
    logOutput: string;
  }>;
  recommendedTweaks?: string[];
}

