import React from 'react';
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
} from 'lucide-react';
import { AuthUser, AppSettings } from '../types';
import { getFdimExpansion } from '../utils/branding';
import { DEFAULT_CORPORATE_COLORS } from '../utils/theme';

interface HeaderProps {
  activeTab: 'wizard' | 'quick-deploy' | 'ad-computers' | 'agent' | 'runner' | 'library' | 'ai-detective' | 'history' | 'customers';
  setActiveTab: (tab: 'wizard' | 'quick-deploy' | 'ad-computers' | 'agent' | 'runner' | 'library' | 'ai-detective' | 'history' | 'customers') => void;
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
  const primaryColor = appSettings?.corporateColors?.primaryColor || DEFAULT_CORPORATE_COLORS.primaryColor;
  const secondaryColor = appSettings?.corporateColors?.secondaryColor || DEFAULT_CORPORATE_COLORS.secondaryColor;
  const brandName = appSettings?.corporateColors?.companyBrandName || 'FDIM Suite';
  const showProfanity = currentUser?.showProfanity !== false;

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg text-white font-bold transition-all"
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
                  className="font-extrabold text-xl tracking-tight transition-colors"
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
              <p className="text-xs text-slate-400 hidden sm:block">
                {brandName ? `${brandName} • ` : ''}Zero-Touch Workstation Provisioning & Silent UNC Installer Suite
              </p>
            </div>
          </div>

          {/* AD Machine & Customer Badge */}
          <div className="hidden xl:flex items-center space-x-3 bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Host:</span>
              <span className="text-slate-200 font-bold">{machineName || '$env:COMPUTERNAME'}</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center space-x-1.5 text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-300 font-medium truncate max-w-[140px]">{selectedCustomerName}</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-400 font-medium">AD Member</span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2">
            <nav className="flex space-x-1 sm:space-x-1.5">
              <button
                onClick={() => setActiveTab('wizard')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'wizard'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Full new PC staging workflow"
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">PC Setup</span>
              </button>

              <button
                onClick={() => setActiveTab('quick-deploy')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'quick-deploy'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Deploy software to existing in-use PCs without full staging"
              >
                <PackageCheck className="w-4 h-4 text-emerald-300" />
                <span className="hidden sm:inline">Quick Deploy</span>
              </button>

              <button
                onClick={() => setActiveTab('ad-computers')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'ad-computers'
                    ? 'bg-cyan-700 text-white shadow-md shadow-cyan-700/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Active Directory Computer inventory, LDAP sync, and bulk actions"
              >
                <Network className="w-4 h-4 text-cyan-300" />
                <span className="hidden md:inline">AD Computers</span>
              </button>

              <button
                onClick={() => setActiveTab('agent')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'agent'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Client scheduled task agent heartbeats and offline wait-tasks queue"
              >
                <Radio className="w-4 h-4 text-blue-300" />
                <span className="hidden md:inline">Agent & Queue</span>
              </button>

              <button
                onClick={() => setActiveTab('runner')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all relative ${
                  activeTab === 'runner'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
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

              <button
                onClick={() => setActiveTab('customers')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'customers'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden md:inline">Profiles</span>
              </button>

              <button
                onClick={() => setActiveTab('library')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'library'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span className="hidden md:inline">Catalog</span>
              </button>

              <button
                onClick={() => setActiveTab('ai-detective')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'ai-detective'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span className="hidden lg:inline">AI Detective</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'history'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <History className="w-4 h-4" />
                <span className="hidden lg:inline">History</span>
              </button>
            </nav>

            {/* Settings & Auth Action Buttons */}
            <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
