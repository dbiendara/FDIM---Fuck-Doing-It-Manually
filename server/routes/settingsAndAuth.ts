import { Router } from 'express';
import { Client as LdapClient } from 'ldapts';
import { AuthUser } from '../../src/types/index.ts';
import {
  getAppSettings,
  updateAppSettings,
  getDatabaseMetadata,
  getDatabaseFilePath,
  getAllUsers,
  findUserByUsername,
  saveUser,
  deleteUser,
  hashPassword,
  verifyPassword,
  sanitizeUser,
} from '../db.ts';
import {
  getActiveSessionUser,
  setActiveSessionUser,
  getSettingsWithRuntimeInfo,
} from '../state.ts';
import {
  normalizeLdapUrl,
  executeAdBind,
  testActiveDirectoryConnection,
} from '../services/network.ts';

export const settingsAndAuthRouter = Router();

// -------------------------------------------------------------
// APP SETTINGS & DATABASE MANAGEMENT API
// -------------------------------------------------------------

settingsAndAuthRouter.get('/settings', (_req, res) => {
  res.json(getSettingsWithRuntimeInfo());
});

settingsAndAuthRouter.put('/settings', (req, res) => {
  updateAppSettings(req.body);
  res.json(getSettingsWithRuntimeInfo());
});

settingsAndAuthRouter.get(['/database/info', '/settings/db-info'], (_req, res) => {
  try {
    res.json(getDatabaseMetadata());
  } catch (err: any) {
    console.error('Error in /api/database/info:', err);
    res.status(500).json({ error: err?.message || 'Failed to retrieve database metadata' });
  }
});

settingsAndAuthRouter.get('/database/download', (_req, res) => {
  const dbFile = getDatabaseFilePath();
  res.download(dbFile, 'fdim-database.sqlite');
});

// -------------------------------------------------------------
// AUTHENTICATION & LOGIN API (Active Directory / Keycloak / Local)
// -------------------------------------------------------------

settingsAndAuthRouter.get('/auth/me', (_req, res) => {
  res.json({
    user: sanitizeUser(getActiveSessionUser()),
    appSettings: getSettingsWithRuntimeInfo(),
  });
});

settingsAndAuthRouter.post('/auth/login', async (req, res) => {
  const { username, password, provider, domain } = req.body;
  const settings = getAppSettings();

  // 1. Keycloak SSO Authentication
  if (provider === 'keycloak') {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required for Keycloak authentication' });
    }
    const kcConfig = settings.keycloakConfig;
    if (!kcConfig?.serverUrl || !kcConfig?.clientId) {
      return res.status(400).json({
        error: 'Keycloak SSO is not configured on this server. Please log in using Local authentication or configure Keycloak in Settings.',
      });
    }

    try {
      const tokenUrl = `${kcConfig.serverUrl.replace(/\/+$/, '')}/realms/${encodeURIComponent(kcConfig.realm || 'enterprise')}/protocol/openid-connect/token`;
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', kcConfig.clientId);
      if (kcConfig.clientSecret) {
        params.append('client_secret', kcConfig.clientSecret);
      }
      params.append('username', String(username).trim());
      params.append('password', String(password));

      const kcRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!kcRes.ok) {
        const errJson: any = await kcRes.json().catch(() => ({}));
        return res.status(401).json({
          error: `Keycloak authentication failed: ${errJson.error_description || errJson.error || 'Invalid credentials'}`,
        });
      }

      const existingLocal = findUserByUsername(username);
      const kcUser: AuthUser = {
        id: existingLocal?.id || `usr-kc-${username.toLowerCase()}`,
        username,
        displayName: existingLocal?.displayName || `${username} (Keycloak SSO)`,
        domain: domain || settings.defaultGlobalDomain,
        role: existingLocal?.role || 'Administrator',
        authProvider: 'keycloak',
        avatarInitials: username.slice(0, 2).toUpperCase(),
        showProfanity: existingLocal?.showProfanity !== false,
      };

      saveUser(kcUser);
      const sanitized = sanitizeUser(kcUser);
      setActiveSessionUser(sanitized);
      return res.json({ success: true, user: sanitized });
    } catch (err: any) {
      return res.status(500).json({
        error: `Failed to connect to Keycloak server: ${err?.message || 'Server unreachable'}`,
      });
    }
  }

  // 2. Active Directory / LDAP Bind Authentication
  if (provider === 'active_directory') {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required for Active Directory authentication' });
    }

    const adConfig = settings.adLdapConfig;
    if (!adConfig?.ldapUrl) {
      return res.status(400).json({
        error: 'Active Directory is not configured on this server. Please log in using Local authentication or configure LDAP in Settings / Setup Wizard.',
      });
    }

    const cleanUser = username.includes('\\') ? username.split('\\')[1] : username.split('@')[0];
    const userDomain = domain || adConfig.domain || settings.defaultGlobalDomain || 'CORP';

    const normalizedUrl = normalizeLdapUrl(adConfig.ldapUrl);
    if (!normalizedUrl) {
      return res.status(500).json({ error: 'Invalid LDAP URL configured in settings.' });
    }

    const client = new LdapClient({
      url: normalizedUrl,
      timeout: 7000,
      connectTimeout: 5000,
      tlsOptions: { rejectUnauthorized: false },
    });

    try {
      const bindResult = await executeAdBind(
        client,
        username,
        password,
        userDomain,
        adConfig.baseDn,
        normalizedUrl
      );

      await client.unbind().catch(() => {});

      if (!bindResult.bound) {
        return res.status(401).json({
          error: bindResult.error || `Active Directory authentication failed for "${username}".`,
        });
      }

      const isAdmin =
        cleanUser.toLowerCase() === 'administrator' ||
        (adConfig.adminGroup && username.toLowerCase().includes(adConfig.adminGroup.toLowerCase()));

      const existingLocal = findUserByUsername(cleanUser) || findUserByUsername(`${userDomain}\\${cleanUser}`);
      const adUser: AuthUser = {
        id: existingLocal?.id || `usr-ad-${cleanUser.toLowerCase()}`,
        username: `${userDomain}\\${cleanUser}`,
        displayName: existingLocal?.displayName || `${cleanUser} (Domain ${isAdmin ? 'Admin' : 'User'})`,
        domain: userDomain,
        role: existingLocal?.role || (isAdmin ? 'Administrator' : 'Technician'),
        authProvider: 'active_directory',
        avatarInitials: cleanUser.slice(0, 2).toUpperCase(),
        showProfanity: existingLocal?.showProfanity !== false,
      };

      saveUser(adUser);
      const sanitized = sanitizeUser(adUser);
      setActiveSessionUser(sanitized);
      return res.json({ success: true, user: sanitized });
    } catch (err: any) {
      await client.unbind().catch(() => {});
      return res.status(500).json({
        error: `Active Directory connection failed: ${err?.message || 'Domain Controller unreachable'}`,
      });
    }
  }

  // 3. Local Authentication with Strict Verification
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = String(username).trim();
  const existing = findUserByUsername(cleanUsername);

  if (!existing) {
    return res.status(401).json({
      error: `Authentication failed: User "${cleanUsername}" does not exist.`,
    });
  }

  const isValid = verifyPassword(String(password), existing.passwordHash, existing.username);
  if (!isValid) {
    return res.status(401).json({
      error: 'Authentication failed: Incorrect password.',
    });
  }

  if (!existing.passwordHash || !existing.passwordHash.includes(':')) {
    existing.passwordHash = hashPassword(password);
    saveUser(existing);
  }

  const sanitized = sanitizeUser(existing);
  setActiveSessionUser(sanitized);
  res.json({ success: true, user: sanitized });
});

settingsAndAuthRouter.post('/auth/logout', (_req, res) => {
  setActiveSessionUser(null);
  res.json({ success: true, user: null });
});

// -------------------------------------------------------------
// USER MANAGEMENT API (Admin Operations)
// -------------------------------------------------------------

settingsAndAuthRouter.get('/users', (_req, res) => {
  const users = getAllUsers().map(sanitizeUser);
  res.json(users);
});

settingsAndAuthRouter.post('/users', (req, res) => {
  const { username, displayName, role, password, domain } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = String(username).trim();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const existing = findUserByUsername(cleanUsername);
  if (existing) {
    return res.status(400).json({ error: `User "${cleanUsername}" already exists` });
  }

  const settings = getAppSettings();
  const newUser: AuthUser = {
    id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    username: cleanUsername,
    displayName: displayName || cleanUsername,
    domain: domain || settings.defaultGlobalDomain || 'LOCAL',
    role: role === 'Administrator' ? 'Administrator' : 'Technician',
    authProvider: 'local',
    avatarInitials: cleanUsername.slice(0, 2).toUpperCase(),
    showProfanity: true,
    passwordHash: hashPassword(String(password)),
  };

  const saved = saveUser(newUser);
  res.status(201).json(sanitizeUser(saved));
});

settingsAndAuthRouter.put('/users/:id/password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const all = getAllUsers();
  const target = all.find((u) => u.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isAdmin = getActiveSessionUser()?.role === 'Administrator';
  if (!isAdmin || currentPassword) {
    const isValid = verifyPassword(String(currentPassword || ''), target.passwordHash, target.username);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  target.passwordHash = hashPassword(String(newPassword));
  const updated = saveUser(target);
  res.json({
    success: true,
    message: `Password updated successfully for ${target.username}`,
    user: sanitizeUser(updated),
  });
});

settingsAndAuthRouter.delete('/users/:id', (req, res) => {
  const all = getAllUsers();
  const target = all.find((u) => u.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const admins = all.filter((u) => u.role === 'Administrator');
  if (target.role === 'Administrator' && admins.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the sole Administrator account' });
  }

  deleteUser(target.id);
  res.json({ success: true, message: `User ${target.username} deleted` });
});

settingsAndAuthRouter.post('/auth/test-ad', async (req, res) => {
  const { ldapUrl, domain, baseDn, bindDn, bindPassword } = req.body;
  if (!ldapUrl) {
    return res.status(400).json({ error: 'LDAP URL is required' });
  }

  const result = await testActiveDirectoryConnection({
    ldapUrl,
    domain,
    baseDn,
    bindDn,
    bindPassword,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error,
      message: result.message,
      dcHost: result.dcHost,
    });
  }

  res.json({
    success: true,
    message: result.message,
    dcHost: result.dcHost,
    computerCount: result.computerCount,
    bindDnValid: !!bindDn,
    baseDn: baseDn || '',
    timestamp: new Date().toISOString(),
  });
});

settingsAndAuthRouter.post('/auth/preferences', (req, res) => {
  const { showProfanity } = req.body;
  const activeUser = getActiveSessionUser();
  if (typeof showProfanity === 'boolean' && activeUser) {
    activeUser.showProfanity = showProfanity;
    try {
      saveUser(activeUser);
    } catch (err) {
      console.warn('Could not persist user to SQLite:', err);
    }
  }
  res.json({ success: true, user: activeUser });
});
