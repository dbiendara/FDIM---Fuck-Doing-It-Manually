import React, { useState, useMemo } from 'react';
import {
  SoftwarePackage,
  CustomerProfile,
} from '../types';
import {
  PackageCheck,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  FileCode,
  Download,
  Copy,
  Check,
  Play,
  Building2,
  HardDrive,
  Terminal,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
  Server,
} from 'lucide-react';

interface QuickSoftwareDeployProps {
  packages: SoftwarePackage[];
  customers: CustomerProfile[];
  defaultDomain?: string;
  initialMachineName?: string;
  initialCustomerId?: string;
  onRunQuickDeployment: (config: {
    machineName: string;
    customer: CustomerProfile;
    selectedPackages: SoftwarePackage[];
    packageOverrides: Record<string, { extraSwitches?: string }>;
    uncCredentials?: { username?: string; password?: string };
  }) => void;
}

export const QuickSoftwareDeploy: React.FC<QuickSoftwareDeployProps> = ({
  packages,
  customers,
  defaultDomain,
  initialMachineName,
  initialCustomerId,
  onRunQuickDeployment,
}) => {
  const [targetMachine, setTargetMachine] = useState(initialMachineName || '$env:COMPUTERNAME');
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialCustomerId || customers[0]?.id || ''
  );

  // Sync state whenever selected machine or customer changes from parent
  React.useEffect(() => {
    if (initialMachineName) {
      setTargetMachine(initialMachineName);
    }
  }, [initialMachineName]);

  React.useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);
  const [selectedPkgIds, setSelectedPkgIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'unc' | 'winget'>('All');

  // UNC Credentials for in-use machine if needed
  const [useCustomCreds, setUseCustomCreds] = useState(false);
  const [uncUsername, setUncUsername] = useState('');
  const [uncPassword, setUncPassword] = useState('');

  // Per-package extra switches overrides
  const [packageOverrides, setPackageOverrides] = useState<Record<string, { extraSwitches?: string }>>({});
  const [expandedPkgId, setExpandedPkgId] = useState<string | null>(null);

  // Script preview modal
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  const categories = useMemo(() => {
    const cats = new Set(packages.map((p) => p.category));
    return ['All', ...Array.from(cats)];
  }, [packages]);

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch =
        pkg.name.toLowerCase().includes(search.toLowerCase()) ||
        pkg.description.toLowerCase().includes(search.toLowerCase()) ||
        (pkg.wingetId && pkg.wingetId.toLowerCase().includes(search.toLowerCase())) ||
        pkg.fileName.toLowerCase().includes(search.toLowerCase());

      const matchesCat = categoryFilter === 'All' || pkg.category === categoryFilter;
      const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || !!pkg.wingetId;
      const matchesSource =
        sourceFilter === 'All' ||
        (sourceFilter === 'winget' && isWinget) ||
        (sourceFilter === 'unc' && !isWinget);

      return matchesSearch && matchesCat && matchesSource;
    });
  }, [packages, search, categoryFilter, sourceFilter]);

  const selectedPackages = useMemo(() => {
    return packages.filter((p) => selectedPkgIds.includes(p.id));
  }, [packages, selectedPkgIds]);

  const totalEstMinutes = useMemo(() => {
    return selectedPackages.reduce((acc, p) => acc + (p.estimatedMinutes || 2), 0);
  }, [selectedPackages]);

  const toggleSelect = (id: string) => {
    setSelectedPkgIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPkgIds.length === filteredPackages.length) {
      setSelectedPkgIds([]);
    } else {
      setSelectedPkgIds(filteredPackages.map((p) => p.id));
    }
  };

  const handleGenerateScript = async () => {
    if (selectedPackages.length === 0) return;
    setIsGenerating(true);

    try {
      const res = await fetch('/api/scripts/generate-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineName: targetMachine,
          customerProfileId: activeCustomer?.id,
          selectedPackageIds: selectedPkgIds,
          packageOverrides,
          uncCredentials: useCustomCreds && uncUsername ? { username: uncUsername, password: uncPassword } : undefined,
        }),
      });

      const data = await res.json();
      if (data.script) {
        setGeneratedScript(data.script);
        setIsScriptModalOpen(true);
      }
    } catch (err) {
      console.error('Error generating quick install script:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteNow = () => {
    if (selectedPackages.length === 0 || !activeCustomer) return;
    onRunQuickDeployment({
      machineName: targetMachine,
      customer: activeCustomer,
      selectedPackages,
      packageOverrides,
      uncCredentials: useCustomCreds && uncUsername ? { username: uncUsername, password: uncPassword } : undefined,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Install-QuickSoftware-${(activeCustomer?.customerCode || 'PC')}.ps1`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Feature Banner */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-cyan-950/70 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950">
              <PackageCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold text-white">
                  Quick Software Deploy <span className="text-emerald-400 font-mono text-sm">(Software Nachinstallation)</span>
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 font-semibold">
                  For In-Use PCs
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Deploy packages silently to already active domain workstations without full staging.
                <strong className="text-white"> Will NOT touch domain admin groups, will NOT touch power plans, and will NOT force user logoffs.</strong>
              </p>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-end text-xs font-mono text-slate-400">
            <span>Non-disruptive execution</span>
            <span className="text-emerald-400 font-semibold mt-0.5">Zero Reboot Default</span>
          </div>
        </div>
      </div>

      {/* Target PC & Client Context */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span>Target Workstation & Customer Context</span>
          </span>
          <span className="text-[11px] text-slate-400">Step 1 of 2</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Hostname */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Computer Name / IP:
            </label>
            <div className="relative">
              <input
                type="text"
                value={targetMachine}
                onChange={(e) => setTargetMachine(e.target.value)}
                placeholder="$env:COMPUTERNAME or WS-CORP-01"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              {targetMachine !== '$env:COMPUTERNAME' && (
                <button
                  type="button"
                  onClick={() => setTargetMachine('$env:COMPUTERNAME')}
                  title="Reset to local $env:COMPUTERNAME"
                  className="absolute right-2 top-2 text-[10px] text-slate-400 hover:text-cyan-300 font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Local
                </button>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              {targetMachine && targetMachine !== '$env:COMPUTERNAME' ? (
                <span className="text-cyan-400 font-mono font-medium">Selected Target PC: {targetMachine}</span>
              ) : (
                <span>Leave as <code>$env:COMPUTERNAME</code> to run on the active local machine.</span>
              )}
            </span>
          </div>

          {/* Customer Profile */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Customer / UNC Source Share:
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.customerCode})
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 font-mono truncate mt-1 block">
              Share: {activeCustomer?.uncShareRoot || '\\\\corp-fs01\\deployments'}
            </span>
          </div>

          {/* Optional UNC Credential Toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>UNC Authentication:</span>
              <button
                type="button"
                onClick={() => setUseCustomCreds(!useCustomCreds)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono underline"
              >
                {useCustomCreds ? 'Disable' : 'Specify credentials'}
              </button>
            </label>

            {useCustomCreds ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="DOMAIN\user"
                  value={uncUsername}
                  onChange={(e) => setUncUsername(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={uncPassword}
                  onChange={(e) => setUncPassword(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2 text-[11px] text-slate-400">
                Uses executing technician's active Kerberos AD domain credentials.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Package Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center space-x-2">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              <span>Select Software Packages to Install ({selectedPkgIds.length} Selected)</span>
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Estimated total installation duration: ~{totalEstMinutes} minutes
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSelectAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              {selectedPkgIds.length === filteredPackages.length ? 'Deselect All' : 'Select All Visible'}
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search software by name, winget ID, or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  Category: {c}
                </option>
              ))}
            </select>

            <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-0.5 text-xs">
              <button
                onClick={() => setSourceFilter('All')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  sourceFilter === 'All' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSourceFilter('unc')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  sourceFilter === 'unc' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                UNC
              </button>
              <button
                onClick={() => setSourceFilter('winget')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  sourceFilter === 'winget' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Winget
              </button>
            </div>
          </div>
        </div>

        {/* Package Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {filteredPackages.map((pkg) => {
            const isSelected = selectedPkgIds.includes(pkg.id);
            const isExpanded = expandedPkgId === pkg.id;
            const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || !!pkg.wingetId;

            return (
              <div
                key={pkg.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/25 border-emerald-500/60 text-white ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div
                      className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
                      onClick={() => toggleSelect(pkg.id)}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{pkg.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">v{pkg.version}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-md border shrink-0 ${
                        isWinget
                          ? 'bg-sky-950 text-sky-300 border-sky-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {isWinget ? 'Winget' : 'UNC'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2.5">{pkg.description}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-[10px] font-mono text-slate-400">
                    <span className="truncate max-w-[140px]">{pkg.wingetId || pkg.fileName}</span>
                    <div className="flex items-center space-x-2">
                      <span>~{pkg.estimatedMinutes}m</span>
                      <button
                        type="button"
                        onClick={() => setExpandedPkgId(isExpanded ? null : pkg.id)}
                        className="text-slate-400 hover:text-white p-0.5"
                        title="Configure custom silent parameters"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable switch overrides */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-mono block">
                        Extra Switches Override:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ALLUSERS=1 NORESTART"
                        value={packageOverrides[pkg.id]?.extraSwitches || ''}
                        onChange={(e) =>
                          setPackageOverrides((prev) => ({
                            ...prev,
                            [pkg.id]: { ...prev[pkg.id], extraSwitches: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredPackages.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">
            No software packages match your search filter.
          </div>
        )}
      </div>

      {/* Sticky Bottom Deployment Bar */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sticky bottom-4 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
            {selectedPkgIds.length}
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              {selectedPkgIds.length} Package(s) Ready for Deployment
            </span>
            <span className="text-[11px] text-slate-400">
              Target: <strong className="text-cyan-300 font-mono">{targetMachine}</strong> • Client: {activeCustomer?.companyName}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={handleGenerateScript}
            disabled={selectedPkgIds.length === 0 || isGenerating}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
          >
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Generate Script (.ps1)</span>
          </button>

          <button
            onClick={handleExecuteNow}
            disabled={selectedPkgIds.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Deploy Now (Live Terminal)</span>
          </button>
        </div>
      </div>

      {/* Script Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>FDIM Quick Install Script (Install-SoftwareOnly.ps1)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    {selectedPkgIds.length} Packages
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Self-contained PowerShell runner for in-use machines. Run in an administrative PowerShell prompt.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Script'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-cyan-600/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ps1</span>
                </button>
                <button
                  onClick={() => setIsScriptModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre">
              {generatedScript}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Quick execute syntax: <code className="bg-slate-950 px-2 py-1 rounded text-cyan-300 font-mono">powershell.exe -ExecutionPolicy Bypass -File .\Install-SoftwareOnly.ps1</code></span>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
