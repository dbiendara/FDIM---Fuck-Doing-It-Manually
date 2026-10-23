import React, { useState } from 'react';
import { AuthUser, AppSettings } from '../types';
import {
  Shield,
  User,
  KeyRound,
  Lock,
  Building2,
  CheckCircle2,
  LogOut,
  X,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getFdimExpansion, saveUserProfanityPreference } from '../utils/branding';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AuthUser | null;
  appSettings: AppSettings;
  onUserChanged: (user: AuthUser) => void;
  onLogout?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  appSettings,
  onUserChanged,
  onLogout,
}) => {
  const activeUser = currentUser || {
    id: 'usr-admin',
    username: 'admin',
    displayName: 'FDIM Domain Administrator',
    domain: 'CORP',
    role: 'Administrator',
    authProvider: 'local' as const,
    avatarInitials: 'DA',
    showProfanity: true,
  };
  const [authMode, setAuthMode] = useState<'ad' | 'keycloak' | 'local'>('ad');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState(appSettings.adLdapConfig.domain || 'CORP');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleToggleProfanity = async () => {
    const nextVal = activeUser.showProfanity === false ? true : false;
    saveUserProfanityPreference(activeUser.id, nextVal);
    const updatedUser = { ...activeUser, showProfanity: nextVal };
    onUserChanged(updatedUser);
    try {
      await fetch('/api/auth/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showProfanity: nextVal }),
      });
    } catch (err) {
      console.warn('Failed to sync profanity preference to backend:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: authMode === 'ad' ? 'active_directory' : authMode === 'keycloak' ? 'keycloak' : 'local',
          username,
          password,
          domain,
        }),
      });

      const data = await res.json();
      if (data.user) {
        onUserChanged(data.user);
        onClose();
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch {
      setErrorMsg('Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    if (onLogout) {
      onLogout();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Current User Header */}
        <div className="flex items-center space-x-3.5 mb-5 pb-4 border-b border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-cyan-600/30">
            {activeUser.avatarInitials || 'DA'}
          </div>
          <div>
            <span className="text-xs text-slate-400 font-mono block">Logged In Technician</span>
            <h3 className="text-sm font-bold text-white">{activeUser.displayName}</h3>
            <span className="text-[11px] text-cyan-400 font-mono">
              Role: {activeUser.role} • {activeUser.domain || 'Domain Member'}
            </span>
          </div>
        </div>

        {/* Per-User Profanity Configuration Switch */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeUser.showProfanity !== false ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span className="text-xs font-bold text-white">Technician Acronym Setting</span>
            </div>
            <button
              type="button"
              onClick={handleToggleProfanity}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                activeUser.showProfanity !== false ? 'bg-amber-600' : 'bg-emerald-600'
              }`}
              title="Toggle uncensored vs corporate safe-for-work phrasing"
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  activeUser.showProfanity !== false ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-slate-400 text-[11px]">Show word &quot;fuck&quot; in FDIM:</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                activeUser.showProfanity !== false
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {activeUser.showProfanity !== false ? '⚡ Fuck Doing It Manually' : '🛡️ Forget Doing It Manually'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Per-user technician setting. Disable to switch to Corporate Safe-For-Work (SFW) mode for client presentations and audits.
          </p>
        </div>

        {/* Auth Provider Selector */}
        <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-1 mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setAuthMode('ad')}
            className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              authMode === 'ad' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Active Directory</span>
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('keycloak')}
            className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              authMode === 'keycloak' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Keycloak SSO</span>
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('local')}
            className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
              authMode === 'local' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Local Tech</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs font-mono">
            {errorMsg}
          </div>
        )}

        {/* Active Directory Form */}
        {authMode === 'ad' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Domain:</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="CORP"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                AD sAMAccountName / Username:
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="j.doe"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Domain Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>Authenticate with Active Directory</span>
              </button>
            </div>
          </form>
        )}

        {/* Keycloak Form */}
        {authMode === 'keycloak' && (
          <div className="space-y-4 text-center py-2">
            <p className="text-xs text-slate-300 leading-relaxed">
              Authenticate via enterprise single sign-on backed by Keycloak OIDC realm:
              <br />
              <strong className="text-purple-300 font-mono">{appSettings.keycloakConfig.realm}</strong> (
              <span className="font-mono text-slate-400">{appSettings.keycloakConfig.serverUrl}</span>)
            </p>

            <button
              onClick={handleLogin}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center justify-center space-x-2"
            >
              <Lock className="w-4 h-4" />
              <span>Log in with Keycloak SSO</span>
            </button>
          </div>
        )}

        {/* Local Form */}
        {authMode === 'local' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Technician Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="technician"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setUsername('admin')}
                className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setUsername('technician')}
                className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
              >
                Field Tech
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all flex items-center justify-center space-x-2"
              >
                <User className="w-4 h-4" />
                <span>Switch Local Profile</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer with Logout */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-xs text-rose-300 hover:text-white flex items-center space-x-1.5 transition-colors cursor-pointer font-semibold shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out / Log Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
