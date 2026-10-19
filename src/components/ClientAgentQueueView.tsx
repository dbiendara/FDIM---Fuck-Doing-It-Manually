import React, { useState, useEffect } from 'react';
import {
  ADComputer,
  QueuedTask,
  CustomerProfile,
  SoftwarePackage,
} from '../types';
import {
  Radio,
  Clock,
  Play,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Terminal,
  Activity,
  UserCheck,
  Plus,
  Send,
  Layers,
  HardDrive,
  RefreshCw,
  Cpu,
  Monitor,
  ShieldCheck,
  Shield,
  FileText,
} from 'lucide-react';

interface ClientAgentQueueViewProps {
  customers: CustomerProfile[];
  packages: SoftwarePackage[];
}

export const ClientAgentQueueView: React.FC<ClientAgentQueueViewProps> = ({
  customers,
  packages,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'agents'>('queue');
  const [tasks, setTasks] = useState<QueuedTask[]>([]);
  const [computers, setComputers] = useState<ADComputer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaskLog, setSelectedTaskLog] = useState<QueuedTask | null>(null);

  // New task modal
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [targetMachine, setTargetMachine] = useState('');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<QueuedTask['taskType']>('SoftwareInstall');
  const [taskExecutionMode, setTaskExecutionMode] = useState<'agent_system' | 'service_account'>('agent_system');

  // Installer script generator
  const [serverUrl, setServerUrl] = useState(() => `${window.location.protocol}//${window.location.hostname}:3000`);
  const [heartbeatInterval, setHeartbeatInterval] = useState(30);
  const [bootDelay, setBootDelay] = useState(5);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [agentEncryption, setAgentEncryption] = useState<{ mode: string; isSecured: boolean }>({
    mode: 'none',
    isSecured: false,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, compsRes, settingsRes] = await Promise.all([
        fetch('/api/agent/tasks'),
        fetch('/api/ad-computers'),
        fetch('/api/settings').catch(() => null),
      ]);
      const tasksData = await tasksRes.json();
      const compsData = await compsRes.json();
      setTasks(tasksData);
      setComputers(compsData);

      if (settingsRes && settingsRes.ok) {
        const sets = await settingsRes.json();
        if (sets?.agentConfig) {
          const isSec = sets.agentConfig.encryptionMode && sets.agentConfig.encryptionMode !== 'none';
          setAgentEncryption({
            mode: sets.agentConfig.encryptionMode || 'none',
            isSecured: Boolean(isSec),
          });
          if (sets.agentConfig.serverUrl) setServerUrl(sets.agentConfig.serverUrl);
          if (sets.agentConfig.heartbeatIntervalMinutes) setHeartbeatInterval(sets.agentConfig.heartbeatIntervalMinutes);
          if (sets.agentConfig.bootDelayMinutes) setBootDelay(sets.agentConfig.bootDelayMinutes);
        }
      }
    } catch (err) {
      console.error('Error fetching agent & task data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 8 seconds to reflect heartbeats & task progress
    const timer = setInterval(fetchData, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleCancelTask = async (id: string) => {
    try {
      await fetch(`/api/agent/tasks/${id}/cancel`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Error cancelling task:', err);
    }
  };

  const handleRetryTask = async (id: string) => {
    try {
      await fetch(`/api/agent/tasks/${id}/retry`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Error retrying task:', err);
    }
  };

  const handleCreateTask = async () => {
    if (!targetMachine) return;
    try {
      const targetPkg = packages.filter((p) => selectedPackageIds.includes(p.id));
      const title =
        taskType === 'SoftwareInstall'
          ? `Install ${targetPkg.map((p) => p.name).join(', ') || 'Software Package'}`
          : taskType === 'SoftwareUpdate'
          ? 'Check & Deploy Software Updates'
          : 'Enforce System Configuration';

      await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineName: targetMachine,
          taskType,
          title,
          payload: {
            packageIds: selectedPackageIds,
          },
          executionMode: taskExecutionMode,
          createdBy: 'Deployment Console',
        }),
      });

      setIsNewTaskModalOpen(false);
      setTargetMachine('');
      setSelectedPackageIds([]);
      fetchData();
    } catch (err) {
      console.error('Error creating queued task:', err);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const agentComputers = computers.filter((c) => c.agentInstalled);
  const queuedCount = tasks.filter((t) => t.status === 'queued' || t.status === 'dispatching').length;
  const runningCount = tasks.filter((t) => t.status === 'running').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-blue-950 border border-blue-800/80 text-blue-400">
                <Radio className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                  <span>Client Agent & Offline Wait-Tasks Queue</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800/60 font-mono font-semibold">
                    SYSTEM Scheduled Task
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Autonomous workstation agent running silently under <code>NT AUTHORITY\SYSTEM</code>. Reports health after boot and every 30 minutes, checks LAN reachability, and pulls queued deployment tasks for offline machines.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsNewTaskModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Queue Deployment Task</span>
            </button>

            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-blue-900/40 p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Connected Agents</span>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            </div>
            <span className="text-xl font-extrabold text-blue-400 mt-1 block">{agentComputers.length}</span>
          </div>

          <div className="bg-slate-950/60 border border-amber-900/40 p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Queued Wait-Tasks</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xl font-extrabold text-amber-400 mt-1 block">{queuedCount}</span>
          </div>

          <div className="bg-slate-950/60 border border-purple-900/40 p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Active Dispatch</span>
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-xl font-extrabold text-purple-400 mt-1 block">{runningCount}</span>
          </div>

          <div className="bg-slate-950/60 border border-emerald-900/40 p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Completed Jobs</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-xl font-extrabold text-emerald-400 mt-1 block">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold px-2">
        <button
          onClick={() => setActiveSubTab('queue')}
          className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-colors ${
            activeSubTab === 'queue'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Wait-Tasks & Queue ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('agents')}
          className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition-colors ${
            activeSubTab === 'agents'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Active Client Agents & Compliance ({agentComputers.length})</span>
        </button>
      </div>

      {/* VIEW 1: WAIT-TASKS QUEUE */}
      {activeSubTab === 'queue' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-300">Background Wait-Tasks Dispatcher</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  Auto-executes when offline PCs boot & reach LAN
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Target PC</th>
                    <th className="py-3 px-4">Task Title & Scope</th>
                    <th className="py-3 px-4">Execution Identity</th>
                    <th className="py-3 px-4">Queued At</th>
                    <th className="py-3 px-4">Result / Log</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="font-medium">The Wait-Tasks queue is currently empty.</p>
                        <p className="text-[11px] mt-1 text-slate-600">
                          Deploy software to offline machines or click &quot;Queue Deployment Task&quot; above to schedule autonomous jobs.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => {
                      const comp = computers.find((c) => c.name.toLowerCase() === task.machineName.toLowerCase());
                      const isOffline = comp?.status === 'Offline';

                      return (
                        <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Status */}
                          <td className="py-3 px-4">
                            {task.status === 'queued' ? (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                                <Clock className="w-3 h-3" />
                                <span>{isOffline ? 'Waiting (PC Offline)' : 'Queued (Ready)'}</span>
                              </span>
                            ) : task.status === 'dispatching' || task.status === 'running' ? (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-800/60 animate-pulse">
                                <Activity className="w-3 h-3" />
                                <span>Dispatching...</span>
                              </span>
                            ) : task.status === 'completed' ? (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Completed (Exit 0)</span>
                              </span>
                            ) : task.status === 'cancelled' ? (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                <XCircle className="w-3 h-3" />
                                <span>Cancelled</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-950/80 text-red-400 border border-red-800/60">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Failed</span>
                              </span>
                            )}
                          </td>

                          {/* Target Machine */}
                          <td className="py-3 px-4">
                            <span className="font-bold font-mono text-white text-sm block">
                              {task.machineName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {comp?.ipAddress || 'LAN Target'} • {comp?.status || 'Unknown'}
                            </span>
                          </td>

                          {/* Title & Scope */}
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-200 block">{task.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Type: {task.taskType} • By: {task.createdBy}
                            </span>
                          </td>

                          {/* Execution Identity */}
                          <td className="py-3 px-4">
                            {task.executionMode === 'agent_system' ? (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-400 font-mono text-[10px] border border-blue-900/50 block w-fit">
                                NT AUTHORITY\SYSTEM
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px] border border-emerald-900/50 block w-fit">
                                {task.serviceAccount || 'CORP\\svc_fdim_runner'}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Delegated Service Exec
                            </span>
                          </td>

                          {/* Queued At */}
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>

                          {/* Result Log */}
                          <td className="py-3 px-4">
                            {task.resultLog ? (
                              <button
                                onClick={() => setSelectedTaskLog(task)}
                                className="text-cyan-400 hover:text-cyan-300 font-semibold text-[11px] flex items-center space-x-1"
                              >
                                <FileText className="w-3 h-3" />
                                <span>View Transcript</span>
                              </button>
                            ) : (
                              <span className="text-slate-600 text-[11px]">Awaiting execution</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {task.status === 'queued' && (
                                <button
                                  onClick={() => handleCancelTask(task.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 text-xs transition-colors"
                                  title="Cancel queued task"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {(task.status === 'failed' || task.status === 'cancelled') && (
                                <button
                                  onClick={() => handleRetryTask(task.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-400 text-slate-400 text-xs transition-colors"
                                  title="Retry task"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CONNECTED AGENTS & COMPLIANCE */}
      {activeSubTab === 'agents' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agentComputers.map((comp) => {
              const cust = customers.find((c) => c.id === comp.customerProfileId) || customers[0];
              const installedCount = comp.installedPackageIds?.length || 0;
              const blueprintCount = cust?.packageIds?.length || 0;

              return (
                <div
                  key={comp.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-800 text-blue-400 flex items-center justify-center font-mono font-bold">
                          <Radio className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-base font-mono">{comp.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-semibold">
                              v{comp.agentVersion || '1.4'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            {comp.ipAddress} • {comp.dnsHostName}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-mono text-slate-500">
                        Uptime: {comp.uptimeHours || 0}h
                      </span>
                    </div>

                    <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">Current User</span>
                        <span className="text-slate-200 font-medium">{comp.currentUser || 'SYSTEM / Idle'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">Last Heartbeat</span>
                        <span className="text-emerald-400 font-mono">
                          {comp.lastHeartbeat ? new Date(comp.lastHeartbeat).toLocaleTimeString() : 'Active'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">Client OS</span>
                        <span className="text-slate-300 truncate block">{comp.operatingSystem}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">OU Path</span>
                        <span className="text-slate-300 truncate block">{comp.ouPath.split(',')[0]}</span>
                      </div>
                    </div>

                    {/* Installed Packages Compliance */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400 font-semibold">Software Blueprint Compliance:</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {installedCount} of {blueprintCount} packages installed
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.round((installedCount / (blueprintCount || 1)) * 100))}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Autonomous Task Engine Ready</span>
                    <button
                      onClick={() => {
                        setTargetMachine(comp.name);
                        setIsNewTaskModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-md shadow-blue-600/30 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Dispatch Task</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Installer & GPO Instructions Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>Agent Deployment & GPO Scheduled Task Installation</span>
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs text-slate-400">
                    Deploy the client agent via Active Directory Group Policy (GPO Startup Script) or run the 1-liner on any Windows client.
                  </p>
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    agentEncryption.isSecured
                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    <Shield className="w-3 h-3 text-emerald-400" />
                    <span>{agentEncryption.isSecured ? `Secured (${agentEncryption.mode.toUpperCase()})` : 'Tokenless (LAN)'}</span>
                  </span>
                </div>
              </div>

              <a
                href={`/api/agent/script/installer?serverUrl=${encodeURIComponent(serverUrl)}&intervalMinutes=${heartbeatInterval}&bootDelayMinutes=${bootDelay}`}
                download="Install-FDIMAgent.ps1"
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Install-FDIMAgent.ps1</span>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Server URL:</label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Heartbeat Interval:</label>
                <select
                  value={heartbeatInterval}
                  onChange={(e) => setHeartbeatInterval(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                >
                  <option value={15}>Every 15 Minutes</option>
                  <option value={30}>Every 30 Minutes (Recommended)</option>
                  <option value={60}>Every 60 Minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Delay After Boot:</label>
                <select
                  value={bootDelay}
                  onChange={(e) => setBootDelay(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                >
                  <option value={2}>2 Minutes</option>
                  <option value={5}>5 Minutes (Recommended for DHCP)</option>
                  <option value={10}>10 Minutes</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono">1-Liner PowerShell Deployment Command:</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `irm ${serverUrl}/api/agent/script/installer | iex`,
                      'agent-cmd'
                    )
                  }
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  {copiedKey === 'agent-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'agent-cmd' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-cyan-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 overflow-x-auto">
                irm {serverUrl}/api/agent/script/installer | iex
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Queue New Deployment Task */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-1">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Queue Deployment Wait-Task</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Schedule an autonomous installation job. If the PC is offline, it will run as soon as it boots and reaches the network.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target PC Hostname:</label>
                <input
                  type="text"
                  placeholder="e.g. ACME-WS-084 or ACME-LAP-102"
                  value={targetMachine}
                  onChange={(e) => setTargetMachine(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Task Type:</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                  >
                    <option value="SoftwareInstall">Software Installation</option>
                    <option value="SoftwareUpdate">Check & Update Packages</option>
                    <option value="ConfigSwitch">Enforce System Configuration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Execution Mode:</label>
                  <select
                    value={taskExecutionMode}
                    onChange={(e) => setTaskExecutionMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                  >
                    <option value="agent_system">Client Agent (SYSTEM)</option>
                    <option value="service_account">Elevated Service Account</option>
                  </select>
                </div>
              </div>

              {taskType === 'SoftwareInstall' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Packages to Install Silently:
                  </label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto bg-slate-950 p-2 rounded-xl border border-slate-800">
                    {packages.map((pkg) => {
                      const isChecked = selectedPackageIds.includes(pkg.id);
                      return (
                        <label
                          key={pkg.id}
                          className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer text-xs ${
                            isChecked ? 'bg-cyan-950/60 text-white' : 'text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedPackageIds((prev) =>
                                prev.includes(pkg.id) ? prev.filter((id) => id !== pkg.id) : [...prev, pkg.id]
                              );
                            }}
                            className="rounded border-slate-700 text-cyan-600"
                          />
                          <span className="font-semibold">{pkg.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">v{pkg.version}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={!targetMachine}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  Schedule Wait-Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Execution Transcript Log */}
      {selectedTaskLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Execution Transcript: {selectedTaskLog.title}</span>
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  Machine: {selectedTaskLog.machineName} • Status: {selectedTaskLog.status} (Exit {selectedTaskLog.exitCode ?? 0})
                </span>
              </div>
              <button
                onClick={() => setSelectedTaskLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 max-h-96 overflow-y-auto whitespace-pre-wrap">
              {selectedTaskLog.resultLog || 'No log details available.'}
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedTaskLog(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
