import { AppSettings } from '../types';

export const DEFAULT_CLIENT_SETTINGS: AppSettings = {
  defaultGlobalDomain: 'corp.local',
  authMode: 'local',
  adLdapConfig: {
    ldapUrl: '',
    domain: '',
    baseDn: '',
    bindDn: '',
    userSearchFilter: '(sAMAccountName={username})',
    adminGroup: 'Domain Admins',
    computerSearchOu: '',
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
  },
};

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}
