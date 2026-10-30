import React, { useState } from 'react';
import { SoftwarePackage } from '../types';
import {
  Layers,
  HardDrive,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  Edit2,
  ExternalLink,
  Server,
  FolderOpen,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sliders,
  FileCode,
  Sparkles,
  Save,
  X,
  FilePlus,
  HelpCircle,
  Copy,
  Check,
  Terminal,
  CloudDownload,
  Package,
  Box,
} from 'lucide-react';
import { PackageSandboxModal } from './PackageSandboxModal';

interface PackageLibraryProps {
  packages: SoftwarePackage[];
  onAddPackage: (pkg: SoftwarePackage) => void;
  onUpdatePackage?: (pkg: SoftwarePackage) => void;
  onDeletePackage: (id: string) => void;
  onOpenAIDetective: () => void;
  geminiConfig?: {
    enabled: boolean;
    hasApiKey: boolean;
    model?: string;
    message?: string;
  };
}

export const PackageLibrary: React.FC<PackageLibraryProps> = ({
  packages,
  onAddPackage,
  onUpdatePackage,
  onDeletePackage,
  onOpenAIDetective,
  geminiConfig,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'unc' | 'winget'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Manual package form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [sandboxPkg, setSandboxPkg] = useState<SoftwarePackage | null>(null);

  // Source Type: UNC share or Winget
  const [sourceType, setSourceType] = useState<'unc' | 'winget'>('unc');
  const [wingetId, setWingetId] = useState('');

  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [category, setCategory] = useState<SoftwarePackage['category']>('Utilities');
  const [uncPath, setUncPath] = useState('\\\\corp-fs01.internal.net\\deployments\\apps');
  const [fileName, setFileName] = useState('');
  const [installerType, setInstallerType] = useState<SoftwarePackage['installerType']>('MSI');
  const [silentArgs, setSilentArgs] = useState('/qn /norestart ALLUSERS=1');
  const [extraSwitches, setExtraSwitches] = useState('');
  const [logArgs, setLogArgs] = useState('/l*v "C:\\ProgramData\\PCSetup\\Logs\\install.log"');
  const [rebootBehavior, setRebootBehavior] = useState<SoftwarePackage['rebootBehavior']>('Suppress');
  const [detectionType, setDetectionType] = useState<SoftwarePackage['detectionType']>('FilePath');
  const [detectionRule, setDetectionRule] = useState('C:\\Program Files\\');
  const [successExitCodes, setSuccessExitCodes] = useState('0, 3010');
  const [estimatedMinutes, setEstimatedMinutes] = useState(2);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Config file import state (for UNC packages like TeamViewer Host)
  const [hasConfigFile, setHasConfigFile] = useState(false);
  const [configFileName, setConfigFileName] = useState('');
  const [configUncPath, setConfigUncPath] = useState('');
  const [importSwitch, setImportSwitch] = useState('');
  const [preCopyDestination, setPreCopyDestination] = useState('');

  const categories = [
    'All',
    'RemoteSupport',
    'Browser',
    'Development',
    'Productivity',
    'Communication',
    'Security',
    'Utilities',
  ];

  // Open creation form with fresh defaults
  const openCreateForm = () => {
    setEditingPkgId(null);
    setSourceType('unc');
    setWingetId('');
    setName('');
    setVersion('1.0.0');
    setCategory('Utilities');
    setUncPath('\\\\corp-fs01.internal.net\\deployments\\apps\\myapp');
    setFileName('setup.msi');
    setInstallerType('MSI');
    setSilentArgs('/qn /norestart ALLUSERS=1');
    setExtraSwitches('');
    setLogArgs('/l*v "C:\\ProgramData\\PCSetup\\Logs\\install.log"');
    setRebootBehavior('Suppress');
    setDetectionType('FilePath');
    setDetectionRule('C:\\Program Files\\MyApp\\app.exe');
    setSuccessExitCodes('0, 3010');
    setEstimatedMinutes(2);
    setDescription('Standard enterprise application deployed silently from UNC share.');
    setNotes('');
    setHasConfigFile(false);
    setConfigFileName('');
    setConfigUncPath('');
    setImportSwitch('');
    setPreCopyDestination('');
    setIsFormOpen(true);
  };

  // Open edit form with existing package data
  const openEditForm = (pkg: SoftwarePackage) => {
    setEditingPkgId(pkg.id);
    const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);
    setSourceType(isWinget ? 'winget' : 'unc');
    setWingetId(pkg.wingetId || (isWinget ? pkg.fileName : ''));
    setName(pkg.name);
    setVersion(pkg.version);
    setCategory(pkg.category);
    setUncPath(pkg.uncPath || '');
    setFileName(pkg.fileName || (isWinget ? pkg.wingetId || 'winget' : ''));
    setInstallerType(pkg.installerType);
    setSilentArgs(pkg.silentArgs);
    setExtraSwitches(pkg.extraSwitches || '');
    setLogArgs(pkg.logArgs || '');
    setRebootBehavior(pkg.rebootBehavior);
    setDetectionType(pkg.detectionType);
    setDetectionRule(pkg.detectionRule);
    setSuccessExitCodes((pkg.successExitCodes || [0]).join(', '));
    setEstimatedMinutes(pkg.estimatedMinutes || 2);
    setDescription(pkg.description || '');
    setNotes(pkg.notes || '');

    if (pkg.configFileImport?.enabled) {
      setHasConfigFile(true);
      setConfigFileName(pkg.configFileImport.configFileName || '');
      setConfigUncPath(pkg.configFileImport.configUncPath || '');
      setImportSwitch(pkg.configFileImport.importSwitch || '');
      setPreCopyDestination(pkg.configFileImport.preCopyDestination || '');
    } else {
      setHasConfigFile(false);
      setConfigFileName('');
      setConfigUncPath('');
      setImportSwitch('');
      setPreCopyDestination('');
    }

    setIsFormOpen(true);
  };

  // Quick preset helper
  const applyPreset = (type: string) => {
    if (type === 'MSI') {
      setSourceType('unc');
      setInstallerType('MSI');
      setSilentArgs('/qn /norestart ALLUSERS=1');
      setLogArgs('/l*v "C:\\ProgramData\\PCSetup\\Logs\\install.log"');
      setSuccessExitCodes('0, 3010');
      setDetectionType('FilePath');
    } else if (type === 'TeamViewer') {
      setSourceType('unc');
      setName('TeamViewer Host');
      setCategory('RemoteSupport');
      setInstallerType('MSI');
      setFileName('TeamViewer_Host.msi');
      setSilentArgs('/qn /norestart');
      setExtraSwitches('CUSTOMCONFIGID=idc89120 APITOKEN=109283-token ASSIGNMENTOPTIONS="--alias %COMPUTERNAME% --grant-easy-access"');
      setHasConfigFile(true);
      setConfigFileName('TeamViewer_Settings.tvopt');
      setConfigUncPath(`${uncPath}\\TeamViewer_Settings.tvopt`);
      setImportSwitch(`SETTINGSFILE="${uncPath}\\TeamViewer_Settings.tvopt"`);
      setPreCopyDestination('C:\\Program Files\\TeamViewer\\');
      setDetectionType('FilePath');
      setDetectionRule('C:\\Program Files\\TeamViewer\\TeamViewer.exe');
      setSuccessExitCodes('0, 3010');
    } else if (type === 'InnoSetup') {
      setSourceType('unc');
      setInstallerType('InnoSetup');
      setSilentArgs('/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-');
      setLogArgs('/LOG="C:\\ProgramData\\PCSetup\\Logs\\install.log"');
      setSuccessExitCodes('0');
      setDetectionType('FilePath');
    } else if (type === 'NSIS') {
      setSourceType('unc');
      setInstallerType('NSIS');
      setSilentArgs('/S');
      setLogArgs('');
      setSuccessExitCodes('0');
      setDetectionType('FilePath');
    } else if (type === 'WiX') {
      setSourceType('unc');
      setInstallerType('WiX');
      setSilentArgs('-q --silent');
      setLogArgs('-log "C:\\ProgramData\\PCSetup\\Logs\\install.log"');
      setSuccessExitCodes('0, 3010');
      setDetectionType('FilePath');
    }
    // WINGET PRESETS
    else if (type === 'winget-7zip') {
      setSourceType('winget');
      setName('7-Zip (Winget)');
      setWingetId('7zip.7zip');
      setVersion('24.08');
      setCategory('Utilities');
      setInstallerType('Winget');
      setSilentArgs('--silent --accept-package-agreements --accept-source-agreements --disable-interactivity');
      setDetectionType('FilePath');
      setDetectionRule('C:\\Program Files\\7-Zip\\7z.exe');
      setSuccessExitCodes('0, 3010');
      setEstimatedMinutes(1);
      setDescription('High-compression open source archiver installed via Winget without needing UNC share.');
      setHasConfigFile(false);
    } else if (type === 'winget-vlc') {
      setSourceType('winget');
      setName('VLC Media Player (Winget)');
      setWingetId('VideoLAN.VLC');
      setVersion('3.0.21');
      setCategory('Utilities');
      setInstallerType('Winget');
      setSilentArgs('--silent --accept-package-agreements --accept-source-agreements --disable-interactivity');
      setDetectionType('FilePath');
      setDetectionRule('C:\\Program Files\\VideoLAN\\VLC\\vlc.exe');
      setSuccessExitCodes('0, 3010');
      setEstimatedMinutes(2);
      setDescription('Universal multimedia player installed via Winget without UNC network share.');
      setHasConfigFile(false);
    } else if (type === 'odt-outlook' || type === 'winget-outlook') {
      setSourceType('unc');
      setName('Microsoft Outlook Classic (Office Deployment Tool / ODT)');
      setWingetId('');
      setVersion('16.0 Desktop');
      setCategory('Productivity');
      setUncPath('\\\\corp-fs01.internal.net\\deployments\\office\\odt');
      setFileName('setup.exe');
      setInstallerType('CustomEXE');
      setSilentArgs('/configure configuration-outlook.xml');
      setDetectionType('FilePath');
      setDetectionRule('C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE');
      setSuccessExitCodes('0, 3010');
      setEstimatedMinutes(5);
      setDescription('Classic desktop Microsoft Outlook installed via Office Deployment Tool (ODT). Note: Winget does not distribute Outlook Classic (Winget only provides the new web-based Outlook).');
      setHasConfigFile(false);
    } else if (type === 'winget-chrome') {
      setSourceType('winget');
      setName('Google Chrome (Winget)');
      setWingetId('Google.Chrome');
      setVersion('Stable');
      setCategory('Browser');
      setInstallerType('Winget');
      setSilentArgs('--silent --accept-package-agreements --accept-source-agreements --disable-interactivity');
      setDetectionType('FilePath');
      setDetectionRule('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
      setSuccessExitCodes('0, 3010');
      setEstimatedMinutes(2);
      setDescription('Official Google Chrome web browser installed from Winget repository.');
      setHasConfigFile(false);
    } else if (type === 'winget-notepadpp') {
      setSourceType('winget');
      setName('Notepad++ (Winget)');
      setWingetId('Notepad++.Notepad++');
      setVersion('8.7');
      setCategory('Development');
      setInstallerType('Winget');
      setSilentArgs('--silent --accept-package-agreements --accept-source-agreements --disable-interactivity');
      setDetectionType('FilePath');
      setDetectionRule('C:\\Program Files\\Notepad++\\notepad++.exe');
      setSuccessExitCodes('0, 3010');
      setEstimatedMinutes(1);
      setDescription('Source code editor installed directly from Windows Package Manager.');
      setHasConfigFile(false);
    } else if (type === 'winget-adobereader') {
      setSourceType('winget');
      setName('Adobe Acrobat Reader DC (Winget)');
      setWingetId('Adobe.Acrobat.Reader.64-bit');
      setVersion('Continuous');
      setCategory('Productivity');
      setInstallerType('Winget');
      setSilentArgs('--silent --accept-package-agreements --accept-source-agreements --disable-interactivity');
      setDetectionType('FilePath');
      setDetectionRule('C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe');
      setSuccessExitCodes('0, 3010');
      setEstimatedMinutes(3);
      setDescription('Adobe Acrobat Reader installed via Winget without requiring UNC repository.');
      setHasConfigFile(false);
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (sourceType === 'winget' && !wingetId.trim()) {
      alert('Please provide a valid Winget Package ID (e.g. 7zip.7zip, VideoLAN.VLC)');
      return;
    }

    if (sourceType === 'unc' && !fileName.trim()) {
      alert('Please provide the installer file name for UNC deployment.');
      return;
    }

    const parsedExitCodes = successExitCodes
      .split(',')
      .map((c) => parseInt(c.trim(), 10))
      .filter((n) => !isNaN(n));

    const packageData: SoftwarePackage = {
      id: editingPkgId || `pkg-${Date.now().toString(36)}`,
      name: name.trim(),
      version: version.trim() || '1.0.0',
      category,
      sourceType,
      wingetId: sourceType === 'winget' ? wingetId.trim() : undefined,
      uncPath: sourceType === 'winget' ? '' : uncPath.trim(),
      fileName: sourceType === 'winget' ? wingetId.trim() : fileName.trim(),
      installerType: sourceType === 'winget' ? 'Winget' : installerType,
      silentArgs: silentArgs.trim(),
      extraSwitches: extraSwitches.trim() || undefined,
      configFileImport:
        sourceType === 'unc' && hasConfigFile
          ? {
              enabled: true,
              configFileName: configFileName.trim(),
              configUncPath: configUncPath.trim(),
              importSwitch: importSwitch.trim() || undefined,
              preCopyDestination: preCopyDestination.trim() || undefined,
            }
          : undefined,
      logArgs: logArgs.trim() || undefined,
      rebootBehavior,
      detectionType,
      detectionRule: detectionRule.trim(),
      successExitCodes: parsedExitCodes.length > 0 ? parsedExitCodes : [0],
      estimatedMinutes: Number(estimatedMinutes) || 2,
      description: description.trim() || `${name} software package`,
      notes: notes.trim() || undefined,
      testInstallStatus: 'Verified',
      aiConfidence: 100,
    };

    if (editingPkgId && onUpdatePackage) {
      onUpdatePackage(packageData);
    } else {
      onAddPackage(packageData);
    }

    setIsFormOpen(false);
  };

  const filtered = packages.filter((pkg) => {
    const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);
    const matchesSource =
      sourceFilter === 'All' ||
      (sourceFilter === 'winget' && isWinget) ||
      (sourceFilter === 'unc' && !isWinget);

    const matchesSearch =
      pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.fileName.toLowerCase().includes(search.toLowerCase()) ||
      (pkg.wingetId && pkg.wingetId.toLowerCase().includes(search.toLowerCase())) ||
      pkg.uncPath.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'All' || pkg.category === selectedCategory;
    return matchesSource && matchesSearch && matchesCat;
  });

  const wingetCount = packages.filter((p) => p.sourceType === 'winget' || p.installerType === 'Winget' || Boolean(p.wingetId)).length;
  const uncCount = packages.length - wingetCount;

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Two Clear Actions: Manual Add and AI Scan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-white">Software Catalog (UNC Shares & Winget)</h1>
          </div>
          <p className="text-xs text-slate-400">
            Deploy silent software from SMB file shares or directly via Windows Package Manager (Winget) without storing files locally.
          </p>
          <div className="flex items-center space-x-3 mt-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800/60 text-emerald-300 font-mono">
              🏢 UNC Share: {uncCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-800/60 text-sky-300 font-mono">
              🪟 Winget: {wingetCount}
            </span>
            <span className="text-slate-500">• Total Packages: {packages.length}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {/* Primary Manual Add Button */}
          <button
            onClick={openCreateForm}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Package (UNC or Winget)</span>
          </button>

          {/* AI Switch Detective Button — Only visible when Gemini API key is configured */}
          {Boolean(geminiConfig?.hasApiKey) && (
            <button
              onClick={onOpenAIDetective}
              className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-purple-300 hover:text-white border border-purple-800/60 text-xs font-semibold transition-all cursor-pointer"
              title="Scan custom installer documentation with AI switch discovery"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>AI Switch Detective</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Package Add/Edit Modal */}
      {isFormOpen && (
        <div className="bg-slate-900 border border-cyan-500/70 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">
                {editingPkgId ? 'Edit Software Package' : 'Register New Software Package'}
              </h2>
            </div>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Source Type Selector: UNC Share vs Winget */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Distribution Source</span>
              <span className="text-[11px] text-slate-400">
                Choose whether this software installs from an internal UNC SMB share or directly from Winget CDN.
              </span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSourceType('unc');
                  setInstallerType('MSI');
                  setSilentArgs('/qn /norestart ALLUSERS=1');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  sourceType === 'unc'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>UNC Network Share</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceType('winget');
                  setInstallerType('Winget');
                  setSilentArgs('--silent --accept-package-agreements --accept-source-agreements --disable-interactivity');
                  if (!wingetId) setWingetId('7zip.7zip');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  sourceType === 'winget'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Winget (No UNC Needed)</span>
              </button>
            </div>
          </div>

          {/* Quick presets for chosen source type */}
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-2">
              {sourceType === 'winget'
                ? '⭐ Quick Presets for Popular Winget Packages:'
                : '⭐ Quick Auto-Fill Presets for UNC Packaging Types:'}
            </span>
            <div className="flex flex-wrap gap-2">
              {sourceType === 'winget' ? (
                <>
                  <button
                    type="button"
                    onClick={() => applyPreset('winget-7zip')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-800 text-sky-300 hover:bg-sky-900 transition-colors font-mono cursor-pointer"
                  >
                    📦 7-Zip (7zip.7zip)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('winget-vlc')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-800 text-sky-300 hover:bg-sky-900 transition-colors font-mono cursor-pointer"
                  >
                    📦 VLC Media Player (VideoLAN.VLC)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('odt-outlook')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 transition-colors font-mono cursor-pointer"
                    title="Office Deployment Tool Click-to-Run (Winget does not distribute Outlook Classic)"
                  >
                    💼 Outlook Classic (ODT / UNC)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('winget-chrome')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-800 text-sky-300 hover:bg-sky-900 transition-colors font-mono cursor-pointer"
                  >
                    📦 Google Chrome (Google.Chrome)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('winget-notepadpp')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-800 text-sky-300 hover:bg-sky-900 transition-colors font-mono cursor-pointer"
                  >
                    📦 Notepad++ (Notepad++.Notepad++)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('winget-adobereader')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-800 text-sky-300 hover:bg-sky-900 transition-colors font-mono cursor-pointer"
                  >
                    📦 Adobe Acrobat Reader
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => applyPreset('TeamViewer')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-purple-800/80 text-purple-300 hover:bg-purple-950/40 transition-colors font-medium cursor-pointer"
                  >
                    ⭐ TeamViewer Host (MSI + Token + .tvopt)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('MSI')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 hover:bg-slate-800 transition-colors font-mono cursor-pointer"
                  >
                    Standard MSI (/qn /norestart)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('InnoSetup')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-mono cursor-pointer"
                  >
                    Inno Setup (/VERYSILENT)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('NSIS')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-mono cursor-pointer"
                  >
                    NSIS (/S)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('WiX')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-mono cursor-pointer"
                  >
                    WiX Burn (-q --silent)
                  </button>
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-4">
            {/* Row 1: Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Software Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 7-Zip Enterprise or AnyDesk"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 24.08 or 1.0.0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SoftwarePackage['category'])}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="RemoteSupport">Remote Support / Management</option>
                  <option value="Browser">Web Browser</option>
                  <option value="Development">Developer Tools</option>
                  <option value="Productivity">Productivity & Office</option>
                  <option value="Communication">Team Communications</option>
                  <option value="Security">Security & Antivirus</option>
                  <option value="Utilities">Utilities & Tools</option>
                </select>
              </div>
            </div>

            {/* Row 2: Source Specific Fields */}
            {sourceType === 'winget' ? (
              <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-800/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-sky-300 font-semibold mb-1">
                      Winget Package ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={wingetId}
                      onChange={(e) => setWingetId(e.target.value)}
                      placeholder="e.g. 7zip.7zip, VideoLAN.VLC, Microsoft.Outlook"
                      className="w-full bg-slate-950 border border-sky-700/80 rounded-lg px-3 py-2 text-sky-200 font-mono text-xs focus:outline-none focus:border-sky-400"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Matches the exact package ID in Microsoft's official winget repo.
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Generated PowerShell Command Preview
                    </label>
                    <code className="block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                      winget install --id "{wingetId || 'Package.ID'}" -e --silent --accept-package-agreements
                    </code>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">
                    UNC Share Directory <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={uncPath}
                    onChange={(e) => setUncPath(e.target.value)}
                    placeholder="\\corp-fs01.internal.net\deployments\apps\anydesk"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Installer Binary Filename <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="AnyDeskSetup.msi"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            {/* Row 3: Installer Framework & Silent Arguments */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Installer Packaging Type</label>
                <select
                  value={installerType}
                  onChange={(e) => setInstallerType(e.target.value as SoftwarePackage['installerType'])}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                >
                  {sourceType === 'winget' ? (
                    <option value="Winget">Winget (Windows Package Manager)</option>
                  ) : (
                    <>
                      <option value="MSI">MSI (Windows Installer)</option>
                      <option value="InnoSetup">Inno Setup</option>
                      <option value="NSIS">NSIS (Nullsoft)</option>
                      <option value="WiX">WiX / Burn Bootstrapper</option>
                      <option value="InstallShield">InstallShield</option>
                      <option value="CustomEXE">Custom EXE / Bootstrapper</option>
                      <option value="PowerShellScript">PowerShell Script (.ps1)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">
                  Silent Execution Arguments <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={silentArgs}
                  onChange={(e) => setSilentArgs(e.target.value)}
                  placeholder={sourceType === 'winget' ? '--silent --accept-package-agreements --accept-source-agreements' : '/qn /norestart ALLUSERS=1'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Row 4: Extra Switches (e.g. MSI properties, tokens) */}
            <div className="text-xs">
              <label className="block text-slate-300 font-semibold mb-1">
                Extra Installer Switches / Public Properties (Optional)
              </label>
              <input
                type="text"
                value={extraSwitches}
                onChange={(e) => setExtraSwitches(e.target.value)}
                placeholder='e.g. CUSTOMCONFIGID=idc89120 APITOKEN=xxxx ASSIGNMENTOPTIONS="--alias %COMPUTERNAME%"'
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-purple-300 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Additional arguments appended verbatim to the silent execution command.
              </span>
            </div>

            {/* Row 5: Configuration File Import (e.g. TeamViewer .tvopt) */}
            {sourceType === 'unc' && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has-config-file-toggle"
                      checked={hasConfigFile}
                      onChange={(e) => setHasConfigFile(e.target.checked)}
                      className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor="has-config-file-toggle"
                      className="text-xs font-bold text-white cursor-pointer select-none"
                    >
                      Import Custom Configuration File (e.g. TeamViewer .tvopt or XML template)
                    </label>
                  </div>
                  <span className="text-[10px] text-purple-400 font-mono">MSI & Custom Exe Staging</span>
                </div>

                {hasConfigFile && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-850">
                    <div>
                      <label className="block text-slate-400 mb-1">Config File Name</label>
                      <input
                        type="text"
                        value={configFileName}
                        onChange={(e) => setConfigFileName(e.target.value)}
                        placeholder="TeamViewer_Settings.tvopt"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Config UNC Path</label>
                      <input
                        type="text"
                        value={configUncPath}
                        onChange={(e) => setConfigUncPath(e.target.value)}
                        placeholder="\\corp-fs01\deployments\TeamViewer_Settings.tvopt"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-cyan-300 font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Import Switch Property</label>
                      <input
                        type="text"
                        value={importSwitch}
                        onChange={(e) => setImportSwitch(e.target.value)}
                        placeholder='SETTINGSFILE="<CONFIG_PATH>"'
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-purple-300 font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Pre-Copy Local Destination (Optional)</label>
                      <input
                        type="text"
                        value={preCopyDestination}
                        onChange={(e) => setPreCopyDestination(e.target.value)}
                        placeholder="C:\Program Files\TeamViewer\"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 6: Detection & Verification */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Detection Rule Type</label>
                <select
                  value={detectionType}
                  onChange={(e) => setDetectionType(e.target.value as SoftwarePackage['detectionType'])}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="FilePath">Local File Path (Test-Path)</option>
                  <option value="Registry">Registry Key (Uninstall Key)</option>
                  <option value="PowerShellCheck">Custom PowerShell Check</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">
                  Detection Rule Path or Expression
                </label>
                <input
                  type="text"
                  value={detectionRule}
                  onChange={(e) => setDetectionRule(e.target.value)}
                  placeholder="C:\Program Files\7-Zip\7z.exe"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Row 7: Exit Codes, Log Args & Minutes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Success Exit Codes</label>
                <input
                  type="text"
                  value={successExitCodes}
                  onChange={(e) => setSuccessExitCodes(e.target.value)}
                  placeholder="0, 3010"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reboot Behavior</label>
                <select
                  value={rebootBehavior}
                  onChange={(e) => setRebootBehavior(e.target.value as SoftwarePackage['rebootBehavior'])}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Suppress">Suppress (Zero Restart)</option>
                  <option value="Prompt">Prompt</option>
                  <option value="Allow">Allow</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Estimated Duration (Min)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Description */}
            <div className="text-xs">
              <label className="block text-slate-300 font-semibold mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of package purpose"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30"
              >
                <Save className="w-4 h-4" />
                <span>{editingPkgId ? 'Save Changes' : 'Register Package'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Distribution Source Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search package name, Winget ID (7zip, vlc), or UNC directory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Distribution Source Filter */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setSourceFilter('All')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sourceFilter === 'All'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Sources ({packages.length})
            </button>
            <button
              onClick={() => setSourceFilter('unc')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sourceFilter === 'unc'
                  ? 'bg-emerald-900/70 border border-emerald-600 text-emerald-200 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>UNC Share ({uncCount})</span>
            </button>
            <button
              onClick={() => setSourceFilter('winget')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sourceFilter === 'winget'
                  ? 'bg-sky-900/70 border border-sky-600 text-sky-200 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span>Winget Repo ({wingetCount})</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`text-xs px-3 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === c
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Package Table / Cards */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((pkg) => {
          const isExpanded = expandedId === pkg.id;
          const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);

          return (
            <div
              key={pkg.id}
              className={`border hover:border-slate-700 rounded-xl p-4 transition-all shadow-sm ${
                isWinget
                  ? 'bg-slate-900/90 border-sky-900/50'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      isWinget
                        ? 'bg-sky-950 border border-sky-800 text-sky-400'
                        : 'bg-slate-950 border border-slate-800 text-cyan-400'
                    }`}
                  >
                    {isWinget ? 'WINGET' : pkg.installerType}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{pkg.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        v{pkg.version}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {pkg.category}
                      </span>

                      {/* Source badge */}
                      {isWinget ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-950 text-sky-300 border border-sky-700/80 font-mono flex items-center space-x-1">
                          <Terminal className="w-3 h-3 text-sky-400" />
                          <span>Winget: {pkg.wingetId || pkg.fileName}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-mono flex items-center space-x-1">
                          <FolderOpen className="w-3 h-3 text-emerald-400" />
                          <span>UNC Share</span>
                        </span>
                      )}

                      {pkg.configFileImport?.enabled && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-medium">
                          Config File Import
                        </span>
                      )}
                    </div>

                    {/* Source path / command indicator */}
                    <div className="flex items-center space-x-2 text-xs font-mono mt-1">
                      {isWinget ? (
                        <span className="text-sky-300 truncate">
                          winget install --id "{pkg.wingetId || pkg.fileName}" --silent
                        </span>
                      ) : (
                        <div className="flex items-center space-x-1.5 text-slate-400 truncate">
                          <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{pkg.uncPath}\{pkg.fileName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => setSandboxPkg(pkg)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-300 hover:text-white flex items-center space-x-1 cursor-pointer transition-colors"
                    title="Test package in isolated Proxmox VM with automatic snapshot rollback"
                  >
                    <Box className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">Sandbox Test</span>
                  </button>

                  <button
                    onClick={() => openEditForm(pkg)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                    title="Edit package details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Parameters</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => onDeletePackage(pkg.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Remove package from catalog"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">
                      {isWinget ? 'Winget Silent Switches:' : 'Silent Arguments:'}
                    </span>
                    <code className="block bg-slate-950 p-2 rounded border border-slate-800 text-emerald-300 font-mono text-[11px] break-all">
                      {pkg.silentArgs}
                    </code>
                    {pkg.extraSwitches && (
                      <div className="mt-2">
                        <span className="text-[11px] text-cyan-400 block mb-0.5">Extra Switches:</span>
                        <code className="block bg-slate-950 p-1.5 rounded border border-slate-800 text-cyan-300 font-mono text-[11px] break-all">
                          {pkg.extraSwitches}
                        </code>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Post-Install Detection Rule:</span>
                    <code className="block bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 font-mono text-[11px] break-all">
                      {pkg.detectionRule || 'Standard exit code validation'}
                    </code>
                    {pkg.configFileImport?.enabled && (
                      <div className="mt-2">
                        <span className="text-[11px] text-purple-400 block mb-0.5">Configuration File Import:</span>
                        <code className="block bg-slate-950 p-1.5 rounded border border-slate-800 text-purple-300 font-mono text-[11px] break-all">
                          {pkg.configFileImport.configUncPath}
                        </code>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-slate-300">
                    <span className="text-[11px] text-slate-400 block mb-1">Deployment Metadata:</span>
                    <div className="flex justify-between text-[11px]">
                      <span>Distribution:</span>
                      <span className="font-mono text-cyan-400">
                        {isWinget ? 'Windows Package Manager' : 'Local UNC SMB Share'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Exit Codes:</span>
                      <span className="font-mono text-cyan-400">[{pkg.successExitCodes.join(', ')}]</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Reboot Mode:</span>
                      <span>{pkg.rebootBehavior}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Est. Duration:</span>
                      <span>~{pkg.estimatedMinutes} min</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sandboxPkg && (
        <PackageSandboxModal
          isOpen={!!sandboxPkg}
          onClose={() => setSandboxPkg(null)}
          pkg={sandboxPkg}
          onPackageVerified={(updated) => {
            if (onUpdatePackage) onUpdatePackage(updated);
            setSandboxPkg(updated);
          }}
        />
      )}
    </div>
  );
};
