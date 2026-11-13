import { Router } from 'express';
import { ADComputer, QueuedTask } from '../../src/types/index.ts';
import {
  getAllADComputers,
  getADComputerByName,
  saveADComputer,
  getAllPackages,
  getAllCustomers,
  getAppSettings,
  getAllQueuedTasks,
  getQueuedTasksForMachine,
  saveQueuedTask,
  updateQueuedTaskStatus,
  deleteQueuedTask,
} from '../db.ts';
import {
  DEFAULT_PORT,
  getActiveSessionUser,
  centralServerRunner,
  getActiveRunnerJobsCount,
  agentLiveLogs,
  agentSseClients,
  agentLongPollWaiters,
  broadcastAgentLog,
  checkAgentAuthorization,
  getScriptBrandingTitle,
  LiveDeploymentSession,
  liveDeploymentSessions,
  pruneLiveSessions,
} from '../state.ts';
import {
  buildLiveDeploymentScript,
  generateClientAgentInstallerScript,
  generateServerRunnerScript,
  generateServerRunnerServiceInstaller,
} from '../services/powershell.ts';

export const agentAndRunnerRouter = Router();

// -------------------------------------------------------------
// CLIENT AGENT & WAIT-TASKS QUEUE API
// -------------------------------------------------------------

agentAndRunnerRouter.get(['/agent/tasks', '/queued-tasks'], (req, res) => {
  const { machine, status } = req.query;
  let tasks = getAllQueuedTasks();
  if (typeof machine === 'string' && machine) {
    tasks = tasks.filter((t) => t.machineName.toLowerCase() === machine.toLowerCase());
  }
  if (typeof status === 'string' && status) {
    tasks = tasks.filter((t) => t.status.toLowerCase() === status.toLowerCase());
  }
  res.json(tasks);
});

agentAndRunnerRouter.post(['/agent/tasks', '/queued-tasks'], (req, res) => {
  const {
    machineName,
    taskType,
    title,
    payload,
    packageIds,
    packageNames,
    customerProfileId,
    executionMode,
    serviceAccount,
    createdBy,
    notes,
  } = req.body;

  if (!machineName) {
    return res.status(400).json({ error: 'machineName is required' });
  }

  const computedTitle =
    title ||
    (Array.isArray(packageNames) && packageNames.length > 0
      ? `Install: ${packageNames.join(', ')}`
      : notes || `${taskType || 'SoftwareInstall'} on ${machineName}`);

  const settings = getAppSettings();
  const activeUser = getActiveSessionUser();
  const newTask: QueuedTask = {
    id: `task-q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    machineName: String(machineName).toUpperCase().trim(),
    taskType: taskType === 'SoftwareDeploy' ? 'SoftwareInstall' : taskType || 'SoftwareInstall',
    title: computedTitle,
    status: 'queued',
    payload: payload || {
      packageIds: Array.isArray(packageIds) ? packageIds : [],
      packageNames: Array.isArray(packageNames) ? packageNames : [],
      customerProfileId: customerProfileId || '',
    },
    executionMode: executionMode || (settings.runnerServiceAccount.enabled ? 'service_account' : 'agent_system'),
    serviceAccount: serviceAccount || settings.runnerServiceAccount.username,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || activeUser?.displayName || 'System Admin',
    retryCount: 0,
    maxRetries: 3,
  };
  (newTask as any).packageNames = Array.isArray(packageNames) ? packageNames : [];

  saveQueuedTask(newTask);
  res.status(201).json(newTask);
});

agentAndRunnerRouter.post('/agent/tasks/:id/cancel', (req, res) => {
  const updated = updateQueuedTaskStatus(req.params.id, 'cancelled', 'Cancelled by administrator');
  if (!updated) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ success: true, task: updated });
});

agentAndRunnerRouter.post('/agent/tasks/:id/retry', (req, res) => {
  const task = getAllQueuedTasks().find((t) => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  task.status = 'queued';
  task.retryCount = (task.retryCount || 0) + 1;
  task.resultLog = `Retry #${task.retryCount} initiated at ${new Date().toISOString()}`;
  saveQueuedTask(task);
  res.json({ success: true, task });
});

agentAndRunnerRouter.delete(['/agent/tasks/:id', '/queued-tasks/:id'], (req, res) => {
  const success = deleteQueuedTask(req.params.id);
  res.json({ success, deletedId: req.params.id });
});

agentAndRunnerRouter.post('/agent/heartbeat', (req, res) => {
  if (!checkAgentAuthorization(req, res)) return;

  const {
    machineName,
    domain,
    os,
    osName,
    ip,
    ipAddress,
    currentUser,
    loggedInUser,
    uptimeHours,
    installedPackages,
    agentVersion,
  } = req.body;

  if (!machineName) {
    return res.status(400).json({ error: 'machineName is required' });
  }

  const effectiveIp = ip || ipAddress;
  const effectiveOs = os || osName;
  const effectiveUser = currentUser || loggedInUser;

  const cleanName = String(machineName).toUpperCase().trim();
  const now = new Date().toISOString();
  let comp = getADComputerByName(cleanName);

  if (comp) {
    comp.status = 'AgentConnected';
    comp.lastSeen = now;
    comp.lastHeartbeat = now;
    comp.agentInstalled = true;
    comp.agentStatus = 'Installed';
    comp.lastAgentHeartbeat = now;
    if (agentVersion) comp.agentVersion = agentVersion;
    if (effectiveIp) comp.ipAddress = effectiveIp;
    if (effectiveOs) {
      comp.operatingSystem = effectiveOs;
      comp.osName = effectiveOs;
    }
    if (effectiveUser) {
      comp.currentUser = effectiveUser;
      comp.loggedInUser = effectiveUser;
    }
    if (typeof uptimeHours === 'number') comp.uptimeHours = uptimeHours;
    if (Array.isArray(installedPackages) && installedPackages.length > 0) {
      const set = new Set([...(comp.installedPackageIds || []), ...installedPackages]);
      comp.installedPackageIds = Array.from(set);
    }
    saveADComputer(comp);
  } else {
    const newComp: ADComputer = {
      id: `comp-${Date.now().toString(36)}`,
      name: cleanName,
      fqdn: `${cleanName.toLowerCase()}.${domain || 'corp.local'}`,
      dnsHostName: `${cleanName.toLowerCase()}.${domain || 'corp.local'}`,
      domain: domain || 'corp.local',
      osName: effectiveOs || 'Windows 11 Pro',
      osBuild: '22631',
      operatingSystem: effectiveOs || 'Windows 11 Pro',
      ouPath: 'OU=Workstations',
      ipAddress: effectiveIp || req.ip || 'Unresolved (DNS)',
      status: 'Online',
      pingMs: 2,
      lastSeen: now,
      lastHeartbeat: now,
      lastAgentHeartbeat: now,
      agentInstalled: true,
      agentStatus: 'Installed',
      agentVersion: agentVersion || '2.4.1',
      installedPackageIds: Array.isArray(installedPackages) ? installedPackages : [],
      customerProfileId: '',
      description: 'Auto-registered via client heartbeat task',
      currentUser: effectiveUser,
      loggedInUser: effectiveUser || null,
      uptimeHours: uptimeHours || 1,
    };
    saveADComputer(newComp);
    comp = newComp;
  }

  const pending = getQueuedTasksForMachine(cleanName);
  if (pending.length > 0) {
    const nextTask = pending[0];
    updateQueuedTaskStatus(nextTask.id, 'dispatching', `Dispatched to client agent during heartbeat at ${now}`);
    return res.json({
      status: 'ok',
      hasTasks: true,
      pendingTasks: [nextTask],
      serverTime: now,
      message: `Dispatched task [${nextTask.title}] to ${cleanName}`,
    });
  }

  res.json({
    status: 'ok',
    hasTasks: false,
    pendingTasks: [],
    serverTime: now,
    message: 'Heartbeat acknowledged. No pending tasks.',
  });
});

agentAndRunnerRouter.post('/agent/tasks/:id/report', (req, res) => {
  if (!checkAgentAuthorization(req, res)) return;

  const { status, exitCode, resultLog, installedPackageIds } = req.body;
  const task = getAllQueuedTasks().find((t) => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const updatedStatus: QueuedTask['status'] =
    status === 'success' || status === 'completed' ? 'completed' : 'failed';
  const resolvedExitCode = exitCode ?? (updatedStatus === 'completed' ? 0 : 1);
  const updated = updateQueuedTaskStatus(
    req.params.id,
    updatedStatus,
    resultLog || `Completed with exit code ${resolvedExitCode}`,
    resolvedExitCode
  );

  if (updatedStatus === 'completed') {
    const comp = getADComputerByName(task.machineName);
    if (comp) {
      const pkgIdsToAdd = task.payload.packageIds || installedPackageIds || [];
      if (pkgIdsToAdd.length > 0) {
        const merged = Array.from(new Set([...(comp.installedPackageIds || []), ...pkgIdsToAdd]));
        comp.installedPackageIds = merged;
        saveADComputer(comp);
      }
    }
  }

  if (centralServerRunner.runnerInfo) {
    centralServerRunner.runnerInfo.activeJobsCount = getActiveRunnerJobsCount();
  }

  broadcastAgentLog({
    taskId: task.id,
    machineName: task.machineName,
    level: updatedStatus === 'completed' ? 'success' : 'error',
    message: `[Task Report] ${task.title} finished on [${task.machineName}]: ${updatedStatus.toUpperCase()} (ExitCode: ${resolvedExitCode})`,
    exitCode: resolvedExitCode,
  });

  res.json({ success: true, task: updated });
});

agentAndRunnerRouter.get('/agent/tasks/:id/script', (req, res) => {
  const task = getAllQueuedTasks().find((t) => t.id === req.params.id);
  if (!task) {
    return res.status(404).type('text/plain').send('# Task not found');
  }

  if (task.payload?.customScript) {
    return res.type('text/plain; charset=utf-8').send(task.payload.customScript);
  }

  const allPackages = getAllPackages();
  const allCustomers = getAllCustomers();
  const customer = allCustomers.find((c) => c.id === task.payload?.customerProfileId) || allCustomers[0];
  const targetPackages = allPackages.filter((p) => (task.payload?.packageIds || []).includes(p.id));

  const settings = getAppSettings();
  const effectiveServerUrl = (
    settings.agentConfig?.serverUrl ||
    `${req.protocol}://${req.get('host') || `localhost:${DEFAULT_PORT}`}`
  ).replace(/\/+$/, '');

  pruneLiveSessions();

  const pseudoSession: LiveDeploymentSession = {
    id: `task-run-${task.id}`,
    machineName: task.machineName,
    domainName: customer?.domainName || 'corp.local',
    customerProfileId: customer?.id || '',
    customerCompanyName: customer?.companyName || 'Corporate Client',
    uncShareRoot: customer?.uncShareRoot,
    deploymentType: 'QuickSoftwareInstall',
    packageIds: targetPackages.map((p) => p.id),
    packages: targetPackages,
    packageCustomSwitches: task.payload?.customSwitches,
    packageConfigFiles: task.payload?.configFiles,
    executionMode: task.executionMode === 'interactive' ? 'technician' : (task.executionMode || 'agent_system'),
    serviceAccount: task.serviceAccount || 'NT AUTHORITY\\SYSTEM',
    status: 'running',
    startedAt: new Date().toISOString(),
    steps: [],
    logs: [],
    serverUrl: effectiveServerUrl,
    runCommand: '',
    remoteWinRmCommand: '',
    winrmReachable: false,
    agentConnected: true,
    queuedTaskId: task.id,
  };

  liveDeploymentSessions.set(pseudoSession.id, pseudoSession);
  const script = buildLiveDeploymentScript(pseudoSession, effectiveServerUrl, allPackages);
  res.type('text/plain; charset=utf-8').send(script);
});

agentAndRunnerRouter.get('/agent/script/installer', (req, res) => {
  const settings = getAppSettings();
  const serverUrl = (req.query.serverUrl as string) || settings.agentConfig.serverUrl || `http://localhost:${DEFAULT_PORT}`;
  const intervalMinutes = parseInt((req.query.intervalMinutes as string) || `${settings.agentConfig.heartbeatIntervalMinutes || 30}`, 10);
  const bootDelayMinutes = parseInt((req.query.bootDelayMinutes as string) || `${settings.agentConfig.bootDelayMinutes || 5}`, 10);
  const isSecured = Boolean(settings.agentConfig?.encryptionMode && settings.agentConfig.encryptionMode !== 'none');
  const pskToken = isSecured ? (settings.agentConfig?.preSharedKey || '') : '';
  const showProf =
    req.query.showProfanity === 'false' ? false : req.query.showProfanity === 'true' ? true : undefined;

  const installerScript = generateClientAgentInstallerScript({
    serverUrl,
    intervalMinutes,
    bootDelayMinutes,
    isSecured,
    pskToken,
    brandingTitle: getScriptBrandingTitle(showProf),
  });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Install-FDIMAgent.ps1"');
  res.send(installerScript);
});

// -------------------------------------------------------------
// CENTRAL SERVER RUNNER (REMOTE ZERO-AGENT WINRM ORCHESTRATOR)
// -------------------------------------------------------------

agentAndRunnerRouter.get('/server-runner/status', (_req, res) => {
  const settings = getAppSettings();
  const pollIntervalSec = 30;
  let isOnline = false;
  const activeCount = getActiveRunnerJobsCount();

  if (centralServerRunner.runnerInfo) {
    const elapsedSec = (Date.now() - new Date(centralServerRunner.runnerInfo.lastPoll).getTime()) / 1000;
    isOnline = elapsedSec < pollIntervalSec * 2.5;
    centralServerRunner.runnerInfo.activeJobsCount = activeCount;
    centralServerRunner.runnerInfo.status = isOnline ? (activeCount > 0 ? 'Busy' : 'Online') : 'Offline';
  }

  res.json({
    active: isOnline,
    runner: centralServerRunner.runnerInfo,
    pollIntervalSec,
    serviceAccount: settings.runnerServiceAccount,
  });
});

agentAndRunnerRouter.post('/server-runner/poll', (req, res) => {
  const { runnerId, hostname, ip, version, totalExecutedJobs } = req.body;
  const settings = getAppSettings();
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';
  const now = new Date().toISOString();
  const activeCount = getActiveRunnerJobsCount();

  centralServerRunner.lastPoll = now;
  centralServerRunner.runnerInfo = {
    runnerId: runnerId || `SRV-RUNNER-${(hostname || 'MGMT').toUpperCase()}`,
    hostname: hostname || 'Central-Management-Server',
    ipAddress: ip || clientIp,
    version: version || '2.0.0-remote-orchestrator',
    status: activeCount > 0 ? 'Busy' : 'Online',
    lastPoll: now,
    pollIntervalSec: 30,
    activeJobsCount: activeCount,
    totalExecutedJobs: Number(totalExecutedJobs) || 0,
    serviceAccount: settings.runnerServiceAccount?.username,
  };

  const allTasks = getAllQueuedTasks();
  const pendingTasks = allTasks.filter((t) => t.status === 'queued' || t.status === 'Queued');

  res.json({
    success: true,
    message: `Central Runner heartbeat acknowledged. ${pendingTasks.length} pending task(s) ready for remote execution.`,
    pollIntervalSec: 30,
    hasTasks: pendingTasks.length > 0,
    pendingTasks,
  });
});

agentAndRunnerRouter.post('/server-runner/tasks/:id/claim', (req, res) => {
  const { claimedByRunner, executor } = req.body;
  const task = getAllQueuedTasks().find((t) => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  task.status = 'running';
  task.dispatchedAt = new Date().toISOString();
  task.claimedByRunner = claimedByRunner || centralServerRunner.runnerInfo?.runnerId || 'Central-Server-Runner';
  task.executor = executor || `Central Server Runner (${centralServerRunner.runnerInfo?.hostname || 'Server'})`;
  saveQueuedTask(task);

  if (centralServerRunner.runnerInfo) {
    centralServerRunner.runnerInfo.activeJobsCount = getActiveRunnerJobsCount();
  }

  res.json({ success: true, task });
});

agentAndRunnerRouter.get('/server-runner/script', (req, res) => {
  const settings = getAppSettings();
  const effectiveServerUrl = (
    (req.query.serverUrl as string) ||
    settings.agentConfig?.serverUrl ||
    `${req.protocol}://${req.get('host') || `localhost:${DEFAULT_PORT}`}`
  ).replace(/\/+$/, '');
  const pollInterval = parseInt(req.query.interval as string, 10) || 30;
  const serviceAccount = settings.runnerServiceAccount?.username || '';
  const token = settings.agentConfig?.preSharedKey || '';

  const script = generateServerRunnerScript(effectiveServerUrl, pollInterval, serviceAccount, token);
  res.type('text/plain; charset=utf-8').send(script);
});

agentAndRunnerRouter.get(['/server-runner/install-service', '/server-runner/installer'], (req, res) => {
  const settings = getAppSettings();
  const effectiveServerUrl = (
    (req.query.serverUrl as string) ||
    settings.agentConfig?.serverUrl ||
    `${req.protocol}://${req.get('host') || `localhost:${DEFAULT_PORT}`}`
  ).replace(/\/+$/, '');
  const pollInterval = parseInt(req.query.interval as string, 10) || 30;

  const script = generateServerRunnerServiceInstaller(effectiveServerUrl, pollInterval);
  res.type('text/plain; charset=utf-8').send(script);
});

// -------------------------------------------------------------
// REAL-TIME REMOTE AGENT LOGGING, SSE STREAM & LONG-POLLING API
// -------------------------------------------------------------

agentAndRunnerRouter.post(['/agent/logs', '/agent/tasks/:id/log'], (req, res) => {
  const taskId = req.params.id || req.body.taskId || 'general';
  const {
    machineName,
    level,
    message,
    stepId,
    stepStatus,
    packageId,
    packageName,
    progressPercent,
    installerType,
    exitCode,
    timestamp,
  } = req.body;

  const log = broadcastAgentLog({
    taskId,
    machineName: machineName || 'REMOTE-PC',
    level: level || 'info',
    message: String(message || ''),
    stepId,
    stepStatus,
    packageId,
    packageName,
    progressPercent: typeof progressPercent === 'number' ? progressPercent : undefined,
    installerType,
    exitCode: typeof exitCode === 'number' ? exitCode : undefined,
    timestamp,
  });

  res.json({ success: true, logId: log.id });
});

agentAndRunnerRouter.get('/agent/live-logs', (req, res) => {
  const { since, machineName, taskId, level, limit, poll } = req.query;
  const isPoll = poll === 'true' || poll === '1';
  const maxLimit = parseInt(limit as string, 10) || 200;

  const filterLogs = (logsSince?: string) => {
    let list = agentLiveLogs;
    if (machineName && machineName !== 'ALL') {
      list = list.filter((l) => l.machineName.toUpperCase() === (machineName as string).toUpperCase());
    }
    if (taskId && taskId !== 'ALL') {
      list = list.filter((l) => l.taskId === taskId);
    }
    if (level && level !== 'ALL') {
      list = list.filter((l) => l.level === level);
    }
    if (logsSince) {
      list = list.filter((l) => l.isoTime > logsSince);
    }
    return list.slice(-maxLimit);
  };

  const currentMatched = filterLogs(typeof since === 'string' && since ? since : undefined);

  if (isPoll && typeof since === 'string' && since && currentMatched.length === 0) {
    const waiterId = `waiter-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timer = setTimeout(() => {
      for (const w of Array.from(agentLongPollWaiters)) {
        if (w.id === waiterId) {
          agentLongPollWaiters.delete(w);
          break;
        }
      }
      try {
        res.json({
          success: true,
          mode: 'long-polling',
          logs: [],
          timeout: true,
          serverTime: new Date().toISOString(),
        });
      } catch {}
    }, 15000);

    const waiter = {
      id: waiterId,
      res,
      timer,
      machineName: typeof machineName === 'string' ? machineName : undefined,
      taskId: typeof taskId === 'string' ? taskId : undefined,
      sinceIso: since,
    };

    agentLongPollWaiters.add(waiter);

    req.on('close', () => {
      clearTimeout(timer);
      agentLongPollWaiters.delete(waiter);
    });
    return;
  }

  res.json({
    success: true,
    mode: isPoll ? 'long-polling' : 'poll',
    logs: currentMatched,
    totalBuffered: agentLiveLogs.length,
    serverTime: new Date().toISOString(),
  });
});

agentAndRunnerRouter.get('/agent/live-logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  res.write(
    `data: ${JSON.stringify({ type: 'connected', serverTime: new Date().toISOString(), bufferedCount: agentLiveLogs.length })}\n\n`
  );

  agentSseClients.add(res);

  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeatInterval);
      agentSseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    agentSseClients.delete(res);
  });
});

agentAndRunnerRouter.post('/agent/live-logs/simulate', async (req, res) => {
  const { machineName, packageName, installerType, silentArgs } = req.body;
  const targetMachine = (machineName || 'CSPC03').toUpperCase().trim();
  const pkgName = packageName || '7-Zip Enterprise 24.08';
  const type = installerType || 'MSI';
  const args = silentArgs || '/qn /norestart';
  const simTaskId = `task-sim-${Date.now().toString(36)}`;

  res.json({
    success: true,
    message: `Started live remote silent install simulation for [${pkgName}] on target [${targetMachine}]`,
    taskId: simTaskId,
  });

  const steps = [
    { delay: 150, level: 'info', msg: `[Preflight] Workstation Agent on [${targetMachine}] received job dispatch [${simTaskId}]` },
    { delay: 750, level: 'running', msg: `[Preflight] Validating high-integrity administrator rights (NT AUTHORITY\\SYSTEM) on ${targetMachine}` },
    { delay: 1500, level: 'success', msg: `[Preflight] Administrator elevation verified. WinRM remote execution context active.` },
    { delay: 2300, level: 'info', msg: `[Network] Testing SMB connectivity to distribution share: \\\\corp-fs01\\software$\\${pkgName.replace(/[^a-zA-Z0-9]/g, '')}` },
    { delay: 3100, level: 'success', msg: `[Network] Share reachable (latency: 1.4ms). Installer verified.` },
    { delay: 3900, level: 'running', msg: `[Install] Spawning silent installer: msiexec.exe /i "\\\\corp-fs01\\software$\\${pkgName}.msi" ${args}`, progressPercent: 25 },
    { delay: 5100, level: 'info', msg: `[Install] Windows Installer Service (MSIServer) active. Writing files & registering components...`, progressPercent: 55 },
    { delay: 6500, level: 'success', msg: `[Install] Process finished with Exit Code: 0 (SUCCESS - No reboot required)`, progressPercent: 85, exitCode: 0 },
    { delay: 7300, level: 'info', msg: `[Detection] Executing compliance detection check: FilePath [C:\\Program Files\\7-Zip\\7z.exe]` },
    { delay: 8100, level: 'success', msg: `[Detection] Detection rule verified: Target binary present (v24.08). Package installed.`, progressPercent: 100 },
    { delay: 8900, level: 'success', msg: `[Signoff] Silent install pipeline for [${pkgName}] on [${targetMachine}] completed successfully.` },
  ];

  for (const step of steps) {
    setTimeout(() => {
      broadcastAgentLog({
        taskId: simTaskId,
        machineName: targetMachine,
        level: step.level as any,
        message: step.msg,
        packageName: pkgName,
        progressPercent: step.progressPercent,
        installerType: type,
        exitCode: step.exitCode,
      });
    }, step.delay);
  }
});

agentAndRunnerRouter.post(['/agent/live-logs/clear', '/agent/live-logs/purge'], (_req, res) => {
  const count = agentLiveLogs.length;
  agentLiveLogs.length = 0;
  res.json({ success: true, clearedCount: count });
});

agentAndRunnerRouter.delete('/agent/live-logs', (_req, res) => {
  const count = agentLiveLogs.length;
  agentLiveLogs.length = 0;
  res.json({ success: true, clearedCount: count });
});
