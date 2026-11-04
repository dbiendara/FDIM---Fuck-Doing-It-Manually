import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ADComputer,
  QueuedTask,
  SoftwarePackage,
  AgentExecutionLog,
} from '../types';
import {
  Terminal,
  Activity,
  Play,
  Pause,
  Trash2,
  Copy,
  Download,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Zap,
  Monitor,
  Server,
  Clock,
  ArrowDown,
  Layers,
  ShieldCheck,
  RefreshCw,
  Filter,
} from 'lucide-react';

interface AgentLiveLogMonitorProps {
  computers: ADComputer[];
  packages: SoftwarePackage[];
  tasks: QueuedTask[];
}

type StreamStrategy = 'sse' | 'long-poll' | 'fast-poll';

export const AgentLiveLogMonitor: React.FC<AgentLiveLogMonitorProps> = ({
  computers,
  packages,
  tasks,
}) => {
  const [logs, setLogs] = useState<AgentExecutionLog[]>([]);
  const [strategy, setStrategy] = useState<StreamStrategy>('sse');
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'polling' | 'connecting' | 'paused' | 'error'>('connecting');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMachine, setSelectedMachine] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(2000);

  // Simulation customizer modal / popover
  const [simMachine, setSimMachine] = useState<string>(() => computers[0]?.name || 'CSPC03');
  const [simPackage, setSimPackage] = useState<string>(() => packages[0]?.name || '7-Zip Enterprise 24.08');
  const [simInstallerType, setSimInstallerType] = useState<string>('MSI');
  const [simArgs, setSimArgs] = useState<string>('/qn /norestart');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const lastIsoTimeRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom when new logs arrive if auto-scroll is on
  useEffect(() => {
    if (autoScroll && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Initial load of recent logs
  const fetchInitialLogs = async () => {
    try {
      const res = await fetch('/api/agent/live-logs?limit=150');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
          if (data.logs.length > 0) {
            const newest = data.logs[data.logs.length - 1];
            lastIsoTimeRef.current = newest.isoTime;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load initial logs:', err);
    }
  };

  useEffect(() => {
    fetchInitialLogs();
  }, []);

  // Streaming Engine: handles SSE vs Long-Polling vs Fast-Polling
  useEffect(() => {
    if (!isStreaming) {
      setConnectionStatus('paused');
      return;
    }

    if (strategy === 'sse') {
      setConnectionStatus('connecting');
      const eventSource = new EventSource('/api/agent/live-logs/stream');

      eventSource.onopen = () => {
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const item = JSON.parse(event.data);
          if (item.type === 'connected') {
            return;
          }
          if (item && item.message) {
            setLogs((prev) => {
              // Avoid duplicates
              if (prev.some((l) => l.id === item.id)) return prev;
              const next = [...prev, item];
              if (next.length > 2000) next.shift();
              return next;
            });
            if (item.isoTime) {
              lastIsoTimeRef.current = item.isoTime;
            }
          }
        } catch {}
      };

      eventSource.onerror = () => {
        setConnectionStatus('error');
      };

      return () => {
        eventSource.close();
      };
    }

    if (strategy === 'long-poll') {
      let isSubscribed = true;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const runLongPoll = async () => {
        while (isSubscribed && isStreaming) {
          try {
            setConnectionStatus('polling');
            const sinceParam = lastIsoTimeRef.current ? `&since=${encodeURIComponent(lastIsoTimeRef.current)}` : '';
            const machParam = selectedMachine !== 'ALL' ? `&machineName=${encodeURIComponent(selectedMachine)}` : '';
            const url = `/api/agent/live-logs?poll=true${sinceParam}${machParam}`;

            const res = await fetch(url, { signal: abortController.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);

            const data = await res.json();
            if (Array.isArray(data.logs) && data.logs.length > 0) {
              setLogs((prev) => {
                const existingIds = new Set(prev.map((l) => l.id));
                const newEntries = data.logs.filter((l: AgentExecutionLog) => !existingIds.has(l.id));
                const combined = [...prev, ...newEntries];
                if (combined.length > 2000) return combined.slice(-2000);
                return combined;
              });
              const newest = data.logs[data.logs.length - 1];
              lastIsoTimeRef.current = newest.isoTime;
            }
            setConnectionStatus('connected');
          } catch (err: any) {
            if (err.name === 'AbortError') break;
            setConnectionStatus('error');
            // Backoff 2s before retry on error
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      };

      runLongPoll();

      return () => {
        isSubscribed = false;
        abortController.abort();
      };
    }

    if (strategy === 'fast-poll') {
      setConnectionStatus('polling');
      const interval = setInterval(async () => {
        try {
          const sinceParam = lastIsoTimeRef.current ? `&since=${encodeURIComponent(lastIsoTimeRef.current)}` : '';
          const machParam = selectedMachine !== 'ALL' ? `&machineName=${encodeURIComponent(selectedMachine)}` : '';
          const url = `/api/agent/live-logs?poll=false${sinceParam}${machParam}`;

          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.logs) && data.logs.length > 0) {
              setLogs((prev) => {
                const existingIds = new Set(prev.map((l) => l.id));
                const newEntries = data.logs.filter((l: AgentExecutionLog) => !existingIds.has(l.id));
                const combined = [...prev, ...newEntries];
                if (combined.length > 2000) return combined.slice(-2000);
                return combined;
              });
              const newest = data.logs[data.logs.length - 1];
              lastIsoTimeRef.current = newest.isoTime;
            }
            setConnectionStatus('connected');
          }
        } catch {
          setConnectionStatus('error');
        }
      }, pollIntervalMs);

      return () => clearInterval(interval);
    }
  }, [isStreaming, strategy, selectedMachine, pollIntervalMs]);

  // Handle user scroll detection for auto-scroll toggle
  const handleScroll = () => {
    if (!terminalContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  // Trigger interactive simulation
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/agent/live-logs/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineName: simMachine,
          packageName: simPackage,
          installerType: simInstallerType,
          silentArgs: simArgs,
        }),
      });
      if (res.ok) {
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Simulation trigger failed:', err);
    } finally {
      setTimeout(() => setIsSimulating(false), 2000);
    }
  };

  // Clear logs buffer
  const handleClearLogs = async () => {
    try {
      await fetch('/api/agent/live-logs/clear', { method: 'POST' });
      setLogs([]);
      lastIsoTimeRef.current = new Date().toISOString();
    } catch (err) {
      console.error('Clear logs failed:', err);
    }
  };

  // Copy logs as formatted text
  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.machineName}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download log file
  const handleDownloadLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.machineName}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fdim-agent-execution-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedMachine !== 'ALL' && log.machineName.toUpperCase() !== selectedMachine.toUpperCase()) {
        return false;
      }
      if (selectedLevel !== 'ALL' && log.level.toLowerCase() !== selectedLevel.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inMsg = log.message.toLowerCase().includes(q);
        const inMach = log.machineName.toLowerCase().includes(q);
        const inTask = log.taskId.toLowerCase().includes(q);
        const inPkg = (log.packageName || '').toLowerCase().includes(q);
        if (!inMsg && !inMach && !inTask && !inPkg) return false;
      }
      return true;
    });
  }, [logs, selectedMachine, selectedLevel, searchQuery]);

  // Compute active running silent installs for HUD
  const activeSilentInstalls = useMemo(() => {
    const recentMap = new Map<string, { machine: string; pkg: string; progress: number; lastMsg: string; timestamp: string }>();
    const cutoff = Date.now() - 60000; // last 60 seconds

    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      const logTime = new Date(l.isoTime).getTime();
      if (logTime < cutoff) continue;

      if (!recentMap.has(l.machineName)) {
        if (l.level === 'running' || (l.progressPercent !== undefined && l.progressPercent < 100)) {
          recentMap.set(l.machineName, {
            machine: l.machineName,
            pkg: l.packageName || 'Deployment Package',
            progress: l.progressPercent ?? 50,
            lastMsg: l.message,
            timestamp: l.timestamp,
          });
        }
      }
    }
    return Array.from(recentMap.values());
  }, [logs]);

  // Unique machines present in logs
  const logMachines = useMemo(() => {
    const set = new Set<string>();
    computers.forEach((c) => set.add(c.name.toUpperCase()));
    logs.forEach((l) => set.add(l.machineName.toUpperCase()));
    return Array.from(set).sort();
  }, [computers, logs]);

  return (
    <div className="space-y-4">
      {/* Top Controller Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/80 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Remote PC Agent Live Execution Monitor</h2>
                <span
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : connectionStatus === 'polling'
                      ? 'bg-blue-950 text-blue-400 border border-blue-800 animate-pulse'
                      : connectionStatus === 'paused'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionStatus === 'connected'
                        ? 'bg-emerald-400 animate-ping'
                        : connectionStatus === 'polling'
                        ? 'bg-blue-400 animate-pulse'
                        : connectionStatus === 'paused'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    {connectionStatus === 'connected'
                      ? strategy === 'sse'
                        ? 'STREAMING (SSE Active)'
                        : 'STREAMING (Long-Poll Active)'
                      : connectionStatus === 'polling'
                      ? 'LONG-POLLING'
                      : connectionStatus === 'paused'
                      ? 'PAUSED'
                      : 'DISCONNECTED'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time execution stream monitoring silent package installs, msiexec exit codes, and registry detection rules from remote Windows workstations.
              </p>
            </div>
          </div>

          {/* Strategy, Controls, and Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Streaming Strategy Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold px-1.5">Strategy:</span>
              <button
                onClick={() => setStrategy('sse')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  strategy === 'sse'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Server-Sent Events: Instant push from server with zero latency"
              >
                SSE Stream
              </button>
              <button
                onClick={() => setStrategy('long-poll')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  strategy === 'long-poll'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Adaptive Long-Polling: Holds HTTP request open until a remote agent posts a new log"
              >
                Long-Poll
              </button>
              <button
                onClick={() => setStrategy('fast-poll')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  strategy === 'fast-poll'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Interval Fast-Polling: Repeatedly requests updates every 2 seconds"
              >
                Fast-Poll
              </button>
            </div>

            {/* Pause / Resume Button */}
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                isStreaming
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
              }`}
              title={isStreaming ? 'Pause live log ingestion' : 'Resume live log ingestion'}
            >
              {isStreaming ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Live</span>
                </>
              )}
            </button>

            {/* Test Simulation Trigger */}
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold border border-blue-400/40 shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="Dispatches a realistic silent install simulation so you can inspect live streaming"
            >
              <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin text-amber-300' : 'text-amber-400'}`} />
              <span>{isSimulating ? 'Simulating...' : 'Simulate Silent Install'}</span>
            </button>

            {/* Copy Logs */}
            <button
              onClick={handleCopyLogs}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
              title="Copy filtered logs to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Download Log File */}
            <button
              onClick={handleDownloadLogs}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
              title="Download plain-text log file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Clear Terminal */}
            <button
              onClick={handleClearLogs}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs transition-colors cursor-pointer"
              title="Clear terminal buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Silent Installs HUD (Shows active tasks in-flight) */}
      {activeSilentInstalls.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSilentInstalls.map((job) => (
            <div
              key={job.machine}
              className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-3.5 shadow-md shadow-cyan-500/5 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                    <Monitor className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <span className="font-mono text-xs font-bold text-white block">{job.machine}</span>
                    <span className="text-[10px] text-slate-400 truncate block max-w-[180px]">{job.pkg}</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                  {job.progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-1.5 mb-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(job.progress, 15)}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-300 font-mono truncate" title={job.lastMsg}>
                {job.lastMsg}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Machine Filter */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Target Computers ({logMachines.length})</option>
              {logMachines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {['ALL', 'info', 'running', 'success', 'warn', 'error'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  selectedLevel === lvl
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl === 'ALL' ? 'All Levels' : lvl.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Search input & Auto-scroll indicator */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs (msiexec, exitcode, rule)..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={() => {
              setAutoScroll(!autoScroll);
              if (!autoScroll && terminalContainerRef.current) {
                terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
              }
            }}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              autoScroll
                ? 'bg-cyan-950 text-cyan-400 border-cyan-800'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
            title="Automatically scroll to bottom when new logs stream in"
          >
            <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'animate-bounce' : ''}`} />
            <span>Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Monospace Execution Terminal Console */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col font-mono text-xs">
        {/* Terminal Header */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <span className="text-slate-400 text-xs font-semibold ml-2">
              FDIM Silent Install Console Stream ({filteredLogs.length} events displayed)
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-slate-500">
            <span>Buffer: {logs.length}/2500</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">UTF-8 OutputEncoding</span>
          </div>
        </div>

        {/* Terminal Log Stream Window */}
        <div
          ref={terminalContainerRef}
          onScroll={handleScroll}
          className="p-4 space-y-1 overflow-y-auto max-h-[580px] min-h-[380px] font-mono leading-relaxed select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
              <Terminal className="w-8 h-8 text-slate-600 stroke-1" />
              <div>
                <p className="text-sm font-semibold text-slate-400">No Execution Logs Match Filter</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {logs.length === 0
                    ? 'Waiting for remote PC agents to report or execute silent software installations.'
                    : 'Try clearing your search query or setting the computer/level filter to "All".'}
                </p>
              </div>
              <button
                onClick={handleRunSimulation}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-900/50 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-700/60 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Trigger Test Silent Install Stream</span>
              </button>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';
              const isSuccess = log.level === 'success';
              const isRunning = log.level === 'running';

              return (
                <div
                  key={log.id}
                  className={`flex items-start space-x-2 py-0.5 px-1 rounded transition-colors ${
                    isError
                      ? 'bg-rose-950/25 text-rose-200'
                      : isWarn
                      ? 'bg-amber-950/20 text-amber-200'
                      : isSuccess
                      ? 'text-emerald-300'
                      : isRunning
                      ? 'text-cyan-300 bg-cyan-950/15'
                      : 'text-slate-300 hover:bg-slate-900/40'
                  }`}
                >
                  {/* Timestamp */}
                  <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>

                  {/* Machine Badge */}
                  <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-cyan-400 shrink-0">
                    {log.machineName}
                  </span>

                  {/* Level Badge */}
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                      isError
                        ? 'bg-rose-900/80 text-white'
                        : isWarn
                        ? 'bg-amber-900/80 text-amber-200'
                        : isSuccess
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        : isRunning
                        ? 'bg-blue-900/70 text-blue-300 animate-pulse'
                        : 'bg-slate-850 text-slate-400'
                    }`}
                  >
                    {log.level}
                  </span>

                  {/* Message body with highlighted keywords */}
                  <span className="break-all flex-1">
                    {log.message}
                  </span>

                  {/* Optional Exit Code badge */}
                  {log.exitCode !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                        log.exitCode === 0 || log.exitCode === 3010
                          ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                          : 'bg-rose-950 border border-rose-800 text-rose-300'
                      }`}
                    >
                      ExitCode: {log.exitCode}
                    </span>
                  )}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer with Quick Stats */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>
                Successes: {logs.filter((l) => l.level === 'success').length}
              </span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>
                Warnings: {logs.filter((l) => l.level === 'warn').length}
              </span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              <span>
                Errors: {logs.filter((l) => l.level === 'error').length}
              </span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span>Remote Agent Dispatch URL:</span>
            <code className="text-cyan-400 font-mono text-[10px]">/api/agent/logs</code>
          </div>
        </div>
      </div>
    </div>
  );
};
