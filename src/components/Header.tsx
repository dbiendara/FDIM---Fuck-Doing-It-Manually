import React, { useState, useRef, useEffect } from 'react';
import {
  Monitor,
  Terminal,
  Layers,
  Sparkles,
  History,
  Building2,
  HardDrive,
  Cpu,
  ShieldCheck,
  PackageCheck,
  Settings,
  User,
  Shield,
  Radio,
  Network,
  ChevronDown,
  Code2,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { AuthUser, AppSettings } from '../types';
import { getFdimExpansion } from '../utils/branding';
import { DEFAULT_CORPORATE_COLORS } from '../utils/theme';

export type AppNavTab =
  | 'wizard'
  | 'quick-deploy'
  | 'ad-computers'
  | 'agent'
  | 'runner'
  | 'library'
  | 'ai-detective'
  | 'history'
  | 'customers'
  | 'snippets';

interface HeaderProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  machineName: string;
  selectedCustomerName: string;
  isDeploying: boolean;
  currentUser?: AuthUser;
  appSettings?: AppSettings;
  onOpenSettings?: () => void;
  onOpenLogin?: () => void;
  onToggleProfanity?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  machineName,
  selectedCustomerName,
  isDeploying,
  currentUser,
  appSettings,
  onOpenSettings,
  onOpenLogin,
  onToggleProfanity,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const primaryColor = appSettings?.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor;
  const secondaryColor = appSettings?.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor;
  const brandName = appSettings?.corporateColors?.companyBrandName || 'FDIM Suite';
  const showProfanity = currentUser?.showProfanity !== false;

  // Check if the active tab belongs to the dropdown menu
  const isDropdownActive = [
    'quick-deploy',
    'agent',
    'history',
    'customers',
    'snippets',
    'library',
    'ai-detective',
  ].includes(activeTab);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const getActiveDropdownLabel = () => {
    switch (activeTab) {
      case 'quick-deploy':
        return 'Quick Deploy';
      case 'agent':
        return 'Agent & Queue';
      case 'history':
        return 'History';
      case 'customers':
        return 'Profiles';
      case 'snippets':
        return 'Logon Snippets';
      case 'library':
        return 'Catalog';
      case 'ai-detective':
        return 'AI Detective';
      default:
        return 'More Tools';
    }
  };

  const selectTabAndClose = (tab: AppNavTab) => {
    setActiveTab(tab);
    setIsDropdownOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg text-white font-bold transition-all shrink-0"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                boxShadow: `0 10px 20px -5px ${primaryColor}40`,
              }}
            >
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className="font-extrabold text-xl tracking-tight transition-colors cursor-pointer select-none"
                  onClick={() => setActiveTab('wizard')}
                  style={{
                    background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  FDIM
                </span>
                <button
                  type="button"
                  onClick={onToggleProfanity}
                  title={
                    showProfanity
                      ? "Click to switch to Corporate Safe-For-Work mode ('Forget Doing It Manually')"
                      : "Click to switch to Uncensored mode ('Fuck Doing It Manually')"
                  }
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold font-mono tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 select-none ${
                    showProfanity
                      ? 'text-amber-300 bg-amber-950/80 border border-amber-800/80 hover:bg-amber-900/60'
                      : 'text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 hover:bg-emerald-900/60'
                  }`}
                >
                  <span>{getFdimExpansion(showProfanity)}</span>
                  <span className="text-[11px]">{showProfanity ? '⚡' : '🛡️'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 hidden xl:block">
                {brandName ? `${brandName} • ` : ''}Zero-Touch Workstation Provisioning Suite
              </p>
            </div>
          </div>

          {/* AD Machine & Customer Badge */}
          <div className="hidden lg:flex items-center space-x-3 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Host:</span>
              <span className="text-slate-200 font-bold">{machineName || '$env:COMPUTERNAME'}</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center space-x-1.5 text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-300 font-medium truncate max-w-[120px]">{selectedCustomerName}</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-400 font-medium">AD Member</span>
          </div>

          {/* Navigation Controls: Clean Core Tabs + Dropdown Menu */}
          <div className="flex items-center space-x-2">
            <nav className="flex items-center space-x-1 sm:space-x-1.5">
              {/* Core 1: PC Setup */}
              <button
                type="button"
                onClick={() => setActiveTab('wizard')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'wizard'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Full Zero-Touch PC Staging Wizard"
              >
                <Monitor className="w-4 h-4" />
                <span>PC Setup</span>
              </button>

              {/* Core 2: AD Computers */}
              <button
                type="button"
                onClick={() => setActiveTab('ad-computers')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'ad-computers'
                    ? 'bg-cyan-700 text-white shadow-md shadow-cyan-700/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Active Directory Computer Inventory, LDAP sync, and bulk actions"
              >
                <Network className="w-4 h-4 text-cyan-300" />
                <span className="hidden sm:inline">AD Computers</span>
              </button>

              {/* Core 3: Live Runner */}
              <button
                type="button"
                onClick={() => setActiveTab('runner')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all relative cursor-pointer ${
                  activeTab === 'runner'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Real-time PowerShell execution stream"
              >
                <Terminal className="w-4 h-4" />
                <span className="hidden sm:inline">Live Runner</span>
                {isDeploying && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}
              </button>

              {/* DROPDOWN MENU: Tools & Workspaces */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    isDropdownActive
                      ? 'bg-slate-800 text-cyan-300 border-cyan-800 shadow-sm'
                      : 'bg-slate-950/70 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                  }`}
                  title="Workspaces, software catalog, customer profiles, and first-run scripts"
                >
                  <Menu className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">
                    {isDropdownActive ? getActiveDropdownLabel() : 'Menu'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isDropdownOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Floating Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* Section 1: Deployments & Operations */}
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800/80 mb-1">
                      Operations & Monitoring
                    </div>

                    <button
                      type="button"
                      onClick={() => selectTabAndClose('quick-deploy')}
                      className={`w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeTab === 'quick-deploy'
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400">
                        <PackageCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Quick Software Deploy</span>
                          {activeTab === 'quick-deploy' && <span className="text-[10px] text-emerald-400">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Silent push to online computers without full system reconfiguration
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => selectTabAndClose('agent')}
                      className={`w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeTab === 'agent'
                          ? 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0 mt-0.5 text-blue-400">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Agent & Offline Queue</span>
                          {activeTab === 'agent' && <span className="text-[10px] text-blue-400">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Scheduled task client heartbeats and pending offline wait-tasks
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => selectTabAndClose('history')}
                      className={`w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeTab === 'history'
                          ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-slate-400">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Deployment History & Audit</span>
                          {activeTab === 'history' && <span className="text-[10px] text-cyan-400">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Audit certificates, printable compliance records, and execution logs
                        </p>
                      </div>
                    </button>

                    {/* Section 2: Configurations & Libraries */}
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800/80 mt-2 mb-1">
                      Configuration & Libraries
                    </div>

                    <button
                      type="button"
                      onClick={() => selectTabAndClose('customers')}
                      className={`w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeTab === 'customers'
                          ? 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800 flex items-center justify-center shrink-0 mt-0.5 text-purple-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Company Profiles</span>
                          {activeTab === 'customers' && <span className="text-[10px] text-purple-400">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Client AD delegation, network share paths, and default software sets
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => selectTabAndClose('snippets')}
                      className={`w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeTab === 'snippets'
                          ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center shrink-0 mt-0.5 text-cyan-400">
                        <Code2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span className="flex items-center space-x-1.5">
                            <span>First-Run Snippets</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-900/60 text-cyan-300 font-mono font-semibold">
                              NEW
                            </span>
                          </span>
                          {activeTab === 'snippets' && <span className="text-[10px] text-cyan-400">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Reusable user-logon PowerShell scripts (Outlook sigs, OneDrive KFM, policies)
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => selectTabAndClose('library')}
                      className={`w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeTab === 'library'
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-slate-400">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Software Catalog</span>
                          {activeTab === 'library' && <span className="text-[10px] text-white">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          UNC repositories, Winget packages, and ODT Outlook Classic installer rules
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => selectTabAndClose('ai-detective')}
                      className={`w-full flex items-start space-x-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        activeTab === 'ai-detective'
                          ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/60'
                          : 'hover:bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center shrink-0 mt-0.5 text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>AI Silent Switch Detective</span>
                          {activeTab === 'ai-detective' && <span className="text-[10px] text-indigo-400">Active</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          AI installer switch extraction and file/registry detection rules
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {/* Settings & Auth Action Buttons */}
            <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Infrastructure Settings, SQLite DB, AD/Keycloak, Docker"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {onOpenLogin && (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Technician Profile & AD Login"
                >
                  <span className="w-5 h-5 rounded-md bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold font-mono flex items-center justify-center text-[10px]">
                    {currentUser?.avatarInitials || 'AD'}
                  </span>
                  <span className="hidden sm:inline font-mono text-[11px] max-w-[100px] truncate">
                    {currentUser?.displayName || 'Admin'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
