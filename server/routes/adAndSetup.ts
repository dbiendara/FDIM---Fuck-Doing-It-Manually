import net from 'node:net';
import { Router } from 'express';
import { ADComputer, AuthUser } from '../../src/types/index.ts';
import {
  getAllADComputers,
  getADComputerByName,
  saveADComputer,
  saveADComputersBatch,
  deleteADComputer,
  getAppSettings,
  updateAppSettings,
  getAllCustomers,
  saveCustomer,
  getAllUsers,
  findUserByUsername,
  saveUser,
  hashPassword,
  sanitizeUser,
  clearProductionWorkspace,
  getQueuedTasksForMachine,
  saveQueuedTask,
  getComputerHistory,
} from '../db.ts';
import {
  getActiveSessionUser,
  setActiveSessionUser,
  getSettingsWithRuntimeInfo,
  DEFAULT_PORT,
} from '../state.ts';
import {
  isValidResolvedIp,
  resolveAndProbeHost,
  queryActiveDirectoryComputers,
} from '../services/network.ts';
import { escapePsDoubleQuoted } from '../services/powershell.ts';

export const adAndSetupRouter = Router();

// -------------------------------------------------------------
// ACTIVE DIRECTORY COMPUTERS API
// -------------------------------------------------------------

adAndSetupRouter.get('/ad-computers', (_req, res) => {
  res.json(getAllADComputers());
});

adAndSetupRouter.post('/ad-computers', async (req, res) => {
  try {
    const rawName = String(req.body.name || '').trim().toUpperCase();
    if (!rawName) {
      return res.status(400).json({ error: 'Workstation hostname is required' });
    }

    const settings = getAppSettings();
    const domainSuffix = req.body.domain || settings.defaultGlobalDomain || '';
    const explicitIp = req.body.ipAddress ? String(req.body.ipAddress).trim() : undefined;

    const probe = await resolveAndProbeHost(rawName, explicitIp, domainSuffix);

    const existing = getADComputerByName(rawName);
    const osVal = req.body.osName || req.body.operatingSystem || existing?.osName || existing?.operatingSystem || 'Windows 11 Pro';
    const dnsVal = req.body.fqdn || req.body.dnsHostName || probe.dnsHostName;
    const isAgentInstalled =
      req.body.agentInstalled !== undefined
        ? Boolean(req.body.agentInstalled)
        : existing?.agentInstalled || existing?.agentStatus === 'Installed' || false;

    const resolvedIp = isValidResolvedIp(explicitIp)
      ? explicitIp!
      : isValidResolvedIp(probe.ipAddress)
      ? probe.ipAddress
      : existing?.ipAddress && isValidResolvedIp(existing.ipAddress)
      ? existing.ipAddress
      : probe.ipAddress;

    const comp: ADComputer = {
      id: existing?.id || req.body.id || `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: rawName,
      fqdn: dnsVal,
      dnsHostName: dnsVal,
      domain: domainSuffix || existing?.domain || 'corp.local',
      osName: osVal,
      osBuild: req.body.osBuild || existing?.osBuild || '22631',
      operatingSystem: osVal,
      ouPath: req.body.ouPath || existing?.ouPath || settings.adLdapConfig?.computerSearchOu || settings.adLdapConfig?.baseDn || 'CN=Computers',
      ipAddress: resolvedIp,
      status: isAgentInstalled && probe.reachable ? 'AgentConnected' : probe.reachable ? 'Online' : 'Offline',
      pingMs: probe.latencyMs,
      lastSeen: new Date().toISOString(),
      agentInstalled: isAgentInstalled,
      agentStatus: isAgentInstalled ? 'Installed' : 'Not Installed',
      agentVersion: req.body.agentVersion || existing?.agentVersion || (isAgentInstalled ? '2.4.1' : undefined),
      installedPackageIds: req.body.installedPackageIds || existing?.installedPackageIds || [],
      customerProfileId: req.body.customerProfileId ?? existing?.customerProfileId ?? (getAllCustomers()[0]?.id || ''),
      description: req.body.description !== undefined ? req.body.description : existing?.description || 'Manually added workstation',
      currentUser: req.body.currentUser || req.body.loggedInUser || existing?.currentUser,
      loggedInUser: req.body.loggedInUser || req.body.currentUser || existing?.loggedInUser || null,
      uptimeHours: req.body.uptimeHours ?? existing?.uptimeHours ?? 0,
    };

    saveADComputer(comp);
    res.status(201).json({ ...comp, success: true, computer: comp });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to add workstation' });
  }
});

adAndSetupRouter.put('/ad-computers/:id', async (req, res) => {
  try {
    const all = getAllADComputers();
    const existing = all.find((c) => c.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Workstation not found' });
    }

    const updatedName = req.body.name ? String(req.body.name).trim().toUpperCase() : existing.name;
    const explicitIp = req.body.ipAddress !== undefined ? String(req.body.ipAddress).trim() : existing.ipAddress;
    const settings = getAppSettings();
    const probe = await resolveAndProbeHost(updatedName, explicitIp, settings.defaultGlobalDomain);
    const osVal = req.body.osName || req.body.operatingSystem || existing.osName || existing.operatingSystem || 'Windows 11 Pro';
    const dnsVal = req.body.fqdn || req.body.dnsHostName || probe.dnsHostName || existing.dnsHostName || existing.fqdn;
    const isAgentInstalled = existing.agentInstalled || existing.agentStatus === 'Installed';

    const finalIp = isValidResolvedIp(explicitIp)
      ? explicitIp
      : isValidResolvedIp(probe.ipAddress)
      ? probe.ipAddress
      : isValidResolvedIp(existing.ipAddress)
      ? existing.ipAddress
      : probe.ipAddress;

    const updated: ADComputer = {
      ...existing,
      ...req.body,
      id: existing.id,
      name: updatedName,
      fqdn: dnsVal,
      dnsHostName: dnsVal,
      osName: osVal,
      operatingSystem: osVal,
      ipAddress: finalIp,
      status: isAgentInstalled && probe.reachable ? 'AgentConnected' : probe.reachable ? 'Online' : 'Offline',
      pingMs: probe.latencyMs,
    };

    saveADComputer(updated);
    res.json({ ...updated, success: true, computer: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update workstation' });
  }
});

adAndSetupRouter.delete('/ad-computers/:id', (req, res) => {
  const success = deleteADComputer(req.params.id);
  res.json({ success, deletedId: req.params.id });
});

// -------------------------------------------------------------
// SETUP WIZARD & INSTANCE INITIALIZATION
// -------------------------------------------------------------

adAndSetupRouter.get('/setup/status', (_req, res) => {
  const settings = getAppSettings();
  const allUsers = getAllUsers();
  const allComputers = getAllADComputers();
  const allCustomers = getAllCustomers();
  const adminUsers = allUsers.filter((u) => u.role === 'Administrator');

  res.json({
    isSetupCompleted: Boolean(settings.initialSetupCompleted),
    setupCompletedAt: settings.setupCompletedAt || null,
    adminCount: adminUsers.length,
    computersCount: allComputers.length,
    customersCount: allCustomers.length,
    currentDomain: settings.defaultGlobalDomain,
    adLdapConfig: settings.adLdapConfig,
    corporateColors: settings.corporateColors,
  });
});

adAndSetupRouter.post('/setup/initialize', async (req, res) => {
  try {
    const {
      adminUser,
      adConfig,
      companyBrand,
      defaultCustomer,
      initialSyncAD,
      clearWorkspace,
    } = req.body || {};

    if (!adminUser || !adminUser.username) {
      return res.status(400).json({ error: 'Master administrator username is required' });
    }

    if (clearWorkspace !== false) {
      clearProductionWorkspace({
        clearCustomers: true,
        clearComputers: true,
        clearDeployments: true,
        clearTasks: true,
      });
    }

    const cleanUsername = String(adminUser.username).trim();
    const existingUser = findUserByUsername(cleanUsername);
    const adminId = existingUser ? existingUser.id : `usr-admin-${Date.now().toString(36)}`;
    const adminPass = adminUser.password ? String(adminUser.password) : existingUser?.passwordHash ? undefined : 'admin';
    const createdAdminUser: AuthUser = {
      id: adminId,
      username: cleanUsername,
      displayName: adminUser.displayName || `${cleanUsername} (Master Admin)`,
      domain: adConfig?.domain || 'LOCAL',
      role: 'Administrator',
      authProvider: 'local',
      avatarInitials: (adminUser.displayName || cleanUsername).slice(0, 2).toUpperCase(),
      showProfanity: adminUser.showProfanity !== false,
      passwordHash: adminPass ? hashPassword(adminPass) : existingUser?.passwordHash,
    };
    const savedAdmin = saveUser(createdAdminUser);
    const sanitizedAdmin = sanitizeUser(savedAdmin);
    setActiveSessionUser(sanitizedAdmin);

    const netbiosDomain = (adConfig?.domain || '').trim().toUpperCase();
    const baseDn = (adConfig?.baseDn || '').trim();
    const derivedFqdnFromBaseDn = baseDn
      ? baseDn
          .split(',')
          .map((p: string) => p.trim())
          .filter((p: string) => /^DC=/i.test(p))
          .map((p: string) => p.replace(/^DC=/i, ''))
          .join('.')
      : '';
    const globalDomain =
      companyBrand?.defaultGlobalDomain ||
      derivedFqdnFromBaseDn ||
      (netbiosDomain ? `${netbiosDomain.toLowerCase()}.local` : 'local');

    updateAppSettings({
      initialSetupCompleted: true,
      setupCompletedAt: new Date().toISOString(),
      defaultGlobalDomain: globalDomain,
      authMode: adConfig?.ldapUrl ? 'active_directory' : 'local',
      adLdapConfig: {
        ldapUrl: (adConfig?.ldapUrl || '').trim(),
        domain: netbiosDomain,
        baseDn,
        bindDn: (adConfig?.bindDn || '').trim(),
        bindPassword: adConfig?.bindPassword || '',
        userSearchFilter: '(sAMAccountName={username})',
        adminGroup: (adConfig?.adminGroup || 'Domain Admins').trim(),
        computerSearchOu: (adConfig?.computerSearchOu || baseDn).trim(),
      },
      corporateColors: {
        primaryColor: companyBrand?.primaryColor || '#06b6d4',
        secondaryColor: companyBrand?.secondaryColor || '#2563eb',
        companyBrandName: companyBrand?.companyBrandName || 'FDIM Suite',
        themeMode: 'dark-cyan',
        customCssVarEnabled: true,
      },
    });

    let createdCustomerId = '';
    if (defaultCustomer && defaultCustomer.companyName && String(defaultCustomer.companyName).trim()) {
      const companyNameClean = String(defaultCustomer.companyName).trim();
      const targetCode = (defaultCustomer.customerCode || companyNameClean.slice(0, 4)).trim().toUpperCase();
      createdCustomerId = `cust-${Date.now().toString(36)}`;
      saveCustomer({
        id: createdCustomerId,
        companyName: companyNameClean,
        customerCode: targetCode,
        domainName: globalDomain,
        defaultAdAdminGroup: adConfig?.adminGroup || 'Domain Admins',
        uncShareRoot: (defaultCustomer.uncShareRoot || '').trim(),
        enableRdp: true,
        powerPlanSettings: {
          screenTimeoutAc: 15,
          standbyTimeoutAc: 0,
        },
        packageIds: [],
        notes: 'Primary organization profile created during initial setup.',
      });
    }

    let discoveredCount = 0;
    let ldapSyncWarning: string | undefined;
    if (initialSyncAD && adConfig?.ldapUrl && String(adConfig.ldapUrl).trim()) {
      const syncResult = await queryActiveDirectoryComputers({
        ldapUrl: adConfig.ldapUrl,
        domain: netbiosDomain || globalDomain,
        baseDn,
        bindDn: adConfig.bindDn,
        bindPassword: adConfig.bindPassword,
        searchOu: adConfig.computerSearchOu || baseDn,
        customerProfileId: createdCustomerId,
        defaultGlobalDomain: globalDomain,
      });
      if (syncResult.success) {
        discoveredCount = syncResult.discovered.length;
      } else {
        ldapSyncWarning = syncResult.error;
      }
    }

    res.json({
      success: true,
      message: ldapSyncWarning
        ? `Setup completed! Note: Initial LDAP sync could not reach the Domain Controller (${ldapSyncWarning}).`
        : 'FDIM Suite initial setup completed! Production workspace is ready.',
      user: sanitizedAdmin,
      appSettings: getSettingsWithRuntimeInfo(),
      discoveredComputersCount: discoveredCount,
      ldapSyncWarning,
    });
  } catch (err: any) {
    console.error('Error in /api/setup/initialize:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error during setup initialization',
    });
  }
});

adAndSetupRouter.post('/setup/reset', (req, res) => {
  if (req.body?.clearWorkspace) {
    clearProductionWorkspace();
  }
  updateAppSettings({
    initialSetupCompleted: false,
    setupCompletedAt: undefined,
  });
  res.json({
    success: true,
    message: 'Setup state reset. The Setup Wizard will run on next load.',
    appSettings: getSettingsWithRuntimeInfo(),
  });
});

adAndSetupRouter.post('/database/purge-workspace', (req, res) => {
  clearProductionWorkspace({
    clearCustomers: req.body?.clearCustomers !== false,
    clearComputers: req.body?.clearComputers !== false,
    clearDeployments: req.body?.clearDeployments !== false,
    clearTasks: req.body?.clearTasks !== false,
  });
  res.json({
    success: true,
    message: 'Production workspace cleared (all computers, customer profiles, deployment history, and queued tasks removed).',
  });
});

// -------------------------------------------------------------
// AD COMPUTER LDAP SYNC, PING, BULK IMPORT & AGENT DEPLOY
// -------------------------------------------------------------

adAndSetupRouter.post('/ad-computers/sync', async (req, res) => {
  try {
    const settings = getAppSettings();
    const ldapUrl = req.body.ldapUrl || settings.adLdapConfig?.ldapUrl || '';
    const domain = req.body.domain || settings.adLdapConfig?.domain || '';
    const baseDn = req.body.baseDn || settings.adLdapConfig?.baseDn || '';
    const bindDn = req.body.bindDn || settings.adLdapConfig?.bindDn || '';
    const bindPassword = req.body.bindPassword ?? settings.adLdapConfig?.bindPassword ?? '';
    const ouPath = req.body.ouPath || settings.adLdapConfig?.computerSearchOu || baseDn;
    const specificNames: string[] = Array.isArray(req.body.specificComputerNames) ? req.body.specificComputerNames : [];
    const customerId = req.body.customerProfileId || getAllCustomers()[0]?.id || '';

    if (req.body.ldapUrl || req.body.bindDn || req.body.baseDn || req.body.bindPassword) {
      updateAppSettings({
        adLdapConfig: {
          ...settings.adLdapConfig,
          ...(req.body.ldapUrl ? { ldapUrl: String(req.body.ldapUrl).trim() } : {}),
          ...(req.body.domain ? { domain: String(req.body.domain).trim() } : {}),
          ...(req.body.baseDn ? { baseDn: String(req.body.baseDn).trim() } : {}),
          ...(req.body.bindDn ? { bindDn: String(req.body.bindDn).trim() } : {}),
          ...(req.body.bindPassword !== undefined ? { bindPassword: String(req.body.bindPassword) } : {}),
          ...(req.body.ouPath ? { computerSearchOu: String(req.body.ouPath).trim() } : {}),
        },
      });
    }

    const syncResult = await queryActiveDirectoryComputers({
      ldapUrl,
      domain,
      baseDn,
      bindDn,
      bindPassword,
      searchOu: ouPath,
      specificNames,
      customerProfileId: customerId,
      defaultGlobalDomain: settings.defaultGlobalDomain,
    });

    if (!syncResult.success) {
      return res.status(400).json({
        success: false,
        error: syncResult.error,
        message: syncResult.error,
        totalComputers: getAllADComputers().length,
        discoveredCount: 0,
        discoveredComputers: [],
        updatedCount: 0,
      });
    }

    const allCompsNow = getAllADComputers();
    const discoveredNames = syncResult.discovered.map((c) => c.name).join(', ');
    const message =
      syncResult.discovered.length > 0
        ? `LDAP Sync succeeded: Discovered ${syncResult.discovered.length} new computer(s) (${discoveredNames}) in [${syncResult.searchedBase}]. Updated ${syncResult.updated.length} existing computer(s).`
        : `LDAP Sync completed against [${syncResult.searchedBase}]: Found ${syncResult.totalFoundInAd} computer object(s) in Active Directory (${syncResult.updated.length} updated, 0 new).`;

    res.json({
      success: true,
      message,
      totalComputers: allCompsNow.length,
      discoveredCount: syncResult.discovered.length,
      discoveredComputers: syncResult.discovered,
      updatedCount: syncResult.updated.length,
      domain,
      ouPath: syncResult.searchedBase,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Unexpected error during Active Directory LDAP synchronization',
    });
  }
});

adAndSetupRouter.post('/ad-computers/ping', async (req, res) => {
  try {
    const rawNames = req.body.machineNames || req.body.computerNames;
    const rawIds = req.body.computerIds;
    const allComputers = getAllADComputers();

    let targetNames: string[] = [];
    if (Array.isArray(rawNames) && rawNames.length > 0) {
      targetNames = rawNames.map((n: any) => String(n).trim()).filter(Boolean);
    } else if (Array.isArray(rawIds) && rawIds.length > 0) {
      targetNames = allComputers.filter((c) => rawIds.includes(c.id)).map((c) => c.name);
    } else {
      targetNames = allComputers.map((c) => c.name);
    }

    if (targetNames.length === 0) {
      return res.json({ success: true, computers: allComputers, results: [], resultsByHost: {} });
    }

    const settings = getAppSettings();
    const resultsByHost: Record<string, { reachable: boolean; latencyMs?: number; status: string; ipAddress?: string }> = {};
    const resultsList: Array<{ name: string; reachable: boolean; latencyMs?: number; status: string; ipAddress?: string }> = [];

    for (const name of targetNames) {
      const comp = allComputers.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const explicitIp = comp && isValidResolvedIp(comp.ipAddress) ? comp.ipAddress : undefined;
      const probe = await resolveAndProbeHost(name, explicitIp, settings.defaultGlobalDomain);

      const isAgentInstalled = comp?.agentInstalled || comp?.agentStatus === 'Installed';
      const newStatus = probe.reachable ? (isAgentInstalled ? 'AgentConnected' : 'Online') : 'Offline';

      const entry = {
        name,
        reachable: probe.reachable,
        latencyMs: probe.latencyMs,
        status: probe.reachable ? 'Online' : 'Offline',
        ipAddress: probe.ipAddress,
      };
      resultsByHost[name] = entry;
      resultsList.push(entry);

      if (comp) {
        comp.status = newStatus;
        comp.pingMs = probe.latencyMs;
        if (isValidResolvedIp(probe.ipAddress)) {
          comp.ipAddress = probe.ipAddress;
        }
        if (probe.reachable) {
          comp.lastSeen = new Date().toISOString();
        }
        saveADComputer(comp);
      }
    }

    res.json({
      success: true,
      computers: getAllADComputers(),
      results: resultsList,
      resultsByHost,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error probing workstation reachability' });
  }
});

adAndSetupRouter.post('/ad-computers/bulk-import', async (req, res) => {
  try {
    const { computerNames, computers, domain, ouPath, customerProfileId } = req.body;
    const settings = getAppSettings();
    const targetDomain = domain || settings.defaultGlobalDomain || 'corp.local';
    const targetOu = ouPath || settings.adLdapConfig?.computerSearchOu || settings.adLdapConfig?.baseDn || 'CN=Computers';
    const targetCustomer = customerProfileId ?? (getAllCustomers()[0]?.id || '');

    const imported: ADComputer[] = [];
    const updated: ADComputer[] = [];
    const existing = getAllADComputers();

    const entriesToProcess: Array<{
      name: string;
      ipAddress?: string;
      dnsHostName?: string;
      operatingSystem?: string;
      osBuild?: string;
      ouPath?: string;
      description?: string;
    }> = [];

    if (Array.isArray(computers)) {
      for (const item of computers) {
        if (item && item.name) {
          entriesToProcess.push({
            name: String(item.name).trim().toUpperCase(),
            ipAddress: item.ipAddress ? String(item.ipAddress).trim() : undefined,
            dnsHostName: (item.dnsHostName || item.fqdn) ? String(item.dnsHostName || item.fqdn).trim() : undefined,
            operatingSystem: (item.operatingSystem || item.osName) ? String(item.operatingSystem || item.osName).trim() : undefined,
            osBuild: item.osBuild ? String(item.osBuild).trim() : undefined,
            ouPath: item.ouPath ? String(item.ouPath).trim() : undefined,
            description: item.description ? String(item.description).trim() : undefined,
          });
        }
      }
    } else if (Array.isArray(computerNames)) {
      for (const rawLine of computerNames) {
        const parts = String(rawLine)
          .split(/[;,\t]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length === 0) continue;
        const cleanName = parts[0].toUpperCase();
        const optionalIp = parts[1] && (net.isIP(parts[1]) || /^\d+\.\d+\.\d+\.\d+$/.test(parts[1])) ? parts[1] : undefined;
        const optionalOs = optionalIp ? parts[2] : parts[1];
        const optionalOu = optionalIp ? parts[3] : parts[2];
        entriesToProcess.push({
          name: cleanName,
          ipAddress: optionalIp,
          operatingSystem: optionalOs,
          ouPath: optionalOu,
        });
      }
    }

    if (entriesToProcess.length === 0) {
      return res.status(400).json({ error: 'No valid computer hostnames provided' });
    }

    for (const item of entriesToProcess) {
      if (!item.name) continue;
      const probe = await resolveAndProbeHost(item.name, item.ipAddress, targetDomain);
      const found = existing.find((c) => c.name.toLowerCase() === item.name.toLowerCase());
      const osVal = item.operatingSystem || found?.osName || found?.operatingSystem || 'Windows 11 Pro';
      const dnsVal = item.dnsHostName || probe.dnsHostName || `${item.name.toLowerCase()}.${targetDomain}`;

      if (found) {
        if (item.ipAddress || isValidResolvedIp(probe.ipAddress)) {
          found.ipAddress = item.ipAddress || probe.ipAddress;
        }
        found.fqdn = dnsVal;
        found.dnsHostName = dnsVal;
        found.domain = targetDomain;
        found.osName = osVal;
        found.operatingSystem = osVal;
        if (item.osBuild) found.osBuild = item.osBuild;
        if (item.ouPath) found.ouPath = item.ouPath;
        if (item.description) found.description = item.description;
        if (targetCustomer) found.customerProfileId = targetCustomer;
        const isAgentInstalled = found.agentInstalled || found.agentStatus === 'Installed';
        found.status = isAgentInstalled && probe.reachable ? 'AgentConnected' : probe.reachable ? 'Online' : 'Offline';
        found.pingMs = probe.latencyMs;
        updated.push(found);
        continue;
      }

      const newComp: ADComputer = {
        id: `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: item.name,
        fqdn: dnsVal,
        dnsHostName: dnsVal,
        domain: targetDomain,
        osName: osVal,
        osBuild: item.osBuild || '22631',
        operatingSystem: osVal,
        ouPath: item.ouPath || targetOu,
        ipAddress: item.ipAddress || probe.ipAddress,
        status: probe.reachable ? 'Online' : 'Offline',
        pingMs: probe.latencyMs,
        lastSeen: new Date().toISOString(),
        agentInstalled: false,
        agentStatus: 'Not Installed',
        installedPackageIds: [],
        customerProfileId: targetCustomer,
        description: item.description || 'Added to workstation inventory',
        uptimeHours: 0,
      };
      imported.push(newComp);
    }

    saveADComputersBatch([...imported, ...updated]);

    res.json({
      success: true,
      message: `Processed ${imported.length + updated.length} workstation(s): ${imported.length} added, ${updated.length} updated.`,
      importedCount: imported.length,
      updatedCount: updated.length,
      computers: getAllADComputers(),
      importedComputers: [...imported, ...updated],
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error importing workstations' });
  }
});

adAndSetupRouter.post('/ad-computers/deploy-agent', async (req, res) => {
  try {
    const { machineNames, computerNames, computerIds, serverUrl, adminUsername, adminPassword, transport } = req.body;
    const allComputers = getAllADComputers();
    const targetMachines: Array<{ id: string; name: string; comp?: ADComputer }> = [];

    if (Array.isArray(computerIds) && computerIds.length > 0) {
      for (const id of computerIds) {
        const comp = allComputers.find((c) => c.id === id || c.name.toLowerCase() === String(id).toLowerCase());
        if (comp) {
          targetMachines.push({ id: comp.id, name: comp.name, comp });
        }
      }
    }

    const rawNames = Array.isArray(machineNames) ? machineNames : Array.isArray(computerNames) ? computerNames : [];
    if (targetMachines.length === 0 && rawNames.length > 0) {
      for (const rawName of rawNames) {
        const clean = String(rawName).trim().toUpperCase();
        if (!clean) continue;
        const comp = allComputers.find((c) => c.name.toLowerCase() === clean.toLowerCase());
        targetMachines.push({
          id: comp?.id || `target-${clean}`,
          name: comp?.name || clean,
          comp,
        });
      }
    }

    if (targetMachines.length === 0) {
      return res.status(400).json({ error: 'At least one target workstation (computerIds or machineNames) is required' });
    }

    const settings = getAppSettings();
    const activeUser = getActiveSessionUser();
    const effectiveServerUrl = (
      serverUrl ||
      settings.agentConfig?.serverUrl ||
      `${req.protocol}://${req.get('host') || `localhost:${DEFAULT_PORT}`}`
    ).replace(/\/+$/, '');
    const selectedTransport = String(transport || 'WinRM');

    const results: Array<{
      id: string;
      name: string;
      fqdn: string;
      machineName: string;
      ipAddress: string;
      reachable: boolean;
      pingMs: number | null;
      openPort?: number;
      winrmOpen: boolean;
      smbOpen: boolean;
      wmiOpen: boolean;
      status: 'queued_and_ready' | 'unreachable_queued';
      detail: string;
      message: string;
    }> = [];

    for (const target of targetMachines) {
      const comp = target.comp;
      const rawName = target.name;
      const explicitIp = comp && isValidResolvedIp(comp.ipAddress) ? comp.ipAddress : undefined;
      const probe = await resolveAndProbeHost(rawName, explicitIp, settings.defaultGlobalDomain);

      const winrmOpen = probe.openPorts.includes(5985) || probe.openPorts.includes(5986);
      const smbOpen = probe.openPorts.includes(445);
      const wmiOpen = probe.openPorts.includes(135);
      const openPort = probe.openPorts[0];

      const existingTasks = getQueuedTasksForMachine(rawName);
      if (!existingTasks.some((t) => (t.title || '').includes('Deploy FDIM Client Agent'))) {
        saveQueuedTask({
          id: `task-agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          machineName: String(rawName).toUpperCase(),
          taskType: 'CustomScript',
          title: `Deploy FDIM Client Agent (${selectedTransport} Bootstrap)`,
          status: 'queued',
          payload: {
            customScript: `Invoke-RestMethod -Uri "${effectiveServerUrl}/api/agent/script/installer?serverUrl=${encodeURIComponent(effectiveServerUrl)}" -UseBasicParsing | Invoke-Expression`,
          },
          executionMode: 'service_account',
          serviceAccount: adminUsername || settings.runnerServiceAccount?.username || 'Administrator',
          createdAt: new Date().toISOString(),
          createdBy: activeUser?.displayName || 'System Admin',
          retryCount: 0,
          maxRetries: 3,
        });
      }

      if (comp) {
        if (isValidResolvedIp(probe.ipAddress)) comp.ipAddress = probe.ipAddress;
        const isAgentInstalled = comp.agentInstalled || comp.agentStatus === 'Installed';
        comp.status = probe.reachable ? (isAgentInstalled ? 'AgentConnected' : 'Online') : 'Offline';
        comp.pingMs = probe.latencyMs;
        saveADComputer(comp);
      }

      const detailText = probe.reachable
        ? winrmOpen
          ? 'Online — WinRM (5985/5986) Open & Ready'
          : smbOpen
          ? 'Online — SMB (445) Open & Ready'
          : wmiOpen
          ? 'Online — WMI/RPC (135) Open & Ready'
          : 'Online — Run PowerShell Push Script from Jump Host'
        : 'Queued — Run PowerShell Push Script from Jump Host / LAN';

      results.push({
        id: target.id,
        name: String(rawName).toUpperCase(),
        fqdn: comp?.fqdn || comp?.dnsHostName || probe.dnsHostName || String(rawName).toLowerCase(),
        machineName: String(rawName).toUpperCase(),
        ipAddress: explicitIp || probe.ipAddress,
        reachable: probe.reachable,
        pingMs: probe.latencyMs ?? null,
        openPort,
        winrmOpen,
        smbOpen,
        wmiOpen,
        status: probe.reachable ? 'queued_and_ready' : 'unreachable_queued',
        detail: detailText,
        message: detailText,
      });
    }

    const targetAddresses = results.map((r) => (isValidResolvedIp(r.ipAddress) ? r.ipAddress : r.name));
    const targetsList = targetAddresses.map((n) => `"${escapePsDoubleQuoted(String(n).trim())}"`).join(', ');
    const targetNamesSummary = results.map((r) => `${r.name} (${r.ipAddress})`).join(', ');
    const credUser =
      adminUsername ||
      settings.runnerServiceAccount?.username ||
      `${settings.adLdapConfig?.domain || 'DOMAIN'}\\Administrator`;

    const bootstrapOneLiner = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-RestMethod -Uri "${effectiveServerUrl}/api/agent/script/installer?serverUrl=${encodeURIComponent(effectiveServerUrl)}" -UseBasicParsing | Invoke-Expression`;

    const credSnippet = adminPassword
      ? `$SecPass = ConvertTo-SecureString "${escapePsDoubleQuoted(String(adminPassword))}" -AsPlainText -Force\n$Cred = New-Object System.Management.Automation.PSCredential("${escapePsDoubleQuoted(credUser)}", $SecPass)`
      : `$Cred = Get-Credential -UserName "${escapePsDoubleQuoted(credUser)}" -Message "Enter Domain Admin credentials for FDIM Agent deployment"`;

    let remotePushScript = '';
    if (selectedTransport.toUpperCase() === 'WMI') {
      remotePushScript = `# ==============================================================================
# FDIM Client Agent Remote Push Script — WMI / CIM Process Call (TCP 135 / DCOM)
# Targets: ${targetNamesSummary}
# Server:  ${effectiveServerUrl}
# ==============================================================================
$Targets = @(${targetsList})
$ServerUrl = "${escapePsDoubleQuoted(effectiveServerUrl)}"
${credSnippet}

$BootstrapCmd = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-RestMethod -Uri '$ServerUrl/api/agent/script/installer?serverUrl=$([uri]::EscapeDataString($ServerUrl))' -UseBasicParsing | Invoke-Expression"""

foreach ($Target in $Targets) {
    Write-Host "[*] Deploying FDIM Client Agent to $Target via WMI/CIM (Win32_Process)..." -ForegroundColor Cyan
    try {
        $CimOpt = New-CimSessionOption -Protocol Dcom
        $Session = New-CimSession -ComputerName $Target -Credential $Cred -SessionOption $CimOpt -ErrorAction Stop
        $Result = Invoke-CimMethod -CimSession $Session -ClassName Win32_Process -MethodName Create -Arguments @{
            CommandLine = $BootstrapCmd
        } -ErrorAction Stop
        if ($Result.ReturnValue -eq 0) {
            Write-Host "[OK] Agent installer launched on $Target (PID: $($Result.ProcessId))!" -ForegroundColor Green
        } else {
            Write-Warning "[!] Win32_Process.Create returned code $($Result.ReturnValue) on $Target"
        }
        Remove-CimSession $Session -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "[!] WMI/CIM failed on $Target: $_"
    }
}`;
    } else if (selectedTransport.toUpperCase() === 'SMB') {
      remotePushScript = `# ==============================================================================
# FDIM Client Agent Remote Push Script — SMB Admin$ Share + Scheduled Task (TCP 445)
# Targets: ${targetNamesSummary}
# Server:  ${effectiveServerUrl}
# ==============================================================================
$Targets = @(${targetsList})
$ServerUrl = "${escapePsDoubleQuoted(effectiveServerUrl)}"
${credSnippet}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$InstallerContent = Invoke-RestMethod -Uri "$ServerUrl/api/agent/script/installer?serverUrl=$([uri]::EscapeDataString($ServerUrl))" -UseBasicParsing

foreach ($Target in $Targets) {
    Write-Host "[*] Staging FDIM Agent via SMB ADMIN$ on $Target..." -ForegroundColor Cyan
    try {
        New-PSDrive -Name "FDIMSMB" -PSProvider FileSystem -Root "\\\\$Target\\ADMIN$\\Temp" -Credential $Cred -ErrorAction Stop | Out-Null
        Set-Content -Path "FDIMSMB:\\Install-FDIMAgent.ps1" -Value $InstallerContent -Encoding UTF8 -Force
        Remove-PSDrive -Name "FDIMSMB" -ErrorAction SilentlyContinue

        $PlainPass = $Cred.GetNetworkCredential().Password
        schtasks.exe /Create /S $Target /U "$($Cred.UserName)" /P "$PlainPass" /RU "SYSTEM" /SC ONCE /ST 00:00 /TN "FDIM-Agent-Bootstrap" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\\Windows\\Temp\\Install-FDIMAgent.ps1" /RL HIGHEST /F | Out-Null
        schtasks.exe /Run /S $Target /U "$($Cred.UserName)" /P "$PlainPass" /TN "FDIM-Agent-Bootstrap" | Out-Null
        Write-Host "[OK] FDIM Agent staged and executed as SYSTEM on $Target!" -ForegroundColor Green
    } catch {
        Remove-PSDrive -Name "FDIMSMB" -ErrorAction SilentlyContinue
        Write-Warning "[!] SMB deployment failed on $Target: $_"
    }
}`;
    } else {
      const useSslFlag = selectedTransport === 'winrm_https' ? ' -UseSSL' : '';
      remotePushScript = `# ==============================================================================
# FDIM Client Agent Remote Push Script — WinRM / PowerShell Remoting (TCP 5985/5986)
# Targets: ${targetNamesSummary}
# Server:  ${effectiveServerUrl}
# ==============================================================================
$Targets = @(${targetsList})
$ServerUrl = "${escapePsDoubleQuoted(effectiveServerUrl)}"
${credSnippet}

foreach ($Target in $Targets) {
    Write-Host "[*] Deploying FDIM Client Agent to $Target via WinRM..." -ForegroundColor Cyan
    try {
        Invoke-Command -ComputerName $Target -Credential $Cred${useSslFlag} -ScriptBlock {
            param($Url)
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $installer = Invoke-RestMethod -Uri "$Url/api/agent/script/installer?serverUrl=$([uri]::EscapeDataString($Url))" -UseBasicParsing
            Invoke-Expression $installer
        } -ArgumentList $ServerUrl -ErrorAction Stop
        Write-Host "[OK] FDIM Agent installed and heartbeat triggered on $Target!" -ForegroundColor Green
    } catch {
        Write-Warning "[!] WinRM failed on $Target: $_"
    }
}`;
    }

    const reachableCount = results.filter((r) => r.reachable).length;
    res.json({
      success: true,
      message: `Prepared ${selectedTransport} Agent Deployment for ${results.length} workstation(s) (${reachableCount} directly reachable from server). Copy or run the PowerShell script below to install the agent.`,
      serverUrl: effectiveServerUrl,
      computers: getAllADComputers(),
      results,
      bootstrapOneLiner,
      remotePushScript,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to prepare agent deployment' });
  }
});

adAndSetupRouter.get('/computers/:name/history', (req, res) => {
  try {
    res.json(getComputerHistory(req.params.name));
  } catch (err: any) {
    console.error('Error fetching computer history:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch computer history' });
  }
});
