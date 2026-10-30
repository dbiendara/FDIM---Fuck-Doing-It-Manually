import React, { useState, useEffect } from 'react';
import {
  SoftwarePackage,
  AIDetectionResult,
  AITestInstallResult,
} from '../types';
import {
  Sparkles,
  Search,
  FileText,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Save,
  Loader2,
  HardDrive,
  Cpu,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  BookOpen,
  Play,
  Check,
  Info,
} from 'lucide-react';

interface AIDetectiveProps {
  onAddPackage: (pkg: SoftwarePackage) => void;
  existingPackages: SoftwarePackage[];
  geminiConfig?: {
    enabled: boolean;
    hasApiKey: boolean;
    model?: string;
    message?: string;
  };
}

export const AIDetective: React.FC<AIDetectiveProps> = ({
  onAddPackage,
  existingPackages,
  geminiConfig,
}) => {
  // Input fields
  const [softwareName, setSoftwareName] = useState('Wireshark Network Analyzer');
  const [version, setVersion] = useState('4.2.7');
  const [fileName, setFileName] = useState('Wireshark-win64-4.2.7.exe');
  const [uncPath, setUncPath] = useState('\\\\corp-fs01.internal.net\\deployments\\apps\\wireshark');
  const [vendorDocUrl, setVendorDocUrl] = useState('https://www.wireshark.org/docs/wsug_html_chunked/ChBuildInstallWin.html');
  const [docSnippet, setDocSnippet] = useState(
    'Wireshark uses an NSIS (Nullsoft) installer. For unattended installations, use the /S flag. To suppress desktop icons, use /desktopicon=no. If you want to install Npcap silently, pass /npcap=yes /S. The installer writes to standard Program Files.'
  );

  // States
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<AIDetectionResult | null>(null);
  const [testResult, setTestResult] = useState<AITestInstallResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; hasApiKey: boolean; message?: string } | null>(
    geminiConfig || null
  );

  // Check Gemini AI availability on server
  useEffect(() => {
    if (geminiConfig) {
      setAiStatus(geminiConfig);
      return;
    }
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((data) => setAiStatus(data))
      .catch(() => setAiStatus({ enabled: false, hasApiKey: false, message: 'Gemini AI service unavailable' }));
  }, [geminiConfig]);

  const isGeminiActive = Boolean(aiStatus?.enabled && aiStatus?.hasApiKey);

  // Preset demo software samples
  const loadPreset = (preset: {
    name: string;
    version: string;
    file: string;
    unc: string;
    url: string;
    docs: string;
  }) => {
    setSoftwareName(preset.name);
    setVersion(preset.version);
    setFileName(preset.file);
    setUncPath(preset.unc);
    setVendorDocUrl(preset.url);
    setDocSnippet(preset.docs);
    setDetectionResult(null);
    setTestResult(null);
    setErrorMsg(null);
    setSavedSuccess(false);
  };

  // Run AI Silent Switch Detection
  const handleDetectSwitches = async (offline = false) => {
    setIsScanning(true);
    setErrorMsg(null);
    setSavedSuccess(false);
    setTestResult(null);

    try {
      const response = await fetch('/api/ai/detect-switches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          softwareName,
          version,
          fileName,
          uncPath,
          vendorDocUrl,
          docSnippet,
          useOfflineFallback: offline,
        }),
      });

      const res = await response.json();
      if (res.success && res.data) {
        setDetectionResult(res.data);
      } else {
        throw new Error(res.error || 'Failed to detect silent parameters');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during installer analysis');
    } finally {
      setIsScanning(false);
    }
  };

  // Run Sandbox Test Install Simulation
  const handleRunTestInstall = async (offline = false) => {
    if (!detectionResult) return;
    setIsTesting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/ai/test-install-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          softwareName,
          uncPath,
          fileName,
          installerType: detectionResult.installerType,
          silentArgs: detectionResult.silentArgs,
          extraSwitches: detectionResult.extraSwitches,
          detectionRule: detectionResult.detectionRule,
          useOfflineFallback: offline,
        }),
      });

      const res = await response.json();
      if (res.success && res.data) {
        setTestResult(res.data);
      } else {
        throw new Error(res.error || 'Failed to execute test install simulation');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during test install simulation');
    } finally {
      setIsTesting(false);
    }
  };

  // Save to corporate UNC library
  const handleSaveToCatalog = () => {
    if (!detectionResult) return;

    const hasConfigFile = detectionResult.configFileAdvice?.includes('.tvopt') || docSnippet.includes('.tvopt');

    const newPackage: SoftwarePackage = {
      id: `pkg-${Date.now().toString(36)}`,
      name: softwareName,
      version: version || '1.0.0',
      category: detectionResult.category || 'Utilities',
      uncPath,
      fileName,
      installerType: detectionResult.installerType,
      silentArgs: detectionResult.silentArgs,
      extraSwitches: detectionResult.extraSwitches,
      configFileImport: hasConfigFile
        ? {
            enabled: true,
            configFileName: 'TeamViewer_Settings.tvopt',
            configUncPath: `${uncPath}\\TeamViewer_Settings.tvopt`,
            importSwitch: `SETTINGSFILE="${uncPath}\\TeamViewer_Settings.tvopt"`,
            preCopyDestination: 'C:\\Program Files\\TeamViewer\\',
          }
        : undefined,
      logArgs: detectionResult.logArgs,
      rebootBehavior: detectionResult.rebootBehavior,
      detectionType: detectionResult.detectionType,
      detectionRule: detectionResult.detectionRule,
      successExitCodes: detectionResult.successExitCodes || [0],
      estimatedMinutes: detectionResult.estimatedMinutes || 2,
      description: detectionResult.analysisExplanation.substring(0, 160) + '...',
      testInstallStatus: testResult?.verdict === 'PASS' ? 'Verified' : 'Untested',
      aiConfidence: detectionResult.confidenceScore,
      notes: `Scanned & validated by AI Detective. Exit codes: ${detectionResult.successExitCodes.join(', ')}`,
    };

    onAddPackage(newPackage);
    setSavedSuccess(true);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-800/40 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-700/60 text-purple-200 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>AI Silent Switch Detective & Test Install Harness</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Automated Silent Packaging Inspector
          </h1>
          <p className="mt-2 text-slate-300 text-sm leading-relaxed">
            When new software is introduced to the organization, the AI analyzes the installer binary framework (MSI, Inno Setup, NSIS, WiX Burn, InstallShield), scans vendor release documentation, extracts silent flags, and runs a synthetic sandbox test install.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div className="mt-6 pt-5 border-t border-purple-900/50">
          <span className="text-xs text-purple-300 font-medium block mb-2.5">
            Quick-load enterprise software documentation samples:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                loadPreset({
                  name: 'TeamViewer Host (Unattended Support)',
                  version: '15.56.3',
                  file: 'TeamViewer_Host.msi',
                  unc: '\\\\corp-fs01.internal.net\\deployments\\apps\\teamviewer',
                  url: 'https://community.teamviewer.com/English/kb/articles/39638-mass-deployment-improvements',
                  docs: 'TeamViewer Host MSI unattended installation requires: msiexec.exe /i "TeamViewer_Host.msi" /qn CUSTOMCONFIGID=idc89120 APITOKEN=109283-acmetoken ASSIGNMENTOPTIONS="--alias %COMPUTERNAME% --grant-easy-access". To import pre-configured settings, pass SETTINGSFILE="\\\\corp-fs01\\deployments\\teamviewer\\TeamViewer_Settings.tvopt". Exit code 0 indicates success, 3010 reboot pending.',
                })
              }
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-purple-900/50 text-cyan-300 border border-cyan-500/50 transition-colors font-medium flex items-center space-x-1"
            >
              <span>⭐ TeamViewer Host (MSI + CustomConfigID + .tvopt)</span>
            </button>

            <button
              onClick={() =>
                loadPreset({
                  name: 'Wireshark Network Analyzer',
                  version: '4.2.7',
                  file: 'Wireshark-win64-4.2.7.exe',
                  unc: '\\\\corp-fs01.internal.net\\deployments\\apps\\wireshark',
                  url: 'https://www.wireshark.org/docs/wsug_html_chunked/ChBuildInstallWin.html',
                  docs: 'Wireshark uses an NSIS (Nullsoft) installer. For unattended installations, use the /S flag. To suppress desktop icons, use /desktopicon=no. If you want to install Npcap silently, pass /npcap=yes /S. The installer writes to standard Program Files.',
                })
              }
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-purple-900/40 text-purple-200 border border-purple-800/50 transition-colors"
            >
              Wireshark (NSIS /S)
            </button>

            <button
              onClick={() =>
                loadPreset({
                  name: 'Postman Desktop Enterprise',
                  version: '11.8.0',
                  file: 'Postman-win64-Setup.exe',
                  unc: '\\\\corp-fs01.internal.net\\deployments\\apps\\postman',
                  url: 'https://learning.postman.com/docs/getting-started/installation-and-updates/',
                  docs: 'Postman uses a Squirrel/Electron installer. For machine-wide installation without user interaction, pass --silent flag. To disable desktop shortcuts and automatic startup, add --suppress-shortcuts flag.',
                })
              }
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-purple-900/40 text-purple-200 border border-purple-800/50 transition-colors"
            >
              Postman (Squirrel/Electron)
            </button>

            <button
              onClick={() =>
                loadPreset({
                  name: 'AutoDesk DWG TrueView 2025',
                  version: '2025.1',
                  file: 'DWGTrueView_2025_English_Win_64bit.exe',
                  unc: '\\\\corp-fs01.internal.net\\deployments\\apps\\autodesk',
                  url: 'https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Silent-Install-parameters.html',
                  docs: 'Autodesk installer is packaged with WiX Burn bootstrapper. Silent installation syntax is Setup.exe -q --silent. The return code 0 indicates success, and 3010 indicates a pending restart.',
                })
              }
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-purple-900/40 text-purple-200 border border-purple-800/50 transition-colors"
            >
              AutoDesk DWG TrueView (WiX Burn -q)
            </button>

            <button
              onClick={() =>
                loadPreset({
                  name: 'Tableau Desktop Enterprise',
                  version: '2024.2.1',
                  file: 'TableauDesktop-64bit-2024-2-1.exe',
                  unc: '\\\\corp-fs01.internal.net\\deployments\\apps\\tableau',
                  url: 'https://help.tableau.com/current/desktopdeploy/en-us/desktop_deploy_commandline.htm',
                  docs: 'Tableau Desktop command-line installation: TableauDesktop-64bit.exe /quiet /norestart ACCEPTEULA=1 REGISTER=0 REPORTING=0 ACTIVATEKEY="CORP-LIC-9901". Log file flag: /log "C:\\ProgramData\\PCSetup\\Logs\\tableau.log". Exit code 0 indicates success.',
                })
              }
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-purple-900/40 text-purple-200 border border-purple-800/50 transition-colors"
            >
              Tableau Desktop (MSI Properties)
            </button>
          </div>
        </div>
      </div>

      {/* Input Stage */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span>Software Information & Documentation Sources</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Software Name</label>
            <input
              type="text"
              value={softwareName}
              onChange={(e) => setSoftwareName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Installer Filename</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">UNC Share Target Directory</label>
            <input
              type="text"
              value={uncPath}
              onChange={(e) => setUncPath(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Vendor Installation Documentation Link (Optional)
            </label>
            <input
              type="text"
              value={vendorDocUrl}
              onChange={(e) => setVendorDocUrl(e.target.value)}
              placeholder="https://docs.vendor.com/silent-install"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Vendor Silent Install Documentation / Release Notes / Packaging Snippet
            </label>
            <textarea
              rows={4}
              value={docSnippet}
              onChange={(e) => setDocSnippet(e.target.value)}
              placeholder="Paste relevant sections from vendor deployment guide, silent switches table, or command-line parameters..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Gemini Disabled Status Banner */}
        {!isGeminiActive && (
          <div className="mt-6 p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-xs flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-300 flex items-center space-x-2">
                <span>Automatic Gemini AI Installer Feature Disabled</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-900/70 border border-amber-700 text-amber-200">
                  NO API KEY CONFIGURED
                </span>
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                No <code className="font-mono text-amber-100 bg-amber-950/80 px-1 py-0.5 rounded">GEMINI_API_KEY</code> environment variable was provided on the server. The automated Gemini-powered inspection is disabled. You can use the built-in <strong>Offline Heuristic Packaging Engine</strong> to detect switches for MSI, Inno Setup, NSIS, WiX Burn, InstallShield, and Squirrel installers, or run local sandbox installations.
              </p>
            </div>
          </div>
        )}

        {/* Trigger Action Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>
              {isGeminiActive
                ? 'Gemini AI will scan documentation syntax and detect silent arguments automatically.'
                : 'Offline heuristic engine will evaluate framework binary signatures and packaging syntax.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Always-Active Offline Heuristic Rule Engine Button */}
            <button
              onClick={() => handleDetectSwitches(true)}
              disabled={isScanning || !softwareName}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                !isGeminiActive
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60'
              } disabled:opacity-50`}
              title="Run offline rule-based heuristic detection"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>RUN OFFLINE HEURISTIC DETECTION</span>
            </button>

            {/* Gemini Scan Button: Enabled if API key is present, explicitly disabled otherwise */}
            {isGeminiActive ? (
              <button
                onClick={() => handleDetectSwitches(false)}
                disabled={isScanning || !softwareName}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scanning with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>GEMINI AI SCAN & DETECT</span>
                  </>
                )}
              </button>
            ) : (
              <div
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-500 text-xs font-semibold select-none cursor-not-allowed"
                title="Gemini scan disabled: No GEMINI_API_KEY environment variable provided"
              >
                <Sparkles className="w-4 h-4 text-slate-600" />
                <span>Gemini Scan Disabled (No Key)</span>
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* AI Detection Result Cards */}
      {detectionResult && (
        <div className="bg-slate-900 border border-purple-500/50 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-white">
                    Silent Install Specification Identified
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                      (detectionResult as any).geminiDisabled || !isGeminiActive
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {(detectionResult as any).geminiDisabled || !isGeminiActive
                      ? 'Offline Heuristic Engine'
                      : `${detectionResult.confidenceScore}% Confidence (Gemini AI)`}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Installer Framework: <strong className="text-cyan-400">{detectionResult.installerType}</strong> • Category: {detectionResult.category}
                </p>
              </div>
            </div>

            {/* Test Install Button */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleRunTestInstall(!isGeminiActive)}
                disabled={isTesting}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Test Sandbox Install...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>EXECUTE SANDBOX TEST INSTALL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-mono block mb-1">
                Zero-Touch Silent Arguments
              </span>
              <code className="text-xs text-emerald-400 font-mono font-bold break-all">
                {detectionResult.silentArgs}
              </code>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-mono block mb-1">
                Logging Arguments
              </span>
              <code className="text-xs text-cyan-300 font-mono break-all">
                {detectionResult.logArgs || 'None required'}
              </code>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-mono block mb-1">
                Exit Codes & Reboot Mode
              </span>
              <div className="flex items-center justify-between text-xs text-slate-200 font-mono">
                <span>Success: [{detectionResult.successExitCodes.join(', ')}]</span>
                <span className="text-amber-400 font-medium">Reboot: {detectionResult.rebootBehavior}</span>
              </div>
            </div>
          </div>

          {/* Detection Rule & Snippet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-mono block mb-1">
                Post-Install Detection Rule ({detectionResult.detectionType})
              </span>
              <code className="text-xs text-slate-300 font-mono block break-all bg-slate-900 p-2 rounded border border-slate-850">
                {detectionResult.detectionRule}
              </code>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-mono block mb-1">
                Generated PowerShell Invocation Snippet
              </span>
              <code className="text-xs text-purple-300 font-mono block break-all bg-slate-900 p-2 rounded border border-slate-850 overflow-x-auto">
                {detectionResult.powershellSnippet}
              </code>
            </div>
          </div>

          {/* Technical Explanation */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Packaging & Silent Switch Analysis</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {detectionResult.analysisExplanation}
            </p>
          </div>

          {/* Sandbox Test Result View */}
          {testResult && (
            <div className="mt-4 p-5 rounded-xl bg-slate-950 border border-cyan-500/60 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white">Sandbox Test Install Verification Report</h4>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase font-mono ${
                    testResult.verdict === 'PASS'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : testResult.verdict === 'WARN'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-red-950 text-red-300 border border-red-800'
                  }`}
                >
                  Verdict: {testResult.verdict}
                </span>
              </div>

              <p className="text-xs text-slate-300">{testResult.summary}</p>

              {/* Hanging Risk Analysis */}
              {testResult.hangingRisks && testResult.hangingRisks.length > 0 && (
                <div>
                  <span className="text-[11px] text-amber-400 font-medium block mb-1">
                    Hanging & Popup Risk Checklist:
                  </span>
                  <ul className="space-y-1">
                    {testResult.hangingRisks.map((risk, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start space-x-2">
                        <span className="text-cyan-400">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Simulated timeline */}
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-mono block mb-2">
                  Simulated Execution Timeline
                </span>
                <div className="space-y-2">
                  {testResult.simulatedTimeline.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center space-x-2 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-200">{step.step}</span>
                      </div>
                      <div className="flex items-center space-x-3 font-mono text-[11px] text-slate-400">
                        <span>{step.durationSec}s</span>
                        <span className="text-emerald-400">{step.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save to Catalog Action */}
          <div className="flex items-center justify-end pt-4 border-t border-slate-800 space-x-3">
            {savedSuccess ? (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-800">
                <Check className="w-4 h-4" />
                <span>Added to Corporate UNC Software Catalog!</span>
              </div>
            ) : (
              <button
                onClick={handleSaveToCatalog}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>SAVE & ADD TO CORPORATE LIBRARY</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
