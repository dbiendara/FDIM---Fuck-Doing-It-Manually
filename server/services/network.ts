import net from 'node:net';
import dns from 'node:dns';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client as LdapClient } from 'ldapts';

const execFileAsync = promisify(execFile);

export function isValidResolvedIp(ip?: string | null): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('unresolved') || trimmed === '172.104.149.86') return false;
  return true;
}

export function normalizeLdapUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^ldaps?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.endsWith(':636')) return `ldaps://${trimmed}`;
  return `ldap://${trimmed}`;
}

export function probeTcpPort(
  host: string,
  port: number,
  timeoutMs = 1200
): Promise<{ alive: boolean; portOpen: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (alive: boolean, portOpen: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ alive, portOpen, latencyMs: Math.max(1, Date.now() - start) });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true, true));
    socket.once('timeout', () => finish(false, false));
    socket.once('error', (err: any) => {
      if (err && err.code === 'ECONNREFUSED') {
        finish(true, false);
      } else {
        finish(false, false);
      }
    });

    try {
      socket.connect(port, host);
    } catch {
      finish(false, false);
    }
  });
}

export async function resolveAndProbeHost(
  hostname: string,
  explicitIp?: string,
  domainSuffix?: string
): Promise<{
  ipAddress: string;
  dnsHostName: string;
  reachable: boolean;
  latencyMs?: number;
  openPorts: number[];
}> {
  const cleanHost = hostname.trim();
  const rawDomain = (domainSuffix || '').trim().replace(/^\.+|\.+$/g, '');
  const domainClean = rawDomain.toLowerCase() === 'corp.internal.net' ? 'corp.local' : rawDomain;
  const fqdn =
    cleanHost.includes('.') || !domainClean
      ? cleanHost.toLowerCase()
      : `${cleanHost.toLowerCase()}.${domainClean.toLowerCase()}`;

  let resolvedIp = isValidResolvedIp(explicitIp) ? explicitIp!.trim() : '';

  if (!resolvedIp && net.isIP(cleanHost)) {
    resolvedIp = cleanHost;
  }

  if (!resolvedIp) {
    try {
      const res = await dns.promises.lookup(cleanHost, { family: 4 });
      if (res && res.address && res.address !== '172.104.149.86') resolvedIp = res.address;
    } catch {
      if (fqdn !== cleanHost.toLowerCase() && !fqdn.endsWith('.internal.net')) {
        try {
          const resFqdn = await dns.promises.lookup(fqdn, { family: 4 });
          if (resFqdn && resFqdn.address && resFqdn.address !== '172.104.149.86') {
            resolvedIp = resFqdn.address;
          }
        } catch {
          // DNS could not resolve
        }
      }
    }
  }

  if (!resolvedIp) {
    return {
      ipAddress: 'Unresolved (DNS)',
      dnsHostName: fqdn,
      reachable: false,
      latencyMs: undefined,
      openPorts: [],
    };
  }

  const portsToCheck = [445, 5985, 5986, 3389, 135];
  const probeResults = await Promise.all(portsToCheck.map((p) => probeTcpPort(resolvedIp, p, 1200)));
  const aliveProbes = probeResults.filter((r) => r.alive);
  const openPorts = portsToCheck.filter((_, idx) => probeResults[idx].portOpen);

  if (aliveProbes.length > 0) {
    const minLatency = Math.min(...aliveProbes.map((r) => r.latencyMs));
    return {
      ipAddress: resolvedIp,
      dnsHostName: fqdn,
      reachable: true,
      latencyMs: minLatency,
      openPorts,
    };
  }

  try {
    const start = Date.now();
    await execFileAsync('ping', ['-c', '1', '-W', '1', resolvedIp], { timeout: 1500 });
    return {
      ipAddress: resolvedIp,
      dnsHostName: fqdn,
      reachable: true,
      latencyMs: Math.max(1, Date.now() - start),
      openPorts: [],
    };
  } catch {
    return {
      ipAddress: resolvedIp,
      dnsHostName: fqdn,
      reachable: false,
      latencyMs: undefined,
      openPorts: [],
    };
  }
}

export function formatAdBindCandidates(
  rawBind: string | undefined,
  domain?: string,
  baseDn?: string,
  ldapUrl?: string
): string[] {
  const candidates: string[] = [];
  const raw = (rawBind || '').trim();
  if (!raw) return candidates;

  const pushUnique = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }
  };

  let fqdn = '';
  if (baseDn) {
    const dcParts = baseDn
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^dc=/i.test(s))
      .map((s) => s.replace(/^dc=/i, '').trim())
      .filter(Boolean);
    if (dcParts.length > 0) fqdn = dcParts.join('.');
  }
  if (!fqdn && ldapUrl) {
    try {
      const host = new URL(normalizeLdapUrl(ldapUrl)).hostname;
      if (host && host.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        const parts = host.split('.');
        if (parts.length >= 2) {
          fqdn = parts.length > 2 ? parts.slice(1).join('.') : host;
        }
      }
    } catch {}
  }

  const netbiosDomain = (domain || '').replace(/\\.*$/, '').trim() || (fqdn ? fqdn.split('.')[0].toUpperCase() : '');

  pushUnique(raw);

  const isDn = /^CN=|^UID=/i.test(raw);
  const isUpn = raw.includes('@');
  const isDownLevel = raw.includes('\\');

  if (!isDn) {
    const bareUser = isDownLevel ? raw.split('\\')[1] : isUpn ? raw.split('@')[0] : raw;

    if (fqdn) {
      pushUnique(`${bareUser}@${fqdn}`);
    }
    if (domain && domain.includes('.')) {
      pushUnique(`${bareUser}@${domain}`);
    }
    if (netbiosDomain) {
      pushUnique(`${netbiosDomain}\\${bareUser}`);
    }
    if (baseDn) {
      pushUnique(`CN=${bareUser},CN=Users,${baseDn}`);
    }
  }

  return candidates;
}

export async function executeAdBind(
  client: LdapClient,
  rawBindDn: string,
  password: string,
  domain?: string,
  baseDn?: string,
  ldapUrl?: string
): Promise<{ bound: boolean; usedPrincipal: string; error?: string }> {
  const candidates = formatAdBindCandidates(rawBindDn, domain, baseDn, ldapUrl);
  let lastError: any = null;

  for (const candidate of candidates) {
    try {
      await client.bind(candidate, password);
      return { bound: true, usedPrincipal: candidate };
    } catch (err: any) {
      lastError = err;
      const codeStr = String(err?.code || err?.message || '');
      if (codeStr.includes('ECONNREFUSED') || codeStr.includes('ETIMEDOUT') || codeStr.includes('ENOTFOUND')) {
        break;
      }
    }
  }

  const rawMsg = lastError?.message || 'LDAP bind failed';
  let friendlyHint = '';
  if (rawMsg.includes('52e') || rawMsg.includes('InvalidCredentials')) {
    friendlyHint =
      'Invalid Credentials (AD error 52e). Tip: Try using the User Principal Name (e.g. "administrator@domain.local") or "DOMAIN\\\\Administrator" instead of a bare username or wrong OU path.';
  } else if (rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ETIMEDOUT')) {
    friendlyHint = 'Could not connect to Domain Controller port (389/636). Verify firewall and server IP/FQDN.';
  } else if (rawMsg.includes('ENOTFOUND')) {
    friendlyHint = 'Domain Controller hostname could not be resolved via DNS.';
  }

  return {
    bound: false,
    usedPrincipal: candidates[0] || rawBindDn,
    error: friendlyHint ? `${rawMsg} — ${friendlyHint}` : rawMsg,
  };
}

export async function testActiveDirectoryConnection(config: {
  ldapUrl: string;
  domain?: string;
  baseDn?: string;
  bindDn?: string;
  bindPassword?: string;
}): Promise<{
  success: boolean;
  message: string;
  error?: string;
  dcHost: string;
  computerCount?: number;
}> {
  const url = normalizeLdapUrl(config.ldapUrl);
  if (!url) {
    return { success: false, dcHost: '', error: 'LDAP URL is empty', message: 'LDAP URL is required' };
  }

  let dcHost = url;
  let port = url.startsWith('ldaps://') ? 636 : 389;
  try {
    const parsed = new URL(url);
    dcHost = parsed.hostname;
    if (parsed.port) port = parseInt(parsed.port, 10);
  } catch {}

  const tcpCheck = await probeTcpPort(dcHost, port, 3000);
  if (!tcpCheck.portOpen) {
    return {
      success: false,
      dcHost,
      error: `Cannot reach Active Directory Domain Controller at ${dcHost}:${port}. Ensure server IP/FQDN is reachable on LAN/VPN and port ${port} is open.`,
      message: `Connection refused / timed out to ${dcHost}:${port}`,
    };
  }

  const client = new LdapClient({
    url,
    timeout: 6000,
    connectTimeout: 4000,
    tlsOptions: { rejectUnauthorized: false },
  });

  try {
    let usedPrincipal = 'anonymous';
    if (config.bindDn && config.bindPassword) {
      const bindResult = await executeAdBind(
        client,
        config.bindDn,
        config.bindPassword,
        config.domain,
        config.baseDn,
        url
      );
      if (!bindResult.bound) {
        await client.unbind().catch(() => {});
        return {
          success: false,
          dcHost,
          error: `AD Bind failed (tried ${bindResult.usedPrincipal}): ${bindResult.error}`,
          message: `LDAP Bind failed: ${bindResult.error}`,
        };
      }
      usedPrincipal = bindResult.usedPrincipal;
    }

    let computerCount: number | undefined;
    if (config.baseDn) {
      try {
        const { searchEntries } = await client.search(config.baseDn, {
          scope: 'sub',
          filter: '(objectClass=computer)',
          attributes: ['cn'],
          sizeLimit: 500,
        });
        computerCount = searchEntries.length;
      } catch {
        // Ignore search error if anonymous bind doesn't allow search
      }
    }

    await client.unbind().catch(() => {});
    return {
      success: true,
      dcHost,
      computerCount,
      message: `Connected cleanly to Domain Controller (${dcHost}:${port}) via ${usedPrincipal}${
        computerCount !== undefined ? ` — verified access to ${computerCount} AD computer objects` : ''
      }.`,
    };
  } catch (err: any) {
    await client.unbind().catch(() => {});
    return {
      success: false,
      dcHost,
      error: err?.message || 'LDAP communication error',
      message: `LDAP Error: ${err?.message || 'Authentication/connection failed'}`,
    };
  }
}

import {
  getAllADComputers,
  getAllCustomers,
  saveADComputersBatch,
} from '../db.ts';
import type { ADComputer } from '../../src/types/index.ts';

export async function queryActiveDirectoryComputers(options: {
  ldapUrl: string;
  domain: string;
  baseDn: string;
  bindDn?: string;
  bindPassword?: string;
  searchOu?: string;
  specificNames?: string[];
  customerProfileId?: string;
  defaultGlobalDomain?: string;
}): Promise<{
  success: boolean;
  discovered: ADComputer[];
  updated: ADComputer[];
  totalFoundInAd: number;
  searchedBase: string;
  error?: string;
}> {
  const normalizedUrl = normalizeLdapUrl(options.ldapUrl);
  if (!normalizedUrl) {
    return {
      success: false,
      discovered: [],
      updated: [],
      totalFoundInAd: 0,
      searchedBase: '',
      error: 'No Active Directory LDAP URL configured. Configure AD in Settings or Setup Wizard.',
    };
  }

  const client = new LdapClient({
    url: normalizedUrl,
    timeout: 8000,
    connectTimeout: 6000,
    tlsOptions: { rejectUnauthorized: false },
  });

  const primarySearchBase = (options.searchOu || options.baseDn || '').trim();
  const fallbackBaseDn = (options.baseDn || '').trim();

  try {
    const bindResult = await executeAdBind(
      client,
      options.bindDn || '',
      options.bindPassword || '',
      options.domain,
      options.baseDn,
      normalizedUrl
    );

    if (!bindResult.bound) {
      await client.unbind().catch(() => {});
      return {
        success: false,
        discovered: [],
        updated: [],
        totalFoundInAd: 0,
        searchedBase: primarySearchBase,
        error: bindResult.error || 'Active Directory authentication failed',
      };
    }

    let filter = '(objectClass=computer)';
    if (options.specificNames && options.specificNames.length > 0) {
      const subFilters = options.specificNames
        .map((n) => n.trim().replace(/[()*\\]/g, ''))
        .filter(Boolean)
        .map((n) => `(cn=${n})(name=${n})(sAMAccountName=${n}$)`)
        .join('');
      if (subFilters) {
        filter = `(&(objectClass=computer)(|${subFilters}))`;
      }
    }

    const attributes = [
      'cn',
      'name',
      'sAMAccountName',
      'dNSHostName',
      'operatingSystem',
      'operatingSystemVersion',
      'distinguishedName',
      'description',
    ];

    let entries: any[] = [];
    let actualSearchedBase = primarySearchBase;

    try {
      const res = await client.search(primarySearchBase, {
        scope: 'sub',
        filter,
        attributes,
      });
      entries = res.searchEntries || [];
    } catch (searchErr: any) {
      if (fallbackBaseDn && fallbackBaseDn.toLowerCase() !== primarySearchBase.toLowerCase()) {
        actualSearchedBase = fallbackBaseDn;
        const fallbackRes = await client.search(fallbackBaseDn, {
          scope: 'sub',
          filter,
          attributes,
        });
        entries = fallbackRes.searchEntries || [];
      } else {
        throw searchErr;
      }
    }

    if (entries.length === 0 && fallbackBaseDn && fallbackBaseDn.toLowerCase() !== primarySearchBase.toLowerCase()) {
      try {
        const fallbackRes = await client.search(fallbackBaseDn, {
          scope: 'sub',
          filter,
          attributes,
        });
        if (fallbackRes.searchEntries && fallbackRes.searchEntries.length > 0) {
          entries = fallbackRes.searchEntries;
          actualSearchedBase = fallbackBaseDn;
        }
      } catch {
        // Keep empty entries
      }
    }

    await client.unbind().catch(() => {});

    const existing = getAllADComputers();
    const discovered: ADComputer[] = [];
    const updated: ADComputer[] = [];
    const nowIso = new Date().toISOString();

    for (const entry of entries) {
      const rawName = String(entry.cn || entry.name || entry.sAMAccountName || '')
        .replace(/\$$/, '')
        .trim()
        .toUpperCase();
      if (!rawName) continue;

      const dn = String(entry.distinguishedName || entry.dn || '');
      const ouParts = dn.split(',').slice(1).join(',');
      const ouPath = ouParts || actualSearchedBase;
      const dnsHost = String(
        entry.dNSHostName || `${rawName.toLowerCase()}.${options.defaultGlobalDomain || options.domain.toLowerCase()}`
      );
      const osName = String(entry.operatingSystem || 'Windows Workstation');
      const osVer = entry.operatingSystemVersion ? ` (${entry.operatingSystemVersion})` : '';
      const desc = entry.description
        ? Array.isArray(entry.description)
          ? String(entry.description[0])
          : String(entry.description)
        : '';

      const probe = await resolveAndProbeHost(dnsHost || rawName, undefined, options.defaultGlobalDomain || options.domain);
      const existingComp = existing.find((e) => e.name.toLowerCase() === rawName.toLowerCase());

      if (existingComp) {
        existingComp.dnsHostName = dnsHost || existingComp.dnsHostName;
        existingComp.operatingSystem = `${osName}${osVer}`;
        existingComp.ouPath = ouPath;
        if (isValidResolvedIp(probe.ipAddress)) {
          existingComp.ipAddress = probe.ipAddress;
        }
        if (desc) existingComp.description = desc;
        if (existingComp.agentInstalled && probe.reachable) {
          existingComp.status = 'AgentConnected';
        } else {
          existingComp.status = probe.reachable ? 'Online' : 'Offline';
        }
        existingComp.pingMs = probe.latencyMs;
        if (probe.reachable) existingComp.lastSeen = nowIso;
        updated.push(existingComp);
      } else {
        const newComp: ADComputer = {
          id: `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          name: rawName,
          dnsHostName: dnsHost,
          operatingSystem: `${osName}${osVer}`,
          ouPath,
          ipAddress: probe.ipAddress,
          status: probe.reachable ? 'Online' : 'Offline',
          pingMs: probe.latencyMs,
          lastSeen: nowIso,
          agentInstalled: false,
          installedPackageIds: [],
          customerProfileId: options.customerProfileId || getAllCustomers()[0]?.id || '',
          description: desc || `Synced from Active Directory (${ouPath})`,
          uptimeHours: 0,
        };
        discovered.push(newComp);
      }
    }

    saveADComputersBatch([...discovered, ...updated]);

    return {
      success: true,
      discovered,
      updated,
      totalFoundInAd: entries.length,
      searchedBase: actualSearchedBase,
    };
  } catch (err: any) {
    await client.unbind().catch(() => {});
    const code = err?.code || err?.name || 'LDAP_ERROR';
    let errorDetail = err?.message || 'Unable to reach Domain Controller';
    if (/DSID-0C090A5A/i.test(errorDetail)) {
      errorDetail =
        'Active Directory rejected LDAP search: Windows Server requires an authenticated bind to query computer objects (anonymous queries are prohibited). Please provide a valid domain account (e.g. administrator@corp.local or CORP\\Administrator) and password.';
    }
    return {
      success: false,
      discovered: [],
      updated: [],
      totalFoundInAd: 0,
      searchedBase: primarySearchBase,
      error: `Active Directory LDAP query failed at ${normalizedUrl} (${code}): ${errorDetail}`,
    };
  }
}
