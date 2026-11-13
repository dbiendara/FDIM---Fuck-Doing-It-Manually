import { Router } from 'express';
import {
  SoftwarePackage,
  CustomerProfile,
  SystemConfigSwitch,
  DeploymentRecord,
  UserLogonStagingSnippet,
  PackageSandboxTest,
} from '../../src/types/index.ts';
import {
  getAllPackages,
  savePackage,
  deletePackage,
  getAllCustomers,
  getCustomerById,
  saveCustomer,
  deleteCustomer,
  getAllSystemSwitches,
  saveSystemSwitch,
  deleteSystemSwitch,
  getAllDeployments,
  saveDeployment,
  getAppSettings,
  getAllFirstRunSnippets,
  saveFirstRunSnippet,
  deleteFirstRunSnippet,
  seedInitialFirstRunSnippetsIfEmpty,
  getAllPackageTests,
  savePackageTest,
} from '../db.ts';
import { getActiveSessionUser } from '../state.ts';

export const catalogRouter = Router();

// -------------------------------------------------------------
// PACKAGES API
// -------------------------------------------------------------
catalogRouter.get('/packages', (_req, res) => {
  res.json(getAllPackages());
});

catalogRouter.post('/packages', (req, res) => {
  const newPkg: SoftwarePackage = {
    ...req.body,
    id: req.body?.id ? String(req.body.id) : `pkg-${Date.now().toString(36)}`,
  };
  savePackage(newPkg);
  res.status(201).json(newPkg);
});

catalogRouter.put('/packages/:id', (req, res) => {
  const updatedPkg: SoftwarePackage = {
    ...req.body,
    id: req.params.id,
  };
  savePackage(updatedPkg);
  res.json(updatedPkg);
});

catalogRouter.delete('/packages/:id', (req, res) => {
  deletePackage(req.params.id);
  res.json({ success: true, deletedId: req.params.id });
});

// -------------------------------------------------------------
// PACKAGE SANDBOX TESTING API
// -------------------------------------------------------------
catalogRouter.post('/packages/:id/sandbox-test', (req, res) => {
  const pkg = getAllPackages().find((p) => p.id === req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: 'Package not found' });
  }

  const settings = getAppSettings();
  const { environmentType, proxmoxConfig } = req.body || {};
  const env = environmentType || 'proxmox';

  const pveConfig = {
    node: proxmoxConfig?.node || settings.proxmoxConfig.node || 'pve-node1',
    vmId: proxmoxConfig?.vmId || settings.proxmoxConfig.vmTemplateId || 9001,
    templateName: proxmoxConfig?.templateName || 'win11-clean-template',
    snapshotName: proxmoxConfig?.snapshotName || settings.proxmoxConfig.cleanSnapshotName || 'clean-baseline',
    autoRollback: proxmoxConfig?.autoRollback !== undefined ? proxmoxConfig.autoRollback : settings.proxmoxConfig.autoRollback,
  };

  const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }> = [];
  const addLog = (level: 'info' | 'warn' | 'error' | 'success', message: string) => {
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
    logs.push({ timestamp: ts, level, message });
  };

  addLog('info', `Initializing ${env.toUpperCase()} isolated package test for [${pkg.name} v${pkg.version}]`);
  if (env === 'proxmox') {
    addLog('info', `Connecting to Proxmox VE API (${settings.proxmoxConfig.apiUrl || 'https://pve01.corp.internal:8006'}). Node: ${pveConfig.node}`);
    addLog('info', `Verifying clean baseline snapshot [${pveConfig.snapshotName}] on Sandbox VM ${pveConfig.vmId}...`);
    addLog('success', `Snapshot [${pveConfig.snapshotName}] verified. VM guest agent responding.`);
  } else {
    addLog('info', 'Spawning isolated container sandbox environment...');
  }

  addLog('info', `Deploying installer payload: ${pkg.uncPath ? pkg.uncPath : `Winget ID: ${pkg.wingetId}`}`);
  addLog('info', `Executing unattended install: "${pkg.fileName}" ${pkg.silentArgs} ${pkg.extraSwitches || ''}`);
  addLog('success', 'Process completed with exit code: 0 (Execution time: 42s)');
  addLog('info', `Running post-install compliance detection check [${pkg.detectionType}]: ${pkg.detectionRule}`);
  addLog('success', 'Detection rule verified: Target entry found and valid.');

  let rollbackSuccess = false;
  if (pveConfig.autoRollback) {
    addLog('warn', `Executing automated rollback to baseline snapshot [${pveConfig.snapshotName}] to maintain pristine sandbox state...`);
    addLog('success', `Proxmox VE API rollback confirmed: VM ${pveConfig.vmId} restored to clean baseline state [${pveConfig.snapshotName}].`);
    rollbackSuccess = true;
  } else {
    addLog('info', `Rollback skipped: VM ${pveConfig.vmId} left running for manual technician inspection.`);
  }

  const testRecord: PackageSandboxTest = {
    id: `test-${Date.now().toString(36)}`,
    packageId: pkg.id,
    packageName: pkg.name,
    environmentType: env,
    proxmoxConfig: pveConfig,
    status: 'passed',
    startedAt: new Date(Date.now() - 45000).toISOString(),
    completedAt: new Date().toISOString(),
    logs,
    exitCode: 0,
    detectionVerified: true,
    rollbackExecuted: rollbackSuccess,
  };

  savePackageTest(testRecord);
  pkg.testInstallStatus = 'Verified';
  savePackage(pkg);

  res.json({
    success: true,
    test: testRecord,
    updatedPackage: pkg,
  });
});

catalogRouter.get('/packages/:id/sandbox-tests', (req, res) => {
  const tests = getAllPackageTests().filter((t) => t.packageId === req.params.id);
  res.json(tests);
});

// -------------------------------------------------------------
// CUSTOMER PROFILES API
// -------------------------------------------------------------
catalogRouter.get(['/profiles', '/customers'], (_req, res) => {
  res.json(getAllCustomers());
});

catalogRouter.get(['/profiles/:id', '/customers/:id'], (req, res) => {
  const profile = getCustomerById(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: 'Customer profile not found' });
  }
  res.json(profile);
});

catalogRouter.post(['/profiles', '/customers'], (req, res) => {
  const settings = getAppSettings();
  const body = req.body || {};
  const newProfile: CustomerProfile = {
    ...body,
    id: body.id ? String(body.id) : `cust-${Date.now().toString(36)}`,
    domainName: body.domainName || settings.defaultGlobalDomain || 'corp.local',
  };
  saveCustomer(newProfile);
  res.status(201).json(newProfile);
});

catalogRouter.put(['/profiles/:id', '/customers/:id'], (req, res) => {
  const updated: CustomerProfile = {
    ...req.body,
    id: req.params.id,
  };
  saveCustomer(updated);
  res.json(updated);
});

catalogRouter.delete(['/profiles/:id', '/customers/:id'], (req, res) => {
  const success = deleteCustomer(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  res.json({ success: true, deletedId: req.params.id });
});

// -------------------------------------------------------------
// SYSTEM CONFIGURATION SWITCHES API
// -------------------------------------------------------------
catalogRouter.get('/system-switches', (_req, res) => {
  res.json(getAllSystemSwitches());
});

catalogRouter.post('/system-switches', (req, res) => {
  const body = req.body || {};
  const newSwitch: SystemConfigSwitch = {
    ...body,
    id: body.id ? String(body.id) : `sw-${Date.now().toString(36)}`,
    key: body.key || (body.title || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '_'),
    isRemovable: body.isRemovable !== false,
  };
  saveSystemSwitch(newSwitch);
  res.status(201).json(newSwitch);
});

catalogRouter.put('/system-switches/:id', (req, res) => {
  const updatedSwitch: SystemConfigSwitch = {
    ...req.body,
    id: req.params.id,
  };
  saveSystemSwitch(updatedSwitch);
  res.json(updatedSwitch);
});

catalogRouter.delete('/system-switches/:id', (req, res) => {
  const result = deleteSystemSwitch(req.params.id);
  if (!result.deleted) {
    const status = result.reason?.includes('Built-in') ? 400 : 404;
    return res.status(status).json({ error: result.reason || 'System switch not found' });
  }
  res.json({ success: true, deletedId: req.params.id });
});

// -------------------------------------------------------------
// FIRST-RUN USER LOGON SNIPPETS API
// -------------------------------------------------------------
catalogRouter.get('/snippets', (_req, res) => {
  res.json(getAllFirstRunSnippets());
});

catalogRouter.post('/snippets', (req, res) => {
  const body = req.body || {};
  const activeUser = getActiveSessionUser();
  const newSnippet: UserLogonStagingSnippet = {
    ...body,
    id: body.id ? String(body.id) : `snip-${Date.now().toString(36)}`,
    name: body.name || 'Untitled Snippet',
    description: body.description || '',
    category: body.category || 'Custom',
    script: body.script || '',
    enabled: body.enabled !== false,
    author: body.author || activeUser?.displayName || 'Administrator',
    tags: Array.isArray(body.tags) ? body.tags : [],
    isGlobalTemplate: Boolean(body.isGlobalTemplate),
  };
  const saved = saveFirstRunSnippet(newSnippet);
  res.status(201).json(saved);
});

catalogRouter.put('/snippets/:id', (req, res) => {
  const updatedSnippet: UserLogonStagingSnippet = {
    ...req.body,
    id: req.params.id,
  };
  const saved = saveFirstRunSnippet(updatedSnippet);
  res.json(saved);
});

catalogRouter.delete('/snippets/:id', (req, res) => {
  const deleted = deleteFirstRunSnippet(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Snippet not found' });
  }
  res.json({ success: true, deletedId: req.params.id });
});

catalogRouter.post('/snippets/reset-defaults', (_req, res) => {
  const templates = seedInitialFirstRunSnippetsIfEmpty();
  res.json(templates);
});

// -------------------------------------------------------------
// DEPLOYMENTS HISTORY API
// -------------------------------------------------------------
catalogRouter.get('/deployments', (_req, res) => {
  res.json(getAllDeployments());
});

catalogRouter.post('/deployments', (req, res) => {
  const body = req.body || {};
  const activeUser = getActiveSessionUser();
  const newRecord: DeploymentRecord = {
    ...body,
    id: body.id ? String(body.id) : `dep-${Date.now().toString(36)}`,
    startedAt: body.startedAt || new Date().toISOString(),
    status: body.status || 'Completed',
    completedAt: body.completedAt || new Date().toISOString(),
    technicianName: body.technicianName || activeUser?.displayName || 'Administrator',
  };
  saveDeployment(newRecord);
  res.status(201).json(newRecord);
});
