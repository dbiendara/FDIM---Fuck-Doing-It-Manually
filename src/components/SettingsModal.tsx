import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import {
  Settings,
  Database,
  Shield,
  Server,
  Globe,
  KeyRound,
  Download,
  Check,
  Copy,
  RefreshCw,
  X,
  ExternalLink,
  Cpu,
  Layers,
  Lock,
  HardDrive,
  FileCode,
  Terminal,
  UserCheck,
  Radio,
  RotateCcw,
  Box,
  Palette,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { COLOR_PRESETS, DEFAULT_CORPORATE_COLORS, applyCorporateTheme } from '../utils/theme';
import { getFdimExpansion } from '../utils/branding';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: (newSettings: AppSettings) => void;
  showProfanity?: boolean;
  onToggleProfanity?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
  showProfanity = true,
  onToggleProfanity,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'sqlite' | 'auth' | 'runner' | 'proxmox' | 'agent' | 'docker'>('general');
  const [settings, setSettings] = useState<AppSettings>({
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
    corporateColors: {
      primaryColor: '#06b6d4',
      secondaryColor: '#2563eb',
      companyBrandName: 'FDIM Suite',
      themeMode: 'dark-cyan',
      customCssVarEnabled: true,
    },
  });

  const [dbMetadata, setDbMetadata] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Active Directory test connection
  const [isTestingAd, setIsTestingAd] = useState(false);
  const [adTestResult, setAdTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Docker code copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => {
          setSettings(data);
          if (data.corporateColors) {
            applyCorporateTheme(data.corporateColors);
          }
        })
        .catch((err) => console.error('Error fetching settings:', err));

      fetch('/api/database/info')
        .then((r) => {
          if (!r.ok) return null;
          return r.json();
        })
        .then((meta) => {
          if (meta && !meta.error) {
            setDbMetadata(meta);
          }
        })
        .catch((err) => console.warn('Could not load db metadata:', err));
    }
  }, [isOpen]);

  const handleColorChange = (key: 'primaryColor' | 'secondaryColor' | 'companyBrandName', value: string) => {
    const current = settings.corporateColors || DEFAULT_CORPORATE_COLORS;
    const updated = {
      ...current,
      [key]: value,
    };
    setSettings((prev) => ({
      ...prev,
      corporateColors: updated,
    }));
    applyCorporateTheme(updated);
  };

  const handleApplyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    const current = settings.corporateColors || DEFAULT_CORPORATE_COLORS;
    const updated = {
      ...current,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
    };
    setSettings((prev) => ({
      ...prev,
      corporateColors: updated,
    }));
    applyCorporateTheme(updated);
  };

  const handleResetColors = () => {
    setSettings((prev) => ({
      ...prev,
      corporateColors: { ...DEFAULT_CORPORATE_COLORS },
    }));
    applyCorporateTheme(DEFAULT_CORPORATE_COLORS);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const updated = await res.json();
      setSettings(updated);
      if (updated.corporateColors) {
        applyCorporateTheme(updated.corporateColors);
      }
      onSettingsUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAd = async () => {
    setIsTestingAd(true);
    setAdTestResult(null);
    try {
      const res = await fetch('/api/auth/test-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.adLdapConfig),
      });
      const data = await res.json();
      setAdTestResult(data);
    } catch (err) {
      setAdTestResult({ success: false, message: 'Failed to reach Active Directory Domain Controller.' });
    } finally {
      setIsTestingAd(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl xl:max-w-6xl w-full flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/80 text-cyan-400 flex items-center justify-center font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>FDIM Suite Administration & Infrastructure</span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure global domain defaults, SQLite database storage, Active Directory/Keycloak auth, and Docker SSL deployment.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Bar with Horizontal Scroll Support */}
        <div className="border-b border-slate-800 bg-slate-950/40 relative">
          <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-slate-900/40 px-3 sm:px-5 text-xs font-semibold gap-1 scroll-smooth">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'general'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Global Domain</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('branding')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'branding'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Palette className="w-4 h-4 text-pink-400 shrink-0" />
              <span>Corporate Colors</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sqlite')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'sqlite'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>SQLite Database</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'auth'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>AD / Keycloak</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('runner')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'runner'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Delegated Runner</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('proxmox')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'proxmox'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Proxmox Sandbox</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('agent')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'agent'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Client Agent</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('docker')}
              className={`py-3 px-3.5 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'docker'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4 shrink-0" />
              <span>Docker & SSL</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: GENERAL & GLOBAL DOMAIN */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2 mb-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>Global Primary Domain (Hauptdomain)</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Specify the default primary domain for your company or MSP infrastructure. When creating customer profiles or generating onboarding scripts, FDIM pre-fills this domain automatically.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Global Default Active Directory Domain:
                    </label>
                    <input
                      type="text"
                      value={settings.defaultGlobalDomain}
                      onChange={(e) =>
                        setSettings({ ...settings, defaultGlobalDomain: e.target.value })
                      }
                      placeholder="corp.internal.net or company.local"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-2">
                <span className="font-semibold text-slate-300 block">How This Default Domain is Used:</span>
                <p>• Pre-fills the <strong>Target Domain</strong> field in the New PC Setup Wizard.</p>
                <p>• Pre-fills newly created customer profiles in the <strong>Customer Profiles</strong> manager.</p>
                <p>• Resolves domain membership check for zero-touch silent UNC installations.</p>
              </div>
            </div>
          )}

          {/* TAB: CORPORATE COLORS & BRANDING */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Top Overview */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-950 border border-pink-800 text-pink-400 flex items-center justify-center font-bold">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Corporate Brand Colors & Theme Scheme</h3>
                      <p className="text-xs text-slate-400">
                        Customize primary and secondary corporate colors, portal brand title, and technician profanity settings.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetColors}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Defaults</span>
                  </button>
                </div>
              </div>

              {/* Presets Grid */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    <span>Corporate Color Presets (1-Click Apply)</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Live Theme Preview</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected =
                      (settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor).toLowerCase() ===
                        preset.primary.toLowerCase() &&
                      (settings.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor).toLowerCase() ===
                        preset.secondary.toLowerCase();
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                          isSelected
                            ? 'bg-slate-900 border-cyan-500 shadow-md shadow-cyan-500/20'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <span
                            className="w-4 h-4 rounded-full border border-black/40 shadow-inner"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-black/40 shadow-inner -ml-1"
                            style={{ backgroundColor: preset.secondary }}
                          />
                          {isSelected && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          )}
                        </div>
                        <strong className="text-xs text-white block font-medium truncate">{preset.name}</strong>
                        <span className="text-[10px] text-slate-400 block truncate">{preset.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Pickers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Color */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200">
                      Primary Corporate Brand Color
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Buttons, tabs, active borders
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        className="w-12 h-10 rounded-xl cursor-pointer bg-slate-900 border border-slate-700 p-1"
                        title="Pick corporate primary color"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        placeholder="#06b6d4"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Used as the focal branding tint for action buttons, progress bars, active step badges, and terminal highlights.
                  </p>
                </div>

                {/* Secondary Accent Color */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200">
                      Secondary Corporate Accent Color
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Gradients, tags, glows
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={settings.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        className="w-12 h-10 rounded-xl cursor-pointer bg-slate-900 border border-slate-700 p-1"
                        title="Pick corporate secondary color"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={settings.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        placeholder="#2563eb"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Used in dual-tone brand gradients, secondary cards, background glows, and elevated badges.
                  </p>
                </div>
              </div>

              {/* Portal Brand Title */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  Corporate Portal / Brand Name
                </label>
                <input
                  type="text"
                  value={settings.corporateColors?.companyBrandName || 'FDIM Suite'}
                  onChange={(e) => handleColorChange('companyBrandName', e.target.value)}
                  placeholder="e.g. FDIM Suite, Acme IT Provisioning, Contoso Managed Services"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-400">
                  Custom organization name displayed in the top application header and compliance reports.
                </p>
              </div>

              {/* Profanity Switch for User */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 flex items-center justify-center font-bold">
                      {showProfanity ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                        <span>Acronym Phrasing & Profanity Configuration</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            showProfanity
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {showProfanity ? 'Uncensored Phrasing' : 'Corporate SFW Mode'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Choose whether the acronym displays the word &quot;fuck&quot; or the safe-for-work corporate version.
                      </p>
                    </div>
                  </div>

                  {onToggleProfanity && (
                    <button
                      type="button"
                      onClick={onToggleProfanity}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        showProfanity ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showProfanity ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div
                    onClick={() => {
                      if (!showProfanity && onToggleProfanity) onToggleProfanity();
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      showProfanity
                        ? 'bg-amber-950/40 border-amber-700/80 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-xs font-bold text-white">⚡ Uncensored Mode</strong>
                      {showProfanity && <span className="text-[10px] text-amber-400 font-mono">ACTIVE</span>}
                    </div>
                    <p className="text-[11px] text-amber-300/80 font-mono mb-1 font-semibold">
                      &quot;Fuck Doing It Manually&quot;
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Original IT sysadmin humor. Displayed across the top banner, script modals, and deployment transcripts.
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      if (showProfanity && onToggleProfanity) onToggleProfanity();
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      !showProfanity
                        ? 'bg-emerald-950/40 border-emerald-700/80 text-emerald-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-xs font-bold text-white">🛡️ Corporate Safe For Work (SFW)</strong>
                      {!showProfanity && <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>}
                    </div>
                    <p className="text-[11px] text-emerald-300/80 font-mono mb-1 font-semibold">
                      &quot;Forget Doing It Manually&quot;
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Polite, corporate-safe wording. Ideal for customer demonstrations, executive reviews, and formal compliance certificates.
                    </p>
                  </div>
                </div>
              </div>

              {/* Real-Time Preview Card */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Real-Time Theme & Branding Preview</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Live CSS Custom Properties</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  {/* Simulated Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, ${
                            settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor
                          }, ${
                            settings.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor
                          })`,
                        }}
                      >
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className="font-extrabold text-base tracking-tight"
                            style={{
                              color: settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor,
                            }}
                          >
                            FDIM
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                              showProfanity
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {getFdimExpansion(showProfanity)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {settings.corporateColors?.companyBrandName || 'FDIM Suite'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        style={{
                          backgroundColor:
                            settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor,
                        }}
                        className="px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm"
                      >
                        Primary Action
                      </button>
                      <button
                        type="button"
                        style={{
                          borderColor:
                            settings.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor,
                          color:
                            settings.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor,
                        }}
                        className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-950"
                      >
                        Secondary Pill
                      </button>
                    </div>
                  </div>

                  {/* Simulated Certificate Snippet */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 text-[10px] block font-mono">Workstation Audit Certificate</span>
                      <strong className="text-white text-xs">
                        FDIM ({getFdimExpansion(showProfanity)}) Compliance Record
                      </strong>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded text-[11px] font-mono font-bold"
                      style={{
                        backgroundColor: `${
                          settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor
                        }22`,
                        color:
                          settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor,
                        border: `1px solid ${
                          settings.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor
                        }55`,
                      }}
                    >
                      DOMAIN VERIFIED
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SQLITE DATABASE */}
          {activeTab === 'sqlite' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Local SQLite Database Engine</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    STATUS: Connected (WAL Mode)
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">Customer Profiles</span>
                    <strong className="text-white text-base font-bold font-mono">
                      {dbMetadata?.stats?.customers ?? '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">Software Packages</span>
                    <strong className="text-white text-base font-bold font-mono">
                      {dbMetadata?.stats?.packages ?? '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">Deployments Logged</span>
                    <strong className="text-white text-base font-bold font-mono">
                      {dbMetadata?.stats?.deployments ?? '—'}
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">System Switches</span>
                    <strong className="text-white text-base font-bold font-mono">
                      {dbMetadata?.stats?.systemSwitches ?? '—'}
                    </strong>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Database Engine:</span>
                    <span className="text-emerald-400">{dbMetadata?.engine || 'SQLite (Node.js 22 DatabaseSync)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Location:</span>
                    <span className="text-slate-200 truncate max-w-sm">{dbMetadata?.path || './data/fdim.sqlite'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Database File Size:</span>
                    <span className="text-cyan-300">{dbMetadata?.fileSizeFormatted || '120.0 KB'}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Database is persisted on disk in the <code>/data</code> volume.
                  </span>
                  <a
                    href="/api/database/download"
                    download="fdim-database.sqlite"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-2 transition-colors shadow-md shadow-emerald-600/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SQLite Database (.sqlite)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVE DIRECTORY & KEYCLOAK */}
          {activeTab === 'auth' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Technician Authentication Mode</span>
                </h3>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'local', title: 'Local / Technician', desc: 'Direct technician access without external auth' },
                    { id: 'active_directory', title: 'Active Directory (LDAP)', desc: 'Enterprise AD domain controller login' },
                    { id: 'keycloak', title: 'Keycloak / OIDC', desc: 'Centralized OpenID Connect single sign-on' },
                  ].map((mode) => (
                    <div
                      key={mode.id}
                      onClick={() => setSettings({ ...settings, authMode: mode.id as any })}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        settings.authMode === mode.id
                          ? 'bg-cyan-950/40 border-cyan-500 text-white ring-1 ring-cyan-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <strong className="text-xs font-bold block text-white">{mode.title}</strong>
                      <span className="text-[11px] text-slate-400 mt-1 block">{mode.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Directory Configuration */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Active Directory / LDAP Parameters</span>
                  </h4>
                  <button
                    onClick={handleTestAd}
                    disabled={isTestingAd}
                    className="px-3 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    {isTestingAd ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    <span>{isTestingAd ? 'Testing...' : 'Test AD Connection'}</span>
                  </button>
                </div>

                {adTestResult && (
                  <div
                    className={`p-3 rounded-lg text-xs font-mono border ${
                      adTestResult.success
                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                        : 'bg-red-950/60 border-red-800 text-red-300'
                    }`}
                  >
                    {adTestResult.message}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">LDAP / LDAPS URL:</label>
                    <input
                      type="text"
                      value={settings.adLdapConfig.ldapUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          adLdapConfig: { ...settings.adLdapConfig, ldapUrl: e.target.value },
                        })
                      }
                      placeholder="ldaps://dc01.corp.internal.net:636"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">Domain Name (NetBIOS):</label>
                    <input
                      type="text"
                      value={settings.adLdapConfig.domain}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          adLdapConfig: { ...settings.adLdapConfig, domain: e.target.value },
                        })
                      }
                      placeholder="CORP"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">Base DN:</label>
                    <input
                      type="text"
                      value={settings.adLdapConfig.baseDn}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          adLdapConfig: { ...settings.adLdapConfig, baseDn: e.target.value },
                        })
                      }
                      placeholder="DC=corp,DC=internal,DC=net"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">Technician Admin Group:</label>
                    <input
                      type="text"
                      value={settings.adLdapConfig.adminGroup}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          adLdapConfig: { ...settings.adLdapConfig, adminGroup: e.target.value },
                        })
                      }
                      placeholder="FDIM-Admins"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Keycloak Configuration */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span>Keycloak OIDC Integration</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">Keycloak Server URL:</label>
                    <input
                      type="text"
                      value={settings.keycloakConfig.serverUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          keycloakConfig: { ...settings.keycloakConfig, serverUrl: e.target.value },
                        })
                      }
                      placeholder="https://keycloak.company.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">Realm Name:</label>
                    <input
                      type="text"
                      value={settings.keycloakConfig.realm}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          keycloakConfig: { ...settings.keycloakConfig, realm: e.target.value },
                        })
                      }
                      placeholder="enterprise"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">Client ID:</label>
                    <input
                      type="text"
                      value={settings.keycloakConfig.clientId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          keycloakConfig: { ...settings.keycloakConfig, clientId: e.target.value },
                        })
                      }
                      placeholder="fdim-suite"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">Client Secret:</label>
                    <input
                      type="password"
                      value={settings.keycloakConfig.clientSecret}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          keycloakConfig: { ...settings.keycloakConfig, clientSecret: e.target.value },
                        })
                      }
                      placeholder="••••••••••••••••"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DIENSTBENUTZER FÜR RUNNER (HELPDESK DELEGATION) */}
          {activeTab === 'runner' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Delegated Runner Service Account (Helpdesk Deployment)</span>
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.runnerServiceAccount.enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          runnerServiceAccount: {
                            ...settings.runnerServiceAccount,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Permits non-administrative Helpdesk technicians and Junior IT support personnel to install software and run deployment jobs without giving them Domain Admin or local administrator credentials. Installations execute silently through this elevated service account or through the background agent.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Runner Service Account Username:
                    </label>
                    <input
                      type="text"
                      value={settings.runnerServiceAccount.username}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          runnerServiceAccount: {
                            ...settings.runnerServiceAccount,
                            username: e.target.value,
                          },
                        })
                      }
                      placeholder="CORP\svc_fdim_runner"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Active Directory Domain / Realm:
                    </label>
                    <input
                      type="text"
                      value={settings.runnerServiceAccount.domain}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          runnerServiceAccount: {
                            ...settings.runnerServiceAccount,
                            domain: e.target.value,
                          },
                        })
                      }
                      placeholder="CORP"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.runnerServiceAccount.delegatedHelpdeskAllowed}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          runnerServiceAccount: {
                            ...settings.runnerServiceAccount,
                            delegatedHelpdeskAllowed: e.target.checked,
                          },
                        })
                      }
                      className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-200">
                        Allow Helpdesk Role to Trigger Installations via this Account
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        When enabled, technicians with the &quot;Technician&quot; or &quot;Operator&quot; role can deploy approved catalog packages without requiring administrative credentials on the target PC.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROXMOX SANDBOX & VM PACKAGE TESTING */}
          {activeTab === 'proxmox' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Box className="w-4 h-4 text-purple-400" />
                    <span>Proxmox VE & VM Sandbox Environment</span>
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.proxmoxConfig.enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          proxmoxConfig: {
                            ...settings.proxmoxConfig,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Safely test unattended installers on an isolated Windows VM template on Proxmox VE. The test runner checks silent arguments, exit codes, and registry detection rules, then automatically reverts the VM snapshot to clean baseline state.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Proxmox VE API URL:
                    </label>
                    <input
                      type="text"
                      value={settings.proxmoxConfig.apiUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          proxmoxConfig: { ...settings.proxmoxConfig, apiUrl: e.target.value },
                        })
                      }
                      placeholder="https://pve01.corp.internal:8006/api2/json"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Cluster Node:
                    </label>
                    <input
                      type="text"
                      value={settings.proxmoxConfig.node}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          proxmoxConfig: { ...settings.proxmoxConfig, node: e.target.value },
                        })
                      }
                      placeholder="pve-node1"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Sandbox Test VM ID (VMID):
                    </label>
                    <input
                      type="number"
                      value={settings.proxmoxConfig.vmTemplateId}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          proxmoxConfig: { ...settings.proxmoxConfig, vmTemplateId: parseInt(e.target.value, 10) || 9000 },
                        })
                      }
                      placeholder="9000"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Clean Baseline Snapshot Name:
                    </label>
                    <input
                      type="text"
                      value={settings.proxmoxConfig.cleanSnapshotName}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          proxmoxConfig: { ...settings.proxmoxConfig, cleanSnapshotName: e.target.value },
                        })
                      }
                      placeholder="clean-baseline"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.proxmoxConfig.autoRollback}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          proxmoxConfig: { ...settings.proxmoxConfig, autoRollback: e.target.checked },
                        })
                      }
                      className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500 bg-slate-900"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-200">
                        Automatic Snapshot Rollback after Successful Test (Restore Clean Baseline)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Immediately roll back the test VM to the pristine baseline snapshot after testing so the environment is always clean for subsequent package tests.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CLIENT AGENT & BACKGROUND HEARTBEAT TASK */}
          {activeTab === 'agent' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-blue-400" />
                    <span>Client Background Agent (Scheduled Task)</span>
                  </h3>
                  <a
                    href={`/api/agent/script/installer?serverUrl=${encodeURIComponent(settings.agentConfig.serverUrl)}&intervalMinutes=${settings.agentConfig.heartbeatIntervalMinutes}&bootDelayMinutes=${settings.agentConfig.bootDelayMinutes}`}
                    download="Install-FDIMAgent.ps1"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Install-FDIMAgent.ps1</span>
                  </a>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  The client agent installs as an invisible Windows Scheduled Task running under <code>NT AUTHORITY\SYSTEM</code>. It reports client health, uptime, installed software inventory, and pulls pending deployment wait-tasks.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Heartbeat Polling Interval:
                    </label>
                    <select
                      value={settings.agentConfig.heartbeatIntervalMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          agentConfig: { ...settings.agentConfig, heartbeatIntervalMinutes: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value={15}>Every 15 Minutes</option>
                      <option value={30}>Every 30 Minutes (Recommended)</option>
                      <option value={60}>Every 60 Minutes</option>
                      <option value={120}>Every 2 Hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Startup Delay after Boot:
                    </label>
                    <select
                      value={settings.agentConfig.bootDelayMinutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          agentConfig: { ...settings.agentConfig, bootDelayMinutes: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value={2}>2 Minutes</option>
                      <option value={5}>5 Minutes (Recommended for DHCP)</option>
                      <option value={10}>10 Minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      FDIM Server URL:
                    </label>
                    <input
                      type="text"
                      value={settings.agentConfig.serverUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          agentConfig: { ...settings.agentConfig, serverUrl: e.target.value },
                        })
                      }
                      placeholder="http://fdim.corp.internal:3000"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Agent Communication Security & Encryption Configuration */}
                <div className="mt-5 p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <div>
                        <h4 className="text-xs font-bold text-white">Agent Transport Encryption & Security</h4>
                        <p className="text-[11px] text-slate-400">Authenticate Scheduled Task check-ins and protect offline wait-task dispatching</p>
                      </div>
                    </div>

                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold border ${
                      settings.agentConfig?.encryptionMode && settings.agentConfig.encryptionMode !== 'none'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950/80 text-amber-300 border-amber-800'
                    }`}>
                      {settings.agentConfig?.encryptionMode && settings.agentConfig.encryptionMode !== 'none'
                        ? `Secured (${(settings.agentConfig.encryptionMode || '').toUpperCase()})`
                        : 'Unsecured (LAN Only)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Encryption & Authentication Mode:
                      </label>
                      <select
                        value={settings.agentConfig?.encryptionMode || 'none'}
                        onChange={(e) => {
                          const mode = e.target.value as 'none' | 'token-bearer' | 'hmac-sha256';
                          let psk = settings.agentConfig?.preSharedKey;
                          if (mode !== 'none' && !psk) {
                            psk = 'fdim_sec_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
                              .map((b) => b.toString(16).padStart(2, '0'))
                              .join('');
                          }
                          setSettings({
                            ...settings,
                            agentConfig: {
                              ...settings.agentConfig,
                              encryptionMode: mode,
                              preSharedKey: psk,
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="none">None (Standard unauthenticated HTTP / Internal LAN)</option>
                        <option value="token-bearer">Bearer Token / Pre-Shared Key (Recommended)</option>
                        <option value="hmac-sha256">HMAC-SHA256 Payload Signature Verification</option>
                      </select>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Requires all client scheduled tasks to provide matching authentication token
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Enforce HTTPS Transport:
                      </label>
                      <label className="flex items-center space-x-2 pt-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={settings.agentConfig?.enforceHttps || false}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              agentConfig: {
                                ...settings.agentConfig,
                                enforceHttps: e.target.checked,
                              },
                            })
                          }
                          className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs text-slate-300 font-medium">Reject unencrypted non-HTTPS traffic</span>
                      </label>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Ensures agent heartbeats cannot be intercepted over non-TLS connections
                      </span>
                    </div>
                  </div>

                  {settings.agentConfig?.encryptionMode && settings.agentConfig.encryptionMode !== 'none' && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-mono text-slate-300 uppercase font-semibold">
                          Pre-Shared Secret Key (PSK Token):
                        </label>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newPsk = 'fdim_sec_' + Array.from(crypto.getRandomValues(new Uint8Array(18)))
                                .map((b) => b.toString(16).padStart(2, '0'))
                                .join('');
                              setSettings({
                                ...settings,
                                agentConfig: {
                                  ...settings.agentConfig,
                                  preSharedKey: newPsk,
                                },
                              });
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center space-x-1 cursor-pointer"
                            title="Generate a cryptographically random secret key"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Regenerate Key</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(settings.agentConfig?.preSharedKey || '', 'agent-psk')}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1 cursor-pointer"
                          >
                            {copiedKey === 'agent-psk' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                            <span>{copiedKey === 'agent-psk' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={settings.agentConfig?.preSharedKey || ''}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              agentConfig: {
                                ...settings.agentConfig,
                                preSharedKey: e.target.value,
                              },
                            })
                          }
                          placeholder="fdim_sec_..."
                          className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">
                        This token is automatically injected into the generated <code>Install-FDIMAgent.ps1</code> script and verified on each client heartbeat check-in.
                      </p>
                    </div>
                  )}
                </div>

                {/* 1-Liner Quick Deploy Box */}
                <div className="mt-4 p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      <span>1-Liner PowerShell GPO / Admin Deployment Command:</span>
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `irm ${settings.agentConfig.serverUrl}/api/agent/script/installer | iex`,
                          'agent-1liner'
                        )
                      }
                      className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                    >
                      {copiedKey === 'agent-1liner' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'agent-1liner' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                    irm {settings.agentConfig.serverUrl}/api/agent/script/installer | iex
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DOCKER & NGINX SSL */}
          {activeTab === 'docker' && (
            <div className="space-y-5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Server className="w-4 h-4 text-cyan-400" />
                      <span>Production Docker Deployment (Nginx + SSL + SQLite)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Ready-to-deploy configuration files included in repository root for high-security intranet or MSP servers.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                  <span className="text-cyan-400 font-bold block mb-1">Quick Start Commands:</span>
                  <p className="text-emerald-300"># 1. Generate SSL Certificate:</p>
                  <p className="text-white">chmod +x docker/generate-ssl.sh && ./docker/generate-ssl.sh</p>
                  <p className="text-emerald-300 mt-2"># 2. Launch FDIM Suite with Nginx SSL reverse proxy:</p>
                  <p className="text-white">docker compose up -d --build</p>
                </div>
              </div>

              {/* Snippet: docker-compose.yml */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>docker-compose.yml</span>
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `services:\n  fdim:\n    build: .\n    container_name: fdim-app\n    restart: unless-stopped\n    environment:\n      - PORT=3000\n      - NODE_ENV=production\n    volumes:\n      - ./data:/app/data\n    expose:\n      - "3000"\n\n  nginx:\n    image: nginx:alpine\n    container_name: fdim-nginx-ssl\n    ports:\n      - "80:80"\n      - "443:443"\n    volumes:\n      - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro\n      - ./docker/nginx/ssl:/etc/nginx/ssl:ro\n    depends_on:\n      - fdim`,
                        'compose'
                      )
                    }
                    className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                  >
                    {copiedKey === 'compose' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'compose' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 p-3 rounded-lg border border-slate-850 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
{`services:
  fdim:
    build: .
    container_name: fdim-app
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    expose:
      - "3000"

  nginx:
    image: nginx:alpine
    container_name: fdim-nginx-ssl
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - fdim`}
                </pre>
              </div>

              {/* Nginx SSL Highlights */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <span className="font-semibold text-slate-300 block">Nginx SSL Reverse Proxy Highlights:</span>
                <p>• Automated HTTP to HTTPS 301 redirection on port 80.</p>
                <p>• TLS 1.2 and TLS 1.3 enforced with modern cipher suites.</p>
                <p>• WebSocket and SSE streaming support configured for live terminal output.</p>
                <p>• Persistent SQLite data directory mounted at <code>./data</code>.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1">
                <Check className="w-4 h-4" />
                <span>Settings saved successfully to SQLite!</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
