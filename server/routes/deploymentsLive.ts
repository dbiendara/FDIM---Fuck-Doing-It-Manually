import { Router } from 'express';
import { DeploymentRecord, QueuedTask } from '../../src/types/index.ts';
import {
  getAllPackages,
  getAllCustomers,
  getAllSystemSwitches,
  getAppSettings,
  getADComputerByName,
  saveADComputer,
  saveDeployment,
  saveQueuedTask,
  updateQueuedTaskStatus,
} from '../db.ts';
import {
  DEFAULT_PORT,
  getActiveSessionUser,
  LiveDeploymentSession,
  LiveStepItem,
  liveDeploymentSessions,
  pruneLiveSessions,
  broadcastAgentLog,
} from '../state.ts';
import { resolveAndProbeHost } from '../services/network.ts';
import { buildLiveDeploymentScript } from '../services/powershell.ts';

export const deploymentsLiveRouter = Router();

// 1. Initialize a Live Deployment Session
deploymentsLiveRouter.post('/deployments/live-session', async (req, res) => {
  try {
    pruneLiveSessions();

    const {
      machineName,
      customerProfileId,
      selectedPackageIds,
      packageIds,
      packageCustomSwitches,
      packageConfigFiles,
      uncCredentials,
      systemConfig,
      enabledSwitchIds,
      switchParameters,
      stagedDrives,
      stagedPrinters,
      userLogonStaging,
      deploymentType,
      executionMode,
      serviceAccount,
      queuedTaskId,
    } = req.body;

    const cleanName = (machineName || '$env:COMPUTERNAME').trim().toUpperCase();
    const pkgIds = Array.isArray(selectedPackageIds)
      ? selectedPackageIds
      : Array.isArray(packageIds)
      ? packageIds
      : [];

    const allCustomers = getAllCustomers();
    const customer = allCustomers.find((c) => c.id === customerProfileId) || allCustomers[0];
    const allPackages = getAllPackages();
    const targetPackages = allPackages.filter((p) => pkgIds.includes(p.id));
    const allSwitches = getAllSystemSwitches();

    const settings = getAppSettings();
    const clientProvidedUrl =
      typeof req.body.serverUrl === 'string' && req.body.serverUrl.trim() ? req.body.serverUrl.trim() : null;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${DEFAULT_PORT}`;
    const effectiveServerUrl = (clientProvidedUrl || settings.agentConfig?.serverUrl || `${proto}://${host}`).replace(
      /\/+$/,
      ''
    );

    const existingComp = getADComputerByName(cleanName);
    const domainSuffix = customer?.domainName || settings.defaultGlobalDomain || '';
    const probe = await resolveAndProbeHost(cleanName, existingComp?.ipAddress, domainSuffix);
    const agentConnected = Boolean(existingComp?.agentInstalled || existingComp?.agentStatus === 'Installed');
    const winrmReachable = probe.openPorts.includes(5985) || probe.openPorts.includes(5986);

    const sessionId = `lsess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const steps: LiveStepItem[] = [
      {
        id: 'step-preflight-ad',
        type: 'preflight',
        title: 'Active Directory Domain & Admin Elevation Check',
        subtext: `Validating high-integrity administrator privileges for ${cleanName}`,
        status: 'pending',
        logLines: [],
      },
      {
        id: 'step-preflight-unc',
        type: 'preflight',
        title: 'Network & UNC Deployment Share Connectivity',
        subtext: 'Verifying SMB connectivity to software sources',
        status: 'pending',
        logLines: [],
      },
    ];

    if (Array.isArray(enabledSwitchIds) && enabledSwitchIds.length > 0) {
      enabledSwitchIds.forEach((swId) => {
        const sw = allSwitches.find((s) => s.id === swId);
        if (sw) {
          steps.push({
            id: `step-sys-${sw.id}`,
            type: 'system',
            title: sw.title,
            subtext: sw.description,
            status: 'pending',
            logLines: [],
          });
        }
      });
    }

    targetPackages.forEach((pkg) => {
      const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);
      steps.push({
        id: `step-pkg-${pkg.id}`,
        type: 'package',
        title: isWinget ? `Winget Install: ${pkg.name}` : `Silent Install: ${pkg.name}`,
        subtext: isWinget
          ? `winget install --id "${pkg.wingetId || pkg.fileName}"`
          : `${pkg.uncPath}\\${pkg.fileName}`,
        status: 'pending',
        logLines: [],
      });
    });

    if (
      userLogonStaging?.enabled !== false &&
      ((stagedDrives && stagedDrives.length > 0) || (stagedPrinters && stagedPrinters.length > 0))
    ) {
      steps.push({
        id: 'step-user-first-logon-staging',
        type: 'logon-staging',
        title: 'Stage User First-Logon Setup (Active Setup & Printers)',
        subtext: 'Staging network drives and printers for user initial logon',
        status: 'pending',
        logLines: [],
      });
    }

    steps.push({
      id: 'step-postflight-audit',
      type: 'postflight',
      title: 'Workstation Verification & Handover Signoff',
      subtext: `Certifying setup compliance for ${customer?.companyName || 'Corporate'}`,
      status: 'pending',
      logLines: [],
    });

    const runCommand = `powershell.exe -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; $s = Invoke-RestMethod -Uri '${effectiveServerUrl}/api/deployments/live/${sessionId}/run' -UseBasicParsing; Invoke-Expression $s"`;
    const remoteWinRmCommand = `Invoke-Command -ComputerName "${cleanName}" -ScriptBlock { param($u) [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true} } catch {}; $s = Invoke-RestMethod -Uri "$u/api/deployments/live/${sessionId}/run" -UseBasicParsing; Invoke-Expression $s } -ArgumentList '${effectiveServerUrl}'`;

    const now = new Date().toLocaleTimeString();
    const initialLog = `[${now}] [INFO] Live Deployment Session [${sessionId}] initialized for machine ${cleanName} (${probe.ipAddress}). Ready for deployment.`;

    const session: LiveDeploymentSession = {
      id: sessionId,
      machineName: cleanName,
      domainName: customer?.domainName || 'corp.local',
      customerProfileId: customer?.id || '',
      customerCompanyName: customer?.companyName || 'Corporate Client',
      uncShareRoot: customer?.uncShareRoot,
      deploymentType: deploymentType || 'QuickSoftwareInstall',
      packageIds: targetPackages.map((p) => p.id),
      packages: targetPackages,
      packageCustomSwitches,
      packageConfigFiles,
      uncCredentials,
      systemConfig,
      enabledSwitchIds,
      switchParameters,
      stagedDrives,
      stagedPrinters,
      userLogonStaging,
      executionMode: executionMode || (agentConnected ? 'agent_system' : 'service_account'),
      serviceAccount: serviceAccount || settings.runnerServiceAccount?.username || 'CORP\\svc_fdim_runner',
      status: 'waiting_for_connection',
      startedAt: new Date().toISOString(),
      steps,
      logs: [{ timestamp: now, level: 'info', message: initialLog }],
      serverUrl: effectiveServerUrl,
      runCommand,
      remoteWinRmCommand,
      winrmReachable,
      agentConnected,
      targetIp: probe.ipAddress,
      queuedTaskId,
    };

    liveDeploymentSessions.set(sessionId, session);

    res.json({
      success: true,
      sessionId,
      session,
      runCommand,
      remoteWinRmCommand,
      agentConnected,
      winrmReachable,
      targetIp: probe.ipAddress,
      serverUrl: effectiveServerUrl,
    });
  } catch (err: any) {
    console.error('Error creating live deployment session:', err);
    res.status(500).json({ error: err?.message || 'Failed to initialize live deployment session' });
  }
});

// 2. Manual Queue Task endpoint for Live Runner when workstation is offline
deploymentsLiveRouter.post('/deployments/live/:sessionId/queue-task', (req, res) => {
  const session = liveDeploymentSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Live deployment session not found or expired' });
  }

  const pkgNames = session.packages?.map((p) => p.name).join(', ') || `${session.packageIds.length} packages`;
  const queuedTask: QueuedTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    machineName: session.machineName,
    taskType: 'SoftwareInstall',
    title: `Install ${pkgNames} on ${session.machineName} (Queued from Live Runner)`,
    status: 'queued',
    payload: {
      packageIds: session.packageIds,
      customerProfileId: session.customerProfileId || '',
      customSwitches: session.packageCustomSwitches,
      configFiles: session.packageConfigFiles,
      switchIds: session.enabledSwitchIds,
      switchParameters: session.switchParameters,
      command: session.runCommand,
    },
    executionMode: 'agent_system',
    serviceAccount: 'SYSTEM',
    createdAt: new Date().toISOString(),
    createdBy: 'Live Runner Manual Queue',
    retryCount: 0,
    maxRetries: 3,
  };

  saveQueuedTask(queuedTask);
  session.logs.push({
    timestamp: new Date().toLocaleTimeString(),
    level: 'info',
    message: `[MANUAL QUEUE] Deployment queued as background task ${queuedTask.id} for machine ${session.machineName} when online.`,
  });

  res.json({
    success: true,
    message: `Deployment task successfully created for ${session.machineName}. It will execute automatically when the client agent checks in or connects.`,
    task: queuedTask,
  });
});

// 3. Get Live Session Status (polling endpoint for UI)
deploymentsLiveRouter.get('/deployments/live/:sessionId/status', (req, res) => {
  const session = liveDeploymentSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Live session not found or expired' });
  }
  res.json({
    success: true,
    session: {
      id: session.id,
      status: session.status,
      machineName: session.machineName,
      startedAt: session.startedAt,
      steps: session.steps,
      logs: session.logs,
      lastPingAt: session.lastPingAt,
      completedAt: session.completedAt,
      exitCode: session.exitCode,
      isDryRun: session.isDryRun,
      agentConnected: session.agentConnected,
      winrmReachable: session.winrmReachable,
      targetIp: session.targetIp,
      runCommand: session.runCommand,
      remoteWinRmCommand: session.remoteWinRmCommand,
    },
  });
});

// 4. Download / Execute Live PowerShell Script on Target PC
deploymentsLiveRouter.get('/deployments/live/:sessionId/run', (req, res) => {
  const session = liveDeploymentSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).type('text/plain').send('# Error: Live deployment session not found or expired.');
  }

  if (session.status === 'waiting_for_connection') {
    session.status = 'running';
    session.lastPingAt = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString();
    session.logs.push({
      timestamp: timeStr,
      level: 'info',
      message: `[${timeStr}] [INFO] Target host connected and downloading live PowerShell deployment runner...`,
    });
  }

  const script = buildLiveDeploymentScript(session, session.serverUrl, getAllPackages());
  res.type('text/plain; charset=utf-8').send(script);
});

// 5. Ingest Real-Time Log Messages from PowerShell on Target Machine
deploymentsLiveRouter.post('/deployments/live/:sessionId/log', (req, res) => {
  const session = liveDeploymentSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { timestamp, level, message, stepId, stepStatus } = req.body;
  const timeStr = timestamp || new Date().toLocaleTimeString();
  const safeLevel = level === 'success' || level === 'error' || level === 'warn' ? level : 'info';

  session.lastPingAt = new Date().toISOString();
  if (session.status === 'waiting_for_connection') {
    session.status = 'running';
  }

  if (message) {
    session.logs.push({
      timestamp: timeStr,
      level: safeLevel,
      message: String(message),
    });

    broadcastAgentLog({
      taskId: session.queuedTaskId || (session.id.startsWith('task-run-') ? session.id.replace('task-run-', '') : session.id),
      machineName: session.machineName,
      level: safeLevel,
      message: String(message),
      stepId,
      stepStatus,
      timestamp: timeStr,
    });
  }

  if (stepId) {
    const step = session.steps.find((s) => s.id === stepId);
    if (step) {
      if (stepStatus && ['pending', 'running', 'success', 'warn', 'error'].includes(stepStatus)) {
        step.status = stepStatus;
      }
      if (message) {
        step.logLines.push(String(message));
      }
    }
  }

  res.json({ success: true });
});

// 6. Complete Live Deployment Session & Store Permanent Records
deploymentsLiveRouter.post('/deployments/live/:sessionId/complete', (req, res) => {
  const session = liveDeploymentSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { status, exitCode, installedPackages } = req.body;
  const isOk = status === 'completed' || exitCode === 0;
  session.status = isOk ? 'completed' : 'failed';
  session.exitCode = exitCode ?? (isOk ? 0 : 1);
  session.completedAt = new Date().toISOString();

  session.steps.forEach((s) => {
    if (s.status === 'pending' || s.status === 'running') {
      s.status = isOk ? 'success' : 'warn';
    }
  });

  const activeUser = getActiveSessionUser();
  const record: DeploymentRecord = {
    id: `dep-${Date.now().toString(36)}`,
    machineName: session.machineName,
    domainName: session.domainName,
    customerProfileId: session.customerProfileId,
    customerCompanyName: session.customerCompanyName,
    deploymentType: session.deploymentType,
    status: isOk ? 'Completed' : 'Failed',
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    selectedPackageIds: session.packageIds,
    appliedSwitchIds: session.enabledSwitchIds,
    switchParameters: session.switchParameters,
    systemConfig: session.systemConfig,
    stagedDrives: session.stagedDrives,
    stagedPrinters: session.stagedPrinters,
    userLogonStaging: session.userLogonStaging,
    technicianName: activeUser?.displayName || 'Admin (FDIM Live Runner)',
    logs: session.logs,
    results: {
      packages: Object.fromEntries(
        session.packageIds.map((pId) => [
          pId,
          { status: isOk ? 'success' : 'failed', exitCode: session.exitCode },
        ])
      ),
      systemConfigs: Object.fromEntries(
        (session.enabledSwitchIds || []).map((sId) => [sId, { status: isOk ? 'success' : 'failed' }])
      ),
    },
  };
  saveDeployment(record);

  const comp = getADComputerByName(session.machineName);
  if (comp) {
    const pkgsToAdd = installedPackages || session.packageIds;
    if (Array.isArray(pkgsToAdd) && pkgsToAdd.length > 0) {
      const merged = Array.from(new Set([...(comp.installedPackageIds || []), ...pkgsToAdd]));
      comp.installedPackageIds = merged;
    }
    comp.lastSeen = new Date().toISOString();
    saveADComputer(comp);
  }

  if (session.queuedTaskId) {
    updateQueuedTaskStatus(
      session.queuedTaskId,
      isOk ? 'completed' : 'failed',
      `Live deployment finished with exit code ${session.exitCode}`,
      session.exitCode
    );
  }

  broadcastAgentLog({
    taskId: session.queuedTaskId || (session.id.startsWith('task-run-') ? session.id.replace('task-run-', '') : session.id),
    machineName: session.machineName,
    level: isOk ? 'success' : 'error',
    message: `[Deployment Complete] Session ${session.id} finished on [${session.machineName}]: Status=${isOk ? 'COMPLETED' : 'FAILED'} (ExitCode: ${session.exitCode}).`,
    stepId: 'step-postflight-audit',
    stepStatus: isOk ? 'success' : 'error',
    exitCode: session.exitCode,
  });

  res.json({ success: true, record });
});

// 7. Explicit Dry-Run / Test Simulation Mode
deploymentsLiveRouter.post('/deployments/live/:sessionId/simulate', async (req, res) => {
  const session = liveDeploymentSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.isDryRun = true;
  session.status = 'running';
  const startTs = new Date().toLocaleTimeString();
  session.logs.push({
    timestamp: startTs,
    level: 'warn',
    message: `[${startTs}] [WARN] [TEST SIMULATION / DRY-RUN MODE ACTIVE] No physical workstation will be touched. Simulating pipeline execution...`,
  });

  (async () => {
    for (let i = 0; i < session.steps.length; i++) {
      const step = session.steps[i];
      step.status = 'running';
      const stepTs = new Date().toLocaleTimeString();
      session.logs.push({
        timestamp: stepTs,
        level: 'info',
        message: `[${stepTs}] [SIMULATION] Executing: ${step.title}...`,
      });

      await new Promise((r) => setTimeout(r, 800));

      step.status = 'success';
      const finishTs = new Date().toLocaleTimeString();
      session.logs.push({
        timestamp: finishTs,
        level: 'success',
        message: `[${finishTs}] [SIMULATION] Completed: ${step.title} (ExitCode: 0)`,
      });
    }

    session.status = 'completed';
    session.exitCode = 0;
    session.completedAt = new Date().toISOString();
    const endTs = new Date().toLocaleTimeString();
    session.logs.push({
      timestamp: endTs,
      level: 'success',
      message: `[${endTs}] [SIMULATION COMPLETED] Pipeline simulation completed successfully.`,
    });
  })();

  res.json({ success: true, message: 'Simulation started' });
});
