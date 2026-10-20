import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  SoftwarePackage,
  CustomerProfile,
  SystemConfigSettings,
  SystemConfigSwitch,
  NetworkDriveMapping,
  PrinterMapping,
  UserLogonStagingConfig,
  UserLogonStagingSnippet,
} from '../types';
import {
  Monitor,
  CheckCircle2,
  Circle,
  Play,
  HardDrive,
  Building2,
  Users,
  Search,
  Clock,
  Sparkles,
  Server,
  Terminal,
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Download,
  Copy,
  Check,
  Info,
  Sliders,
  FileCode,
  ShieldAlert,
  Moon,
  Sun,
  Edit3,
  Plus,
  Trash2,
  FilePlus,
  ShieldCheck,
  FolderOpen,
  Printer,
  Link2,
  Save,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  UserX,
  Lock,
  Zap,
  Battery,
  Code,
  Code2,
  Globe,
  Mail,
  Layers,
  X,
} from 'lucide-react';
import {
  loadWizardDraft,
  saveWizardDraft,
  formatTimeAgo,
} from '../utils/wizardAutoSave';
import { getFdimExpansion } from '../utils/branding';

interface NewPCWizardProps {
  packages: SoftwarePackage[];
  customers: CustomerProfile[];
  machineName: string;
  setMachineName: (name: string) => void;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  selectedPackageIds: string[];
  setSelectedPackageIds: React.Dispatch<React.SetStateAction<string[]>>;
  packageCustomSwitches: Record<string, string>;
  setPackageCustomSwitches: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  packageConfigFiles: Record<string, string>;
  setPackageConfigFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  systemConfig: SystemConfigSettings;
  setSystemConfig: React.Dispatch<React.SetStateAction<SystemConfigSettings>>;
  systemSwitches: SystemConfigSwitch[];
  enabledSwitchIds: string[];
  setEnabledSwitchIds: React.Dispatch<React.SetStateAction<string[]>>;
  switchParameters: Record<string, string | number>;
  setSwitchParameters: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
  stagedDrives: NetworkDriveMapping[];
  setStagedDrives: React.Dispatch<React.SetStateAction<NetworkDriveMapping[]>>;
  stagedPrinters: PrinterMapping[];
  setStagedPrinters: React.Dispatch<React.SetStateAction<PrinterMapping[]>>;
  userLogonStaging: UserLogonStagingConfig;
  setUserLogonStaging: React.Dispatch<React.SetStateAction<UserLogonStagingConfig>>;
  onOpenSystemConfigManager: () => void;
  onDeleteSwitch: (id: string) => void;
  onOpenManualPackageModal: () => void;
  onStartDeployment: () => void;
  onOpenScriptModal: () => void;
  availableSnippets?: UserLogonStagingSnippet[];
  onOpenSnippetsManager?: () => void;
  onOpenCustomerProfiles?: () => void;
  showProfanity?: boolean;
}

export const NewPCWizard: React.FC<NewPCWizardProps> = ({
  packages,
  customers,
  machineName,
  setMachineName,
  selectedCustomerId,
  setSelectedCustomerId,
  selectedPackageIds,
  setSelectedPackageIds,
  packageCustomSwitches,
  setPackageCustomSwitches,
  packageConfigFiles,
  setPackageConfigFiles,
  systemConfig,
  setSystemConfig,
  systemSwitches,
  enabledSwitchIds,
  setEnabledSwitchIds,
  switchParameters,
  setSwitchParameters,
  stagedDrives,
  setStagedDrives,
  stagedPrinters,
  setStagedPrinters,
  userLogonStaging,
  setUserLogonStaging,
  onOpenSystemConfigManager,
  onDeleteSwitch,
  onOpenManualPackageModal,
  onStartDeployment,
  onOpenScriptModal,
  availableSnippets = [],
  onOpenSnippetsManager,
  onOpenCustomerProfiles,
  showProfanity = true,
}) => {
  const [packageSearch, setPackageSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'unc' | 'winget'>('All');
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  // First-Run Snippet management state in Wizard
  const [isSnippetPickerOpen, setIsSnippetPickerOpen] = useState(false);
  const [isAddCustomSnippetOpen, setIsAddCustomSnippetOpen] = useState(false);
  const [customSnippetTitle, setCustomSnippetTitle] = useState('');
  const [customSnippetScript, setCustomSnippetScript] = useState('');
  const [snippetSearchQuery, setSnippetSearchQuery] = useState('');
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);

  // Selected customer profile
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  // Handle switching customer profile
  const handleSelectCustomer = (customer: CustomerProfile) => {
    setSelectedCustomerId(customer.id);
    setSelectedPackageIds(customer.packageIds || []);
    if (customer.packageCustomSwitches) {
      setPackageCustomSwitches(customer.packageCustomSwitches);
    }
    if (customer.packageConfigFiles) {
      setPackageConfigFiles(customer.packageConfigFiles);
    }
    const powerEnabled = customer.powerPlanSettings?.enabled !== false;
    const localAdminEnabled = customer.localAdminSettings?.enableLocalAdmin ?? true;
    const localAdminPwd = customer.localAdminSettings?.defaultPassword || 'P@ssw0rd!2026Secure';
    const pwdNeverExpires = customer.localAdminSettings?.adminPasswordNeverExpires ?? true;
    const delOobe = customer.localAdminSettings?.deleteOobeAccount ?? true;
    const oobeName = customer.localAdminSettings?.defaultOobeAccountName || 'install';
    const removeProfile = customer.localAdminSettings?.removeOobeProfile ?? true;

    setSystemConfig((prev) => ({
      ...prev,
      enableRdp: customer.enableRdp,
      adAdminGroupName: customer.defaultAdAdminGroup,
      setPowerPlan: powerEnabled,
      screenTimeoutAc: customer.powerPlanSettings?.screenTimeoutAc ?? 15,
      standbyTimeoutAc: customer.powerPlanSettings?.standbyTimeoutAc ?? 0,
      screenTimeoutDc: customer.powerPlanSettings?.screenTimeoutDc ?? 10,
      standbyTimeoutDc: customer.powerPlanSettings?.standbyTimeoutDc ?? 20,
      enableLocalAdmin: localAdminEnabled,
      localAdminPassword: localAdminPwd,
      adminPasswordNeverExpires: pwdNeverExpires,
      deleteOobeAccount: delOobe,
      oobeAccountName: oobeName,
      removeOobeProfile: removeProfile,
    }));
    setSwitchParameters((prev) => ({
      ...prev,
      adAdminGroupName: customer.defaultAdAdminGroup,
      screenTimeoutAc: customer.powerPlanSettings?.screenTimeoutAc ?? 15,
      standbyTimeoutAc: customer.powerPlanSettings?.standbyTimeoutAc ?? 0,
      screenTimeoutDc: customer.powerPlanSettings?.screenTimeoutDc ?? 10,
      standbyTimeoutDc: customer.powerPlanSettings?.standbyTimeoutDc ?? 20,
      localAdminPassword: localAdminPwd,
      oobeAccountName: oobeName,
    }));
    if (customer.networkDrives) {
      setStagedDrives(customer.networkDrives);
    }
    if (customer.printers) {
      setStagedPrinters(customer.printers);
    }
    if (customer.userLogonStaging) {
      setUserLogonStaging(customer.userLogonStaging);
    }
  };

  // Auto-save state for machine configuration
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [lastSaved, setLastSaved] = useState<string | null>(() => {
    const existing = loadWizardDraft();
    return existing ? existing.savedAt : null;
  });
  const [restoredFromDraft, setRestoredFromDraft] = useState<boolean>(() => {
    return Boolean(loadWizardDraft());
  });
  const [showDraftNotice, setShowDraftNotice] = useState<boolean>(() => {
    return Boolean(loadWizardDraft());
  });

  const isMountedRef = useRef(false);

  // Auto-save changes to local storage whenever selections, switches, or parameters change
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    if (!customers || customers.length === 0 || !selectedCustomerId) return;

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      const saved = saveWizardDraft({
        machineName,
        selectedCustomerId,
        selectedPackageIds,
        packageCustomSwitches,
        packageConfigFiles,
        enabledSwitchIds,
        switchParameters,
        systemConfig,
        stagedDrives,
        stagedPrinters,
        userLogonStaging,
      });
      setLastSaved(saved.savedAt);
      setSaveStatus('saved');
    }, 300);

    return () => clearTimeout(timer);
  }, [
    machineName,
    selectedCustomerId,
    selectedPackageIds,
    packageCustomSwitches,
    packageConfigFiles,
    enabledSwitchIds,
    switchParameters,
    systemConfig,
    stagedDrives,
    stagedPrinters,
    userLogonStaging,
    customers,
  ]);

  // Reset current machine configuration to customer profile defaults
  const handleResetToCustomerDefaults = () => {
    if (!currentCustomer) return;
    setSelectedPackageIds(currentCustomer.packageIds || []);
    setPackageCustomSwitches(currentCustomer.packageCustomSwitches || {});
    setPackageConfigFiles(currentCustomer.packageConfigFiles || {});
    const powerEnabled = currentCustomer.powerPlanSettings?.enabled !== false;
    const localAdminEnabled = currentCustomer.localAdminSettings?.enableLocalAdmin ?? true;
    const localAdminPwd = currentCustomer.localAdminSettings?.defaultPassword || 'P@ssw0rd!2026Secure';
    const pwdNeverExpires = currentCustomer.localAdminSettings?.adminPasswordNeverExpires ?? true;
    const delOobe = currentCustomer.localAdminSettings?.deleteOobeAccount ?? true;
    const oobeName = currentCustomer.localAdminSettings?.defaultOobeAccountName || 'install';
    const removeProfile = currentCustomer.localAdminSettings?.removeOobeProfile ?? true;

    setSystemConfig({
      enableRdp: currentCustomer.enableRdp,
      addAdGroupToAdmins: true,
      adAdminGroupName: currentCustomer.defaultAdAdminGroup,
      setPowerPlan: powerEnabled,
      screenTimeoutAc: currentCustomer.powerPlanSettings?.screenTimeoutAc ?? 15,
      standbyTimeoutAc: currentCustomer.powerPlanSettings?.standbyTimeoutAc ?? 0,
      screenTimeoutDc: currentCustomer.powerPlanSettings?.screenTimeoutDc ?? 10,
      standbyTimeoutDc: currentCustomer.powerPlanSettings?.standbyTimeoutDc ?? 20,
      enableLocalAdmin: localAdminEnabled,
      localAdminPassword: localAdminPwd,
      adminPasswordNeverExpires: pwdNeverExpires,
      deleteOobeAccount: delOobe,
      oobeAccountName: oobeName,
      removeOobeProfile: removeProfile,
    });
    setSwitchParameters({
      adAdminGroupName: currentCustomer.defaultAdAdminGroup,
      screenTimeoutAc: currentCustomer.powerPlanSettings?.screenTimeoutAc ?? 15,
      standbyTimeoutAc: currentCustomer.powerPlanSettings?.standbyTimeoutAc ?? 0,
      screenTimeoutDc: currentCustomer.powerPlanSettings?.screenTimeoutDc ?? 10,
      standbyTimeoutDc: currentCustomer.powerPlanSettings?.standbyTimeoutDc ?? 20,
      localAdminPassword: localAdminPwd,
      oobeAccountName: oobeName,
    });
    setStagedDrives(currentCustomer.networkDrives || []);
    setStagedPrinters(currentCustomer.printers || []);
    if (currentCustomer.userLogonStaging) {
      setUserLogonStaging(currentCustomer.userLogonStaging);
    }
    const resetDraft = saveWizardDraft({
      machineName,
      selectedCustomerId: currentCustomer.id,
      selectedPackageIds: currentCustomer.packageIds || [],
      packageCustomSwitches: currentCustomer.packageCustomSwitches || {},
      packageConfigFiles: currentCustomer.packageConfigFiles || {},
      enabledSwitchIds: ['sw-rdp', 'sw-adgroup', 'sw-power-screen', 'sw-power-standby', 'sw-local-admin', 'sw-delete-oobe'],
      switchParameters: {
        adAdminGroupName: currentCustomer.defaultAdAdminGroup,
        screenTimeoutAc: currentCustomer.powerPlanSettings?.screenTimeoutAc ?? 15,
        standbyTimeoutAc: currentCustomer.powerPlanSettings?.standbyTimeoutAc ?? 0,
        screenTimeoutDc: currentCustomer.powerPlanSettings?.screenTimeoutDc ?? 10,
        standbyTimeoutDc: currentCustomer.powerPlanSettings?.standbyTimeoutDc ?? 20,
        localAdminPassword: localAdminPwd,
        oobeAccountName: oobeName,
      },
      systemConfig: {
        enableRdp: currentCustomer.enableRdp,
        addAdGroupToAdmins: true,
        adAdminGroupName: currentCustomer.defaultAdAdminGroup,
        setPowerPlan: powerEnabled,
        screenTimeoutAc: currentCustomer.powerPlanSettings?.screenTimeoutAc ?? 15,
        standbyTimeoutAc: currentCustomer.powerPlanSettings?.standbyTimeoutAc ?? 0,
        screenTimeoutDc: currentCustomer.powerPlanSettings?.screenTimeoutDc ?? 10,
        standbyTimeoutDc: currentCustomer.powerPlanSettings?.standbyTimeoutDc ?? 20,
        enableLocalAdmin: localAdminEnabled,
        localAdminPassword: localAdminPwd,
        adminPasswordNeverExpires: pwdNeverExpires,
        deleteOobeAccount: delOobe,
        oobeAccountName: oobeName,
        removeOobeProfile: removeProfile,
      },
      stagedDrives: currentCustomer.networkDrives || [],
      stagedPrinters: currentCustomer.printers || [],
      userLogonStaging: currentCustomer.userLogonStaging || {
        enabled: true,
        stagingPath: 'C:\\ProgramData\\FDIM\\UserLogonSetup.ps1',
        activeSetupKey: 'FDIM_UserProvisioning',
        scheduledTaskFallback: true,
        cleanUpAfterFirstRun: false,
      },
    });
    setLastSaved(resetDraft.savedAt);
    setSaveStatus('saved');
    setShowDraftNotice(false);
  };

  // State for adding one-off drives/printers in wizard
  const [wDriveLetter, setWDriveLetter] = useState('P:');
  const [wDriveUnc, setWDriveUnc] = useState('');
  const [wDriveLabel, setWDriveLabel] = useState('');
  const [wPrinterName, setWPrinterName] = useState('');
  const [wPrinterPath, setWPrinterPath] = useState('');
  const [wPrinterType, setWPrinterType] = useState<'PerMachineUNC' | 'UserLogonUNC' | 'DirectIP'>('PerMachineUNC');
  const [wPrinterDefault, setWPrinterDefault] = useState(false);

  const toggleDrive = (driveId: string) => {
    setStagedDrives((prev) =>
      prev.map((d) => (d.id === driveId ? { ...d, enabled: d.enabled === false ? true : false } : d))
    );
  };

  const removeDrive = (driveId: string) => {
    setStagedDrives((prev) => prev.filter((d) => d.id !== driveId));
  };

  const addDrive = () => {
    if (!wDriveUnc) return;
    const newDrive: NetworkDriveMapping = {
      id: `drv-${Date.now()}`,
      driveLetter: wDriveLetter.endsWith(':') ? wDriveLetter : `${wDriveLetter}:`,
      uncPath: wDriveUnc.trim(),
      label: wDriveLabel.trim() || `${wDriveLetter} Share`,
      persistent: true,
      enabled: true,
    };
    setStagedDrives((prev) => [...prev, newDrive]);
    setWDriveUnc('');
    setWDriveLabel('');
  };

  const togglePrinter = (printerId: string) => {
    setStagedPrinters((prev) =>
      prev.map((p) => (p.id === printerId ? { ...p, enabled: p.enabled === false ? true : false } : p))
    );
  };

  const removePrinter = (printerId: string) => {
    setStagedPrinters((prev) => prev.filter((p) => p.id !== printerId));
  };

  const addPrinter = () => {
    if (!wPrinterPath) return;
    const newPrn: PrinterMapping = {
      id: `prn-${Date.now()}`,
      name: wPrinterName.trim() || wPrinterPath.split('\\').pop() || 'Network Printer',
      connectionType: wPrinterType,
      pathOrIp: wPrinterPath.trim(),
      isDefault: wPrinterDefault,
      enabled: true,
    };
    if (wPrinterDefault) {
      setStagedPrinters((prev) => [...prev.map((p) => ({ ...p, isDefault: false })), newPrn]);
    } else {
      setStagedPrinters((prev) => [...prev, newPrn]);
    }
    setWPrinterName('');
    setWPrinterPath('');
    setWPrinterDefault(false);
  };

  // First-Run Snippet Handlers
  const toggleSnippet = (snippetId: string) => {
    setUserLogonStaging((prev) => {
      const current = prev.customScriptSnippets || [];
      const updated = current.map((s) => (s.id === snippetId ? { ...s, enabled: s.enabled === false ? true : false } : s));
      return { ...prev, customScriptSnippets: updated };
    });
  };

  const removeSnippet = (snippetId: string) => {
    setUserLogonStaging((prev) => {
      const current = prev.customScriptSnippets || [];
      return { ...prev, customScriptSnippets: current.filter((s) => s.id !== snippetId) };
    });
  };

  const addSnippetFromLibrary = (snippet: UserLogonStagingSnippet) => {
    setUserLogonStaging((prev) => {
      const current = prev.customScriptSnippets || [];
      if (current.some((s) => s.id === snippet.id)) {
        return prev;
      }
      return {
        ...prev,
        customScriptSnippets: [...current, { ...snippet, enabled: true }],
      };
    });
  };

  const addCustomSnippet = () => {
    if (!customSnippetTitle.trim() || !customSnippetScript.trim()) return;
    const newSnip: UserLogonStagingSnippet = {
      id: `snip-${Date.now().toString(36)}`,
      name: customSnippetTitle.trim(),
      script: customSnippetScript.trim(),
      enabled: true,
      category: 'Custom',
      author: 'Workstation Staging',
    };
    setUserLogonStaging((prev) => ({
      ...prev,
      customScriptSnippets: [...(prev.customScriptSnippets || []), newSnip],
    }));
    setCustomSnippetTitle('');
    setCustomSnippetScript('');
    setIsAddCustomSnippetOpen(false);
  };

  // Toggle package
  const togglePackage = (pkgId: string) => {
    setSelectedPackageIds((prev) =>
      prev.includes(pkgId) ? prev.filter((id) => id !== pkgId) : [...prev, pkgId]
    );
  };

  // Local Administrator & OOBE helper state
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleGenerateAdminPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*-_+=';
    const all = upper + lower + digits + symbols;
    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 16; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    const newPwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    setSystemConfig((prev) => ({ ...prev, localAdminPassword: newPwd }));
    setSwitchParameters((prev) => ({ ...prev, localAdminPassword: newPwd }));
  };

  const handleCopyAdminPassword = () => {
    const pwd = systemConfig.localAdminPassword || switchParameters.localAdminPassword || 'P@ssw0rd!2026Secure';
    navigator.clipboard.writeText(String(pwd));
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleToggleLocalAdmin = (enabled: boolean) => {
    setSystemConfig((prev) => ({ ...prev, enableLocalAdmin: enabled }));
    setEnabledSwitchIds((prev) =>
      enabled
        ? prev.includes('sw-local-admin') ? prev : [...prev, 'sw-local-admin']
        : prev.filter((id) => id !== 'sw-local-admin')
    );
  };

  const handleToggleDeleteOobe = (enabled: boolean) => {
    setSystemConfig((prev) => ({ ...prev, deleteOobeAccount: enabled }));
    setEnabledSwitchIds((prev) =>
      enabled
        ? prev.includes('sw-delete-oobe') ? prev : [...prev, 'sw-delete-oobe']
        : prev.filter((id) => id !== 'sw-delete-oobe')
    );
  };

  // Toggle switch
  const toggleSwitch = (switchId: string) => {
    const isEnabling = !enabledSwitchIds.includes(switchId);
    setEnabledSwitchIds((prev) =>
      isEnabling ? [...prev, switchId] : prev.filter((id) => id !== switchId)
    );

    // Keep systemConfig in sync
    if (switchId === 'sw-rdp') {
      setSystemConfig((prev) => ({ ...prev, enableRdp: isEnabling }));
    } else if (switchId === 'sw-adgroup') {
      setSystemConfig((prev) => ({ ...prev, addAdGroupToAdmins: isEnabling }));
    } else if (switchId === 'sw-power-screen' || switchId === 'sw-power-standby') {
      setSystemConfig((prev) => ({ ...prev, setPowerPlan: isEnabling }));
    } else if (switchId === 'sw-local-admin') {
      setSystemConfig((prev) => ({ ...prev, enableLocalAdmin: isEnabling }));
    } else if (switchId === 'sw-delete-oobe') {
      setSystemConfig((prev) => ({ ...prev, deleteOobeAccount: isEnabling }));
    }
  };

  // Update parameter value for a switch
  const handleParamChange = (key: string, value: string | number) => {
    setSwitchParameters((prev) => ({ ...prev, [key]: value }));

    // Keep legacy systemConfig in sync
    if (key === 'adAdminGroupName') {
      setSystemConfig((prev) => ({ ...prev, adAdminGroupName: String(value) }));
    } else if (key === 'screenTimeoutAc') {
      setSystemConfig((prev) => ({ ...prev, screenTimeoutAc: Number(value) }));
    } else if (key === 'standbyTimeoutAc') {
      setSystemConfig((prev) => ({ ...prev, standbyTimeoutAc: Number(value) }));
    } else if (key === 'screenTimeoutDc') {
      setSystemConfig((prev) => ({ ...prev, screenTimeoutDc: Number(value) }));
    } else if (key === 'standbyTimeoutDc') {
      setSystemConfig((prev) => ({ ...prev, standbyTimeoutDc: Number(value) }));
    } else if (key === 'localAdminPassword') {
      setSystemConfig((prev) => ({ ...prev, localAdminPassword: String(value) }));
    } else if (key === 'oobeAccountName') {
      setSystemConfig((prev) => ({ ...prev, oobeAccountName: String(value) }));
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(packages.map((p) => p.category));
    return ['All', ...Array.from(set)];
  }, [packages]);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);
      const matchesSource =
        sourceFilter === 'All' ||
        (sourceFilter === 'winget' && isWinget) ||
        (sourceFilter === 'unc' && !isWinget);

      const matchesSearch =
        pkg.name.toLowerCase().includes(packageSearch.toLowerCase()) ||
        pkg.fileName.toLowerCase().includes(packageSearch.toLowerCase()) ||
        (pkg.wingetId && pkg.wingetId.toLowerCase().includes(packageSearch.toLowerCase())) ||
        pkg.description.toLowerCase().includes(packageSearch.toLowerCase()) ||
        (pkg.extraSwitches && pkg.extraSwitches.toLowerCase().includes(packageSearch.toLowerCase()));
      const matchesCategory = categoryFilter === 'All' || pkg.category === categoryFilter;
      return matchesSource && matchesSearch && matchesCategory;
    });
  }, [packages, packageSearch, categoryFilter, sourceFilter]);

  // Total estimated deployment time
  const totalEstimatedMinutes = useMemo(() => {
    const packageTime = packages
      .filter((p) => selectedPackageIds.includes(p.id))
      .reduce((acc, p) => acc + (p.estimatedMinutes || 2), 0);
    return Math.ceil(packageTime + 1); // ~1 min for system config
  }, [packages, selectedPackageIds]);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner: Local Active Directory Environment */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-semibold mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Active Directory Member PC • Hostname Configured</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
              <span>FDIM Workstation Provisioning</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  showProfanity !== false
                    ? 'bg-amber-950/80 border border-amber-800 text-amber-300'
                    : 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                }`}
              >
                {getFdimExpansion(showProfanity !== false)}
              </span>
            </h1>
            <p className="mt-1 text-slate-300 text-xs sm:text-sm">
              Select the customer company profile, verify automated system configuration switches, staged network resources, and execute silent zero-touch deployments.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs space-y-1.5 shrink-0 min-w-[260px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Local Hostname:</span>
              <input
                type="text"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                className="bg-slate-900 text-white font-mono px-2 py-0.5 rounded border border-slate-700 text-xs w-36 text-right focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Customer:</span>
              <span className="text-cyan-400 font-semibold truncate max-w-[150px]">{currentCustomer?.companyName}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>AD Domain:</span>
              <span className="text-slate-300 font-mono">{currentCustomer?.domainName}</span>
            </div>
            <div className="pt-2 mt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5 text-slate-400">
                <Save className={`w-3 h-3 ${saveStatus === 'saving' ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
                <span className={saveStatus === 'saving' ? 'text-amber-300' : 'text-emerald-300 font-medium'}>
                  {saveStatus === 'saving' ? 'Saving draft...' : `Draft auto-saved (${formatTimeAgo(lastSaved || undefined)})`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToCustomerDefaults}
                title="Reset selections, switches and parameters to profile defaults"
                className="text-slate-400 hover:text-cyan-400 flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Restored Draft Notice Banner */}
      {restoredFromDraft && showDraftNotice && (
        <div className="bg-cyan-950/40 border border-cyan-800/80 rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-900/60 border border-cyan-700/60 flex items-center justify-center shrink-0">
              <Save className="w-3.5 h-3.5 text-cyan-300" />
            </div>
            <div>
              <span className="font-semibold text-cyan-200">Restored active machine configuration draft</span>
              <span className="text-slate-300 ml-1.5">
                (Saved {formatTimeAgo(lastSaved || undefined)}) — Your custom package selections, switches, and parameters are preserved from your previous session.
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={handleResetToCustomerDefaults}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Reset to Profile Defaults</span>
            </button>
            <button
              onClick={() => setShowDraftNotice(false)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-900/40 hover:bg-cyan-900/70 text-cyan-200 border border-cyan-700/60 text-[11px] font-medium cursor-pointer transition-colors"
            >
              Keep Draft
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Customer / Company Profiles Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-900/60 text-cyan-400 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Select Customer / Company Profile</h2>
              <p className="text-xs text-slate-400">
                Applies client-specific active directory admin delegation, default software packages, and installer parameters
              </p>
            </div>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">No Company Profiles Configured Yet</h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Your production workspace is clean without demo examples. You can configure workstation switches and software below right away, or create a reusable Company Profile for your domain.
                </p>
              </div>
            </div>
            {onOpenCustomerProfiles && (
              <button
                onClick={onOpenCustomerProfiles}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 shrink-0 cursor-pointer"
              >
                Create Company Profile
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {customers.map((cust) => {
              const isSelected = selectedCustomerId === cust.id;
              return (
                <button
                  key={cust.id}
                  onClick={() => handleSelectCustomer(cust)}
                  className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <Building2 className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                        <span className="text-sm font-bold text-white line-clamp-1">{cust.companyName}</span>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                      )}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {cust.notes || `Configured for ${cust.domainName}`}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/80 text-[11px] space-y-1 text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Domain:</span>
                      <span className="font-mono text-slate-300">{cust.domainName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Admin Group:</span>
                      <span className="font-mono text-cyan-400 truncate max-w-[140px]" title={cust.defaultAdAdminGroup}>
                        {cust.defaultAdAdminGroup.split('\\')[1] || cust.defaultAdAdminGroup}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Default Software:</span>
                      <span className="text-emerald-400 font-semibold">{cust.packageIds?.length || 0} packages</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: System Configuration Checklist & Switch Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-900/60 text-purple-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-white">System Configuration Switches</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/70 text-purple-300 font-medium">
                  {enabledSwitchIds.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Enable, customize, or add new PowerShell workstation configuration tasks
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              onClick={onOpenSystemConfigManager}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white border border-purple-800/50 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Manage / Add Switches</span>
            </button>
          </div>
        </div>

        {/* Local Administrator & Windows OOBE Setup Account Management Card */}
        <div className="mb-6 p-5 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Local Administrator & Windows OOBE Setup Account Management</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 font-mono">
                    Zero-Touch Setup
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Provision emergency local admin credentials and securely purge the temporary local account used during Windows OOBE setup screens
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Enable Local Administrator & Set Password */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                systemConfig.enableLocalAdmin !== false
                  ? 'bg-slate-900/90 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/40 border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <label className="text-xs font-bold text-white flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={systemConfig.enableLocalAdmin !== false}
                    onChange={(e) => handleToggleLocalAdmin(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-amber-200">Enable Built-in Local Administrator</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">SID *-500</span>
              </div>

              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                Enables the built-in local Administrator account (well-known SID *-500) for emergency local recovery and sets a secure password.
              </p>

              {systemConfig.enableLocalAdmin !== false && (
                <div className="space-y-3 pt-2.5 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-mono text-slate-400">
                      Local Administrator Password:
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={handleGenerateAdminPassword}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60 transition-colors flex items-center space-x-1 cursor-pointer font-medium"
                        title="Generate a cryptographically strong 16-character password"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Generate Strong</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyAdminPassword}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Copy administrator password to clipboard"
                      >
                        {copiedPassword ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                        <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={
                        systemConfig.localAdminPassword ??
                        switchParameters.localAdminPassword ??
                        'P@ssw0rd!2026Secure'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setSystemConfig((prev) => ({ ...prev, localAdminPassword: val }));
                        setSwitchParameters((prev) => ({ ...prev, localAdminPassword: val }));
                      }}
                      placeholder="Enter strong administrator password"
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-lg pl-3 pr-10 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <label className="text-[11px] text-slate-300 flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={systemConfig.adminPasswordNeverExpires !== false}
                      onChange={(e) =>
                        setSystemConfig((prev) => ({
                          ...prev,
                          adminPasswordNeverExpires: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>
                      Password never expires (
                      <code className="text-amber-400 font-mono text-[10px]">PasswordNeverExpires=$true</code>)
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Card 2: Delete Temporary OOBE Setup Account ("install") */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                systemConfig.deleteOobeAccount !== false
                  ? 'bg-slate-900/90 border-rose-500/50 shadow-sm'
                  : 'bg-slate-900/40 border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <label className="text-xs font-bold text-white flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={systemConfig.deleteOobeAccount !== false}
                    onChange={(e) => handleToggleDeleteOobe(e.target.checked)}
                    className="rounded border-slate-700 text-rose-500 focus:ring-rose-400 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-rose-200">Delete Temporary OOBE Setup Account</span>
                </label>
                <span className="text-[10px] text-rose-400 font-mono uppercase bg-rose-950/70 border border-rose-800/80 px-1.5 py-0.5 rounded">
                  OOBE Cleanup
                </span>
              </div>

              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                Deletes the local account created during initial Windows setup screens (e.g. <span className="font-mono text-rose-300 font-semibold">"install"</span>) and cleans its profile directory from disk.
              </p>

              {systemConfig.deleteOobeAccount !== false && (
                <div className="space-y-3 pt-2.5 border-t border-slate-800">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] uppercase font-mono text-slate-400">
                        OOBE Account Username:
                      </label>
                      <div className="flex items-center space-x-1">
                        {['install', 'setup', 'oobe', 'temp'].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => {
                              setSystemConfig((prev) => ({ ...prev, oobeAccountName: chip }));
                              setSwitchParameters((prev) => ({ ...prev, oobeAccountName: chip }));
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                              (systemConfig.oobeAccountName || 'install') === chip
                                ? 'bg-rose-900 text-rose-200 border border-rose-700 font-bold'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={systemConfig.oobeAccountName ?? switchParameters.oobeAccountName ?? 'install'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSystemConfig((prev) => ({ ...prev, oobeAccountName: val }));
                        setSwitchParameters((prev) => ({ ...prev, oobeAccountName: val }));
                      }}
                      placeholder="e.g. install"
                      className="w-full bg-slate-950 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-rose-300 font-mono focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                    />
                  </div>

                  <label className="text-[11px] text-slate-300 flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={systemConfig.removeOobeProfile !== false}
                      onChange={(e) =>
                        setSystemConfig((prev) => ({ ...prev, removeOobeProfile: e.target.checked }))
                      }
                      className="rounded border-slate-700 text-rose-500 focus:ring-rose-400 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>
                      Purge user profile folder from disk (
                      <code className="text-rose-400 font-mono text-[10px]">
                        C:\Users\{systemConfig.oobeAccountName || 'install'}
                      </code>
                      )
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Grid of System Configuration Switches */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemSwitches.map((sw) => {
            const isEnabled = enabledSwitchIds.includes(sw.id);
            const paramVal = switchParameters[sw.parameterKey || ''] ?? sw.parameterDefaultValue;

            return (
              <div
                key={sw.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isEnabled
                    ? 'bg-slate-950/80 border-purple-500/60 shadow-sm'
                    : 'bg-slate-950/30 border-slate-800/80 opacity-70'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <label className="text-xs font-bold text-white flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleSwitch(sw.id)}
                        className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="leading-tight">{sw.title}</span>
                    </label>

                    {sw.isRemovable && (
                      <button
                        onClick={() => onDeleteSwitch(sw.id)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors shrink-0"
                        title="Remove custom switch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                    {sw.description}
                  </p>
                </div>

                {/* Parameter Input if applicable and switch is enabled */}
                {sw.hasParameter && sw.parameterKey && (
                  <div className="pt-2 border-t border-slate-850 mt-1">
                    {sw.id === 'sw-power-screen' ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-amber-300 uppercase font-mono mb-1 flex items-center space-x-1">
                            <Zap className="w-2.5 h-2.5 text-amber-400" />
                            <span>AC Screen Timeout:</span>
                          </label>
                          <select
                            value={switchParameters.screenTimeoutAc ?? systemConfig.screenTimeoutAc ?? 15}
                            onChange={(e) => handleParamChange('screenTimeoutAc', Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value={10}>10 Minutes</option>
                            <option value={15}>15 Minutes</option>
                            <option value={20}>20 Minutes</option>
                            <option value={30}>30 Minutes</option>
                            <option value={60}>60 Minutes</option>
                            <option value={0}>Never (0)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-cyan-300 uppercase font-mono mb-1 flex items-center space-x-1">
                            <Battery className="w-2.5 h-2.5 text-cyan-400" />
                            <span>Battery Screen Timeout:</span>
                          </label>
                          <select
                            value={switchParameters.screenTimeoutDc ?? systemConfig.screenTimeoutDc ?? 10}
                            onChange={(e) => handleParamChange('screenTimeoutDc', Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                          >
                            <option value={5}>5 Minutes</option>
                            <option value={10}>10 Minutes</option>
                            <option value={15}>15 Minutes</option>
                            <option value={20}>20 Minutes</option>
                            <option value={30}>30 Minutes</option>
                          </select>
                        </div>
                      </div>
                    ) : sw.id === 'sw-power-standby' ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] text-amber-300 uppercase font-mono mb-1 flex items-center space-x-1">
                            <Zap className="w-2.5 h-2.5 text-amber-400" />
                            <span>AC Sleep / Standby:</span>
                          </label>
                          <select
                            value={switchParameters.standbyTimeoutAc ?? systemConfig.standbyTimeoutAc ?? 0}
                            onChange={(e) => handleParamChange('standbyTimeoutAc', Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value={0}>Never Sleep (0)</option>
                            <option value={30}>30 Minutes</option>
                            <option value={60}>60 Minutes</option>
                            <option value={120}>120 Minutes</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-cyan-300 uppercase font-mono mb-1 flex items-center space-x-1">
                            <Battery className="w-2.5 h-2.5 text-cyan-400" />
                            <span>Battery Sleep / Standby:</span>
                          </label>
                          <select
                            value={switchParameters.standbyTimeoutDc ?? systemConfig.standbyTimeoutDc ?? 20}
                            onChange={(e) => handleParamChange('standbyTimeoutDc', Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                          >
                            <option value={10}>10 Minutes</option>
                            <option value={15}>15 Minutes</option>
                            <option value={20}>20 Minutes</option>
                            <option value={30}>30 Minutes</option>
                            <option value={60}>60 Minutes</option>
                            <option value={0}>Never Sleep (0)</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <>
                        <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">
                          {sw.parameterLabel || sw.parameterKey}:
                        </label>

                        {sw.parameterType === 'select' && sw.parameterOptions ? (
                          <select
                            value={paramVal}
                            onChange={(e) =>
                              handleParamChange(
                                sw.parameterKey!,
                                isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                          >
                            {sw.parameterOptions.map((opt) => (
                              <option key={opt.label} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={sw.parameterType === 'number' ? 'number' : 'text'}
                            value={paramVal || ''}
                            onChange={(e) => handleParamChange(sw.parameterKey!, e.target.value)}
                            placeholder={`e.g. ${sw.parameterDefaultValue || ''}`}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono focus:outline-none focus:border-purple-500"
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick "+ Add New Switch" Card */}
          <button
            onClick={onOpenSystemConfigManager}
            className="p-4 rounded-xl border border-dashed border-slate-800 hover:border-purple-500/70 hover:bg-slate-900/60 transition-all text-slate-400 hover:text-purple-300 flex flex-col items-center justify-center space-y-2 min-h-[140px] cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-purple-400">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Add New Switch</span>
            <span className="text-[10px] text-slate-500">Custom PowerShell task or registry key</span>
          </button>
        </div>
      </div>

      {/* Step 3: Software Packages Selection with Extra Switches & Config File Import */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-900/60 text-emerald-400 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-white">Software Packages & Extra Installer Switches</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/70 text-emerald-300 font-medium">
                  {selectedPackageIds.length} Selected
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Silent deployment from UNC shares, Office Deployment Tool (ODT Click-to-Run for Outlook Classic), or Windows Package Manager (Winget for 7-Zip, VLC)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            {/* Quick Manual Add Button right in the wizard */}
            <button
              onClick={onOpenManualPackageModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-cyan-800/60 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add Package (UNC / Winget)</span>
            </button>

            <button
              onClick={() => setSelectedPackageIds(packages.map((p) => p.id))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedPackageIds([])}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Search, Source Filter & Categories */}
        <div className="space-y-3 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search software, Winget ID, UNC file, or extra switches..."
                value={packageSearch}
                onChange={(e) => setPackageSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Distribution Source Filter */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setSourceFilter('All')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  sourceFilter === 'All'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Sources
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('unc')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  sourceFilter === 'unc'
                    ? 'bg-emerald-900/80 border border-emerald-600 text-emerald-200'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderOpen className="w-3 h-3 text-emerald-400" />
                <span>UNC Shares</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('winget')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  sourceFilter === 'winget'
                    ? 'bg-sky-900/80 border border-sky-600 text-sky-200'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3 h-3 text-sky-400" />
                <span>Winget Repo</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-3 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPackages.map((pkg) => {
            const isSelected = selectedPackageIds.includes(pkg.id);
            const extraSwitches = packageCustomSwitches[pkg.id] || pkg.extraSwitches;
            const configFile = packageConfigFiles[pkg.id] || pkg.configFileImport?.configFileName;
            const isEditing = editingPackageId === pkg.id;
            const isWinget = pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || Boolean(pkg.wingetId);

            return (
              <div
                key={pkg.id}
                className={`rounded-xl border transition-all ${
                  isSelected
                    ? isWinget
                      ? 'bg-slate-950/90 border-sky-500/80 shadow-md ring-1 ring-sky-500/20'
                      : 'bg-slate-950/90 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/20'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => togglePackage(pkg.id)}
                      className="flex items-start space-x-3 cursor-pointer flex-1 select-none"
                    >
                      <div className="mt-0.5">
                        {isSelected ? (
                          <CheckCircle2 className={`w-5 h-5 ${isWinget ? 'text-sky-400' : 'text-cyan-400'}`} />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-bold text-white">{pkg.name}</h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            v{pkg.version}
                          </span>
                          {isWinget ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono">
                              🪟 Winget
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-900 text-emerald-300 font-mono">
                              🏢 UNC Share
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{pkg.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        isWinget
                          ? 'bg-sky-950/80 border-sky-800 text-sky-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}>
                        {isWinget ? 'Winget' : pkg.installerType}
                      </span>
                    </div>
                  </div>

                  {/* Distribution Path & Est Time */}
                  <div className="mt-2.5 pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1.5 font-mono truncate max-w-[280px]">
                      {isWinget ? (
                        <>
                          <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="truncate text-sky-300" title={`winget install --id "${pkg.wingetId || pkg.fileName}"`}>
                            winget: {pkg.wingetId || pkg.fileName}
                          </span>
                        </>
                      ) : (
                        <>
                          <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate" title={`${pkg.uncPath}\\${pkg.fileName}`}>
                            {pkg.uncPath}\{pkg.fileName}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{pkg.estimatedMinutes}m</span>
                    </div>
                  </div>

                  {/* Badges for Extra Switches and Config File */}
                  {(extraSwitches || configFile) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-850/80 space-y-1.5 text-[11px]">
                      {extraSwitches && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-mono">Extra Switches:</span>
                          <button
                            onClick={() => setEditingPackageId(isEditing ? null : pkg.id)}
                            className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Customize</span>
                          </button>
                        </div>
                      )}
                      {extraSwitches && (
                        <code className="block bg-slate-900 border border-slate-800 p-1.5 rounded text-[10px] text-emerald-300 font-mono truncate">
                          {extraSwitches}
                        </code>
                      )}

                      {configFile && (
                        <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] font-mono">
                          <FileCode className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>Config File Import:</span>
                          <span className="text-cyan-300 truncate">{configFile}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Parameter Customizer */}
                  {isEditing && (
                    <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-cyan-500/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">Installer Parameter Override:</span>
                        <button
                          onClick={() => setEditingPackageId(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          Done
                        </button>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-mono">Extra Switches:</label>
                        <input
                          type="text"
                          value={packageCustomSwitches[pkg.id] || pkg.extraSwitches || ''}
                          onChange={(e) =>
                            setPackageCustomSwitches((prev) => ({
                              ...prev,
                              [pkg.id]: e.target.value,
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      {pkg.configFileImport?.enabled && (
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-mono">Config File Path:</label>
                          <input
                            type="text"
                            value={packageConfigFiles[pkg.id] || pkg.configFileImport.configUncPath || ''}
                            onChange={(e) =>
                              setPackageConfigFiles((prev) => ({
                                ...prev,
                                [pkg.id]: e.target.value,
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 4: User First-Logon Staging (Network Drives & Printers via Active Setup) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-white">
                  User First-Logon Staging (Network Drives & Printers)
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800/70 text-amber-300 font-medium">
                  {stagedDrives.filter((d) => d.enabled !== false).length} Drives • {stagedPrinters.filter((p) => p.enabled !== false).length} Printers
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Staged for silent execution when the employee signs in via Windows Active Setup (HKLM) & Per-Machine PrintUI
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={userLogonStaging.enabled !== false}
                onChange={(e) => setUserLogonStaging((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Active Setup Staging Enabled</span>
            </label>
          </div>
        </div>

        {/* Informative Explanation Banner solving user concern */}
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 mb-6 flex items-start space-x-3 text-xs">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-200">
              Why this is staged for First Logon:
            </h4>
            <p className="text-amber-300/80 leading-relaxed">
              When deploying a new PC as administrator, the end-user is not yet logged in.
              Network drive mappings (<code className="bg-amber-900/40 px-1 rounded font-mono">HKCU:\Network</code>) and per-user network printers require the employee's interactive Kerberos session.
              FDIM generates <code className="bg-amber-900/40 px-1 rounded font-mono">C:\ProgramData\FDIM\UserLogonSetup.ps1</code> and registers it in Windows <strong>Active Setup</strong> (<code className="bg-amber-900/40 px-1 rounded font-mono">HKLM:\SOFTWARE\Microsoft\Active Setup\...</code>) and machine print connections (<code className="bg-amber-900/40 px-1 rounded font-mono">printui.dll /ga</code>).
              When the employee signs into Windows for the first time, all drives and printers configure silently and automatically!
            </p>
          </div>
        </div>

        {/* Sub-grid: Network Drives (Left) & Network Printers (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Network Drives */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-white">
                <Link2 className="w-4 h-4 text-amber-400" />
                <span>Mapped Network Drives</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {stagedDrives.filter((d) => d.enabled !== false).length} active of {stagedDrives.length}
              </span>
            </div>

            {/* Drives List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {stagedDrives.map((drv) => {
                const isEnabled = drv.enabled !== false;
                return (
                  <div
                    key={drv.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isEnabled
                        ? 'bg-slate-900 border-amber-800/60 shadow-sm'
                        : 'bg-slate-950/40 border-slate-850 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleDrive(drv.id)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <span className="w-7 h-7 rounded-lg bg-amber-950 border border-amber-800 text-amber-300 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        {drv.driveLetter}
                      </span>
                      <div className="min-w-0">
                        <span className="text-white font-medium block truncate text-xs">{drv.label}</span>
                        <span className="text-[11px] text-cyan-400 font-mono truncate block">{drv.uncPath}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeDrive(drv.id)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors shrink-0"
                      title="Remove drive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {stagedDrives.length === 0 && (
                <div className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded-xl">
                  No network drives assigned. Add one below.
                </div>
              )}
            </div>

            {/* Quick Add Drive in Wizard */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">
                + Add Custom Drive for this Workstation:
              </span>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="col-span-1">
                  <select
                    value={wDriveLetter}
                    onChange={(e) => setWDriveLetter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  >
                    {['S:', 'P:', 'M:', 'H:', 'Z:', 'N:', 'F:', 'L:', 'K:', 'O:', 'T:', 'X:'].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={wDriveLabel}
                    onChange={(e) => setWDriveLabel(e.target.value)}
                    placeholder="Drive Label (e.g. Finance Archive)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <input
                  type="text"
                  value={wDriveUnc}
                  onChange={(e) => setWDriveUnc(e.target.value)}
                  placeholder="UNC Path: \\server\share or \\server\users\%USERNAME%"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={addDrive}
                  disabled={!wDriveUnc}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200 text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  Add Drive
                </button>
              </div>
            </div>
          </div>

          {/* Right: Network Printers */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-white">
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Network Printers & Copiers</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {stagedPrinters.filter((p) => p.enabled !== false).length} active of {stagedPrinters.length}
              </span>
            </div>

            {/* Printers List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {stagedPrinters.map((prn) => {
                const isEnabled = prn.enabled !== false;
                return (
                  <div
                    key={prn.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isEnabled
                        ? 'bg-slate-900 border-cyan-800/60 shadow-sm'
                        : 'bg-slate-950/40 border-slate-850 opacity-60'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => togglePrinter(prn.id)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium truncate text-xs">{prn.name}</span>
                          {prn.isDefault && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                              DEFAULT
                            </span>
                          )}
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${prn.connectionType === 'PerMachineUNC' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-purple-950 text-purple-300 border border-purple-800'}`}>
                            {prn.connectionType === 'PerMachineUNC' ? 'Per-Machine' : 'User-Logon'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono truncate block">{prn.pathOrIp}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removePrinter(prn.id)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors shrink-0"
                      title="Remove printer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {stagedPrinters.length === 0 && (
                <div className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded-xl">
                  No printers assigned. Add one below.
                </div>
              )}
            </div>

            {/* Quick Add Printer in Wizard */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">
                + Add Custom Printer for this Workstation:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  value={wPrinterName}
                  onChange={(e) => setWPrinterName(e.target.value)}
                  placeholder="Printer Name (e.g. Floor 2 MFP)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <select
                  value={wPrinterType}
                  onChange={(e) => setWPrinterType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="PerMachineUNC">Per-Machine Connection (PrintUI /ga)</option>
                  <option value="UserLogonUNC">Per-User Network Connection (Active Setup)</option>
                </select>
              </div>
              <div className="flex gap-2 text-xs items-center">
                <input
                  type="text"
                  value={wPrinterPath}
                  onChange={(e) => setWPrinterPath(e.target.value)}
                  placeholder="Path: \\printserver\printer_name"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-slate-300 shrink-0">
                  <input
                    type="checkbox"
                    checked={wPrinterDefault}
                    onChange={(e) => setWPrinterDefault(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                  />
                  <span>Default</span>
                </label>
                <button
                  type="button"
                  onClick={addPrinter}
                  disabled={!wPrinterPath}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-200 text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  Add Printer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-section: First-Run User Logon Snippets & Custom Tasks */}
        <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 flex items-center justify-center">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>First-Run User Logon Scripts & Tasks</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {(userLogonStaging.customScriptSnippets || []).filter((s) => s.enabled !== false).length} Active
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Executed inside interactive user context upon first sign-in (e.g. Outlook signatures, OneDrive KFM, desktop shortcuts)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onOpenSnippetsManager && (
                <button
                  type="button"
                  onClick={onOpenSnippetsManager}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
                  title="Open Snippet Library Manager"
                >
                  Manage Library
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSnippetPickerOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>+ Pick from Library</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddCustomSnippetOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Custom Script</span>
              </button>
            </div>
          </div>

          {/* Snippets List for this PC */}
          <div className="space-y-2.5">
            {(userLogonStaging.customScriptSnippets || []).map((snip) => {
              const isEnabled = snip.enabled !== false;
              const isExpanded = expandedSnippetId === snip.id;

              return (
                <div
                  key={snip.id}
                  className={`rounded-xl border transition-all text-xs overflow-hidden ${
                    isEnabled
                      ? 'bg-slate-950/80 border-cyan-900/60 shadow-sm'
                      : 'bg-slate-950/40 border-slate-850 opacity-60'
                  }`}
                >
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleSnippet(snip.id)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium truncate">{snip.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {snip.category || 'Custom'}
                          </span>
                        </div>
                        {snip.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{snip.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedSnippetId(isExpanded ? null : snip.id)}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        title={isExpanded ? 'Hide code preview' : 'View PowerShell code'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSnippet(snip.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from this PC setup"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-slate-950 border-t border-slate-850 font-mono text-[11px] text-cyan-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {snip.script}
                    </div>
                  )}
                </div>
              );
            })}

            {(!userLogonStaging.customScriptSnippets || userLogonStaging.customScriptSnippets.length === 0) && (
              <div className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded-xl flex items-center justify-center space-x-2">
                <span>No first-run scripts selected for this PC.</span>
                <button
                  type="button"
                  onClick={() => setIsSnippetPickerOpen(true)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold underline not-italic cursor-pointer"
                >
                  Pick from Snippet Library
                </button>
              </div>
            )}
          </div>

          {/* Quick First-Run Configurations (Edge, Welcome, Clean-Up) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <label className="flex items-center space-x-2 cursor-pointer font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={userLogonStaging.configureEdgeHomepage ?? true}
                  onChange={(e) =>
                    setUserLogonStaging((prev) => ({ ...prev, configureEdgeHomepage: e.target.checked }))
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 w-3.5 h-3.5"
                />
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Configure Edge Homepage</span>
              </label>
              <input
                type="text"
                value={userLogonStaging.edgeHomepageUrl || ''}
                onChange={(e) =>
                  setUserLogonStaging((prev) => ({ ...prev, edgeHomepageUrl: e.target.value }))
                }
                placeholder="https://portal.office.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <label className="flex items-center space-x-2 cursor-pointer font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={userLogonStaging.showWelcomeNotification ?? true}
                  onChange={(e) =>
                    setUserLogonStaging((prev) => ({ ...prev, showWelcomeNotification: e.target.checked }))
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 w-3.5 h-3.5"
                />
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Welcome Toast</span>
              </label>
              <input
                type="text"
                value={userLogonStaging.welcomeMessage || ''}
                onChange={(e) =>
                  setUserLogonStaging((prev) => ({ ...prev, welcomeMessage: e.target.value }))
                }
                placeholder="Welcome to your new corporate workstation!"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={userLogonStaging.cleanUpAfterFirstRun ?? false}
                  onChange={(e) =>
                    setUserLogonStaging((prev) => ({ ...prev, cleanUpAfterFirstRun: e.target.checked }))
                  }
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 w-3.5 h-3.5"
                />
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Delete Script After 1st Run</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Active Setup</span>
            </div>
          </div>
        </div>
      </div>

      {/* SNIPPET LIBRARY PICKER MODAL */}
      {isSnippetPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Select First-Run Snippets from Library</h3>
                  <p className="text-xs text-slate-400">
                    Add pre-configured user logon scripts to this specific workstation setup
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSnippetPickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={snippetSearchQuery}
                  onChange={(e) => setSnippetSearchQuery(e.target.value)}
                  placeholder="Search snippet library..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {availableSnippets
                .filter(
                  (s) =>
                    !snippetSearchQuery ||
                    s.name.toLowerCase().includes(snippetSearchQuery.toLowerCase()) ||
                    (s.description && s.description.toLowerCase().includes(snippetSearchQuery.toLowerCase()))
                )
                .map((snip) => {
                  const isAttached = (userLogonStaging.customScriptSnippets || []).some((s) => s.id === snip.id);

                  return (
                    <div
                      key={snip.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                        isAttached
                          ? 'bg-cyan-950/30 border-cyan-800/80'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-bold">{snip.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            {snip.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{snip.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isAttached) {
                            removeSnippet(snip.id);
                          } else {
                            addSnippetFromLibrary(snip);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                          isAttached
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                        }`}
                      >
                        {isAttached ? '✓ Added' : '+ Add to PC'}
                      </button>
                    </div>
                  );
                })}

              {availableSnippets.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  No snippets available in the library yet.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/60">
              <button
                type="button"
                onClick={() => setIsSnippetPickerOpen(false)}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOM SNIPPET MODAL */}
      {isAddCustomSnippetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <span>Add Custom First-Run Script to this PC</span>
              </h3>
              <button
                onClick={() => setIsAddCustomSnippetOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Script Title *</label>
                <input
                  type="text"
                  value={customSnippetTitle}
                  onChange={(e) => setCustomSnippetTitle(e.target.value)}
                  placeholder="e.g. Map Specialized Engineering Share"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">PowerShell Commands *</label>
                <textarea
                  rows={8}
                  value={customSnippetScript}
                  onChange={(e) => setCustomSnippetScript(e.target.value)}
                  placeholder={`# Runs silently in user's Kerberos session at first logon\nWrite-UserLog "Running custom task..." "INFO"\n`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 resize-y"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end space-x-2 bg-slate-950/60">
              <button
                type="button"
                onClick={() => setIsAddCustomSnippetOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addCustomSnippet}
                disabled={!customSnippetTitle || !customSnippetScript}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                Add Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Launcher Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Ready for Workstation Provisioning</h3>
          </div>
          <p className="text-xs text-slate-300">
            Target Host: <strong className="text-white font-mono">{machineName}</strong> • Profile:{' '}
            <strong className="text-cyan-400">{currentCustomer?.companyName}</strong> •{' '}
            <strong className="text-emerald-400">{selectedPackageIds.length} Packages</strong> •{' '}
            <strong className="text-purple-400">{enabledSwitchIds.length} Switches</strong> •{' '}
            <strong className="text-amber-300 font-mono">{stagedDrives.filter((d) => d.enabled !== false).length} Drives, {stagedPrinters.filter((p) => p.enabled !== false).length} Printers Staged</strong> • ~{totalEstimatedMinutes} min
            <span className="inline-flex items-center space-x-1 ml-2 px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-medium text-[11px]">
              <Save className="w-3 h-3 text-emerald-400" />
              <span>Auto-saved</span>
            </span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenScriptModal}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>Generate PowerShell Script</span>
          </button>

          <button
            onClick={onStartDeployment}
            disabled={selectedPackageIds.length === 0}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Run Zero-Touch Deployment</span>
          </button>
        </div>
      </div>
    </div>
  );
};
