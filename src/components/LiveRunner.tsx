import React, { useState, useEffect, useRef } from 'react';
import {
  SoftwarePackage,
  CustomerProfile,
  SystemConfigSettings,
  SystemConfigSwitch,
  DeploymentRecord,
  NetworkDriveMapping,
  PrinterMapping,
  UserLogonStagingConfig,
} from '../types';
import {
  Terminal,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Building2,
  Shield,
  FileText,
  Download,
  Copy,
  Check,
  Server,
  Layers,
  Sparkles,
  Award,
  Sliders,
  FolderOpen,
  Circle,
  Printer,
  UserCheck,
  Radio,
} from 'lucide-react';
import { getFdimExpansion } from '../utils/branding';

interface LiveRunnerProps {
  isDeploying: boolean;
  setIsDeploying: (val: boolean) => void;
  machineName: string;
  customer: CustomerProfile;
  selectedPackages: SoftwarePackage[];
  packageCustomSwitches: Record<string, string>;
  packageConfigFiles: Record<string, string>;
  systemConfig: SystemConfigSettings;
  systemSwitches?: SystemConfigSwitch[];
  enabledSwitchIds?: string[];
  switchParameters?: Record<string, string | number>;
  stagedDrives?: NetworkDriveMapping[];
  stagedPrinters?: PrinterMapping[];
  userLogonStaging?: UserLogonStagingConfig;
  onCompleteDeployment: (record: DeploymentRecord) => void;
  onOpenAuditModal: () => void;
  showProfanity?: boolean;
}

interface StepItem {
  id: string;
  type: 'preflight' | 'system' | 'package' | 'logon-staging' | 'postflight';
  title: string;
  subtext: string;
  status: 'pending' | 'running' | 'success' | 'warn' | 'error';
  logLines: string[];
}

export const LiveRunner: React.FC<LiveRunnerProps> = ({
  isDeploying,
  setIsDeploying,
  machineName,
  customer,
  selectedPackages,
  packageCustomSwitches,
  packageConfigFiles,
  systemConfig,
  systemSwitches = [],
  enabledSwitchIds = [],
  switchParameters = {},
  stagedDrives = [],
  stagedPrinters = [],
  userLogonStaging = { enabled: true },
  onCompleteDeployment,
  onOpenAuditModal,
  showProfanity = true,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'errors' | 'success'>('all');
  const [executionIdentity, setExecutionIdentity] = useState<'service_account' | 'agent_system' | 'technician'>('service_account');

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Initialize pipeline steps
  useEffect(() => {
    const initialSteps: StepItem[] = [];

    // Pre-flight checks
    initialSteps.push({
      id: 'step-preflight-ad',
      type: 'preflight',
      title: 'Active Directory Domain Membership Verification',
      subtext: `Validating PartOfDomain for ${customer.domainName}`,
      status: 'pending',
      logLines: [],
    });
    initialSteps.push({
      id: 'step-preflight-unc',
      type: 'preflight',
      title: 'UNC Network Share Reachability',
      subtext: 'Testing SMB port 445 connectivity to deployment shares',
      status: 'pending',
      logLines: [],
    });

    // Dynamic or fallback system configurations
    if (systemSwitches.length > 0 && enabledSwitchIds.length > 0) {
      const activeSwitches = systemSwitches.filter((s) => enabledSwitchIds.includes(s.id));
      activeSwitches.forEach((sw) => {
        let sub = sw.description;
        if (sw.parameterKey && switchParameters[sw.parameterKey] !== undefined) {
          sub += ` [${sw.parameterKey} = ${switchParameters[sw.parameterKey]}]`;
        }
        initialSteps.push({
          id: `step-sys-${sw.id}`,
          type: 'system',
          title: sw.title,
          subtext: sub,
          status: 'pending',
          logLines: [],
        });
      });
    } else {
      // Legacy fallback
      if (systemConfig.enableRdp) {
        initialSteps.push({
          id: 'step-sys-sw-rdp',
          type: 'system',
          title: 'Enable Remote Desktop (RDP) & Firewall',
          subtext: 'Configures fDenyTSConnections=0 and NLA user authentication',
          status: 'pending',
          logLines: [],
        });
      }
      if (systemConfig.addAdGroupToAdmins && systemConfig.adAdminGroupName) {
        initialSteps.push({
          id: 'step-sys-sw-adgroup',
          type: 'system',
          title: `Add AD Group to Local Administrators`,
          subtext: `Delegates admin rights to ${systemConfig.adAdminGroupName}`,
          status: 'pending',
          logLines: [],
        });
      }
      if (systemConfig.setPowerPlan) {
        initialSteps.push({
          id: 'step-sys-sw-power-screen',
          type: 'system',
          title: 'Configure Power Plan Timeouts',
          subtext: `Screen: ${systemConfig.screenTimeoutAc}m, Standby: ${systemConfig.standbyTimeoutAc === 0 ? 'Never' : `${systemConfig.standbyTimeoutAc}m`}`,
          status: 'pending',
          logLines: [],
        });
      }
      if (systemConfig.enableLocalAdmin !== false) {
        initialSteps.push({
          id: 'step-sys-sw-local-admin',
          type: 'system',
          title: 'Enable Local Administrator & Set Password',
          subtext: 'Enables built-in Administrator (SID *-500) and sets secure administrator password',
          status: 'pending',
          logLines: [],
        });
      }
      if (systemConfig.deleteOobeAccount !== false) {
        const oobeName = systemConfig.oobeAccountName || 'install';
        initialSteps.push({
          id: 'step-sys-sw-delete-oobe',
          type: 'system',
          title: `Delete Temporary OOBE Setup Account ('${oobeName}')`,
          subtext: `Purges temporary '${oobeName}' account and removes its user profile from C:\\Users`,
          status: 'pending',
          logLines: [],
        });
      }
    }

    // Software packages
    selectedPackages.forEach((pkg) => {
      const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);
      const extra = packageCustomSwitches[pkg.id] || pkg.extraSwitches;
      const config = packageConfigFiles[pkg.id] || pkg.configFileImport?.configFileName;
      
      let sub = isWinget
        ? `winget install --id "${pkg.wingetId || pkg.fileName}" --silent`
        : `${pkg.uncPath}\\${pkg.fileName}`;
      if (extra) sub += ` [Extra switches active]`;
      if (config) sub += ` [Config: ${config}]`;

      initialSteps.push({
        id: `step-pkg-${pkg.id}`,
        type: 'package',
        title: isWinget ? `Winget Install: ${pkg.name}` : `Silent Install: ${pkg.name}`,
        subtext: sub,
        status: 'pending',
        logLines: [],
      });
    });

    // Staged User First-Logon Setup (Network Drives & Printers via Active Setup)
    if (userLogonStaging?.enabled !== false && (stagedDrives.length > 0 || stagedPrinters.length > 0)) {
      const driveList = stagedDrives.map((d) => d.driveLetter).join(', ');
      initialSteps.push({
        id: 'step-user-first-logon-staging',
        type: 'logon-staging',
        title: 'Stage User First-Logon Setup (Active Setup & Machine Printers)',
        subtext: `Staging ${stagedDrives.length} drives (${driveList || 'none'}) and ${stagedPrinters.length} printers for new user first logon`,
        status: 'pending',
        logLines: [],
      });
    }

    // Post-flight
    initialSteps.push({
      id: 'step-postflight-audit',
      type: 'postflight',
      title: 'Workstation Verification & Handover Signoff',
      subtext: `Certifying setup compliance for ${customer.companyName}`,
      status: 'pending',
      logLines: [],
    });

    setSteps(initialSteps);
  }, [
    selectedPackages,
    systemConfig,
    customer,
    packageCustomSwitches,
    packageConfigFiles,
    systemSwitches,
    enabledSwitchIds,
    switchParameters,
    stagedDrives,
    stagedPrinters,
    userLogonStaging,
  ]);

  // Elapsed timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isDeploying && !isPaused && !isFinished) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isDeploying, isPaused, isFinished]);

  // Execution simulation engine
  useEffect(() => {
    if (!isDeploying || isPaused || isFinished || steps.length === 0) return;

    if (currentStepIndex >= steps.length) {
      setIsFinished(true);
      setIsDeploying(false);

      const record: DeploymentRecord = {
        id: `dep-${Date.now().toString(36)}`,
        machineName: machineName || '$env:COMPUTERNAME',
        domainName: customer.domainName,
        customerProfileId: customer.id,
        customerCompanyName: customer.companyName,
        status: 'Completed',
        startedAt: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        completedAt: new Date().toISOString(),
        selectedPackageIds: selectedPackages.map((p) => p.id),
        appliedSwitchIds: enabledSwitchIds,
        switchParameters,
        systemConfig,
        stagedDrives,
        stagedPrinters,
        userLogonStaging,
        technicianName: 'Admin (FDIM Suite)',
        logs,
        results: {
          packages: Object.fromEntries(selectedPackages.map((p) => [p.id, { status: 'success', exitCode: 0 }])),
          systemConfigs: Object.fromEntries(enabledSwitchIds.map((swId) => [swId, { status: 'success' }])),
        },
      };

      onCompleteDeployment(record);
      return;
    }

    const currentStep = steps[currentStepIndex];

    setSteps((prev) =>
      prev.map((step, idx) => (idx === currentStepIndex ? { ...step, status: 'running' } : step))
    );

    const timeStr = new Date().toLocaleTimeString();
    const startMsg = `[${timeStr}] [INFO] Executing step [${currentStepIndex + 1}/${steps.length}]: ${currentStep.title}...`;
    setLogs((prev) => [...prev, { timestamp: timeStr, level: 'info', message: startMsg }]);

    let stepTime = 1200;
    if (currentStep.type === 'package') stepTime = 1800;
    if (currentStep.type === 'preflight') stepTime = 700;

    const timeout = setTimeout(() => {
      const finishTimeStr = new Date().toLocaleTimeString();
      let successMsg = `[${finishTimeStr}] [SUCCESS] Completed: ${currentStep.title} (ExitCode 0)`;

      if (currentStep.id.startsWith('step-sys-')) {
        const swId = currentStep.id.replace('step-sys-', '');
        const matchingSwitch = systemSwitches.find((s) => s.id === swId);
        if (swId === 'sw-rdp') {
          successMsg = `[${finishTimeStr}] [SUCCESS] RDP enabled with NLA and Windows Firewall rule verified.`;
        } else if (swId === 'sw-adgroup') {
          const adGroup = switchParameters?.adAdminGroupName || systemConfig.adAdminGroupName;
          successMsg = `[${finishTimeStr}] [SUCCESS] Delegated Local Administrators to AD group [${adGroup}].`;
        } else if (swId === 'sw-power-screen' || swId === 'sw-power-standby') {
          const scr = switchParameters?.screenTimeoutAc ?? systemConfig.screenTimeoutAc;
          const stb = switchParameters?.standbyTimeoutAc ?? systemConfig.standbyTimeoutAc;
          successMsg = `[${finishTimeStr}] [SUCCESS] Power plan active: Screen timeout ${scr}m, Standby ${stb}m.`;
        } else if (swId === 'sw-local-admin') {
          successMsg = `[${finishTimeStr}] [SUCCESS] Built-in local Administrator enabled (SID *-500) and secure password configured (PasswordNeverExpires=True).`;
        } else if (swId === 'sw-delete-oobe') {
          const oobeName = switchParameters?.oobeAccountName || systemConfig.oobeAccountName || 'install';
          successMsg = `[${finishTimeStr}] [SUCCESS] Temporary OOBE setup account [${oobeName}] expunged and user profile directory purged.`;
        } else if (matchingSwitch) {
          successMsg = `[${finishTimeStr}] [SUCCESS] Applied custom task: ${matchingSwitch.title}.`;
        }
      } else if (currentStep.type === 'package') {
        const pkg = selectedPackages.find((p) => `step-pkg-${p.id}` === currentStep.id);
        if (pkg) {
          const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);
          const extra = packageCustomSwitches[pkg.id] || pkg.extraSwitches || '';
          if (isWinget) {
            successMsg = `[${finishTimeStr}] [SUCCESS] Winget installation verified: ${pkg.name} (winget install --id "${pkg.wingetId || pkg.fileName}" -e)`;
          } else {
            successMsg = `[${finishTimeStr}] [SUCCESS] UNC silent install verified: ${pkg.name} ${extra ? `[Extra switches: ${extra}]` : ''}`;
          }
        }
      } else if (currentStep.type === 'logon-staging') {
        const dCount = stagedDrives.length;
        const pCount = stagedPrinters.length;
        successMsg = `[${finishTimeStr}] [SUCCESS] Active Setup registered (HKLM) & payload staged (C:\\ProgramData\\FDIM\\UserLogonSetup.ps1). ${dCount} network drive(s) and ${pCount} printer(s) will map seamlessly upon initial user logon!`;
      }

      setLogs((prev) => [...prev, { timestamp: finishTimeStr, level: 'success', message: successMsg }]);

      setSteps((prev) =>
        prev.map((step, idx) => (idx === currentStepIndex ? { ...step, status: 'success' } : step))
      );

      setCurrentStepIndex((prev) => prev + 1);
    }, stepTime);

    return () => clearTimeout(timeout);
  }, [isDeploying, isPaused, isFinished, currentStepIndex, steps.length]);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRestart = () => {
    setCurrentStepIndex(0);
    setIsFinished(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setLogs([]);
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'pending' })));
    setIsDeploying(true);
  };

  const completedStepsCount = steps.filter((s) => s.status === 'success').length;
  const progressPercent = steps.length > 0 ? Math.round((completedStepsCount / steps.length) * 100) : 0;

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'errors') return log.level === 'error';
    if (logFilter === 'success') return log.level === 'success';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Cockpit Status Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${isDeploying ? 'bg-emerald-400 animate-ping' : isFinished ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              <h1 className="text-xl font-extrabold text-white">
                Workstation Provisioning Execution Cockpit
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Target Machine: <strong className="text-cyan-400 font-mono">{machineName || '$env:COMPUTERNAME'}</strong> • Customer:{' '}
              <strong className="text-white">{customer.companyName}</strong> ({customer.domainName})
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-3 self-start lg:self-auto">
            {!isFinished && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isPaused
                    ? 'bg-emerald-950 border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4 fill-emerald-300" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Resume Pipeline' : 'Pause Pipeline'}</span>
              </button>
            )}

            <button
              onClick={handleRestart}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rerun Pipeline</span>
            </button>

            {isFinished && (
              <button
                onClick={onOpenAuditModal}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>View Compliance Certificate</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Overall Provisioning Progress</span>
              <span className="font-mono text-cyan-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Step Status:</span>
            <span className="font-mono text-slate-200 font-bold">
              {completedStepsCount} / {steps.length} Steps
            </span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Elapsed Time:</span>
            <span className="font-mono text-emerald-400 font-bold">
              {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
            </span>
          </div>
        </div>

        {/* Execution Identity & Helpdesk Delegation Bar */}
        <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-200">Execution Identity:</span>
            <span className="text-slate-400 hidden md:inline">
              (Delegated service account for Helpdesk staff without local administrative rights)
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setExecutionIdentity('service_account')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all ${
                executionIdentity === 'service_account'
                  ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title="Runs under configured Service Account (CORP\svc_fdim_runner)"
            >
              CORP\svc_fdim_runner (Delegated)
            </button>
            <button
              onClick={() => setExecutionIdentity('agent_system')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all ${
                executionIdentity === 'agent_system'
                  ? 'bg-blue-950 border border-blue-700 text-blue-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title="Dispatched to client agent running as NT AUTHORITY\SYSTEM"
            >
              Client Agent (SYSTEM)
            </button>
            <button
              onClick={() => setExecutionIdentity('technician')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all ${
                executionIdentity === 'technician'
                  ? 'bg-cyan-950 border border-cyan-700 text-cyan-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title="Runs under current technician interactive token"
            >
              Technician Token
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Pipeline Step Timeline (Left) & Realtime PowerShell Terminal (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pipeline Execution Steps (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col max-h-[640px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Deployment Task Pipeline</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {steps.length} Tasks Queued
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
            {steps.map((step, idx) => {
              const isCurrent = idx === currentStepIndex && isDeploying;
              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-xl border transition-all text-xs flex items-start space-x-3 ${
                    step.status === 'success'
                      ? 'bg-emerald-950/20 border-emerald-800/60 text-slate-200'
                      : isCurrent
                      ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                      : 'bg-slate-950/60 border-slate-850 text-slate-400'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {isCurrent && (
                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {step.status === 'pending' && <Circle className="w-4 h-4 text-slate-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`font-semibold truncate ${isCurrent ? 'text-cyan-300' : 'text-white'}`}>
                        {step.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">
                        {step.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate font-mono">{step.subtext}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live PowerShell Console Stream (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col max-h-[640px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Live PowerShell Execution Stream</h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(logs.map((l) => l.message).join('\n'));
                  setCopiedLog(true);
                  setTimeout(() => setCopiedLog(false), 2000);
                }}
                className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1 cursor-pointer"
              >
                {copiedLog ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLog ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Console Container */}
          <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-xs overflow-y-auto leading-relaxed space-y-1.5 selection:bg-cyan-600 selection:text-white">
            <div className="text-slate-500 pb-1 border-b border-slate-850">
              # FDIM ({getFdimExpansion(showProfanity !== false)}) Deployment Session: {customer.companyName} [{machineName || '$env:COMPUTERNAME'}]
            </div>

            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`${
                  log.level === 'success'
                    ? 'text-emerald-400'
                    : log.level === 'warn'
                    ? 'text-yellow-400'
                    : log.level === 'error'
                    ? 'text-red-400'
                    : 'text-cyan-300/90'
                }`}
              >
                {log.message}
              </div>
            ))}

            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
