import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import {
  CustomerProfile,
  SoftwarePackage,
  SystemConfigSwitch,
  DeploymentRecord,
  AppSettings,
  AuthUser,
  ADComputer,
  QueuedTask,
  PackageSandboxTest,
  UserLogonStagingSnippet,
} from '../src/types';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'fdim.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch {
  // Ignore if WAL pragma not supported in environment
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS system_switches (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    started_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ad_computers (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queued_tasks (
    id TEXT PRIMARY KEY,
    machine_name TEXT NOT NULL,
    status TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS package_tests (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    data TEXT NOT NULL,
    started_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS first_run_snippets (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// -------------------------------------------------------------
// SEEDING DEFAULT DATA (if empty)
// -------------------------------------------------------------

export function seedInitialDataIfEmpty(
  initialPackages: SoftwarePackage[],
  initialCustomers: CustomerProfile[],
  initialSwitches: SystemConfigSwitch[],
  initialDeployments: DeploymentRecord[]
) {
  const pkgCount = (db.prepare('SELECT COUNT(*) as cnt FROM packages').get() as { cnt: number }).cnt;
  if (pkgCount === 0) {
    const insertPkg = db.prepare('INSERT INTO packages (id, data, updated_at) VALUES (?, ?, ?)');
    for (const pkg of initialPackages) {
      insertPkg.run(pkg.id, JSON.stringify(pkg), new Date().toISOString());
    }
  }

  const custCount = (db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number }).cnt;
  if (custCount === 0) {
    const insertCust = db.prepare('INSERT INTO customers (id, data, updated_at) VALUES (?, ?, ?)');
    for (const cust of initialCustomers) {
      insertCust.run(cust.id, JSON.stringify(cust), new Date().toISOString());
    }
  }

  const insertSwitch = db.prepare('INSERT OR IGNORE INTO system_switches (id, data, updated_at) VALUES (?, ?, ?)');
  for (const sw of initialSwitches) {
    insertSwitch.run(sw.id, JSON.stringify(sw), new Date().toISOString());
  }

  const depCount = (db.prepare('SELECT COUNT(*) as cnt FROM deployments').get() as { cnt: number }).cnt;
  if (depCount === 0) {
    const insertDep = db.prepare('INSERT INTO deployments (id, data, started_at) VALUES (?, ?, ?)');
    for (const dep of initialDeployments) {
      insertDep.run(dep.id, JSON.stringify(dep), dep.startedAt || new Date().toISOString());
    }
  }

  // Initial App Settings
  const defaultSettings: AppSettings = {
    defaultGlobalDomain: 'corp.internal.net',
    authMode: 'local',
    adLdapConfig: {
      ldapUrl: 'ldaps://dc01.corp.internal.net:636',
      domain: 'CORP',
      baseDn: 'DC=corp,DC=internal,DC=net',
      bindDn: 'CN=svc_fdim,OU=ServiceAccounts,DC=corp,DC=internal,DC=net',
      userSearchFilter: '(sAMAccountName={username})',
      adminGroup: 'FDIM-Admins',
    },
    keycloakConfig: {
      serverUrl: 'https://keycloak.corp.internal.net',
      realm: 'enterprise',
      clientId: 'fdim-suite',
      clientSecret: '',
      redirectUri: 'https://fdim.corp.internal.net/oauth/callback',
    },
    runnerServiceAccount: {
      enabled: true,
      username: 'CORP\\svc_fdim_runner',
      domain: 'CORP',
      description: 'Dedicated elevated service account for Helpdesk delegated package deployment without local admin rights',
      delegatedHelpdeskAllowed: true,
    },
    proxmoxConfig: {
      enabled: true,
      apiUrl: 'https://pve01.corp.internal:8006/api2/json',
      node: 'pve-node1',
      vmTemplateId: 9000,
      cleanSnapshotName: 'clean-baseline',
      autoRollback: true,
    },
    agentConfig: {
      heartbeatIntervalMinutes: 30,
      bootDelayMinutes: 5,
      serverUrl: 'http://fdim.corp.internal:3000',
      encryptionMode: 'token-bearer',
      preSharedKey: 'fdim_sec_a7f92e41c88d30e15b6782fa901c34ef',
      enforceHttps: false,
    },
    corporateColors: {
      primaryColor: '#06b6d4',
      secondaryColor: '#2563eb',
      companyBrandName: 'FDIM Suite',
      themeMode: 'dark-cyan',
      customCssVarEnabled: true,
    },
  };

  // Migration: Upgrade legacy pkg-winget-outlook-classic to ODT UNC package if present
  const legacyOutlook = db.prepare('SELECT data FROM packages WHERE id = ?').get('pkg-winget-outlook-classic') as { data: string } | undefined;
  if (legacyOutlook) {
    db.prepare('DELETE FROM packages WHERE id = ?').run('pkg-winget-outlook-classic');
    const odtOutlook = initialPackages.find((p) => p.id === 'pkg-outlook-classic');
    if (odtOutlook) {
      db.prepare('INSERT OR REPLACE INTO packages (id, data, updated_at) VALUES (?, ?, ?)').run(odtOutlook.id, JSON.stringify(odtOutlook), new Date().toISOString());
    }
  }

  const settingsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('global') as { value: string } | undefined;
  if (!settingsRow) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('global', JSON.stringify(defaultSettings));
  }

  // Initial Users
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO users (id, username, data) VALUES (?, ?, ?)');
    const defaultAdmin: AuthUser = {
      id: 'usr-admin',
      username: 'admin',
      displayName: 'FDIM Domain Administrator',
      domain: 'CORP',
      role: 'Administrator',
      authProvider: 'local',
      avatarInitials: 'DA',
      showProfanity: true,
    };
    const defaultTech: AuthUser = {
      id: 'usr-tech1',
      username: 'technician',
      displayName: 'MSP Field Engineer',
      domain: 'CORP',
      role: 'Technician',
      authProvider: 'local',
      avatarInitials: 'FE',
      showProfanity: true,
    };
    insertUser.run(defaultAdmin.id, defaultAdmin.username, JSON.stringify(defaultAdmin));
    insertUser.run(defaultTech.id, defaultTech.username, JSON.stringify(defaultTech));
  }

  // Seed default First-Run User Logon Snippets
  seedInitialFirstRunSnippetsIfEmpty();
}

// -------------------------------------------------------------
// CRUD METHODS
// -------------------------------------------------------------

// Packages
export function getAllPackages(): SoftwarePackage[] {
  const rows = db.prepare('SELECT data FROM packages ORDER BY updated_at DESC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function savePackage(pkg: SoftwarePackage): SoftwarePackage {
  const existing = db.prepare('SELECT id FROM packages WHERE id = ?').get(pkg.id);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE packages SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(pkg), now, pkg.id);
  } else {
    db.prepare('INSERT INTO packages (id, data, updated_at) VALUES (?, ?, ?)').run(pkg.id, JSON.stringify(pkg), now);
  }
  return pkg;
}

export function deletePackage(id: string): boolean {
  const result = db.prepare('DELETE FROM packages WHERE id = ?').run(id);
  return (result as { changes?: number }).changes ? (result as { changes: number }).changes > 0 : true;
}

// Customers
export function getAllCustomers(): CustomerProfile[] {
  const rows = db.prepare('SELECT data FROM customers ORDER BY updated_at DESC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function getCustomerById(id: string): CustomerProfile | null {
  const row = db.prepare('SELECT data FROM customers WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function saveCustomer(cust: CustomerProfile): CustomerProfile {
  const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(cust.id);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE customers SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(cust), now, cust.id);
  } else {
    db.prepare('INSERT INTO customers (id, data, updated_at) VALUES (?, ?, ?)').run(cust.id, JSON.stringify(cust), now);
  }
  return cust;
}

export function deleteCustomer(id: string): boolean {
  const result = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  return (result as { changes?: number }).changes ? (result as { changes: number }).changes > 0 : true;
}

// System Switches
export function getAllSystemSwitches(): SystemConfigSwitch[] {
  const rows = db.prepare('SELECT data FROM system_switches ORDER BY id ASC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function saveSystemSwitch(sw: SystemConfigSwitch): SystemConfigSwitch {
  const existing = db.prepare('SELECT id FROM system_switches WHERE id = ?').get(sw.id);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE system_switches SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(sw), now, sw.id);
  } else {
    db.prepare('INSERT INTO system_switches (id, data, updated_at) VALUES (?, ?, ?)').run(sw.id, JSON.stringify(sw), now);
  }
  return sw;
}

// Deployments
export function getAllDeployments(): DeploymentRecord[] {
  const rows = db.prepare('SELECT data FROM deployments ORDER BY started_at DESC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function saveDeployment(dep: DeploymentRecord): DeploymentRecord {
  const existing = db.prepare('SELECT id FROM deployments WHERE id = ?').get(dep.id);
  if (existing) {
    db.prepare('UPDATE deployments SET data = ? WHERE id = ?').run(JSON.stringify(dep), dep.id);
  } else {
    db.prepare('INSERT INTO deployments (id, data, started_at) VALUES (?, ?, ?)').run(
      dep.id,
      JSON.stringify(dep),
      dep.startedAt || new Date().toISOString()
    );
  }
  return dep;
}

// App Settings
export function getAppSettings(): AppSettings {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('global') as { value: string } | undefined;
  const defaultSettings: AppSettings = {
    initialSetupCompleted: false,
    defaultGlobalDomain: 'corp.internal.net',
    authMode: 'local',
    adLdapConfig: {
      ldapUrl: 'ldaps://dc01.corp.internal.net:636',
      domain: 'CORP',
      baseDn: 'DC=corp,DC=internal,DC=net',
      bindDn: 'CN=svc_fdim,OU=ServiceAccounts,DC=corp,DC=internal,DC=net',
      bindPassword: '',
      userSearchFilter: '(sAMAccountName={username})',
      adminGroup: 'FDIM-Admins',
      computerSearchOu: 'OU=Workstations,DC=corp,DC=internal,DC=net',
    },
    keycloakConfig: {
      serverUrl: 'https://keycloak.corp.internal.net',
      realm: 'enterprise',
      clientId: 'fdim-suite',
      clientSecret: '',
      redirectUri: 'https://fdim.corp.internal.net/oauth/callback',
    },
    runnerServiceAccount: {
      enabled: true,
      username: 'CORP\\svc_fdim_runner',
      domain: 'CORP',
      description: 'Dedicated elevated service account for Helpdesk delegated package deployment without local admin rights',
      delegatedHelpdeskAllowed: true,
    },
    proxmoxConfig: {
      enabled: true,
      apiUrl: 'https://pve01.corp.internal:8006/api2/json',
      node: 'pve-node1',
      vmTemplateId: 9000,
      cleanSnapshotName: 'clean-baseline',
      autoRollback: true,
    },
    agentConfig: {
      heartbeatIntervalMinutes: 30,
      bootDelayMinutes: 5,
      serverUrl: 'http://fdim.corp.internal:3000',
      encryptionMode: 'token-bearer',
      preSharedKey: 'fdim_sec_a7f92e41c88d30e15b6782fa901c34ef',
      enforceHttps: false,
    },
    corporateColors: {
      primaryColor: '#06b6d4',
      secondaryColor: '#2563eb',
      companyBrandName: 'FDIM Suite',
      themeMode: 'dark-cyan',
      customCssVarEnabled: true,
    },
  };

  if (!row) {
    return defaultSettings;
  }

  const parsed = JSON.parse(row.value);
  return {
    ...defaultSettings,
    ...parsed,
    adLdapConfig: { ...defaultSettings.adLdapConfig, ...(parsed.adLdapConfig || {}) },
    keycloakConfig: { ...defaultSettings.keycloakConfig, ...(parsed.keycloakConfig || {}) },
    runnerServiceAccount: { ...defaultSettings.runnerServiceAccount, ...(parsed.runnerServiceAccount || {}) },
    proxmoxConfig: { ...defaultSettings.proxmoxConfig, ...(parsed.proxmoxConfig || {}) },
    agentConfig: { ...defaultSettings.agentConfig, ...(parsed.agentConfig || {}) },
    corporateColors: { ...defaultSettings.corporateColors, ...(parsed.corporateColors || {}) },
  };
}

export function updateAppSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getAppSettings();
  const merged: AppSettings = {
    ...current,
    ...partial,
    adLdapConfig: {
      ...current.adLdapConfig,
      ...(partial.adLdapConfig || {}),
    },
    keycloakConfig: {
      ...current.keycloakConfig,
      ...(partial.keycloakConfig || {}),
    },
    runnerServiceAccount: {
      ...current.runnerServiceAccount,
      ...(partial.runnerServiceAccount || {}),
    },
    proxmoxConfig: {
      ...current.proxmoxConfig,
      ...(partial.proxmoxConfig || {}),
    },
    agentConfig: {
      ...current.agentConfig,
      ...(partial.agentConfig || {}),
    },
    corporateColors: {
      primaryColor: partial.corporateColors?.primaryColor || current.corporateColors?.primaryColor || '#06b6d4',
      secondaryColor: partial.corporateColors?.secondaryColor || current.corporateColors?.secondaryColor || '#2563eb',
      companyBrandName: partial.corporateColors?.companyBrandName || current.corporateColors?.companyBrandName || 'FDIM Suite',
      themeMode: partial.corporateColors?.themeMode || current.corporateColors?.themeMode || 'dark-cyan',
      customCssVarEnabled: true,
    },
  };
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('global', JSON.stringify(merged));
  return merged;
}

// -------------------------------------------------------------
// AD COMPUTERS STORE
// -------------------------------------------------------------
export function getAllADComputers(): ADComputer[] {
  const rows = db.prepare('SELECT data FROM ad_computers ORDER BY updated_at DESC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function getADComputerByName(name: string): ADComputer | null {
  const row = db.prepare('SELECT data FROM ad_computers WHERE LOWER(name) = LOWER(?)').get(name) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function saveADComputer(computer: ADComputer): ADComputer {
  const existing = db.prepare('SELECT id FROM ad_computers WHERE id = ? OR LOWER(name) = LOWER(?)').get(computer.id, computer.name) as { id: string } | undefined;
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE ad_computers SET data = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(computer),
      now,
      existing.id
    );
  } else {
    db.prepare('INSERT INTO ad_computers (id, name, data, updated_at) VALUES (?, ?, ?, ?)').run(
      computer.id,
      computer.name,
      JSON.stringify(computer),
      now
    );
  }
  return computer;
}

export function deleteADComputer(id: string): boolean {
  const info = db.prepare('DELETE FROM ad_computers WHERE id = ?').run(id);
  return info.changes > 0;
}

export function seedInitialADComputersIfEmpty() {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM ad_computers').get() as { cnt: number }).cnt;
  if (count > 0) return;

  const now = new Date();
  const sampleComputers: ADComputer[] = [
    {
      id: 'comp-01',
      name: 'ACME-WS-084',
      dnsHostName: 'acme-ws-084.acme.corp',
      operatingSystem: 'Windows 11 Pro 23H2 (Build 22631.3880)',
      ouPath: 'OU=Workstations,OU=HQ,DC=acme,DC=corp',
      ipAddress: '192.168.10.84',
      status: 'AgentConnected',
      pingMs: 4,
      lastSeen: new Date(now.getTime() - 2 * 60000).toISOString(),
      agentInstalled: true,
      agentVersion: '1.4.0',
      lastHeartbeat: new Date(now.getTime() - 2 * 60000).toISOString(),
      installedPackageIds: ['pkg-teamviewer', 'pkg-chrome', 'pkg-7zip', 'pkg-m365'],
      customerProfileId: 'cust-acme',
      description: 'Engineering Workstation - Desk 4B',
      currentUser: 'ACME\\jdoe',
      uptimeHours: 72,
    },
    {
      id: 'comp-02',
      name: 'ACME-WS-085',
      dnsHostName: 'acme-ws-085.acme.corp',
      operatingSystem: 'Windows 11 Pro 23H2 (Build 22631.3880)',
      ouPath: 'OU=Workstations,OU=HQ,DC=acme,DC=corp',
      ipAddress: '192.168.10.85',
      status: 'Online',
      pingMs: 6,
      lastSeen: new Date(now.getTime() - 5 * 60000).toISOString(),
      agentInstalled: false,
      installedPackageIds: ['pkg-chrome', 'pkg-7zip'],
      customerProfileId: 'cust-acme',
      description: 'Operations Workstation - Desk 4C',
      currentUser: 'ACME\\mweber',
      uptimeHours: 24,
    },
    {
      id: 'comp-03',
      name: 'ACME-LAP-102',
      dnsHostName: 'acme-lap-102.acme.corp',
      operatingSystem: 'Windows 11 Enterprise 23H2',
      ouPath: 'OU=Laptops,OU=FieldStaff,DC=acme,DC=corp',
      ipAddress: '192.168.20.102',
      status: 'Offline',
      lastSeen: new Date(now.getTime() - 14 * 3600000).toISOString(),
      agentInstalled: true,
      agentVersion: '1.4.0',
      lastHeartbeat: new Date(now.getTime() - 14 * 3600000).toISOString(),
      installedPackageIds: ['pkg-teamviewer', 'pkg-chrome', 'pkg-7zip'],
      customerProfileId: 'cust-acme',
      description: 'Sales Field Laptop - Lenovo T14 Gen 4',
      currentUser: 'ACME\\tschmidt',
      uptimeHours: 0,
    },
    {
      id: 'comp-04',
      name: 'ACME-FIN-01',
      dnsHostName: 'acme-fin-01.acme.corp',
      operatingSystem: 'Windows 11 Pro 23H2',
      ouPath: 'OU=Finance,OU=HQ,DC=acme,DC=corp',
      ipAddress: '192.168.15.22',
      status: 'AgentConnected',
      pingMs: 3,
      lastSeen: new Date(now.getTime() - 1 * 60000).toISOString(),
      agentInstalled: true,
      agentVersion: '1.4.0',
      lastHeartbeat: new Date(now.getTime() - 1 * 60000).toISOString(),
      installedPackageIds: ['pkg-teamviewer', 'pkg-chrome', 'pkg-7zip', 'pkg-m365', 'pkg-crowdstrike'],
      customerProfileId: 'cust-acme',
      description: 'Accounting Chief Terminal',
      currentUser: 'ACME\\aklein',
      uptimeHours: 168,
    },
    {
      id: 'comp-05',
      name: 'ACME-PROD-02',
      dnsHostName: 'acme-prod-02.acme.corp',
      operatingSystem: 'Windows 10 Enterprise LTSC 2021',
      ouPath: 'OU=Production,OU=ShopFloor,DC=acme,DC=corp',
      ipAddress: '192.168.40.12',
      status: 'Offline',
      lastSeen: new Date(now.getTime() - 28 * 3600000).toISOString(),
      agentInstalled: false,
      installedPackageIds: ['pkg-7zip'],
      customerProfileId: 'cust-acme',
      description: 'Factory Assembly Line Controller 2',
      uptimeHours: 0,
    },
    {
      id: 'comp-06',
      name: 'MED-CLINIC-04',
      dnsHostName: 'med-clinic-04.medicare.local',
      operatingSystem: 'Windows 11 Pro 23H2',
      ouPath: 'OU=TreatmentRooms,OU=Clinics,DC=medicare,DC=local',
      ipAddress: '10.20.4.14',
      status: 'AgentConnected',
      pingMs: 5,
      lastSeen: new Date(now.getTime() - 4 * 60000).toISOString(),
      agentInstalled: true,
      agentVersion: '1.4.0',
      lastHeartbeat: new Date(now.getTime() - 4 * 60000).toISOString(),
      installedPackageIds: ['pkg-teamviewer', 'pkg-chrome', 'pkg-vlc', 'pkg-acrobat'],
      customerProfileId: 'cust-medicare',
      description: 'Exam Room 4 Clinical All-in-One',
      currentUser: 'MEDICARE\\dr_fischer',
      uptimeHours: 48,
    },
    {
      id: 'comp-07',
      name: 'MED-NURSE-02',
      dnsHostName: 'med-nurse-02.medicare.local',
      operatingSystem: 'Windows 10 Pro 22H2',
      ouPath: 'OU=WardStations,OU=Clinics,DC=medicare,DC=local',
      ipAddress: '10.20.5.21',
      status: 'Offline',
      lastSeen: new Date(now.getTime() - 3 * 3600000).toISOString(),
      agentInstalled: true,
      agentVersion: '1.3.9',
      lastHeartbeat: new Date(now.getTime() - 3 * 3600000).toISOString(),
      installedPackageIds: ['pkg-teamviewer', 'pkg-chrome'],
      customerProfileId: 'cust-medicare',
      description: 'Station 2 Mobile Cart',
      currentUser: 'MEDICARE\\nurse_braun',
      uptimeHours: 0,
    },
    {
      id: 'comp-08',
      name: 'CLOUD-DEV-01',
      dnsHostName: 'cloud-dev-01.cloudscale.io',
      operatingSystem: 'Windows 11 Enterprise 23H2',
      ouPath: 'OU=Engineers,OU=DevOps,DC=cloudscale,DC=io',
      ipAddress: '172.16.100.45',
      status: 'AgentConnected',
      pingMs: 2,
      lastSeen: new Date(now.getTime() - 10 * 1000).toISOString(),
      agentInstalled: true,
      agentVersion: '1.4.0',
      lastHeartbeat: new Date(now.getTime() - 10 * 1000).toISOString(),
      installedPackageIds: ['pkg-chrome', 'pkg-notepadpp', 'pkg-7zip'],
      customerProfileId: 'cust-cloudscale',
      description: 'DevOps Senior Workstation',
      currentUser: 'CLOUDSCALE\\srichter',
      uptimeHours: 240,
    },
    {
      id: 'comp-09',
      name: 'CLOUD-DEV-02',
      dnsHostName: 'cloud-dev-02.cloudscale.io',
      operatingSystem: 'Windows 11 Enterprise 23H2',
      ouPath: 'OU=Engineers,OU=DevOps,DC=cloudscale,DC=io',
      ipAddress: '172.16.100.46',
      status: 'Online',
      pingMs: 4,
      lastSeen: new Date(now.getTime() - 12 * 60000).toISOString(),
      agentInstalled: false,
      installedPackageIds: ['pkg-chrome'],
      customerProfileId: 'cust-cloudscale',
      description: 'Frontend Developer Workstation',
      currentUser: 'CLOUDSCALE\\lbecker',
      uptimeHours: 18,
    },
    {
      id: 'comp-10',
      name: 'PROXMOX-TEST-VM01',
      dnsHostName: 'proxmox-test-vm01.lab.internal',
      operatingSystem: 'Windows 11 Pro 23H2 (Clean Test Template)',
      ouPath: 'OU=Sandbox,OU=Lab,DC=corp,DC=internal,DC=net',
      ipAddress: '192.168.99.11',
      status: 'AgentConnected',
      pingMs: 1,
      lastSeen: new Date(now.getTime() - 30 * 1000).toISOString(),
      agentInstalled: true,
      agentVersion: '1.4.0',
      lastHeartbeat: new Date(now.getTime() - 30 * 1000).toISOString(),
      installedPackageIds: [],
      customerProfileId: 'cust-acme',
      description: 'Dedicated Proxmox VE Package Verification Sandbox (PVE VMID 9001)',
      currentUser: 'SYSTEM',
      uptimeHours: 3,
    },
  ];

  const insert = db.prepare('INSERT INTO ad_computers (id, name, data, updated_at) VALUES (?, ?, ?, ?)');
  for (const c of sampleComputers) {
    insert.run(c.id, c.name, JSON.stringify(c), c.lastSeen);
  }
}

// -------------------------------------------------------------
// QUEUED TASKS STORE (OFFLINE WAIT-TASKS & AGENT DISPATCH)
// -------------------------------------------------------------
export function getAllQueuedTasks(): QueuedTask[] {
  const rows = db.prepare('SELECT data FROM queued_tasks ORDER BY created_at DESC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function getQueuedTasksForMachine(machineName: string): QueuedTask[] {
  const rows = db.prepare("SELECT data FROM queued_tasks WHERE LOWER(machine_name) = LOWER(?) AND status IN ('queued', 'dispatching') ORDER BY created_at ASC").all(machineName) as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function saveQueuedTask(task: QueuedTask): QueuedTask {
  const existing = db.prepare('SELECT id FROM queued_tasks WHERE id = ?').get(task.id) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE queued_tasks SET machine_name = ?, status = ?, data = ? WHERE id = ?').run(
      task.machineName,
      task.status,
      JSON.stringify(task),
      task.id
    );
  } else {
    db.prepare('INSERT INTO queued_tasks (id, machine_name, status, data, created_at) VALUES (?, ?, ?, ?, ?)').run(
      task.id,
      task.machineName,
      task.status,
      JSON.stringify(task),
      task.createdAt || new Date().toISOString()
    );
  }
  return task;
}

export function updateQueuedTaskStatus(
  id: string,
  status: QueuedTask['status'],
  resultLog?: string,
  exitCode?: number
): QueuedTask | null {
  const row = db.prepare('SELECT data FROM queued_tasks WHERE id = ?').get(id) as { data: string } | undefined;
  if (!row) return null;
  const task: QueuedTask = JSON.parse(row.data);
  task.status = status;
  if (status === 'completed' || status === 'failed') {
    task.completedAt = new Date().toISOString();
  } else if (status === 'dispatching' || status === 'running') {
    task.dispatchedAt = new Date().toISOString();
  }
  if (resultLog !== undefined) task.resultLog = resultLog;
  if (exitCode !== undefined) task.exitCode = exitCode;

  db.prepare('UPDATE queued_tasks SET status = ?, data = ? WHERE id = ?').run(
    status,
    JSON.stringify(task),
    id
  );
  return task;
}

export function deleteQueuedTask(id: string): boolean {
  const info = db.prepare('DELETE FROM queued_tasks WHERE id = ?').run(id);
  return info.changes > 0;
}

export function seedInitialQueuedTasksIfEmpty() {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM queued_tasks').get() as { cnt: number }).cnt;
  if (count > 0) return;

  const now = new Date();
  const sampleTasks: QueuedTask[] = [
    {
      id: 'task-q-01',
      machineName: 'ACME-LAP-102',
      taskType: 'SoftwareInstall',
      title: 'Install CrowdStrike Falcon Sensor & M365 Apps',
      status: 'queued',
      payload: {
        packageIds: ['pkg-crowdstrike', 'pkg-m365'],
        customerProfileId: 'cust-acme',
      },
      executionMode: 'agent_system',
      serviceAccount: 'CORP\\svc_fdim_runner',
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      createdBy: 'Helpdesk (Field Deployment)',
      retryCount: 0,
      maxRetries: 3,
    },
    {
      id: 'task-q-02',
      machineName: 'ACME-PROD-02',
      taskType: 'ConfigSwitch',
      title: 'Apply Active Directory Admin Delegation & RDP Firewall',
      status: 'queued',
      payload: {
        switchIds: ['sw-rdp', 'sw-adgroup'],
        switchParameters: { adAdminGroupName: 'ACME\\IT-Workstation-Admins' },
      },
      executionMode: 'service_account',
      serviceAccount: 'CORP\\svc_fdim_runner',
      createdAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
      createdBy: 'Admin (System Configuration)',
      retryCount: 0,
      maxRetries: 3,
    },
  ];

  for (const t of sampleTasks) {
    saveQueuedTask(t);
  }
}

// -------------------------------------------------------------
// PACKAGE SANDBOX TESTS STORE (PROXMOX & TEST RUNS)
// -------------------------------------------------------------
export function getAllPackageTests(): PackageSandboxTest[] {
  const rows = db.prepare('SELECT data FROM package_tests ORDER BY started_at DESC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function savePackageTest(test: PackageSandboxTest): PackageSandboxTest {
  const existing = db.prepare('SELECT id FROM package_tests WHERE id = ?').get(test.id) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE package_tests SET data = ? WHERE id = ?').run(JSON.stringify(test), test.id);
  } else {
    db.prepare('INSERT INTO package_tests (id, package_id, data, started_at) VALUES (?, ?, ?, ?)').run(
      test.id,
      test.packageId,
      JSON.stringify(test),
      test.startedAt || new Date().toISOString()
    );
  }
  return test;
}

// Users / Auth
export function getAllUsers(): AuthUser[] {
  const rows = db.prepare('SELECT data FROM users').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function findUserByUsername(username: string): AuthUser | null {
  const row = db.prepare('SELECT data FROM users WHERE LOWER(username) = LOWER(?)').get(username) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function saveUser(user: AuthUser): AuthUser {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE users SET username = ?, data = ? WHERE id = ?').run(user.username, JSON.stringify(user), user.id);
  } else {
    db.prepare('INSERT INTO users (id, username, data) VALUES (?, ?, ?)').run(user.id, user.username, JSON.stringify(user));
  }
  return user;
}

// Database stats & file info
export function getDatabaseMetadata() {
  let fileSize = 0;
  try {
    const stats = fs.statSync(dbPath);
    fileSize = stats.size;
  } catch {
    fileSize = 0;
  }

  const packageCount = (db.prepare('SELECT COUNT(*) as cnt FROM packages').get() as { cnt: number }).cnt;
  const customerCount = (db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number }).cnt;
  const deploymentCount = (db.prepare('SELECT COUNT(*) as cnt FROM deployments').get() as { cnt: number }).cnt;
  const switchCount = (db.prepare('SELECT COUNT(*) as cnt FROM system_switches').get() as { cnt: number }).cnt;
  const adComputerCount = (db.prepare('SELECT COUNT(*) as cnt FROM ad_computers').get() as { cnt: number }).cnt;
  const queuedTaskCount = (db.prepare("SELECT COUNT(*) as cnt FROM queued_tasks WHERE status = 'queued'").get() as { cnt: number }).cnt;

  return {
    engine: 'SQLite (Node.js 22 Native DatabaseSync)',
    path: dbPath,
    fileSizeBytes: fileSize,
    fileSizeFormatted: `${(fileSize / 1024).toFixed(1)} KB`,
    stats: {
      packages: packageCount,
      customers: customerCount,
      deployments: deploymentCount,
      systemSwitches: switchCount,
      adComputers: adComputerCount,
      queuedTasks: queuedTaskCount,
    },
  };
}

export function getDatabaseFilePath(): string {
  return dbPath;
}

// -------------------------------------------------------------
// COMPUTER HISTORY & INSTALLATION AUDIT TIMELINE
// -------------------------------------------------------------

export function getComputerHistory(machineName: string) {
  const compRow = db.prepare('SELECT data FROM ad_computers WHERE LOWER(name) = LOWER(?)').get(machineName) as { data: string } | undefined;
  const computer: ADComputer | null = compRow ? JSON.parse(compRow.data) : null;

  // Deployments for this machine
  const depRows = db.prepare('SELECT data FROM deployments WHERE LOWER(machine_name) = LOWER(?) ORDER BY started_at DESC').all(machineName) as Array<{ data: string }>;
  const deployments: DeploymentRecord[] = depRows.map((r) => JSON.parse(r.data));

  // Queued & completed agent tasks for this machine
  const taskRows = db.prepare('SELECT data FROM queued_tasks WHERE LOWER(machine_name) = LOWER(?) ORDER BY created_at DESC').all(machineName) as Array<{ data: string }>;
  const tasks: QueuedTask[] = taskRows.map((r) => JSON.parse(r.data));

  // Packages map
  const allPkgs = getAllPackages();
  const pkgMap = new Map(allPkgs.map((p) => [p.id, p]));

  // Build timeline of package installations
  const installationTimeline: Array<{
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
  }> = [];

  // 1. From deployments
  for (const dep of deployments) {
    const isQuick = dep.deploymentType === 'QuickSoftwareInstall';
    const method = isQuick ? 'Quick Deploy' : 'FDIM Staging';
    for (const pkgId of dep.selectedPackageIds || []) {
      const pkg = pkgMap.get(pkgId);
      const pkgMethod = pkg?.installerType === 'Winget' ? 'Winget' : (pkgId === 'pkg-outlook-classic' ? 'ODT Click-to-Run' : method);
      installationTimeline.push({
        id: `inst-${dep.id}-${pkgId}`,
        machineName: dep.machineName,
        packageName: pkg?.name || pkgId,
        packageVersion: pkg?.version || '1.0',
        category: pkg?.category || 'General',
        installedAt: dep.completedAt || dep.startedAt,
        method: pkgMethod,
        status: dep.status === 'Completed' ? 'Success' : (dep.status === 'Failed' ? 'Failed' : 'Success'),
        exitCode: 0,
        technician: dep.technicianName || 'Domain Admin',
        deploymentRecordId: dep.id,
      });
    }
  }

  // 2. From agent tasks
  for (const task of tasks) {
    if (task.status === 'completed' && task.payload?.packageIds) {
      for (const pkgId of task.payload.packageIds) {
        const pkg = pkgMap.get(pkgId);
        // Avoid duplicate if already in timeline around same timestamp
        const exists = installationTimeline.some((item) => item.packageName === (pkg?.name || pkgId) && Math.abs(new Date(item.installedAt).getTime() - new Date(task.completedAt || task.createdAt).getTime()) < 60000);
        if (!exists) {
          installationTimeline.push({
            id: `inst-task-${task.id}-${pkgId}`,
            machineName: task.machineName,
            packageName: pkg?.name || pkgId,
            packageVersion: pkg?.version || '1.0',
            category: pkg?.category || 'General',
            installedAt: task.completedAt || task.createdAt,
            method: 'Agent Task',
            status: 'Success',
            exitCode: task.exitCode ?? 0,
            technician: task.createdBy || 'Agent SYSTEM',
          });
        }
      }
    }
  }

  // 3. Fallback: If computer has installedPackageIds not yet in timeline
  if (computer && Array.isArray(computer.installedPackageIds)) {
    for (const pkgId of computer.installedPackageIds) {
      const pkg = pkgMap.get(pkgId);
      const name = pkg?.name || pkgId;
      if (!installationTimeline.some((item) => item.packageName === name)) {
        installationTimeline.push({
          id: `inst-ad-${computer.id}-${pkgId}`,
          machineName: computer.name,
          packageName: name,
          packageVersion: pkg?.version || 'Detected',
          category: pkg?.category || 'Inventory',
          installedAt: computer.lastSeen || new Date().toISOString(),
          method: pkg?.sourceType === 'winget' ? 'Winget' : (pkgId === 'pkg-outlook-classic' ? 'ODT Click-to-Run' : 'FDIM Staging'),
          status: 'Success',
          exitCode: 0,
          technician: 'Baseline Inventory',
        });
      }
    }
  }

  // Sort newest first
  installationTimeline.sort((a, b) => new Date(b.installedAt).getTime() - new Date(a.installedAt).getTime());

  return {
    computer,
    timeline: installationTimeline,
    deployments,
    tasks,
  };
}

// -------------------------------------------------------------
// FIRST-RUN USER LOGON SNIPPETS STORE
// -------------------------------------------------------------

export function getAllFirstRunSnippets(): UserLogonStagingSnippet[] {
  const rows = db.prepare('SELECT data FROM first_run_snippets ORDER BY updated_at DESC').all() as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data));
}

export function getFirstRunSnippetById(id: string): UserLogonStagingSnippet | null {
  const row = db.prepare('SELECT data FROM first_run_snippets WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function saveFirstRunSnippet(snippet: UserLogonStagingSnippet): UserLogonStagingSnippet {
  const now = new Date().toISOString();
  const toSave = { ...snippet, updatedAt: now };
  const existing = db.prepare('SELECT id FROM first_run_snippets WHERE id = ?').get(snippet.id);
  if (existing) {
    db.prepare('UPDATE first_run_snippets SET data = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(toSave),
      now,
      snippet.id
    );
  } else {
    db.prepare('INSERT INTO first_run_snippets (id, data, updated_at) VALUES (?, ?, ?)').run(
      snippet.id,
      JSON.stringify(toSave),
      now
    );
  }
  return toSave;
}

export function deleteFirstRunSnippet(id: string): boolean {
  const info = db.prepare('DELETE FROM first_run_snippets WHERE id = ?').run(id);
  return info.changes > 0;
}

export function seedInitialFirstRunSnippetsIfEmpty(): UserLogonStagingSnippet[] {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM first_run_snippets').get() as { cnt: number }).cnt;
  if (count > 0) {
    return getAllFirstRunSnippets();
  }

  const defaultTemplates: UserLogonStagingSnippet[] = [
    {
      id: 'snip-outlook-sig',
      name: 'Map Corporate Outlook Signature Template',
      description: 'Pre-populates the local Outlook signature directory and sets default signature registry keys in HKCU.',
      category: 'Outlook & Mail',
      enabled: true,
      author: 'FDIM System',
      isGlobalTemplate: true,
      tags: ['Outlook', 'Email', 'Signatures', 'Office'],
      script: `# Ensure Outlook Signatures directory exists in user AppData
$sigDir = "$env:APPDATA\\Microsoft\\Signatures"
if (-not (Test-Path $sigDir)) { New-Item -ItemType Directory -Path $sigDir -Force | Out-Null }

# Check for corporate UNC signature template or generate localized signature
$uncSig = "\\\\corp-fs01.internal.net\\deployments\\templates\\CorporateSignature.htm"
if (Test-Path $uncSig) {
    Copy-Item -Path $uncSig -Destination "$sigDir\\Corporate.htm" -Force
    Write-UserLog "Copied corporate Outlook signature from $uncSig" "SUCCESS"
} else {
    $sigContent = "<html><body><font face='Segoe UI' size='2'><b>$env:USERNAME</b><br>Corporate Workstation User<br><font color='#0284c7'>FDIM Managed Endpoint</font></font></body></html>"
    Set-Content -Path "$sigDir\\Corporate.htm" -Value $sigContent -Encoding UTF8
    Write-UserLog "Generated default local Outlook signature file" "SUCCESS"
}

# Configure Outlook Mail Profile default signature registry keys
$outlookReg = "HKCU:\\Software\\Microsoft\\Office\\16.0\\Common\\MailSettings"
if (-not (Test-Path $outlookReg)) { New-Item -Path $outlookReg -Force | Out-Null }
Set-ItemProperty -Path $outlookReg -Name "NewSignature" -Value "Corporate" -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path $outlookReg -Name "ReplySignature" -Value "Corporate" -Force -ErrorAction SilentlyContinue`,
    },
    {
      id: 'snip-intranet-shortcut',
      name: 'Pin Corporate Intranet to Desktop & Start Menu',
      description: 'Creates prominent desktop and Start Menu shortcuts linking employees to company internal portal & ERP.',
      category: 'Shortcuts & Desktop',
      enabled: true,
      author: 'FDIM System',
      isGlobalTemplate: true,
      tags: ['Desktop', 'Shortcuts', 'Intranet', 'Web'],
      script: `# Create Corporate Desktop & Start Menu Web Shortcuts
$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = $wsh.CreateShortcut("$desktop\\Corporate Intranet Portal.url")
$shortcut.TargetPath = "https://intranet.corp.internal.net"
$shortcut.Save()

# Pin to user Quick Launch / Start Menu if directory exists
$programs = [Environment]::GetFolderPath("Programs")
if (Test-Path $programs) {
    $startShortcut = $wsh.CreateShortcut("$programs\\Corporate Intranet Portal.url")
    $startShortcut.TargetPath = "https://intranet.corp.internal.net"
    $startShortcut.Save()
}
Write-UserLog "Created Intranet desktop & Start Menu shortcuts" "SUCCESS"`,
    },
    {
      id: 'snip-onedrive-kfm',
      name: 'OneDrive Silent Account Config & Known Folder Move',
      description: 'Silently activates OneDrive business sync and redirects user Desktop, Documents, and Pictures folders to OneDrive.',
      category: 'OneDrive & Cloud',
      enabled: true,
      author: 'FDIM System',
      isGlobalTemplate: true,
      tags: ['OneDrive', 'Backup', 'KFM', 'Cloud'],
      script: `# Enable OneDrive Silent Business Configuration & Known Folder Move
$odReg = "HKCU:\\Software\\Microsoft\\OneDrive"
if (-not (Test-Path $odReg)) { New-Item -Path $odReg -Force | Out-Null }
Set-ItemProperty -Path $odReg -Name "EnableAddAccounts" -Value 1 -Force
Set-ItemProperty -Path $odReg -Name "SilentAccountConfig" -Value 1 -Force
Set-ItemProperty -Path $odReg -Name "KFMSilentOptIn" -Value "1" -Force
Write-UserLog "Configured OneDrive Silent Account Provisioning & KFM" "SUCCESS"`,
    },
    {
      id: 'snip-edge-policies',
      name: 'Configure Enterprise Edge Policies & Tab Sync',
      description: 'Sets corporate homepage, disables first-run promotional splash banners, and enables work profile synchronization.',
      category: 'Browser & Web',
      enabled: true,
      author: 'FDIM System',
      isGlobalTemplate: true,
      tags: ['Edge', 'Browser', 'Policies', 'Intranet'],
      script: `# Enforce corporate Edge browser defaults and suppress promotional splash screens
$edgeKey = "HKCU:\\Software\\Policies\\Microsoft\\Edge"
if (-not (Test-Path $edgeKey)) { New-Item -Path $edgeKey -Force | Out-Null }
Set-ItemProperty -Path $edgeKey -Name "HomepageLocation" -Value "https://portal.office.com" -Force
Set-ItemProperty -Path $edgeKey -Name "RestoreOnStartup" -Value 4 -Force
Set-ItemProperty -Path $edgeKey -Name "HideFirstRunExperience" -Value 1 -Force
Set-ItemProperty -Path $edgeKey -Name "ShowHomeButton" -Value 1 -Force
Write-UserLog "Applied Microsoft Edge enterprise browser policies" "SUCCESS"`,
    },
    {
      id: 'snip-corp-wallpaper',
      name: 'Apply Company Branded Desktop Wallpaper',
      description: 'Sets official company desktop background with lockscreen compliance from network share or local staging.',
      category: 'Shortcuts & Desktop',
      enabled: false,
      author: 'FDIM System',
      isGlobalTemplate: true,
      tags: ['Wallpaper', 'Branding', 'Appearance'],
      script: `# Set corporate background wallpaper
$uncWallpaper = "\\\\corp-fs01.internal.net\\deployments\\assets\\corporate-wallpaper.jpg"
$localWallpaper = "$env:LOCALAPPDATA\\FDIM\\corporate-wallpaper.jpg"

if (Test-Path $uncWallpaper) {
    Copy-Item -Path $uncWallpaper -Destination $localWallpaper -Force
    Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "Wallpaper" -Value $localWallpaper -Force
    rundll32.exe user32.dll,UpdatePerUserSystemParameters 1, True
    Write-UserLog "Applied company wallpaper from $uncWallpaper" "SUCCESS"
} else {
    Write-UserLog "Wallpaper UNC share not reachable; retaining Windows standard theme" "INFO"
}`,
    },
    {
      id: 'snip-powershell-profile',
      name: 'Initialize Technician / User PowerShell Profile',
      description: 'Creates user PowerShell $PROFILE with UTF-8 encoding, timestamp prompt, and helpful administrative aliases.',
      category: 'Custom',
      enabled: false,
      author: 'FDIM System',
      isGlobalTemplate: true,
      tags: ['PowerShell', 'DevOps', 'Profile'],
      script: `# Create user PowerShell Profile
$profilePath = "$env:USERPROFILE\\Documents\\WindowsPowerShell\\Microsoft.PowerShell_profile.ps1"
$profileDir = Split-Path $profilePath
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }

$profileContent = @'
# FDIM Workstation Shell Profile
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function prompt { "[$env:COMPUTERNAME\\$env:USERNAME] $(Get-Date -Format 'HH:mm:ss') \`nPS> " }
Set-Alias -Name ll -Value Get-ChildItem -ErrorAction SilentlyContinue
'@

Set-Content -Path $profilePath -Value $profileContent -Encoding UTF8 -Force
Write-UserLog "Initialized user PowerShell profile at $profilePath" "SUCCESS"`,
    },
    {
      id: 'snip-screen-saver-lock',
      name: 'Enforce Interactive Screen Lock on 15m Inactivity',
      description: 'Sets user screen saver timeout to 900 seconds (15 min) and requires password authentication on resume.',
      category: 'Security & Policies',
      enabled: true,
      author: 'FDIM System',
      isGlobalTemplate: true,
      tags: ['Security', 'ScreenLock', 'Compliance'],
      script: `# Enforce workstation screen lock security policy
$deskReg = "HKCU:\\Control Panel\\Desktop"
Set-ItemProperty -Path $deskReg -Name "ScreenSaveActive" -Value "1" -Force
Set-ItemProperty -Path $deskReg -Name "ScreenSaverIsSecure" -Value "1" -Force
Set-ItemProperty -Path $deskReg -Name "ScreenSaveTimeOut" -Value "900" -Force
Write-UserLog "Enforced 15-minute screen lock security policy" "SUCCESS"`,
    },
  ];

  const insertSnippet = db.prepare('INSERT OR REPLACE INTO first_run_snippets (id, data, updated_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  for (const snip of defaultTemplates) {
    insertSnippet.run(snip.id, JSON.stringify(snip), now);
  }

  return defaultTemplates;
}


