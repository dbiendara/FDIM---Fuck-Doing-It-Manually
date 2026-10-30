import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
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
    machine_name TEXT,
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

// Auto-migrate schema: ensure machine_name column exists on deployments table and backfill
try {
  const colInfo = db.prepare("PRAGMA table_info(deployments)").all() as Array<{ name: string }>;
  if (!colInfo.some((c) => c.name === 'machine_name')) {
    db.exec("ALTER TABLE deployments ADD COLUMN machine_name TEXT;");
    const existingDeps = db.prepare("SELECT id, data FROM deployments").all() as Array<{ id: string; data: string }>;
    const updateStmt = db.prepare("UPDATE deployments SET machine_name = ? WHERE id = ?");
    for (const row of existingDeps) {
      try {
        const parsed = JSON.parse(row.data);
        if (parsed?.machineName) {
          updateStmt.run(parsed.machineName, row.id);
        }
      } catch {}
    }
  }
} catch (err) {
  console.warn('Deployments schema migration check:', err);
}

// -------------------------------------------------------------
// USER AUTHENTICATION & PASSWORD UTILITIES
// -------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash?: string, username?: string): boolean {
  if (!password) return false;

  if (!storedHash) {
    // If no passwordHash is set yet, check standard initial defaults
    const lowerUser = (username || '').toLowerCase();
    if (lowerUser === 'admin' && (password === 'admin' || password === 'password')) {
      return true;
    }
    if (lowerUser === 'technician' && (password === 'technician' || password === 'password')) {
      return true;
    }
    return false;
  }

  // Cryptographic salt:hash format
  if (storedHash.includes(':')) {
    try {
      const [salt, key] = storedHash.split(':');
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  // Plaintext fallback (legacy)
  return password === storedHash;
}

export function sanitizeUser(user: AuthUser | null | undefined): AuthUser | null {
  if (!user) return null;
  const copy = { ...user };
  delete copy.passwordHash;
  return copy;
}

// Auto-migrate schema: ensure users have secure passwordHash
try {
  const existingUsers = db.prepare('SELECT id, username, data FROM users').all() as Array<{ id: string; username: string; data: string }>;
  const updateUserStmt = db.prepare('UPDATE users SET data = ? WHERE id = ?');
  for (const u of existingUsers) {
    try {
      const parsed: AuthUser = JSON.parse(u.data);
      if (!parsed.passwordHash) {
        if (parsed.username.toLowerCase() === 'admin') {
          parsed.passwordHash = hashPassword('admin');
          updateUserStmt.run(JSON.stringify(parsed), u.id);
        } else if (parsed.username.toLowerCase() === 'technician') {
          parsed.passwordHash = hashPassword('technician');
          updateUserStmt.run(JSON.stringify(parsed), u.id);
        }
      }
    } catch {}
  }
} catch (err) {
  console.warn('Users password migration check:', err);
}

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

  // Production mode: Do NOT seed demo customer profiles or demo deployment records.
  // One-time cleanup of any previously seeded demo data so the workspace is clean for production.
  const cleanMigration = db.prepare('SELECT value FROM settings WHERE key = ?').get('production_clean_v3') as { value: string } | undefined;
  if (!cleanMigration) {
    db.prepare("DELETE FROM customers WHERE id IN ('cust-acme', 'cust-contoso', 'cust-nexus', 'cust-apex', 'cust-medicare', 'cust-cloudscale') OR data LIKE '%Contoso Enterprise%'").run();
    db.prepare("DELETE FROM ad_computers WHERE id LIKE 'comp-0%' OR id = 'comp-10' OR id LIKE 'comp-ad-%' OR data LIKE '%Newly domain-joined computer discovered%' OR data LIKE '%Primary domain workstation discovered%' OR data LIKE '%Mobile domain client discovered%' OR data LIKE '%Imported into FDIM Suite%'").run();
    db.prepare("DELETE FROM deployments WHERE id LIKE 'dep-init-%'").run();
    db.prepare("DELETE FROM queued_tasks WHERE id IN ('task-q-01', 'task-q-02')").run();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('production_clean_v3', 'true');
  }

  const insertSwitch = db.prepare('INSERT OR IGNORE INTO system_switches (id, data, updated_at) VALUES (?, ?, ?)');
  for (const sw of initialSwitches) {
    insertSwitch.run(sw.id, JSON.stringify(sw), new Date().toISOString());
  }

  // Initial App Settings (use RFC-safe .local default so public wildcard DNS never hijacks internal hostnames)
  const defaultSettings: AppSettings = {
    defaultGlobalDomain: 'corp.local',
    authMode: 'local',
    adLdapConfig: {
      ldapUrl: '',
      domain: '',
      baseDn: '',
      bindDn: '',
      userSearchFilter: '(sAMAccountName={username})',
      adminGroup: 'Domain Admins',
    },
    keycloakConfig: {
      serverUrl: '',
      realm: 'enterprise',
      clientId: 'fdim-suite',
      clientSecret: '',
      redirectUri: '',
    },
    runnerServiceAccount: {
      enabled: false,
      username: 'Administrator',
      domain: '',
      description: 'Dedicated elevated service account for Helpdesk delegated package deployment without local admin rights',
      delegatedHelpdeskAllowed: true,
    },
    proxmoxConfig: {
      enabled: false,
      apiUrl: '',
      node: 'pve-node1',
      vmTemplateId: 9000,
      cleanSnapshotName: 'clean-baseline',
      autoRollback: true,
    },
    agentConfig: {
      heartbeatIntervalMinutes: 30,
      bootDelayMinutes: 5,
      serverUrl: '',
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
  } else {
    try {
      const parsed = JSON.parse(settingsRow.value) as AppSettings;
      let changed = false;
      if (parsed.defaultGlobalDomain === 'corp.internal.net') {
        parsed.defaultGlobalDomain = 'corp.local';
        changed = true;
      }
      if (parsed.adLdapConfig?.ldapUrl === 'ldaps://dc01.corp.internal.net:636') {
        parsed.adLdapConfig.ldapUrl = '';
        parsed.adLdapConfig.domain = '';
        parsed.adLdapConfig.baseDn = '';
        parsed.adLdapConfig.bindDn = '';
        changed = true;
      }
      if (parsed.agentConfig?.serverUrl === 'http://fdim.corp.internal:3000') {
        parsed.agentConfig.serverUrl = '';
        changed = true;
      }
      if (changed) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('global', JSON.stringify(parsed));
      }
    } catch {
      // ignore
    }
  }
  // Also remove any test/bogus computer that got the 172.104.149.86 wildcard IP
  db.prepare("DELETE FROM ad_computers WHERE data LIKE '%172.104.149.86%'").run();

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
      passwordHash: hashPassword('admin'),
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
      passwordHash: hashPassword('technician'),
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
  const machineName = dep.machineName || '';
  if (existing) {
    try {
      db.prepare('UPDATE deployments SET data = ?, machine_name = ? WHERE id = ?').run(JSON.stringify(dep), machineName, dep.id);
    } catch {
      db.prepare('UPDATE deployments SET data = ? WHERE id = ?').run(JSON.stringify(dep), dep.id);
    }
  } else {
    try {
      db.prepare('INSERT INTO deployments (id, machine_name, data, started_at) VALUES (?, ?, ?, ?)').run(
        dep.id,
        machineName,
        JSON.stringify(dep),
        dep.startedAt || new Date().toISOString()
      );
    } catch {
      db.prepare('INSERT INTO deployments (id, data, started_at) VALUES (?, ?, ?)').run(
        dep.id,
        JSON.stringify(dep),
        dep.startedAt || new Date().toISOString()
      );
    }
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

export function saveADComputersBatch(computers: ADComputer[]): ADComputer[] {
  if (!computers || computers.length === 0) return [];
  const checkStmt = db.prepare('SELECT id FROM ad_computers WHERE id = ? OR LOWER(name) = LOWER(?)');
  const updateStmt = db.prepare('UPDATE ad_computers SET data = ?, updated_at = ? WHERE id = ?');
  const insertStmt = db.prepare('INSERT INTO ad_computers (id, name, data, updated_at) VALUES (?, ?, ?, ?)');
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const comp of computers) {
      const existing = checkStmt.get(comp.id, comp.name) as { id: string } | undefined;
      if (existing) {
        updateStmt.run(JSON.stringify(comp), now, existing.id);
      } else {
        insertStmt.run(comp.id, comp.name, JSON.stringify(comp), now);
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
  return computers;
}

export function deleteADComputer(id: string): boolean {
  const info = db.prepare('DELETE FROM ad_computers WHERE id = ?').run(id);
  return info.changes > 0;
}

export function seedInitialADComputersIfEmpty() {
  // Production mode: Do not seed demo AD computers.
}

export function clearProductionWorkspace(options?: {
  clearCustomers?: boolean;
  clearComputers?: boolean;
  clearDeployments?: boolean;
  clearTasks?: boolean;
}) {
  if (options?.clearCustomers !== false) {
    db.prepare('DELETE FROM customers').run();
  }
  if (options?.clearComputers !== false) {
    db.prepare('DELETE FROM ad_computers').run();
  }
  if (options?.clearDeployments !== false) {
    db.prepare('DELETE FROM deployments').run();
  }
  if (options?.clearTasks !== false) {
    db.prepare('DELETE FROM queued_tasks').run();
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
  // Production mode: Do not seed demo queued tasks.
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

export function saveUser(user: AuthUser, plainPassword?: string): AuthUser {
  if (plainPassword) {
    user.passwordHash = hashPassword(plainPassword);
  }
  const existing = db
    .prepare('SELECT id, data FROM users WHERE id = ? OR LOWER(username) = LOWER(?)')
    .get(user.id, user.username) as { id: string; data: string } | undefined;
  if (existing) {
    let parsedExisting: AuthUser | null = null;
    try {
      parsedExisting = JSON.parse(existing.data);
    } catch {}
    const updatedUser: AuthUser = {
      ...parsedExisting,
      ...user,
      id: existing.id,
      passwordHash: user.passwordHash || parsedExisting?.passwordHash,
    };
    db.prepare('UPDATE users SET username = ?, data = ? WHERE id = ?').run(
      updatedUser.username,
      JSON.stringify(updatedUser),
      existing.id
    );
    return updatedUser;
  } else {
    if (!user.passwordHash && plainPassword) {
      user.passwordHash = hashPassword(plainPassword);
    }
    db.prepare('INSERT INTO users (id, username, data) VALUES (?, ?, ?)').run(
      user.id,
      user.username,
      JSON.stringify(user)
    );
    return user;
  }
}

export function deleteUser(id: string): boolean {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
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

// Helper: robust date parsing handling ISO strings, timestamps, and European DD.MM.YYYY formats
function parseDateToIso(raw: any, fallback?: string): string {
  if (!raw) return fallback || new Date().toISOString();
  if (typeof raw === 'number' && !isNaN(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'Invalid Date') return fallback || new Date().toISOString();
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
    // European / German DD.MM.YYYY [HH:mm[:ss]]
    const euMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (euMatch) {
      const day = parseInt(euMatch[1], 10);
      const month = parseInt(euMatch[2], 10) - 1;
      const year = parseInt(euMatch[3], 10);
      const hour = euMatch[4] ? parseInt(euMatch[4], 10) : 0;
      const min = euMatch[5] ? parseInt(euMatch[5], 10) : 0;
      const sec = euMatch[6] ? parseInt(euMatch[6], 10) : 0;
      const parsed = new Date(year, month, day, hour, min, sec);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return fallback || new Date().toISOString();
}

// -------------------------------------------------------------
// COMPUTER HISTORY & INSTALLATION AUDIT TIMELINE
// -------------------------------------------------------------

export function getComputerHistory(machineName: string) {
  const compRow = db.prepare('SELECT data FROM ad_computers WHERE LOWER(name) = LOWER(?)').get(machineName) as { data: string } | undefined;
  const computer: ADComputer | null = compRow ? JSON.parse(compRow.data) : null;

  // Deployments for this machine (bulletproof: supports machine_name column and in-memory JSON fallback)
  let deployments: DeploymentRecord[] = [];
  try {
    const depRows = db.prepare('SELECT data FROM deployments WHERE LOWER(machine_name) = LOWER(?) ORDER BY started_at DESC').all(machineName) as Array<{ data: string }>;
    deployments = depRows.map((r) => JSON.parse(r.data));
  } catch {
    const allDeployments = getAllDeployments();
    deployments = allDeployments.filter(
      (d) => (d.machineName || '').toLowerCase() === machineName.toLowerCase()
    );
  }

  // Queued & completed agent tasks for this machine
  let tasks: QueuedTask[] = [];
  try {
    const taskRows = db.prepare('SELECT data FROM queued_tasks WHERE LOWER(machine_name) = LOWER(?) ORDER BY created_at DESC').all(machineName) as Array<{ data: string }>;
    tasks = taskRows.map((r) => JSON.parse(r.data));
  } catch {
    const allTasks = getAllQueuedTasks();
    tasks = allTasks.filter(
      (t) => (t.machineName || '').toLowerCase() === machineName.toLowerCase()
    );
  }

  // Packages map
  const allPkgs = getAllPackages();
  const pkgMap = new Map(allPkgs.map((p) => [p.id, p]));

  // Customer map
  const allCustomers = getAllCustomers();
  const customerMap = new Map(allCustomers.map((c) => [c.id, c]));

  // Enrich tasks with packageNames, outputLog, and timestamps
  const enrichedTasks = tasks.map((t) => {
    const rawPayload: any = t.payload || {};
    const pkgIds: string[] = rawPayload.packageIds || (t as any).packageIds || [];
    let pkgNames = Array.isArray(pkgIds) ? pkgIds.map((id) => pkgMap.get(id)?.name || id).filter(Boolean) : [];
    if (pkgNames.length === 0 && Array.isArray((t as any).packageNames)) {
      pkgNames = (t as any).packageNames.filter(Boolean);
    }
    if (pkgNames.length === 0 && Array.isArray(rawPayload.packageNames)) {
      pkgNames = rawPayload.packageNames.filter(Boolean);
    }
    if (pkgNames.length === 0 && Array.isArray((t as any).packages)) {
      pkgNames = (t as any).packages.filter(Boolean);
    }
    if (pkgNames.length === 0) {
      if (t.taskType === 'SoftwareInstall' || t.taskType === 'SoftwareDeploy') {
        pkgNames = ['Standard Software Deployment'];
      } else if (t.taskType === 'CustomScript') {
        pkgNames = ['PowerShell Administrative Script'];
      }
    }

    const fallbackTitle = t.title || `${t.taskType || 'Task'} on ${t.machineName}`;
    const outputLog = t.resultLog || (t as any).outputLog || (t as any).log || '';
    const startedAt = parseDateToIso(t.dispatchedAt || t.createdAt);
    const timestamp = parseDateToIso(t.completedAt || t.dispatchedAt || t.createdAt);

    return {
      ...t,
      title: fallbackTitle,
      packageNames: pkgNames,
      outputLog,
      startedAt,
      timestamp,
      createdAt: parseDateToIso(t.createdAt),
      dispatchedAt: t.dispatchedAt ? parseDateToIso(t.dispatchedAt) : undefined,
      completedAt: t.completedAt ? parseDateToIso(t.completedAt) : undefined,
    };
  });

  // Enrich deployments with customerName, durationSeconds, packageNames, typeLabel
  const compCustomer = computer ? customerMap.get(computer.customerProfileId) : undefined;
  const enrichedDeployments = deployments.map((d) => {
    const cust = customerMap.get(d.customerProfileId) || compCustomer || allCustomers[0];
    const rawCustName = (d.customerCompanyName || cust?.companyName || (cust as any)?.name || '').trim();
    const customerName = rawCustName || (compCustomer?.companyName) || (allCustomers[0]?.companyName) || 'Corporate Client';
    const domainName = (d.domainName || cust?.domainName || computer?.domain || 'corp.local').trim();

    const startIso = parseDateToIso(d.startedAt);
    const compIso = parseDateToIso(d.completedAt, startIso);
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(compIso).getTime();
    const durationSeconds = !isNaN(startMs) && !isNaN(endMs) && endMs >= startMs ? Math.round((endMs - startMs) / 1000) : 0;

    let pkgNames = (d.selectedPackageIds || []).map((id) => pkgMap.get(id)?.name || id).filter(Boolean);
    if (pkgNames.length === 0 && computer && Array.isArray(computer.installedPackageIds) && computer.installedPackageIds.length > 0) {
      pkgNames = computer.installedPackageIds.map((id) => pkgMap.get(id)?.name || id).filter(Boolean);
    }
    if (pkgNames.length === 0) {
      pkgNames = ['Full System Configuration & Policies'];
    }

    const typeLabel = d.deploymentType === 'QuickSoftwareInstall' ? 'Quick Software Deploy' : 'Full Zero-Touch Provisioning';

    return {
      ...d,
      customerName,
      domainName,
      startedAt: startIso,
      completedAt: compIso,
      timestamp: compIso,
      durationSeconds,
      packageNames: pkgNames,
      typeLabel,
    };
  });

  // Build unified timeline
  const unifiedTimeline: Array<{
    id: string;
    type: 'deployment' | 'task' | 'inventory';
    title: string;
    subtitle: string;
    status: 'Completed' | 'Success' | 'Failed' | 'In Progress' | 'Queued';
    timestamp: string;
    actor: string;
    packages: string[];
    details?: string;
  }> = [];

  // 1. From deployments
  for (const dep of enrichedDeployments) {
    const safeTitle = dep.customerName ? `${dep.customerName} — ${dep.typeLabel}` : dep.typeLabel;
    unifiedTimeline.push({
      id: `ev-dep-${dep.id}`,
      type: 'deployment',
      title: safeTitle,
      subtitle: `Domain: ${dep.domainName || 'corp.local'} • ${dep.packageNames.length} package(s) staged`,
      status: dep.status === 'Completed' ? 'Completed' : (dep.status === 'Failed' ? 'Failed' : 'In Progress'),
      timestamp: dep.timestamp,
      actor: dep.technicianName || 'Admin (FDIM Live Runner)',
      packages: dep.packageNames,
      details: dep.durationSeconds > 0 ? `Completed in ${dep.durationSeconds}s` : undefined,
    });
  }

  // 2. From agent tasks
  for (const t of enrichedTasks) {
    const safeTaskTitle = t.title || `${t.taskType || 'Task'} on ${t.machineName}`;
    unifiedTimeline.push({
      id: `ev-task-${t.id}`,
      type: 'task',
      title: safeTaskTitle,
      subtitle: t.executor || (t.serviceAccount ? `Runner: ${t.serviceAccount}` : `Mode: ${t.executionMode || 'remote'}`),
      status: t.status === 'completed' || t.status === 'Completed' ? 'Completed' : (t.status === 'failed' || t.status === 'Failed' ? 'Failed' : 'Queued'),
      timestamp: t.completedAt || t.dispatchedAt || t.createdAt || t.timestamp,
      actor: t.createdBy || t.executor || 'System',
      packages: t.packageNames,
      details: t.resultLog ? t.resultLog.slice(0, 150) : undefined,
    });
  }

  // 3. Fallback: If computer has installedPackageIds not yet in timeline
  if (computer && Array.isArray(computer.installedPackageIds)) {
    for (const pkgId of computer.installedPackageIds) {
      const pkg = pkgMap.get(pkgId);
      const name = pkg?.name || pkgId;
      if (!unifiedTimeline.some((item) => item.packages.includes(name))) {
        unifiedTimeline.push({
          id: `inst-ad-${computer.id}-${pkgId}`,
          type: 'inventory',
          title: `Detected Software: ${name}`,
          subtitle: `Category: ${pkg?.category || 'Inventory'} • Version: ${pkg?.version || 'Installed'}`,
          status: 'Completed',
          timestamp: computer.lastSeen || computer.lastHeartbeat || new Date().toISOString(),
          actor: 'Active Directory Inventory Sync',
          packages: [name],
        });
      }
    }
  }

  // Sort newest first
  unifiedTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Summary counts
  const totalDeployments = deployments.length;
  const completedDeployments = deployments.filter((d) => d.status === 'Completed').length;
  const failedDeployments = deployments.filter((d) => d.status === 'Failed').length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'Completed').length;
  const failedTasks = tasks.filter((t) => t.status === 'failed' || t.status === 'Failed').length;

  return {
    computer,
    summary: {
      totalDeployments,
      completedDeployments,
      failedDeployments: failedDeployments + failedTasks,
      totalTasks,
      completedTasks,
      failedTasks,
    },
    timeline: unifiedTimeline,
    deployments: enrichedDeployments,
    tasks: enrichedTasks,
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
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8
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


