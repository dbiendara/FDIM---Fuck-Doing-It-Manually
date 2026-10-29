import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User,
  Server,
  Key,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Radio,
  Check,
} from 'lucide-react';
import { AuthUser, AppSettings } from '../types';
import { getFdimExpansion } from '../utils/branding';

interface LoginScreenProps {
  appSettings: AppSettings;
  onLoginSuccess: (user: AuthUser) => void;
  showProfanity?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  appSettings,
  onLoginSuccess,
  showProfanity = true,
}) => {
  const [authMode, setAuthMode] = useState<'local' | 'ad' | 'keycloak'>('local');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [domain, setDomain] = useState(appSettings.defaultGlobalDomain || 'CORP');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: authMode === 'ad' ? 'active_directory' : authMode === 'keycloak' ? 'keycloak' : 'local',
          username,
          password,
          domain: authMode === 'ad' ? domain : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg('Failed to connect to authentication backend. Please check network/server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (asAdmin: boolean = true) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'local',
          username: asAdmin ? 'admin' : 'technician',
          password: asAdmin ? 'admin' : 'technician',
          domain: 'CORP',
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.error || 'Quick login failed.');
      }
    } catch (err) {
      setErrorMsg('Server connection failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-teal-500/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>FDIM Enterprise Gateway</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center space-x-2">
            <Layers className="w-8 h-8 text-cyan-400" />
            <span>FDIM</span>
          </h1>

          <p className="text-xs text-slate-400 font-mono tracking-wide">
            {getFdimExpansion(showProfanity !== false)}
          </p>
          <p className="text-[11px] text-slate-500">
            Workstation Provisioning & Deployment Cockpit
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Technician Authentication</h2>
              <p className="text-[11px] text-slate-400">Sign in to access management console</p>
            </div>
            <Lock className="w-4 h-4 text-cyan-400" />
          </div>

          {/* Auth Method Selector */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('local');
                setUsername('admin');
                setPassword('admin');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                authMode === 'local'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Local</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('ad');
                setUsername('administrator');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                authMode === 'ad'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Active Dir</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('keycloak');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                authMode === 'keycloak'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Keycloak</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs font-mono">
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'ad' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Active Directory Domain
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="corp.local"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {authMode === 'ad' ? 'AD Username (sAMAccountName)' : 'Account Username'}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={authMode === 'ad' ? 'administrator' : 'admin'}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to FDIM'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Access Helper */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[11px] text-slate-400 block text-center">
              Quick One-Click Sign In:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin(true)}
                disabled={isSubmitting}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700 text-[11px] font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <Shield className="w-3 h-3 text-cyan-400" />
                <span>Domain Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin(false)}
                disabled={isSubmitting}
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[11px] font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <User className="w-3 h-3 text-emerald-400" />
                <span>Field Tech</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-[10px] text-slate-500">
          Authenticated sessions are encrypted and logged for compliance auditing.
        </p>
      </div>
    </div>
  );
};
