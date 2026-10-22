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
  Wifi,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'waiting_for_connection' | 'running' | 'completed' | 'failed'>('waiting_for_connection');
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'errors' | 'success'>('all');
  const [executionIdentity, setExecutionIdentity] = useState<'service_account' | 'agent_system' | 'technician'>('service_account');

  // Live session execution commands & metadata
  const [runCommand, setRunCommand] = useState('');
  const [remoteWinRmCommand, setRemoteWinRmCommand] = useState('');
  const [agentConnected, setAgentConnected] = useState(false);
  const [winrmReachable, setWinrmReachable] = useState(false);
  const [targetIp, setTargetIp] = useState<string>('');
  const [copiedRunCmd, setCopiedRunCmd] = useState(false);
  const [copiedWinRmCmd, setCopiedWinRmCmd] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isQueueingTask, setIsQueueingTask] = useState(false);
  const [taskQueuedMessage, setTaskQueuedMessage] = useState<string | null>(null);
  const [activeExecTab, setActiveExecTab] = useState<'direct' | 'winrm' | 'agent' | 'dryrun'>('direct');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize Live Session on Backend
  const initLiveSession = async () => {
    setIsInitializing(true);
    try {
      const res = await fetch('/api/deployments/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: window.location.origin,
          machineName: machineName || '$env:COMPUTERNAME',
          customerProfileId: customer.id,
          selectedPackageIds: selectedPackages.map((p) => p.id),
          packageCustomSwitches,
          packageConfigFiles,
          systemConfig,
          enabledSwitchIds,
          switchParameters,
          stagedDrives,
          stagedPrinters,
          userLogonStaging,
          deploymentType: 'QuickSoftwareInstall',
          executionMode: executionIdentity,
        }),
      });

      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        setRunCommand(data.runCommand);
        setRemoteWinRmCommand(data.remoteWinRmCommand);
        setAgentConnected(Boolean(data.agentConnected));
        setWinrmReachable(Boolean(data.winrmReachable));
        setTargetIp(data.targetIp || '');
        if (data.session) {
          setSessionStatus(data.session.status);
          setSteps(data.session.steps || []);
          setLogs(data.session.logs || []);
        }
        if (data.agentConnected) {
          setActiveExecTab('agent');
        } else if (data.winrmReachable) {
          setActiveExecTab('winrm');
        } else {
          setActiveExecTab('direct');
        }
      }
    } catch (err) {
      console.error('Error creating live deployment session:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  // Manual Queue Task (if computer is currently offline or unreachable)
  const handleQueueTaskForOffline = async () => {
    if (!sessionId) return;
    setIsQueueingTask(true);
    try {
      const res = await fetch(`/api/deployments/live/${sessionId}/queue-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setTaskQueuedMessage(data.message || `Task successfully added to Agent Queue for ${machineName}!`);
        setLogs((prev) => [
          ...prev,
          {
            timestamp: new Date().toLocaleTimeString(),
            level: 'info',
            message: `[MANUAL ACTION] Computer marked offline/unavailable. Deployment task scheduled in Agent Queue (${data.task?.id || 'ID pending'}).`,
          },
        ]);
        setTimeout(() => setTaskQueuedMessage(null), 8000);
      }
    } catch (err) {
      console.error('Error queuing task for offline computer:', err);
    } finally {
      setIsQueueingTask(false);
    }
  };

  useEffect(() => {
    initLiveSession();
  }, [machineName, customer.id, selectedPackages]);

  // 2. Poll Live Session Status from Backend
  useEffect(() => {
    if (!sessionId || isFinished) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/deployments/live/${sessionId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.session) {
          const s = data.session;
          setSessionStatus(s.status);
          if (Array.isArray(s.steps)) setSteps(s.steps);
          if (Array.isArray(s.logs)) setLogs(s.logs);

          if (s.status === 'running') {
            setIsDeploying(true);
          } else if (s.status === 'completed' || s.status === 'failed') {
            setIsFinished(true);
            setIsDeploying(false);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

            // Construct final record
            const record: DeploymentRecord = {
              id: `dep-${Date.now().toString(36)}`,
              machineName: s.machineName || machineName || '$env:COMPUTERNAME',
              domainName: customer.domainName,
              customerProfileId: customer.id,
              customerCompanyName: customer.companyName,
              deploymentType: 'QuickSoftwareInstall',
              status: s.status === 'completed' ? 'Completed' : 'Failed',
              startedAt: s.startedAt || new Date().toISOString(),
              completedAt: s.completedAt || new Date().toISOString(),
              selectedPackageIds: selectedPackages.map((p) => p.id),
              appliedSwitchIds: enabledSwitchIds,
              switchParameters,
              systemConfig,
              stagedDrives,
              stagedPrinters,
              userLogonStaging,
              technicianName: 'Admin (FDIM Live Runner)',
              logs: s.logs || logs,
              results: {
                packages: Object.fromEntries(
                  selectedPackages.map((p) => [
                    p.id,
                    { status: s.status === 'completed' ? 'success' : 'failed', exitCode: s.exitCode ?? 0 },
                  ])
                ),
                systemConfigs: Object.fromEntries(enabledSwitchIds.map((swId) => [swId, { status: 'success' }])),
              },
            };
            onCompleteDeployment(record);
          }
        }
      } catch (err) {
        console.error('Error polling live session:', err);
      }
    };

    pollIntervalRef.current = setInterval(fetchStatus, 1500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [sessionId, isFinished, customer, machineName, selectedPackages, enabledSwitchIds, switchParameters, systemConfig, stagedDrives, stagedPrinters, userLogonStaging, onCompleteDeployment]);

  // Elapsed timer when actively running
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sessionStatus === 'running' && !isPaused && !isFinished) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionStatus, isPaused, isFinished]);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Handle dry-run test simulation
  const handleStartSimulation = async () => {
    if (!sessionId) return;
    setIsSimulating(true);
    try {
      await fetch(`/api/deployments/live/${sessionId}/simulate`, { method: 'POST' });
    } catch (err) {
      console.error('Error starting simulation:', err);
    }
  };

  const handleRestart = () => {
    setIsFinished(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setLogs([]);
    initLiveSession();
  };

  const handleCopyRunCmd = () => {
    navigator.clipboard.writeText(runCommand);
    setCopiedRunCmd(true);
    setTimeout(() => setCopiedRunCmd(false), 2500);
  };

  const handleCopyWinRmCmd = () => {
    navigator.clipboard.writeText(remoteWinRmCommand);
    setCopiedWinRmCmd(true);
    setTimeout(() => setCopiedWinRmCmd(false), 2500);
  };

  const handleDownloadScript = () => {
    if (!sessionId) return;
    const link = document.createElement('a');
    link.href = `/api/deployments/live/${sessionId}/run`;
    link.download = `Deploy-${machineName || 'Workstation'}.ps1`;
    link.click();
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
            <div className="flex items-center space-x-2.5">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  sessionStatus === 'running'
                    ? 'bg-cyan-400 animate-ping'
                    : sessionStatus === 'completed'
                    ? 'bg-emerald-400'
                    : sessionStatus === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-emerald-400'
                }`}
              ></span>
              <h1 className="text-xl font-extrabold text-white">
                Workstation Provisioning Execution Cockpit
              </h1>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                  sessionStatus === 'running'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                    : sessionStatus === 'completed'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : sessionStatus === 'failed'
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}
              >
                {sessionStatus === 'waiting_for_connection'
                  ? 'Workstation Ready — Awaiting Execution'
                  : sessionStatus === 'running'
                  ? 'Live Stream Running'
                  : sessionStatus === 'completed'
                  ? 'Completed (ExitCode 0)'
                  : 'Failed'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center space-x-2 flex-wrap gap-y-1">
              <span>Target Machine:</span>
              <strong className="text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                {machineName || '$env:COMPUTERNAME'}
              </strong>
              {targetIp && targetIp !== 'Unresolved (DNS)' && (
                <span className="text-slate-400 font-mono text-[11px]">({targetIp})</span>
              )}
              <span className="text-slate-600">•</span>
              <span>Customer:</span>
              <strong className="text-white">{customer.companyName}</strong> ({customer.domainName})
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-3 self-start lg:self-auto flex-wrap gap-y-2">
            {sessionStatus === 'waiting_for_connection' && (
              <button
                onClick={handleQueueTaskForOffline}
                disabled={isQueueingTask}
                title="If this computer is currently powered off, in sleep, or off-network, click here to queue it for automatic background installation"
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 hover:text-white border border-amber-700/60 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{isQueueingTask ? 'Queuing Task...' : 'Queue Task (Computer Offline / Unavailable)'}</span>
              </button>
            )}

            <button
              onClick={handleRestart}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset & New Session</span>
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

        {taskQueuedMessage && (
          <div className="mt-4 p-3 rounded-xl bg-amber-950/50 border border-amber-600/60 text-amber-200 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{taskQueuedMessage}</span>
            </div>
            <span className="font-mono text-[11px] text-amber-300 font-bold">Scheduled in Agent Queue</span>
          </div>
        )}

        {/* Target Reachability & Remote Execution Control Panel */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-850 pb-3">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center space-x-1.5">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Remote Execution Channel</span>
              </span>
              <span className="flex items-center space-x-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                    agentConnected
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-900 text-slate-400 border-slate-750'
                  }`}
                >
                  Agent: {agentConnected ? 'Installed & Reporting' : 'Not Installed'}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                    winrmReachable
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      : 'bg-slate-900 text-slate-400 border-slate-750'
                  }`}
                >
                  WinRM (5985): {winrmReachable ? 'Open & Ready' : 'Closed / LAN Only'}
                </span>
              </span>
            </div>

            {/* Execution Channel Tabs */}
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => setActiveExecTab('direct')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  activeExecTab === 'direct'
                    ? 'bg-emerald-700 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1-Click Host Runner
              </button>
              <button
                onClick={() => setActiveExecTab('winrm')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  activeExecTab === 'winrm'
                    ? 'bg-cyan-700 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                WinRM Push
              </button>
              <button
                onClick={() => setActiveExecTab('agent')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  activeExecTab === 'agent'
                    ? 'bg-blue-700 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Client Agent
              </button>
              <button
                onClick={() => setActiveExecTab('dryrun')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  activeExecTab === 'dryrun'
                    ? 'bg-purple-700 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dry-Run Simulation
              </button>
            </div>
          </div>

          {/* Tab 1: 1-Click Host Command */}
          {activeExecTab === 'direct' && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>
                  Paste & run in an elevated (Administrator) PowerShell prompt on{' '}
                  <strong className="text-cyan-400 font-mono">{machineName || '$env:COMPUTERNAME'}</strong>:
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyRunCmd}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedRunCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRunCmd ? 'Copied Command!' : 'Copy Command'}</span>
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="px-2.5 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .ps1</span>
                  </button>
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-emerald-300 text-[11px] select-all break-all leading-relaxed">
                {runCommand || 'Generating session command...'}
              </div>
              <p className="text-[11px] text-slate-400 italic">
                * As soon as this command starts on the machine, live progress and package installers will stream into the console below in real-time.
              </p>
            </div>
          )}

          {/* Tab 2: WinRM Remote Push */}
          {activeExecTab === 'winrm' && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>
                  Push execution remotely from your administrative jump host or domain controller:
                </span>
                <button
                  onClick={handleCopyWinRmCmd}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1 cursor-pointer"
                >
                  {copiedWinRmCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWinRmCmd ? 'Copied WinRM!' : 'Copy WinRM Command'}</span>
                </button>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-cyan-300 text-[11px] select-all break-all leading-relaxed">
                {remoteWinRmCommand || 'Generating WinRM command...'}
              </div>
              <p className="text-[11px] text-slate-400">
                Requires PowerShell Remoting / WinRM enabled on target (ports 5985/5986).
              </p>
            </div>
          )}

          {/* Tab 3: Autonomous Client Agent */}
          {activeExecTab === 'agent' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center space-x-1.5">
                    <Radio className="w-4 h-4 text-blue-400" />
                    <span>Autonomous Agent & Offline Queue</span>
                  </span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold border ${
                    taskQueuedMessage
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {taskQueuedMessage ? 'Task Queued' : 'On-Demand Queue'}
                  </span>
                </div>
                <p className="text-slate-400">
                  If <strong className="text-white">{machineName}</strong> is powered off, offline, or unavailable right now,
                  click the button below to stage this software deployment in the Agent Queue. The client agent will pick it up
                  and install unattended as soon as the workstation checks in.
                </p>

                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={handleQueueTaskForOffline}
                    disabled={isQueueingTask}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{isQueueingTask ? 'Queuing Task...' : 'Queue Task (Computer Offline / Unavailable)'}</span>
                  </button>
                  {taskQueuedMessage && (
                    <span className="text-emerald-400 text-[11px] flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Task active in background queue</span>
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center space-x-2 text-[11px]">
                  <span className="text-slate-400">To trigger the agent immediately on the target workstation:</span>
                  <code className="bg-slate-950 px-2 py-0.5 rounded text-cyan-300 font-mono">
                    schtasks /run /tn "FDIM-ClientAgent"
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Dry-Run Test Simulation */}
          {activeExecTab === 'dryrun' && (
            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white">Simulate Pipeline (Dry-Run Preview)</h4>
                  <p className="text-slate-400 mt-0.5">
                    Test the workflow and terminal in the browser without modifying any target machine.
                  </p>
                </div>
                <button
                  onClick={handleStartSimulation}
                  disabled={isSimulating || sessionStatus === 'running'}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSimulating ? 'Simulating...' : 'Run Test Simulation'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar & Stats */}
        <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
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
              {steps.length} Tasks Staged
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
            {steps.map((step) => {
              const isCurrent = step.status === 'running';
              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-xl border transition-all text-xs flex items-start space-x-3 ${
                    step.status === 'success'
                      ? 'bg-emerald-950/20 border-emerald-800/60 text-slate-200'
                      : step.status === 'warn'
                      ? 'bg-amber-950/20 border-amber-800/60 text-slate-200'
                      : step.status === 'error'
                      ? 'bg-rose-950/20 border-rose-800/60 text-slate-200'
                      : isCurrent
                      ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                      : 'bg-slate-950/60 border-slate-850 text-slate-400'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {step.status === 'warn' && <AlertCircle className="w-4 h-4 text-amber-400" />}
                    {step.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
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
              # FDIM ({getFdimExpansion(showProfanity !== false)}) Live Session: {customer.companyName} [{machineName || '$env:COMPUTERNAME'}]
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
