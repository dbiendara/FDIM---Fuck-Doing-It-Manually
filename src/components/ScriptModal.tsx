import React, { useState, useEffect } from 'react';
import {
  SoftwarePackage,
  CustomerProfile,
  SystemConfigSettings,
  SystemConfigSwitch,
  NetworkDriveMapping,
  PrinterMapping,
  UserLogonStagingConfig,
} from '../types';
import { getFdimExpansion } from '../utils/branding';
import {
  Terminal,
  Copy,
  Check,
  Download,
  X,
  ShieldCheck,
  FileCode,
  Building2,
  Sliders,
  FolderOpen,
  HardDrive,
  Printer,
} from 'lucide-react';

interface ScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineName: string;
  customerProfile: CustomerProfile;
  selectedPackages: SoftwarePackage[];
  packageCustomSwitches: Record<string, string>;
  packageConfigFiles: Record<string, string>;
  systemConfig: SystemConfigSettings;
  systemSwitches?: SystemConfigSwitch[];
  enabledSwitchIds?: string[];
  switchParameters?: Record<string, string | number>;
  stagedDrives?: NetworkDriveMapping[];
  stagedPrinters?: PrinterMapping[];
  userLogonStaging?: UserLogonStagingConfig;
  showProfanity?: boolean;
}

export const ScriptModal: React.FC<ScriptModalProps> = ({
  isOpen,
  onClose,
  machineName,
  customerProfile,
  selectedPackages,
  packageCustomSwitches,
  packageConfigFiles,
  systemConfig,
  systemSwitches = [],
  enabledSwitchIds = [],
  switchParameters = {},
  stagedDrives = [],
  stagedPrinters = [],
  userLogonStaging = { enabled: true },
  showProfanity = true,
}) => {
  const [scriptContent, setScriptContent] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedOneLiner, setCopiedOneLiner] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);

    const packageOverrides: Record<string, { extraSwitches?: string; configFilePath?: string }> = {};
    selectedPackages.forEach((pkg) => {
      packageOverrides[pkg.id] = {
        extraSwitches: packageCustomSwitches[pkg.id] || pkg.extraSwitches,
        configFilePath: packageConfigFiles[pkg.id] || pkg.configFileImport?.configUncPath,
      };
    });

    fetch('/api/scripts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineName,
        customerProfile,
        selectedPackageIds: selectedPackages.map((p) => p.id),
        packageOverrides,
        systemConfig,
        selectedSwitchIds: enabledSwitchIds,
        switchParameters,
        networkDrives: stagedDrives,
        printers: stagedPrinters,
        userLogonStaging,
        showProfanity: showProfanity !== false,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.script) {
          setScriptContent(data.script);
        }
      })
      .catch((err) => console.error('Error generating script:', err))
      .finally(() => setLoading(false));
  }, [
    isOpen,
    machineName,
    customerProfile,
    selectedPackages,
    packageCustomSwitches,
    packageConfigFiles,
    systemConfig,
    enabledSwitchIds,
    switchParameters,
    stagedDrives,
    stagedPrinters,
    userLogonStaging,
    showProfanity,
  ]);

  if (!isOpen) return null;

  const oneLinerCommand = `powershell.exe -ExecutionPolicy Bypass -NoProfile -Command "Invoke-WebRequest -Uri '$([System.Uri]::EscapeUriString('${window.location.origin}/api/scripts/run'))' -OutFile '$env:TEMP\\Deploy-PC.ps1'; & '$env:TEMP\\Deploy-PC.ps1'"`;

  const copyScript = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const copyOneLiner = () => {
    navigator.clipboard.writeText(oneLinerCommand);
    setCopiedOneLiner(true);
    setTimeout(() => setCopiedOneLiner(false), 2000);
  };

  const downloadScript = () => {
    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Deploy-${customerProfile?.customerCode || 'Workstation'}.ps1`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>FDIM Deploy-Workstation.ps1 Generator</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    showProfanity !== false
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {getFdimExpansion(showProfanity !== false)}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Self-contained FDIM zero-touch PowerShell master script ready for manual execution or RMM deployment
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Badges */}
        <div className="bg-slate-950/60 px-5 py-3 border-b border-slate-850 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-slate-300">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span>Customer:</span>
              <strong className="text-white">{customerProfile?.companyName}</strong>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-300">
              <FolderOpen className="w-4 h-4 text-cyan-400" />
              <span>Packages:</span>
              <strong className="text-emerald-400">{selectedPackages.length} Silent Installs</strong>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-300">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Switches:</span>
              <strong className="text-purple-400">{enabledSwitchIds.length} Tasks</strong>
            </div>
            {(stagedDrives.length > 0 || stagedPrinters.length > 0) && (
              <div className="flex items-center space-x-1.5 text-slate-300">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span>First-Logon (Active Setup):</span>
                <strong className="text-amber-300">{stagedDrives.length} Drives, {stagedPrinters.length} Printers</strong>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={copyScript}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copiedScript ? 'Copied Full Script' : 'Copy Full Script'}</span>
            </button>

            <button
              onClick={downloadScript}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .ps1</span>
            </button>
          </div>
        </div>

        {/* Script Viewer */}
        <div className="p-4 flex-1 overflow-hidden flex flex-col bg-slate-950">
          <div className="relative flex-1 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col">
            <div className="bg-slate-850 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Deploy-{customerProfile?.customerCode || 'Workstation'}.ps1</span>
              </div>
              <span>{scriptContent ? `${scriptContent.split('\n').length} lines` : 'Generating...'}</span>
            </div>

            <pre className="p-4 text-xs font-mono text-emerald-300 overflow-y-auto flex-1 leading-relaxed selection:bg-cyan-600 selection:text-white">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-400 space-x-2">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating customized PowerShell provisioning script...</span>
                </div>
              ) : (
                scriptContent
              )}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-slate-400">
            Open PowerShell as Administrator on the target machine and execute the script. UNC paths and customer switches will execute unattended.
          </p>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition-colors self-end sm:self-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
