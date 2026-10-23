import React, { useState, useEffect } from 'react';
import {
  SoftwarePackage,
  CustomerProfile,
  SystemConfigSettings,
  SystemConfigSwitch,
  DeploymentRecord,
  NetworkDriveMapping,
  PrinterMapping,
  UserLogonStagingConfig,
  UserLogonStagingSnippet,
  AppSettings,
  AuthUser,
} from './types';
import { Header, AppNavTab } from './components/Header';
import { NewPCWizard } from './components/NewPCWizard';
import { QuickSoftwareDeploy } from './components/QuickSoftwareDeploy';
import { LiveRunner } from './components/LiveRunner';
import { AIDetective } from './components/AIDetective';
import { CustomerProfilesManager } from './components/CustomerProfilesManager';
import { PackageLibrary } from './components/PackageLibrary';
import { DeploymentHistory } from './components/DeploymentHistory';
import { FirstRunSnippetsManager } from './components/FirstRunSnippetsManager';
import { ScriptModal } from './components/ScriptModal';
import { AuditCertificateModal } from './components/AuditCertificateModal';
import { SystemConfigManager } from './components/SystemConfigManager';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal';
import { LoginScreen } from './components/LoginScreen';
import { SetupWizardModal } from './components/SetupWizardModal';
import { ADComputersView } from './components/ADComputersView';
import { ClientAgentQueueView } from './components/ClientAgentQueueView';
import { loadWizardDraft, clearWizardDraft } from './utils/wizardAutoSave';
import { loadUserProfanityPreference, saveUserProfanityPreference } from './utils/branding';
import { applyCorporateTheme, loadSavedCorporateColors } from './utils/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppNavTab>('wizard');
  const [packages, setPackages] = useState<SoftwarePackage[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [systemSwitches, setSystemSwitches] = useState<SystemConfigSwitch[]>([]);
  const [snippets, setSnippets] = useState<UserLogonStagingSnippet[]>([]);

  // App Settings & Auth User state
  const [appSettings, setAppSettings] = useState<AppSettings>({
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
    },
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    // If the user has explicitly logged out, keep them logged out
    if (localStorage.getItem('fdim_logged_out') === 'true') {
      return null;
    }
    const saved = localStorage.getItem('fdim_auth_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      } catch {}
    }
    return null;
  });

  // Modals state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [setupCompletionNotice, setSetupCompletionNotice] = useState<string | null>(null);

  // Machine state (persisted via local storage draft)
  const initialDraft = loadWizardDraft();
  const [machineName, setMachineName] = useState(() => initialDraft?.machineName || 'WS-001');

  // Selected customer profile
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => initialDraft?.selectedCustomerId || '');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>(() => initialDraft?.selectedPackageIds || []);
  const [packageCustomSwitches, setPackageCustomSwitches] = useState<Record<string, string>>(() => initialDraft?.packageCustomSwitches || {});
  const [packageConfigFiles, setPackageConfigFiles] = useState<Record<string, string>>(() => initialDraft?.packageConfigFiles || {});

  // Staged User First-Logon Settings (Network Drives & Printers)
  const [stagedDrives, setStagedDrives] = useState<NetworkDriveMapping[]>(() => initialDraft?.stagedDrives || []);
  const [stagedPrinters, setStagedPrinters] = useState<PrinterMapping[]>(() => initialDraft?.stagedPrinters || []);
  const [userLogonStaging, setUserLogonStaging] = useState<UserLogonStagingConfig>(() => initialDraft?.userLogonStaging || {
    enabled: true,
    stagingPath: 'C:\\ProgramData\\FDIM\\UserLogonSetup.ps1',
    activeSetupKey: 'FDIM_UserProvisioning',
    scheduledTaskFallback: true,
    cleanUpAfterFirstRun: false,
  });

  // Dynamic system configuration switch states
  const [enabledSwitchIds, setEnabledSwitchIds] = useState<string[]>(() => initialDraft?.enabledSwitchIds || ['sw-rdp', 'sw-adgroup', 'sw-power-screen', 'sw-power-standby', 'sw-local-admin', 'sw-delete-oobe']);
  const [switchParameters, setSwitchParameters] = useState<Record<string, string | number>>(() => initialDraft?.switchParameters || {
    adAdminGroupName: 'ACME\\IT-Workstation-Admins',
    screenTimeoutAc: 15,
    standbyTimeoutAc: 0,
    localAdminPassword: 'P@ssw0rd!2026Secure',
    oobeAccountName: 'install',
  });

  // Legacy system configuration settings (kept in sync)
  const [systemConfig, setSystemConfig] = useState<SystemConfigSettings>(() => initialDraft?.systemConfig || {
    enableRdp: true,
    addAdGroupToAdmins: true,
    adAdminGroupName: 'ACME\\IT-Workstation-Admins',
    setPowerPlan: true,
    screenTimeoutAc: 15,
    standbyTimeoutAc: 0,
    enableLocalAdmin: true,
    localAdminPassword: 'P@ssw0rd!2026Secure',
    adminPasswordNeverExpires: true,
    deleteOobeAccount: true,
    oobeAccountName: 'install',
    removeOobeProfile: true,
  });

  // Runner & Modals
  const [isDeploying, setIsDeploying] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSystemConfigManagerOpen, setIsSystemConfigManagerOpen] = useState(false);
  const [activeAuditRecord, setActiveAuditRecord] = useState<DeploymentRecord | null>(null);

  // Mount theme initialization from saved local storage
  useEffect(() => {
    const savedColors = loadSavedCorporateColors();
    applyCorporateTheme(savedColors);
  }, []);

  const handleToggleProfanity = async () => {
    if (!currentUser) return;
    const nextVal = currentUser.showProfanity === false ? true : false;
    saveUserProfanityPreference(currentUser.id, nextVal);
    const updatedUser = { ...currentUser, showProfanity: nextVal };
    setCurrentUser(updatedUser);
    localStorage.setItem('fdim_auth_user', JSON.stringify(updatedUser));
    try {
      await fetch('/api/auth/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showProfanity: nextVal }),
      });
    } catch (err) {
      console.warn('Failed to sync profanity preference:', err);
    }
  };

  const handleLoginSuccess = (user: AuthUser) => {
    const userPref = loadUserProfanityPreference(user.id, user.showProfanity !== false);
    const userObj = { ...user, showProfanity: userPref };
    localStorage.removeItem('fdim_logged_out');
    localStorage.setItem('fdim_auth_user', JSON.stringify(userObj));
    setCurrentUser(userObj);
    setIsLoginModalOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.setItem('fdim_logged_out', 'true');
    localStorage.removeItem('fdim_auth_user');
    setCurrentUser(null);
    setIsLoginModalOpen(false);
  };

  // Initial data loading
  useEffect(() => {
    document.title = 'FDIM - Zero-Touch Workstation Provisioning Suite';
    Promise.all([
      fetch('/api/packages').then((r) => r.json()),
      fetch('/api/profiles').then((r) => r.json()),
      fetch('/api/system-switches').then((r) => r.json()),
      fetch('/api/deployments').then((r) => r.json()),
      fetch('/api/snippets').then((r) => r.json()).catch(() => []),
      fetch('/api/settings').then((r) => r.json()).catch(() => null),
      fetch('/api/auth/me').then((r) => r.json()).catch(() => null),
    ])
      .then(([pkgs, custs, switches, deps, snips, sets, auth]) => {
        setPackages(pkgs || []);
        setCustomers(custs || []);
        setSystemSwitches(switches || []);
        setDeployments(deps || []);
        setSnippets(snips || []);
        if (sets) {
          setAppSettings(sets);
          if (sets.corporateColors) {
            applyCorporateTheme(sets.corporateColors);
          }
          if (sets.initialSetupCompleted === false && !sessionStorage.getItem('fdim_setup_skipped')) {
            setIsSetupWizardOpen(true);
          }
        }
        if (auth?.user) {
          const isExplicitlyLoggedOut = localStorage.getItem('fdim_logged_out') === 'true';
          if (!isExplicitlyLoggedOut) {
            const userPref = loadUserProfanityPreference(auth.user.id, auth.user.showProfanity !== false);
            const userObj = { ...auth.user, showProfanity: userPref };
            setCurrentUser(userObj);
            localStorage.setItem('fdim_auth_user', JSON.stringify(userObj));
          }
        }

        // Check if there is an active draft saved in local storage
        const currentSavedDraft = loadWizardDraft();
        if (currentSavedDraft) {
          if (currentSavedDraft.machineName) setMachineName(currentSavedDraft.machineName);
          if (currentSavedDraft.selectedCustomerId) {
            const validCust = (custs || []).find((c: CustomerProfile) => c.id === currentSavedDraft.selectedCustomerId);
            setSelectedCustomerId(validCust ? validCust.id : ((custs || [])[0]?.id || currentSavedDraft.selectedCustomerId));
          }
          if (Array.isArray(currentSavedDraft.selectedPackageIds)) {
            setSelectedPackageIds(currentSavedDraft.selectedPackageIds);
          }
          if (currentSavedDraft.packageCustomSwitches) {
            setPackageCustomSwitches(currentSavedDraft.packageCustomSwitches);
          }
          if (currentSavedDraft.packageConfigFiles) {
            setPackageConfigFiles(currentSavedDraft.packageConfigFiles);
          }
          if (Array.isArray(currentSavedDraft.enabledSwitchIds)) {
            setEnabledSwitchIds(currentSavedDraft.enabledSwitchIds);
          }
          if (currentSavedDraft.switchParameters) {
            setSwitchParameters(currentSavedDraft.switchParameters);
          }
          if (currentSavedDraft.systemConfig) {
            setSystemConfig(currentSavedDraft.systemConfig);
          }
          if (Array.isArray(currentSavedDraft.stagedDrives)) {
            setStagedDrives(currentSavedDraft.stagedDrives);
          }
          if (Array.isArray(currentSavedDraft.stagedPrinters)) {
            setStagedPrinters(currentSavedDraft.stagedPrinters);
          }
          if (currentSavedDraft.userLogonStaging) {
            setUserLogonStaging(currentSavedDraft.userLogonStaging);
          }
        } else {
          if (Array.isArray(switches)) {
            const defaultEnabled = switches.filter((s: SystemConfigSwitch) => s.enabledByDefault).map((s: SystemConfigSwitch) => s.id);
            setEnabledSwitchIds(defaultEnabled.length > 0 ? defaultEnabled : ['sw-rdp', 'sw-adgroup', 'sw-power-screen', 'sw-power-standby']);
          }

          // Initial default customer setup if no draft was present
          const initialCust = (custs || [])[0];
          if (initialCust) {
            setSelectedCustomerId(initialCust.id);
            setSelectedPackageIds(initialCust.packageIds || []);
            if (initialCust.packageCustomSwitches) {
              setPackageCustomSwitches(initialCust.packageCustomSwitches);
            }
            if (initialCust.packageConfigFiles) {
              setPackageConfigFiles(initialCust.packageConfigFiles);
            }
            const powerEnabled = initialCust.powerPlanSettings?.enabled !== false;
            setSystemConfig({
              enableRdp: initialCust.enableRdp,
              addAdGroupToAdmins: true,
              adAdminGroupName: initialCust.defaultAdAdminGroup,
              setPowerPlan: powerEnabled,
              screenTimeoutAc: initialCust.powerPlanSettings?.screenTimeoutAc ?? 15,
              standbyTimeoutAc: initialCust.powerPlanSettings?.standbyTimeoutAc ?? 0,
            });
            setSwitchParameters((prev) => ({
              ...prev,
              adAdminGroupName: initialCust.defaultAdAdminGroup,
              screenTimeoutAc: initialCust.powerPlanSettings?.screenTimeoutAc ?? 15,
              standbyTimeoutAc: initialCust.powerPlanSettings?.standbyTimeoutAc ?? 0,
            }));
            if (initialCust.networkDrives) {
              setStagedDrives(initialCust.networkDrives);
            }
            if (initialCust.printers) {
              setStagedPrinters(initialCust.printers);
            }
            if (initialCust.userLogonStaging) {
              setUserLogonStaging(initialCust.userLogonStaging);
            }
          }
        }
      })
      .catch((err) => console.error('Error fetching initial setup data:', err));
  }, []);

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0] || {
    id: 'default',
    companyName: 'Corporate Client',
    customerCode: 'CORP',
    domainName: 'corp.local',
    defaultAdAdminGroup: 'CORP\\IT-Admins',
    uncShareRoot: '\\\\corp-fs01.internal.net\\deployments',
    enableRdp: true,
    powerPlanSettings: { screenTimeoutAc: 15, standbyTimeoutAc: 0 },
    packageIds: [],
  };

  // Handlers for Deployment
  const handleStartDeployment = () => {
    setIsDeploying(true);
    setActiveTab('runner');
  };

  const handleCompleteDeployment = (record: DeploymentRecord) => {
    fetch('/api/deployments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
      .then((r) => r.json())
      .then((saved) => {
        setDeployments((prev) => [saved, ...prev]);
        setActiveAuditRecord(saved);
      })
      .catch(() => {
        setDeployments((prev) => [record, ...prev]);
        setActiveAuditRecord(record);
      });
  };

  // Handlers for Packages
  const handleAddPackage = (newPkg: SoftwarePackage) => {
    fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPkg),
    })
      .then((r) => r.json())
      .then((saved) => {
        setPackages((prev) => [saved, ...prev]);
        setSelectedPackageIds((prev) => [...prev, saved.id]);
        if (saved.extraSwitches) {
          setPackageCustomSwitches((prev) => ({ ...prev, [saved.id]: saved.extraSwitches! }));
        }
      })
      .catch(() => {
        setPackages((prev) => [newPkg, ...prev]);
        setSelectedPackageIds((prev) => [...prev, newPkg.id]);
      });
  };

  const handleDeletePackage = (id: string) => {
    fetch(`/api/packages/${id}`, { method: 'DELETE' }).catch((err) => console.error(err));
    setPackages((prev) => prev.filter((p) => p.id !== id));
    setSelectedPackageIds((prev) => prev.filter((pId) => pId !== id));
  };

  const handleUpdatePackage = (updated: SoftwarePackage) => {
    fetch(`/api/packages/${updated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .then((r) => r.json())
      .then((saved) => {
        setPackages((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        if (saved.extraSwitches) {
          setPackageCustomSwitches((prev) => ({ ...prev, [saved.id]: saved.extraSwitches! }));
        }
      })
      .catch(() => {
        setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      });
  };

  // Handlers for Customer Profiles
  const handleAddCustomer = (newProfile: CustomerProfile) => {
    fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProfile),
    })
      .then((r) => r.json())
      .then((saved) => {
        setCustomers((prev) => [...prev, saved]);
      })
      .catch(() => {
        setCustomers((prev) => [...prev, newProfile]);
      });
  };

  const handleUpdateCustomer = (updated: CustomerProfile) => {
    fetch(`/api/profiles/${updated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .then((r) => r.json())
      .then((saved) => {
        setCustomers((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      })
      .catch(() => {
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      });
  };

  const handleDeleteCustomer = (id: string) => {
    fetch(`/api/profiles/${id}`, { method: 'DELETE' }).catch((err) => console.error(err));
    setCustomers((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (selectedCustomerId === id && remaining.length > 0) {
        handleSelectCustomerForSetup(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleSelectCustomerForSetup = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setSelectedCustomerId(cust.id);
      setSelectedPackageIds(cust.packageIds || []);
      if (cust.packageCustomSwitches) {
        setPackageCustomSwitches(cust.packageCustomSwitches);
      }
      if (cust.packageConfigFiles) {
        setPackageConfigFiles(cust.packageConfigFiles);
      }
      setSystemConfig((prev) => ({
        ...prev,
        enableRdp: cust.enableRdp,
        adAdminGroupName: cust.defaultAdAdminGroup,
        screenTimeoutAc: cust.powerPlanSettings?.screenTimeoutAc ?? 15,
        standbyTimeoutAc: cust.powerPlanSettings?.standbyTimeoutAc ?? 0,
      }));
      setSwitchParameters((prev) => ({
        ...prev,
        adAdminGroupName: cust.defaultAdAdminGroup,
        screenTimeoutAc: cust.powerPlanSettings?.screenTimeoutAc ?? 15,
        standbyTimeoutAc: cust.powerPlanSettings?.standbyTimeoutAc ?? 0,
      }));
      if (cust.networkDrives) {
        setStagedDrives(cust.networkDrives);
      }
      if (cust.printers) {
        setStagedPrinters(cust.printers);
      }
      if (cust.userLogonStaging) {
        setUserLogonStaging(cust.userLogonStaging);
      }
    }
    setActiveTab('wizard');
  };

  // Handlers for System Configuration Switches
  const handleAddSwitch = (newSwitch: SystemConfigSwitch) => {
    fetch('/api/system-switches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSwitch),
    })
      .then((r) => r.json())
      .then((saved) => {
        setSystemSwitches((prev) => [...prev, saved]);
        setEnabledSwitchIds((prev) => [...prev, saved.id]);
        if (saved.parameterKey && saved.parameterDefaultValue !== undefined) {
          setSwitchParameters((prev) => ({ ...prev, [saved.parameterKey!]: saved.parameterDefaultValue! }));
        }
      })
      .catch(() => {
        setSystemSwitches((prev) => [...prev, newSwitch]);
        setEnabledSwitchIds((prev) => [...prev, newSwitch.id]);
      });
  };

  const handleUpdateSwitch = (updatedSwitch: SystemConfigSwitch) => {
    fetch(`/api/system-switches/${updatedSwitch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSwitch),
    })
      .then((r) => r.json())
      .then((saved) => {
        setSystemSwitches((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      })
      .catch(() => {
        setSystemSwitches((prev) => prev.map((s) => (s.id === updatedSwitch.id ? updatedSwitch : s)));
      });
  };

  const handleDeleteSwitch = (id: string) => {
    fetch(`/api/system-switches/${id}`, { method: 'DELETE' }).catch((err) => console.error(err));
    setSystemSwitches((prev) => prev.filter((s) => s.id !== id));
    setEnabledSwitchIds((prev) => prev.filter((sId) => sId !== id));
  };

  const handleRunQuickDeployment = (config: {
    machineName: string;
    customer: CustomerProfile;
    selectedPackages: SoftwarePackage[];
    packageOverrides: Record<string, { extraSwitches?: string }>;
    uncCredentials?: { username?: string; password?: string };
  }) => {
    const target = config.machineName?.trim() || machineName || '$env:COMPUTERNAME';
    setMachineName(target);
    setSelectedCustomerId(config.customer.id);
    setSelectedPackageIds(config.selectedPackages.map((p) => p.id));
    const customSwitches: Record<string, string> = {};
    Object.entries(config.packageOverrides).forEach(([pkgId, ov]) => {
      if (ov.extraSwitches) customSwitches[pkgId] = ov.extraSwitches;
    });
    setPackageCustomSwitches(customSwitches);
    // Non-disruptive mode: omit power settings and admin group modifications
    setSystemConfig((prev) => ({
      ...prev,
      setPowerPlan: false,
      addAdGroupToAdmins: false,
    }));
    setEnabledSwitchIds([]);
    setIsDeploying(true);
    setActiveTab('runner');
  };

  // Handlers for First-Run Snippets Library
  const handleAddSnippet = (newSnippet: UserLogonStagingSnippet) => {
    fetch('/api/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSnippet),
    })
      .then((r) => r.json())
      .then((saved) => {
        setSnippets((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
      })
      .catch(() => {
        setSnippets((prev) => [newSnippet, ...prev]);
      });
  };

  const handleUpdateSnippet = (updatedSnippet: UserLogonStagingSnippet) => {
    fetch(`/api/snippets/${updatedSnippet.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSnippet),
    })
      .then((r) => r.json())
      .then((saved) => {
        setSnippets((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      })
      .catch(() => {
        setSnippets((prev) => prev.map((s) => (s.id === updatedSnippet.id ? updatedSnippet : s)));
      });
  };

  const handleDeleteSnippet = (id: string) => {
    fetch(`/api/snippets/${id}`, { method: 'DELETE' }).catch((err) => console.error(err));
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const handleResetDefaultSnippets = () => {
    fetch('/api/snippets/reset-defaults', { method: 'POST' })
      .then((r) => r.json())
      .then((defaults) => {
        if (Array.isArray(defaults)) setSnippets(defaults);
      })
      .catch((err) => console.error(err));
  };

  const handleViewCertificate = (record: DeploymentRecord) => {
    setActiveAuditRecord(record);
    setIsAuditModalOpen(true);
  };

  const selectedPackages = packages.filter((p) => selectedPackageIds.includes(p.id));

  // If not authenticated, present the professional Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        appSettings={appSettings}
        onLoginSuccess={handleLoginSuccess}
        showProfanity={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        machineName={machineName}
        selectedCustomerName={activeCustomer.companyName}
        isDeploying={isDeploying}
        currentUser={currentUser}
        appSettings={appSettings}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onToggleProfanity={handleToggleProfanity}
        onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
      />

      {setupCompletionNotice && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
            <span className="font-medium">{setupCompletionNotice}</span>
            <button
              onClick={() => setSetupCompletionNotice(null)}
              className="text-emerald-400 hover:text-white px-2 py-0.5 rounded font-bold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'wizard' && (
          <NewPCWizard
            packages={packages}
            customers={customers}
            machineName={machineName}
            setMachineName={setMachineName}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            selectedPackageIds={selectedPackageIds}
            setSelectedPackageIds={setSelectedPackageIds}
            packageCustomSwitches={packageCustomSwitches}
            setPackageCustomSwitches={setPackageCustomSwitches}
            packageConfigFiles={packageConfigFiles}
            setPackageConfigFiles={setPackageConfigFiles}
            systemConfig={systemConfig}
            setSystemConfig={setSystemConfig}
            systemSwitches={systemSwitches}
            enabledSwitchIds={enabledSwitchIds}
            setEnabledSwitchIds={setEnabledSwitchIds}
            switchParameters={switchParameters}
            setSwitchParameters={setSwitchParameters}
            stagedDrives={stagedDrives}
            setStagedDrives={setStagedDrives}
            stagedPrinters={stagedPrinters}
            setStagedPrinters={setStagedPrinters}
            userLogonStaging={userLogonStaging}
            setUserLogonStaging={setUserLogonStaging}
            onOpenSystemConfigManager={() => setIsSystemConfigManagerOpen(true)}
            onDeleteSwitch={handleDeleteSwitch}
            onOpenManualPackageModal={() => setActiveTab('library')}
            onStartDeployment={handleStartDeployment}
            onOpenScriptModal={() => setIsScriptModalOpen(true)}
            availableSnippets={snippets}
            onOpenSnippetsManager={() => setActiveTab('snippets')}
            onOpenCustomerProfiles={() => setActiveTab('customers')}
            showProfanity={currentUser.showProfanity !== false}
          />
        )}

        {activeTab === 'quick-deploy' && (
          <QuickSoftwareDeploy
            packages={packages}
            customers={customers}
            defaultDomain={appSettings.defaultGlobalDomain}
            initialMachineName={machineName}
            initialCustomerId={selectedCustomerId}
            onRunQuickDeployment={handleRunQuickDeployment}
          />
        )}

        {activeTab === 'ad-computers' && (
          <ADComputersView
            customers={customers}
            packages={packages}
            onSelectMachineForProvisioning={(mach, custId) => {
              setMachineName(mach);
              setSelectedCustomerId(custId);
              setActiveTab('wizard');
            }}
            onOpenQuickDeployForMachine={(mach, cust) => {
              setMachineName(mach);
              setSelectedCustomerId(cust.id);
              setActiveTab('quick-deploy');
            }}
          />
        )}

        {activeTab === 'agent' && (
          <ClientAgentQueueView
            customers={customers}
            packages={packages}
          />
        )}

        {activeTab === 'runner' && (
          <LiveRunner
            isDeploying={isDeploying}
            setIsDeploying={setIsDeploying}
            machineName={machineName}
            customer={activeCustomer}
            selectedPackages={selectedPackages}
            packageCustomSwitches={packageCustomSwitches}
            packageConfigFiles={packageConfigFiles}
            systemConfig={systemConfig}
            systemSwitches={systemSwitches}
            enabledSwitchIds={enabledSwitchIds}
            switchParameters={switchParameters}
            stagedDrives={stagedDrives}
            stagedPrinters={stagedPrinters}
            userLogonStaging={userLogonStaging}
            onCompleteDeployment={handleCompleteDeployment}
            onOpenAuditModal={() => setIsAuditModalOpen(true)}
            showProfanity={currentUser.showProfanity !== false}
          />
        )}

        {activeTab === 'customers' && (
          <CustomerProfilesManager
            customers={customers}
            packages={packages}
            defaultDomain={appSettings.defaultGlobalDomain}
            availableSnippets={snippets}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSelectCustomerForSetup={handleSelectCustomerForSetup}
          />
        )}

        {activeTab === 'snippets' && (
          <FirstRunSnippetsManager
            snippets={snippets}
            onAddSnippet={handleAddSnippet}
            onUpdateSnippet={handleUpdateSnippet}
            onDeleteSnippet={handleDeleteSnippet}
            onResetDefaults={handleResetDefaultSnippets}
            onSelectForWizard={(snippet) => {
              setUserLogonStaging((prev) => {
                const current = prev.customScriptSnippets || [];
                if (current.some((s) => s.id === snippet.id)) return prev;
                return {
                  ...prev,
                  customScriptSnippets: [...current, { ...snippet, enabled: true }],
                };
              });
              setActiveTab('wizard');
            }}
          />
        )}

        {activeTab === 'ai-detective' && (
          <AIDetective
            onAddPackage={handleAddPackage}
            existingPackages={packages}
          />
        )}

        {activeTab === 'library' && (
          <PackageLibrary
            packages={packages}
            onAddPackage={handleAddPackage}
            onUpdatePackage={handleUpdatePackage}
            onDeletePackage={handleDeletePackage}
            onOpenAIDetective={() => setActiveTab('ai-detective')}
          />
        )}

        {activeTab === 'history' && (
          <DeploymentHistory
            deployments={deployments}
            packages={packages}
            onViewCertificate={handleViewCertificate}
            showProfanity={currentUser.showProfanity !== false}
          />
        )}
      </main>

      {/* System Configuration Switches Manager Modal */}
      <SystemConfigManager
        isOpen={isSystemConfigManagerOpen}
        onClose={() => setIsSystemConfigManagerOpen(false)}
        switches={systemSwitches}
        onAddSwitch={handleAddSwitch}
        onUpdateSwitch={handleUpdateSwitch}
        onDeleteSwitch={handleDeleteSwitch}
      />

      {/* Script Generation Modal */}
      <ScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        machineName={machineName}
        customerProfile={activeCustomer}
        selectedPackages={selectedPackages}
        packageCustomSwitches={packageCustomSwitches}
        packageConfigFiles={packageConfigFiles}
        systemConfig={systemConfig}
        systemSwitches={systemSwitches}
        enabledSwitchIds={enabledSwitchIds}
        switchParameters={switchParameters}
        stagedDrives={stagedDrives}
        stagedPrinters={stagedPrinters}
        userLogonStaging={userLogonStaging}
        showProfanity={currentUser.showProfanity !== false}
      />

      {/* Workstation Handover Audit Certificate Modal */}
      <AuditCertificateModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        record={activeAuditRecord || deployments[0] || null}
        packages={packages}
        showProfanity={currentUser.showProfanity !== false}
      />

      {/* Infrastructure & Administration Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSettingsUpdated={(newSets) => {
          setAppSettings(newSets);
          if (newSets.corporateColors) {
            applyCorporateTheme(newSets.corporateColors);
          }
        }}
        showProfanity={currentUser?.showProfanity !== false}
        onToggleProfanity={handleToggleProfanity}
        onOpenSetupWizard={() => {
          setIsSettingsModalOpen(false);
          setIsSetupWizardOpen(true);
        }}
      />

      {/* Technician Login & AD Auth Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        appSettings={appSettings}
        onUserChanged={handleLoginSuccess}
        onLogout={handleLogout}
      />

      {/* Initial Setup & Active Directory Onboarding Wizard */}
      <SetupWizardModal
        isOpen={isSetupWizardOpen}
        onClose={() => {
          sessionStorage.setItem('fdim_setup_skipped', 'true');
          setIsSetupWizardOpen(false);
        }}
        onSetupCompleted={(newAdmin, newSettings, discoveredCount, ldapSyncWarning, shouldOpenAdTab) => {
          clearWizardDraft();
          setCurrentUser(newAdmin);
          setAppSettings(newSettings);
          setIsSetupWizardOpen(false);
          if (shouldOpenAdTab) {
            setActiveTab('ad-computers');
          }
          const adNotice =
            (newSettings.authMode === 'active_directory' || (newSettings.authMode as string) === 'ad_ldap') && newSettings.adLdapConfig?.domain
              ? `, Active Directory domain [${newSettings.adLdapConfig.domain}] configured`
              : '';
          const syncNotice = discoveredCount
            ? `, and ${discoveredCount} domain computer(s) discovered via LDAP.`
            : ldapSyncWarning
            ? `. Note: ${ldapSyncWarning}`
            : '.';
          setSetupCompletionNotice(
            `Initial setup completed! Master administrator [${newAdmin.username}] ready with a clean production workspace${adNotice}${syncNotice}`
          );
          // Refresh customer profiles & deployments after clean production setup
          fetch('/api/profiles')
            .then((r) => r.json())
            .then((custs) => {
              if (Array.isArray(custs)) {
                setCustomers(custs);
                setSelectedCustomerId(custs[0]?.id || '');
              }
            })
            .catch(() => {});
          fetch('/api/deployments')
            .then((r) => r.json())
            .then((deps) => {
              if (Array.isArray(deps)) setDeployments(deps);
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}
