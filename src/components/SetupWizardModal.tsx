import React, { useState } from 'react';
import {
  Wand2,
  CheckCircle2,
  Shield,
  Server,
  User,
  Building2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  Globe,
  Radio,
  HardDrive,
  Laptop,
  Check,
  AlertTriangle,
  X,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { AppSettings, AuthUser } from '../types';
import { COLOR_PRESETS, applyCorporateTheme } from '../utils/theme';
import { getFdimExpansion } from '../utils/branding';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupCompleted: (
    user: AuthUser,
    settings: AppSettings,
    discoveredCount?: number,
    ldapSyncWarning?: string,
    didRequestSync?: boolean
  ) => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onClose,
  onSetupCompleted,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 2: Master Administrator
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminDisplayName, setAdminDisplayName] = useState('System Administrator');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 3: Active Directory Connection (clean production defaults)
  const [adDomain, setAdDomain] = useState('');
  const [adLdapUrl, setAdLdapUrl] = useState('');
  const [adBaseDn, setAdBaseDn] = useState('');
  const [adBindDn, setAdBindDn] = useState('');
  const [adBindPassword, setAdBindPassword] = useState('');
  const [adAdminGroup, setAdAdminGroup] = useState('Domain Admins');
  const [adComputerSearchOu, setAdComputerSearchOu] = useState('');
  const [isTestingAd, setIsTestingAd] = useState(false);
  const [adTestResult, setAdTestResult] = useState<{ success: boolean; message: string; dcHost?: string } | null>(null);
  const [showBindPassword, setShowBindPassword] = useState(false);

  // Step 4: Company Profile & Branding (optional for empty production workspace)
  const [companyName, setCompanyName] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [uncShareRoot, setUncShareRoot] = useState('');
  const [brandName, setBrandName] = useState('FDIM Suite');
  const [selectedColorPreset, setSelectedColorPreset] = useState('Cyber Cyan');
  const [primaryColor, setPrimaryColor] = useState('#06b6d4');
  const [secondaryColor, setSecondaryColor] = useState('#2563eb');
  const [showProfanity, setShowProfanity] = useState(true);

  // Step 5: Directory Sync & Clean Production Workspace
  const [initialSyncAD, setInitialSyncAD] = useState(false);
  const [clearWorkspace, setClearWorkspace] = useState(true);

  if (!isOpen) return null;

  const handleLdapUrlChange = (val: string) => {
    setAdLdapUrl(val);
    // Auto-derive Base DN and NetBIOS domain from FQDN in LDAP URL if empty
    const hostMatch = val.replace(/^ldaps?:\/\//i, '').split(':')[0].split('/')[0];
    const parts = hostMatch.split('.').filter(Boolean);
    if (parts.length >= 3 && !/^\d+$/.test(parts[0])) {
      const domainParts = parts.slice(1);
      if (!adDomain) {
        setAdDomain(domainParts[0].toUpperCase());
      }
      const suggestedBaseDn = domainParts.map((p) => `DC=${p}`).join(',');
      if (!adBaseDn) {
        setAdBaseDn(suggestedBaseDn);
      }
      if (!adComputerSearchOu) {
        setAdComputerSearchOu(suggestedBaseDn);
      }
    }
  };

  const handleTestAd = async () => {
    setIsTestingAd(true);
    setAdTestResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/test-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ldapUrl: adLdapUrl,
          domain: adDomain,
          baseDn: adBaseDn,
          bindDn: adBindDn,
          bindPassword: adBindPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdTestResult({
          success: true,
          message: data.message || `Successfully connected to Domain Controller ${data.dcHost || ''}.`,
          dcHost: data.dcHost,
        });
        setInitialSyncAD(true);
      } else {
        setAdTestResult({
          success: false,
          message: data.error || data.message || 'Failed to reach Domain Controller via LDAP.',
        });
      }
    } catch {
      setAdTestResult({
        success: false,
        message: 'Network error or timeout connecting to Active Directory Domain Controller.',
      });
    } finally {
      setIsTestingAd(false);
    }
  };

  const handleColorPresetChange = (presetName: string) => {
    setSelectedColorPreset(presetName);
    const preset = COLOR_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setPrimaryColor(preset.primary);
      setSecondaryColor(preset.secondary);
    }
  };

  const validateCurrentStep = (): boolean => {
    setErrorMsg(null);
    if (currentStep === 2) {
      if (!adminUsername.trim()) {
        setErrorMsg('Administrator username cannot be empty.');
        return false;
      }
      if (adminPassword.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return false;
      }
      if (adminPassword !== adminPasswordConfirm) {
        setErrorMsg('Passwords do not match.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as any);
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as any);
    }
  };

  const handleCompleteSetup = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const derivedFqdn = adBaseDn
        ? adBaseDn
            .split(',')
            .map((p) => p.trim())
            .filter((p) => /^DC=/i.test(p))
            .map((p) => p.replace(/^DC=/i, ''))
            .join('.')
        : adDomain
        ? `${adDomain.toLowerCase()}.local`
        : 'local';

      const payload = {
        adminUser: {
          username: adminUsername,
          displayName: adminDisplayName,
          email: adminEmail,
          password: adminPassword,
          role: 'Administrator',
          showProfanity,
        },
        adConfig: {
          ldapUrl: adLdapUrl.trim(),
          domain: adDomain.trim(),
          baseDn: adBaseDn.trim(),
          bindDn: adBindDn.trim(),
          bindPassword: adBindPassword,
          adminGroup: adAdminGroup.trim() || 'Domain Admins',
          computerSearchOu: adComputerSearchOu.trim() || adBaseDn.trim(),
        },
        companyBrand: {
          companyBrandName: brandName,
          primaryColor,
          secondaryColor,
          defaultGlobalDomain: derivedFqdn,
        },
        defaultCustomer: companyName.trim()
          ? {
              companyName: companyName.trim(),
              customerCode: customerCode.trim() || companyName.trim().slice(0, 4).toUpperCase(),
              domain: adDomain.trim() || derivedFqdn,
              uncShareRoot: uncShareRoot.trim(),
            }
          : null,
        initialSyncAD: initialSyncAD && Boolean(adLdapUrl.trim()),
        clearWorkspace,
      };

      const res = await fetch('/api/setup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned unexpected response (${res.status}). Please retry.`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete setup');
      }

      // Apply theme
      applyCorporateTheme({
        primaryColor,
        secondaryColor,
        companyBrandName: brandName,
        themeMode: 'custom',
        customCssVarEnabled: true,
      });

      onSetupCompleted(
        data.user,
        data.appSettings,
        data.discoveredComputersCount,
        data.ldapSyncWarning,
        initialSyncAD && Boolean(adLdapUrl.trim())
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Error initializing FDIM Suite configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Wizard Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  FDIM Suite Initial Setup Wizard
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold uppercase">
                  First-Run Onboarding
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure instance defaults, create the master administrator account, and link Active Directory.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close setup wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="border-b border-slate-800 bg-slate-950/40 px-6 py-3">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Welcome & Status' },
              { num: 2, label: 'Master Admin' },
              { num: 3, label: 'Active Directory' },
              { num: 4, label: 'Organization' },
              { num: 5, label: 'Sync & Launch' },
            ].map((step) => {
              const isPassed = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              return (
                <div key={step.num} className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                      isPassed
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                        : isCurrent
                        ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20 font-black'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : step.num}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isCurrent ? 'text-cyan-300 font-bold' : isPassed ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.num < 5 && <div className="w-6 sm:w-12 h-0.5 bg-slate-800 mx-1 hidden md:block"></div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: WELCOME & VERIFICATION */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-gradient-to-r from-cyan-950/60 to-blue-950/40 p-6 rounded-2xl border border-cyan-800/50">
                <h3 className="text-base font-bold text-white flex items-center space-x-2 mb-2">
                  <span>Welcome to the FDIM Workstation Provisioning Suite</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  FDIM (<em>{getFdimExpansion(true)}</em>) automates complete workstation staging, zero-touch Windows setup, silent software distribution from UNC shares or Winget, and user-logon script execution across enterprise domains.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-900/60 text-cyan-200 border border-cyan-700/60 font-mono">
                    Node.js 22 + SQLite WAL
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-900/60 text-blue-200 border border-blue-700/60 font-mono">
                    Active Directory LDAP Sync
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-900/60 text-emerald-200 border border-emerald-700/60 font-mono">
                    Zero-Touch PowerShell Runner
                  </span>
                </div>
              </div>

              {/* System Engine Readiness Checks */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>Infrastructure Engine Status</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-semibold text-slate-200">SQLite Storage</span>
                        <p className="text-[10px] text-slate-400 font-mono">/data/fdim.sqlite (WAL)</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
                      READY
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <div>
                        <span className="font-semibold text-slate-200">Auth & RBAC Subsystem</span>
                        <p className="text-[10px] text-slate-400 font-mono">AD LDAP / Keycloak / Local</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
                      INITIALIZING
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Laptop className="w-4 h-4 text-purple-400" />
                      <div>
                        <span className="font-semibold text-slate-200">Workstation Staging Engine</span>
                        <p className="text-[10px] text-slate-400 font-mono">Active Setup & Logon Tasks</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 font-mono font-bold">
                      STANDBY
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Radio className="w-4 h-4 text-blue-400" />
                      <div>
                        <span className="font-semibold text-slate-200">Client Agent Dispatcher</span>
                        <p className="text-[10px] text-slate-400 font-mono">Offline Queuing & Scheduled Task</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono font-bold">
                      ACTIVE
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-200">What this wizard will configure:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Create your initial master administrator account with full rights.</li>
                  <li>Link your enterprise Active Directory Domain Controller and configure LDAP/LDAPS.</li>
                  <li>Set up the default customer organization profile and UNC software deployment shares.</li>
                  <li>Optionally perform an immediate LDAP sync to discover active domain computers.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: MASTER ADMINISTRATOR ACCOUNT */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>Create Master Administrator Account</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  This local account serves as the primary system administrator and emergency break-glass account.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Username <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="e.g. admin or sysadmin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Used for local master console sign-in.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Display Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={adminDisplayName}
                    onChange={(e) => setAdminDisplayName(e.target.value)}
                    placeholder="e.g. Lead Domain Administrator"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Displayed in the header and deployment audits.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Administrator Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@corp.internal.net"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Master Password <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPasswordConfirm}
                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start space-x-3 text-xs text-slate-400">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200">Role: Super Administrator (Elevated)</span>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Grants permissions to run live PowerShell scripts, manage packages, configure AD domain bindings, and execute batch deployments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONNECT ACTIVE DIRECTORY */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Connect Active Directory Domain Controller</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Link your Windows Server Active Directory domain controller for LDAP computer discovery and domain authentication.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestAd}
                  disabled={isTestingAd}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAd ? 'animate-spin' : ''}`} />
                  <span>{isTestingAd ? 'Testing DC...' : 'Test Connection'}</span>
                </button>
              </div>

              {/* Test AD feedback */}
              {adTestResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2.5 ${
                    adTestResult.success
                      ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
                      : 'bg-red-950/70 border-red-800/80 text-red-200'
                  }`}
                >
                  {adTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {adTestResult.success ? 'Domain Controller Connected!' : 'Connection Warning:'}
                    </span>
                    <p className="text-[11px] mt-0.5">{adTestResult.message}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Domain Controller LDAP(S) URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={adLdapUrl}
                    onChange={(e) => handleLdapUrlChange(e.target.value)}
                    placeholder="e.g. ldap://192.168.1.10:389 or ldaps://dc01.domain.local:636"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Port 636 for LDAPS or 389 for standard LDAP.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Domain NetBIOS Name
                  </label>
                  <input
                    type="text"
                    value={adDomain}
                    onChange={(e) => setAdDomain(e.target.value.toUpperCase())}
                    placeholder="e.g. CORP or MYCOMPANY"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Short domain identifier (e.g. DOMAIN\user).</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Base Distinguished Name (Base DN) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={adBaseDn}
                  onChange={(e) => setAdBaseDn(e.target.value)}
                  placeholder="DC=corp,DC=internal,DC=net"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Service Account / Bind User <span className="text-amber-400 font-normal">(Required for Computer Sync)</span>
                  </label>
                  <input
                    type="text"
                    value={adBindDn}
                    onChange={(e) => setAdBindDn(e.target.value)}
                    placeholder="administrator@corp.local, CORP\administrator, or CN=..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Active Directory rejects anonymous LDAP queries (DSID-0C090A5A). An authenticated user is required.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">Service Account Bind Password</label>
                    <button
                      type="button"
                      onClick={() => setShowBindPassword(!showBindPassword)}
                      className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
                    >
                      {showBindPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showBindPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showBindPassword ? 'text' : 'password'}
                    value={adBindPassword}
                    onChange={(e) => setAdBindPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Delegated Admin Security Group</label>
                  <input
                    type="text"
                    value={adAdminGroup}
                    onChange={(e) => setAdAdminGroup(e.target.value)}
                    placeholder="FDIM-Admins"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">AD members of this security group inherit full suite administrator privileges.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target Computer Discovery OU (Search Base)
                  </label>
                  <input
                    type="text"
                    value={adComputerSearchOu}
                    onChange={(e) => setAdComputerSearchOu(e.target.value)}
                    placeholder="OU=Workstations,DC=corp,DC=internal,DC=net"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">The OU scanned during LDAP computer synchronizations.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ORGANIZATION & BRANDING */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span>Primary Organization Profile & Corporate Theme (Optional)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Leave Organization Name blank if you prefer an empty workspace with zero pre-created profiles.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Organization / Customer Name <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setCustomerCode(e.target.value.slice(0, 4).toUpperCase());
                    }}
                    placeholder="Leave blank for empty workspace, or enter company name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Customer Short Code (3-5 letters)
                  </label>
                  <input
                    type="text"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HQ or CORP"
                    maxLength={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  UNC Software Deployment Repository Share <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={uncShareRoot}
                  onChange={(e) => setUncShareRoot(e.target.value)}
                  placeholder="e.g. \\fileserver\deployments"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">SMB/UNC network path containing application installation packages.</p>
              </div>

              {/* Theme & Palette Presets */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-200">Suite Visual Theme & Accent Colors</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {COLOR_PRESETS.slice(0, 4).map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleColorPresetChange(preset.name)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedColorPreset === preset.name
                          ? 'border-cyan-500 bg-cyan-950/40 shadow-sm shadow-cyan-500/20'
                          : 'border-slate-800 bg-slate-950 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ background: preset.primary }}
                        ></span>
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ background: preset.secondary }}
                        ></span>
                      </div>
                      <span className="text-xs font-bold text-white block">{preset.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{preset.primary}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone / Profanity Selection */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-200 block">IT Culture & Phrasing Tone</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowProfanity(true)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      showProfanity
                        ? 'border-amber-700 bg-amber-950/40 text-amber-200'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center space-x-1.5">
                        <span>⚡ Uncensored Sysadmin</span>
                      </span>
                      {showProfanity && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-[11px] leading-tight">
                      &quot;Fuck Doing It Manually&quot; — authentic IT sysadmin spirit.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowProfanity(false)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      !showProfanity
                        ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center space-x-1.5">
                        <span>🛡️ Corporate Safe-For-Work</span>
                      </span>
                      {!showProfanity && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] leading-tight">
                      &quot;Forget Doing It Manually&quot; — professional presentation for end-clients.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW, INITIAL DIRECTORY SYNC & LAUNCH */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Review Configuration & Launch FDIM Suite</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm your initial deployment settings. Once completed, your administrator session will start immediately.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Admin Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                    <User className="w-4 h-4" />
                    <span>Master Admin</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Username</span>
                    <span className="font-mono text-white font-bold">{adminUsername}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Display Name</span>
                    <span className="text-slate-200">{adminDisplayName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Role</span>
                    <span className="text-emerald-400 font-semibold font-mono">Super Administrator</span>
                  </div>
                </div>

                {/* AD Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold">
                    <Shield className="w-4 h-4" />
                    <span>Active Directory</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Domain (NetBIOS)</span>
                    <span className="font-mono text-white font-bold">{adDomain}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">LDAP URL</span>
                    <span className="text-slate-300 font-mono text-[11px] truncate block">{adLdapUrl}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Admin Group</span>
                    <span className="text-cyan-400 font-mono">{adAdminGroup}</span>
                  </div>
                </div>

                {/* Organization Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold">
                    <Building2 className="w-4 h-4" />
                    <span>Organization</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Profile Name</span>
                    <span className="text-white font-bold">{companyName.trim() || 'None (Empty Workspace)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Customer Code</span>
                    <span className="text-purple-300 font-mono font-bold">{customerCode.trim() || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mode</span>
                    <span className={showProfanity ? 'text-amber-400 font-mono' : 'text-emerald-400 font-mono'}>
                      {showProfanity ? '⚡ Uncensored' : '🛡️ Safe-For-Work'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clean Production Workspace Checkbox */}
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="clearWorkspaceCheck"
                  checked={clearWorkspace}
                  onChange={(e) => setClearWorkspace(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 w-4 h-4 cursor-pointer"
                />
                <div>
                  <label htmlFor="clearWorkspaceCheck" className="text-xs font-bold text-white cursor-pointer block">
                    Start with a clean, empty production workspace (No Demo PCs or Example Profiles)
                  </label>
                  <p className="text-[11px] text-emerald-200/80 mt-0.5 leading-relaxed">
                    Purges all sample/demo workstations, sample customer profiles, and sample deployment records so your instance contains only real production data.
                  </p>
                </div>
              </div>

              {/* Initial LDAP Sync Checkbox */}
              <div className="p-4 rounded-2xl bg-cyan-950/50 border border-cyan-800/60 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="initialSyncCheck"
                  checked={initialSyncAD}
                  disabled={!adLdapUrl.trim()}
                  onChange={(e) => setInitialSyncAD(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <div>
                  <label htmlFor="initialSyncCheck" className="text-xs font-bold text-white cursor-pointer block">
                    Perform live Active Directory LDAP computer discovery immediately
                  </label>
                  <p className="text-[11px] text-cyan-200/80 mt-0.5 leading-relaxed">
                    {adLdapUrl.trim() ? (
                      <>
                        Connects via LDAPv3 to <code>{adLdapUrl}</code> and queries <code>{adComputerSearchOu || adBaseDn || 'RootDSE'}</code> for real domain computer objects, then opens the <strong>AD Computers</strong> tab.
                      </>
                    ) : (
                      'Enter a Domain Controller LDAP URL in Step 3 to enable immediate Active Directory computer discovery.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Skip for now
            </button>

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteSetup}
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-xl shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Configuring System...' : 'Complete Setup & Launch Suite'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
