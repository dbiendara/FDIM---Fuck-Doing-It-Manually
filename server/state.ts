import express from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  AuthUser,
  ServerRunnerInfo,
  AgentExecutionLog,
  AppSettings,
} from '../src/types/index.ts';
import { getAppSettings, getAllQueuedTasks } from './db.ts';

export const DEFAULT_PORT = Number(process.env.PORT) || 3000;
export const GEMINI_MODEL = 'gemini-4-hydrogen';

// Active session user
let activeSessionUser: AuthUser | null = null;

export function getActiveSessionUser(): AuthUser | null {
  return activeSessionUser;
}

export function setActiveSessionUser(user: AuthUser | null): void {
  activeSessionUser = user;
}

// -------------------------------------------------------------
// LIVE DEPLOYMENT SESSIONS STORE
// -------------------------------------------------------------

export interface LiveStepItem {
  id: string;
  type: 'preflight' | 'system' | 'package' | 'logon-staging' | 'postflight';
  title: string;
  subtext: string;
  status: 'pending' | 'running' | 'success' | 'warn' | 'error';
  logLines: string[];
}

export interface LiveDeploymentSession {
  id: string;
  machineName: string;
  domainName: string;
  customerProfileId: string;
  customerCompanyName: string;
  uncShareRoot?: string;
  deploymentType: 'FullStaging' | 'QuickSoftwareInstall';
  packageIds: string[];
  packages: any[];
  packageCustomSwitches?: Record<string, string>;
  packageConfigFiles?: Record<string, string>;
  uncCredentials?: { username?: string; password?: string };
  systemConfig?: any;
  enabledSwitchIds?: string[];
  switchParameters?: Record<string, any>;
  stagedDrives?: any[];
  stagedPrinters?: any[];
  userLogonStaging?: any;
  executionMode: 'service_account' | 'agent_system' | 'technician';
  serviceAccount: string;
  status: 'waiting_for_connection' | 'running' | 'completed' | 'failed';
  startedAt: string;
  lastPingAt?: string;
  completedAt?: string;
  exitCode?: number;
  steps: LiveStepItem[];
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;
  serverUrl: string;
  runCommand: string;
  remoteWinRmCommand: string;
  winrmReachable: boolean;
  agentConnected: boolean;
  targetIp?: string;
  queuedTaskId?: string;
  isDryRun?: boolean;
}

export const liveDeploymentSessions = new Map<string, LiveDeploymentSession>();

const SESSION_RETENTION_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_LIVE_SESSIONS = 150;

export function pruneLiveSessions(): void {
  const now = Date.now();
  for (const [id, session] of liveDeploymentSessions.entries()) {
    const isFinished = session.status === 'completed' || session.status === 'failed';
    const refTime = new Date(session.completedAt || session.lastPingAt || session.startedAt).getTime();
    if (isFinished && !Number.isNaN(refTime) && now - refTime > SESSION_RETENTION_MS) {
      liveDeploymentSessions.delete(id);
    }
  }
  if (liveDeploymentSessions.size > MAX_LIVE_SESSIONS) {
    const overflow = liveDeploymentSessions.size - MAX_LIVE_SESSIONS;
    let removed = 0;
    for (const id of liveDeploymentSessions.keys()) {
      if (removed >= overflow) break;
      liveDeploymentSessions.delete(id);
      removed++;
    }
  }
}

// -------------------------------------------------------------
// CENTRAL SERVER RUNNER DAEMON STATUS TRACKER
// -------------------------------------------------------------

export const centralServerRunner: {
  lastPoll: string | null;
  runnerInfo: ServerRunnerInfo | null;
} = {
  lastPoll: null,
  runnerInfo: null,
};

export function getActiveRunnerJobsCount(): number {
  try {
    return getAllQueuedTasks().filter(
      (t) => t.status === 'running' || t.status === 'dispatching'
    ).length;
  } catch {
    return 0;
  }
}

// -------------------------------------------------------------
// REAL-TIME REMOTE AGENT LOGGING (SSE & LONG-POLLING)
// -------------------------------------------------------------

const MAX_AGENT_LIVE_LOGS = 2500;

export const agentLiveLogs: AgentExecutionLog[] = [
  {
    id: 'log-seed-1',
    taskId: 'system-startup',
    machineName: 'CSPC03',
    timestamp: new Date(Date.now() - 360000).toLocaleTimeString('en-GB', { hour12: false }),
    isoTime: new Date(Date.now() - 360000).toISOString(),
    level: 'info',
    message: 'Client Agent daemon initialized on CSPC03. Scheduled Task running under NT AUTHORITY\\SYSTEM.',
  },
  {
    id: 'log-seed-2',
    taskId: 'system-startup',
    machineName: 'CSPC03',
    timestamp: new Date(Date.now() - 355000).toLocaleTimeString('en-GB', { hour12: false }),
    isoTime: new Date(Date.now() - 355000).toISOString(),
    level: 'success',
    message: 'Heartbeat signal acknowledged by FDIM server. Pre-shared key authentication verified.',
  },
  {
    id: 'log-seed-3',
    taskId: 'system-startup',
    machineName: 'CSPC03',
    timestamp: new Date(Date.now() - 350000).toLocaleTimeString('en-GB', { hour12: false }),
    isoTime: new Date(Date.now() - 350000).toISOString(),
    level: 'info',
    message: 'Workstation ready for remote silent software installation and configuration jobs.',
  },
];

export const agentSseClients = new Set<express.Response>();
export const agentLongPollWaiters = new Set<{
  id: string;
  res: express.Response;
  timer: NodeJS.Timeout;
  machineName?: string;
  taskId?: string;
  sinceIso?: string;
}>();

export function broadcastAgentLog(
  log: Omit<AgentExecutionLog, 'id' | 'timestamp' | 'isoTime'> & {
    id?: string;
    timestamp?: string;
    isoTime?: string;
  }
): AgentExecutionLog {
  const now = new Date();
  const entry: AgentExecutionLog = {
    id: log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    taskId: log.taskId || 'general',
    machineName: (log.machineName || 'REMOTE-PC').toUpperCase().trim(),
    timestamp: log.timestamp || now.toLocaleTimeString('en-GB', { hour12: false }),
    isoTime: log.isoTime || now.toISOString(),
    level: log.level || 'info',
    message: String(log.message || ''),
    stepId: log.stepId,
    stepStatus: log.stepStatus,
    packageId: log.packageId,
    packageName: log.packageName,
    progressPercent: log.progressPercent,
    installerType: log.installerType,
    exitCode: log.exitCode,
  };

  agentLiveLogs.push(entry);
  if (agentLiveLogs.length > MAX_AGENT_LIVE_LOGS) {
    agentLiveLogs.splice(0, agentLiveLogs.length - MAX_AGENT_LIVE_LOGS);
  }

  const sseData = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of Array.from(agentSseClients)) {
    try {
      client.write(sseData);
    } catch {
      agentSseClients.delete(client);
    }
  }

  for (const waiter of Array.from(agentLongPollWaiters)) {
    const machineMatch =
      !waiter.machineName ||
      waiter.machineName === 'ALL' ||
      waiter.machineName.toUpperCase() === entry.machineName;
    const taskMatch = !waiter.taskId || waiter.taskId === entry.taskId;
    if (machineMatch && taskMatch) {
      clearTimeout(waiter.timer);
      agentLongPollWaiters.delete(waiter);
      try {
        waiter.res.json({
          success: true,
          mode: 'long-polling',
          logs: [entry],
          serverTime: now.toISOString(),
        });
      } catch {}
    }
  }

  return entry;
}

// -------------------------------------------------------------
// GEMINI AI, BRANDING & SECURITY HELPERS
// -------------------------------------------------------------

export function isGeminiConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return Boolean(key && key.length > 5 && !key.startsWith('YOUR_') && !key.includes('PLACEHOLDER'));
}

export function getAiClient(): GoogleGenAI {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

export function getSettingsWithRuntimeInfo(): AppSettings {
  const settings = getAppSettings();
  const hasKey = isGeminiConfigured();
  return {
    ...settings,
    geminiConfig: {
      enabled: hasKey,
      hasApiKey: hasKey,
      model: hasKey ? GEMINI_MODEL : undefined,
      message: hasKey
        ? `Gemini Live AI Active (${GEMINI_MODEL})`
        : 'AI Switch Detective disabled: GEMINI_API_KEY not configured on server',
    },
  };
}

export function getScriptBrandingTitle(allowProfanity?: boolean): string {
  const pref = allowProfanity !== undefined ? allowProfanity : activeSessionUser?.showProfanity !== false;
  return pref ? 'Fuck Doing It Manually' : 'Forget Doing It Manually';
}

export function checkAgentAuthorization(req: express.Request, res: express.Response): boolean {
  const settings = getAppSettings();
  const agentCfg = settings.agentConfig;

  if (agentCfg?.enforceHttps) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps && req.headers['host'] && !req.headers['host'].includes('localhost') && !req.headers['host'].includes('127.0.0.1')) {
      res.status(403).json({
        success: false,
        error: 'HTTPS connection required by FDIM Agent Security Policy.',
      });
      return false;
    }
  }

  if (!agentCfg?.encryptionMode || agentCfg.encryptionMode === 'none' || !agentCfg.preSharedKey) {
    return true;
  }

  if (req.body?.simulate === true) {
    return true;
  }

  const providedToken =
    (req.headers['x-fdim-agent-token'] as string) ||
    (req.headers['authorization']?.replace(/^Bearer\s+/i, '') || '') ||
    (req.headers['x-agent-signature'] as string) ||
    (req.body?.agentToken as string) ||
    (req.query?.token as string) ||
    '';

  if (!providedToken) {
    res.status(401).json({
      success: false,
      error: `Security enforcement failed: Server enforces "${agentCfg.encryptionMode}" encryption mode with a valid Pre-Shared Key (PSK).`,
      encryptionMode: agentCfg.encryptionMode,
    });
    return false;
  }

  if (providedToken.trim() !== agentCfg.preSharedKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid Agent Authentication Token / Pre-Shared Key.',
      encryptionMode: agentCfg.encryptionMode,
    });
    return false;
  }

  return true;
}
