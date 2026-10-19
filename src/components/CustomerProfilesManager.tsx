import React, { useState } from 'react';
import {
  CustomerProfile,
  SoftwarePackage,
  NetworkDriveMapping,
  PrinterMapping,
  UserLogonStagingConfig,
  UserLogonStagingSnippet,
} from '../types';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Shield,
  Layers,
  Save,
  X,
  HardDrive,
  Users,
  Settings,
  Search,
  Filter,
  Check,
  Circle,
  FileCode,
  Sliders,
  ExternalLink,
  Printer,
  Info,
  Battery,
  Zap,
  Terminal,
  Globe,
  Code,
  Sparkles,
  Link2,
} from 'lucide-react';

interface CustomerProfilesManagerProps {
  customers: CustomerProfile[];
  packages: SoftwarePackage[];
  defaultDomain?: string;
  onAddCustomer: (profile: CustomerProfile) => void;
  onUpdateCustomer: (profile: CustomerProfile) => void;
  onDeleteCustomer: (customerId: string) => void;
  onSelectCustomerForSetup: (customerId: string) => void;
}

export const CustomerProfilesManager: React.FC<CustomerProfilesManagerProps> = ({
  customers,
  packages,
  defaultDomain,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onSelectCustomerForSetup,
}) => {
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerProfile | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [domainName, setDomainName] = useState('');
  const [defaultAdAdminGroup, setDefaultAdAdminGroup] = useState('');
  const [uncShareRoot, setUncShareRoot] = useState('');
  const [configurePowerSettings, setConfigurePowerSettings] = useState(false);
  const [screenTimeoutAc, setScreenTimeoutAc] = useState(15);
  const [standbyTimeoutAc, setStandbyTimeoutAc] = useState(0);
  const [screenTimeoutDc, setScreenTimeoutDc] = useState(10);
  const [standbyTimeoutDc, setStandbyTimeoutDc] = useState(20);
  const [enableRdp, setEnableRdp] = useState(true);
  const [selectedPkgIds, setSelectedPkgIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [pkgSearch, setPkgSearch] = useState('');
  const [pkgCategoryFilter, setPkgCategoryFilter] = useState('All');

  // Network Drives and Printers (User First-Logon Staging) states
  const [networkDrives, setNetworkDrives] = useState<NetworkDriveMapping[]>([]);
  const [printers, setPrinters] = useState<PrinterMapping[]>([]);
  const [newDriveLetter, setNewDriveLetter] = useState('S:');
  const [newDriveUnc, setNewDriveUnc] = useState('');
  const [newDriveLabel, setNewDriveLabel] = useState('');
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterPath, setNewPrinterPath] = useState('');
  const [newPrinterType, setNewPrinterType] = useState<'PerMachineUNC' | 'UserLogonUNC' | 'DirectIP'>('PerMachineUNC');
  const [newPrinterDefault, setNewPrinterDefault] = useState(false);

  // First-run user logon automation options & custom script snippets
  const [configureEdgeHomepage, setConfigureEdgeHomepage] = useState(true);
  const [edgeHomepageUrl, setEdgeHomepageUrl] = useState('');
  const [createDesktopShortcuts, setCreateDesktopShortcuts] = useState(true);
  const [showWelcomeNotification, setShowWelcomeNotification] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome to your corporate workstation! Your network resources are staged.');
  const [cleanUpAfterFirstRun, setCleanUpAfterFirstRun] = useState(false);
  const [customScriptSnippets, setCustomScriptSnippets] = useState<UserLogonStagingSnippet[]>([]);
  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetScript, setNewSnippetScript] = useState('');

  const startEdit = (cust: CustomerProfile) => {
    setEditingCustomer(cust);
    setIsCreating(false);
    setCompanyName(cust.companyName);
    setCustomerCode(cust.customerCode);
    setDomainName(cust.domainName);
    setDefaultAdAdminGroup(cust.defaultAdAdminGroup);
    setUncShareRoot(cust.uncShareRoot);
    setConfigurePowerSettings(cust.powerPlanSettings?.enabled === true);
    setScreenTimeoutAc(cust.powerPlanSettings?.screenTimeoutAc ?? 15);
    setStandbyTimeoutAc(cust.powerPlanSettings?.standbyTimeoutAc ?? 0);
    setScreenTimeoutDc(cust.powerPlanSettings?.screenTimeoutDc ?? 10);
    setStandbyTimeoutDc(cust.powerPlanSettings?.standbyTimeoutDc ?? 20);
    setEnableRdp(cust.enableRdp);
    setSelectedPkgIds(cust.packageIds || []);
    setNotes(cust.notes || '');

    // Network Drives and Printers
    setNetworkDrives(cust.networkDrives || []);
    setPrinters(cust.printers || []);
    setNewDriveUnc(`${cust.uncShareRoot}\\Shares\\Public`);
    setNewDriveLabel('Company Public Share');
    setNewPrinterName(`${cust.customerCode || 'Office'} Color MFP`);
    setNewPrinterPath(`\\\\corp-print01.internal.net\\${cust.customerCode || 'OFFICE'}-Color-MFP`);
    setNewPrinterType('PerMachineUNC');
    setNewPrinterDefault(false);

    // First-run settings
    setConfigureEdgeHomepage(cust.userLogonStaging?.configureEdgeHomepage ?? true);
    setEdgeHomepageUrl(cust.userLogonStaging?.edgeHomepageUrl || `https://intranet.${cust.domainName || 'corp.internal'}`);
    setCreateDesktopShortcuts(cust.userLogonStaging?.createDesktopShortcuts ?? true);
    setShowWelcomeNotification(cust.userLogonStaging?.showWelcomeNotification ?? true);
    setWelcomeMessage(cust.userLogonStaging?.welcomeMessage || `Welcome to ${cust.companyName}! Your workstation network resources are configured.`);
    setCleanUpAfterFirstRun(cust.userLogonStaging?.cleanUpAfterFirstRun ?? false);
    setCustomScriptSnippets(cust.userLogonStaging?.customScriptSnippets || []);
    setNewSnippetName('');
    setNewSnippetScript('');
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingCustomer(null);
    setCompanyName('');
    setCustomerCode('');
    setDomainName(defaultDomain || 'corp.internal.net');
    setDefaultAdAdminGroup('CORP\\IT-Admins');
    setUncShareRoot('\\\\corp-fs01.internal.net\\deployments\\customers\\newclient');
    setConfigurePowerSettings(false);
    setScreenTimeoutAc(15);
    setStandbyTimeoutAc(0);
    setScreenTimeoutDc(10);
    setStandbyTimeoutDc(20);
    setEnableRdp(true);
    setSelectedPkgIds(['pkg-chrome', 'pkg-7zip', 'pkg-m365']);
    setNotes('');

    // First-run defaults
    setConfigureEdgeHomepage(true);
    setEdgeHomepageUrl(`https://intranet.${defaultDomain || 'corp.internal'}`);
    setCreateDesktopShortcuts(true);
    setShowWelcomeNotification(true);
    setWelcomeMessage('Welcome to your corporate workstation! Your network resources are staged.');
    setCleanUpAfterFirstRun(false);
    setCustomScriptSnippets([
      {
        id: `snip-${Date.now()}-1`,
        name: 'Map Corporate Outlook Signature Template',
        script: `# Copy corporate email signature template to user's AppData\n$sigDir = "$env:APPDATA\\Microsoft\\Signatures"\nif (-not (Test-Path $sigDir)) { New-Item -ItemType Directory -Path $sigDir -Force | Out-Null }`,
        enabled: true,
      },
      {
        id: `snip-${Date.now()}-2`,
        name: 'Pin Corporate Intranet to Desktop',
        script: `$wsh = New-Object -ComObject WScript.Shell\n$shortcut = $wsh.CreateShortcut("$env:USERPROFILE\\Desktop\\Corporate Intranet.url")\n$shortcut.TargetPath = "https://intranet.${defaultDomain || 'corp.internal'}"\n$shortcut.Save()`,
        enabled: true,
      },
    ]);
    setNewSnippetName('');
    setNewSnippetScript('');

    // Default template drives & printers for new client
    setNetworkDrives([
      {
        id: `drv-${Date.now()}-1`,
        driveLetter: 'S:',
        uncPath: '\\\\corp-fs01.internal.net\\deployments\\customers\\newclient\\Shared',
        label: 'Company Shared Files',
        persistent: true,
        enabled: true,
      },
      {
        id: `drv-${Date.now()}-2`,
        driveLetter: 'H:',
        uncPath: '\\\\corp-fs01.internal.net\\users\\%USERNAME%',
        label: 'User Personal Home Folder (%USERNAME%)',
        persistent: true,
        enabled: true,
      },
    ]);
    setPrinters([
      {
        id: `prn-${Date.now()}-1`,
        name: 'Office Main Floor Color MFP',
        connectionType: 'PerMachineUNC',
        pathOrIp: '\\\\corp-print01.internal.net\\Office-Color-MFP',
        isDefault: true,
        comment: 'High volume color multi-function printer (PrintUI per-machine)',
        enabled: true,
      },
    ]);
    setNewDriveLetter('P:');
    setNewDriveUnc('\\\\corp-fs01.internal.net\\Projects');
    setNewDriveLabel('Company Projects Share');
    setNewPrinterName('Warehouse Shipping Label Printer');
    setNewPrinterPath('\\\\corp-print01.internal.net\\Shipping-Labels');
    setNewPrinterType('UserLogonUNC');
    setNewPrinterDefault(false);
  };

  const handleAddDrive = () => {
    if (!newDriveUnc) return;
    const drive: NetworkDriveMapping = {
      id: `drv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      driveLetter: newDriveLetter.endsWith(':') ? newDriveLetter : `${newDriveLetter}:`,
      uncPath: newDriveUnc.trim(),
      label: newDriveLabel.trim() || `${newDriveLetter} Network Share`,
      persistent: true,
      enabled: true,
    };
    setNetworkDrives((prev) => [...prev, drive]);
    setNewDriveUnc('');
    setNewDriveLabel('');
  };

  const handleRemoveDrive = (id: string) => {
    setNetworkDrives((prev) => prev.filter((d) => d.id !== id));
  };

  const handleAddPrinter = () => {
    if (!newPrinterPath) return;
    const printer: PrinterMapping = {
      id: `prn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newPrinterName.trim() || newPrinterPath.split('\\').pop() || 'Network Printer',
      connectionType: newPrinterType,
      pathOrIp: newPrinterPath.trim(),
      isDefault: newPrinterDefault,
      comment: newPrinterType === 'PerMachineUNC' ? 'Installed machine-wide via PrintUI (/ga)' : 'Connected per-user on initial logon via Active Setup',
      enabled: true,
    };
    if (newPrinterDefault) {
      setPrinters((prev) => [...prev.map((p) => ({ ...p, isDefault: false })), printer]);
    } else {
      setPrinters((prev) => [...prev, printer]);
    }
    setNewPrinterName('');
    setNewPrinterPath('');
    setNewPrinterDefault(false);
  };

  const handleRemovePrinter = (id: string) => {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
  };

  const togglePackageSelection = (pkgId: string) => {
    setSelectedPkgIds((prev) =>
      prev.includes(pkgId) ? prev.filter((id) => id !== pkgId) : [...prev, pkgId]
    );
  };

  const handleSelectAllPackages = () => {
    setSelectedPkgIds(packages.map((p) => p.id));
  };

  const handleClearAllPackages = () => {
    setSelectedPkgIds([]);
  };

  const handleSelectCorePackages = () => {
    const coreIds = packages
      .filter((p) =>
        [
          'pkg-teamviewer',
          'pkg-chrome',
          'pkg-7zip',
          'pkg-acrobat',
          'pkg-m365',
          'pkg-winget-7zip',
          'pkg-winget-vlc',
          'pkg-outlook-classic',
        ].includes(p.id)
      )
      .map((p) => p.id);
    setSelectedPkgIds(coreIds);
  };

  const handleSave = () => {
    const payload: CustomerProfile = {
      id: editingCustomer ? editingCustomer.id : `cust-${Date.now().toString(36)}`,
      companyName,
      customerCode: customerCode || companyName.substring(0, 4).toUpperCase(),
      domainName,
      defaultAdAdminGroup,
      uncShareRoot,
      enableRdp,
      powerPlanSettings: {
        enabled: configurePowerSettings,
        screenTimeoutAc,
        standbyTimeoutAc,
        screenTimeoutDc,
        standbyTimeoutDc,
      },
      packageIds: selectedPkgIds,
      packageCustomSwitches: editingCustomer?.packageCustomSwitches || {},
      packageConfigFiles: editingCustomer?.packageConfigFiles || {},
      networkDrives,
      printers,
      userLogonStaging: {
        enabled: true,
        stagingPath: 'C:\\ProgramData\\FDIM\\UserLogonSetup.ps1',
        activeSetupKey: 'FDIM_UserProvisioning',
        scheduledTaskFallback: true,
        cleanUpAfterFirstRun,
        createDesktopShortcuts,
        configureEdgeHomepage,
        edgeHomepageUrl,
        showWelcomeNotification,
        welcomeMessage,
        customScriptSnippets,
      },
      localAdminSettings: editingCustomer?.localAdminSettings || {
        enableLocalAdmin: true,
        defaultPassword: 'P@ssw0rd!2026Secure',
        adminPasswordNeverExpires: true,
        deleteOobeAccount: true,
        defaultOobeAccountName: 'install',
        removeOobeProfile: true,
      },
      notes,
    };

    if (editingCustomer) {
      onUpdateCustomer(payload);
    } else {
      onAddCustomer(payload);
    }

    setEditingCustomer(null);
    setIsCreating(false);
  };

  const categories = ['All', ...Array.from(new Set(packages.map((p) => p.category)))];

  const filteredFormPackages = packages.filter((pkg) => {
    const matchesSearch =
      pkg.name.toLowerCase().includes(pkgSearch.toLowerCase()) ||
      pkg.fileName.toLowerCase().includes(pkgSearch.toLowerCase()) ||
      pkg.category.toLowerCase().includes(pkgSearch.toLowerCase());
    const matchesCat = pkgCategoryFilter === 'All' || pkg.category === pkgCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-white">FDIM Multi-Tenant Company Deployment Profiles</h1>
          </div>
          <p className="text-xs text-slate-400">
            Define multi-tenant customer settings: Domain name, default AD Admin group, power plan timeouts, and default software packages assigned to each customer.
          </p>
        </div>

        <button
          onClick={startCreate}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer Profile</span>
        </button>
      </div>

      {/* Editor Modal / Form */}
      {(isCreating || editingCustomer) && (
        <div className="bg-slate-900 border border-cyan-500/60 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>{isCreating ? 'Create New Customer Profile' : `Edit Profile: ${companyName}`}</span>
            </h3>
            <button
              onClick={() => {
                setEditingCustomer(null);
                setIsCreating(false);
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Industrial GmbH"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Customer Code</label>
              <input
                type="text"
                value={customerCode}
                onChange={(e) => setCustomerCode(e.target.value)}
                placeholder="e.g. ACME"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Local Active Directory Domain</label>
              <input
                type="text"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="e.g. acme.corp"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">AD Admin Group to Delegate</label>
              <input
                type="text"
                value={defaultAdAdminGroup}
                onChange={(e) => setDefaultAdAdminGroup(e.target.value)}
                placeholder="e.g. ACME\IT-Workstation-Admins"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* UNC Share Root & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Customer UNC Share Root Path</label>
              <input
                type="text"
                value={uncShareRoot}
                onChange={(e) => setUncShareRoot(e.target.value)}
                placeholder="\\corp-fs01.internal.net\deployments\customers\acme"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Profile Notes / Requirements</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Logistics client, requires unattended remote support and specific security policy."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Power Plan (Optional) & RDP settings */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Workstation System Configuration Policies</span>
              </h4>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enable-power-policy-toggle"
                  checked={configurePowerSettings}
                  onChange={(e) => setConfigurePowerSettings(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                />
                <label htmlFor="enable-power-policy-toggle" className="text-xs text-slate-300 cursor-pointer font-medium select-none">
                  Customize Power Plan (Optional)
                </label>
              </div>
            </div>

            {configurePowerSettings && (
              <div className="p-3.5 bg-slate-900/90 rounded-xl border border-purple-500/30 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* AC Power (Plugged In) */}
                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2.5">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-300">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>AC Power / Plugged In</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Display Turn-Off:</label>
                        <select
                          value={screenTimeoutAc}
                          onChange={(e) => setScreenTimeoutAc(parseInt(e.target.value, 10))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
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
                        <label className="block text-[11px] text-slate-400 mb-1">System Sleep:</label>
                        <select
                          value={standbyTimeoutAc}
                          onChange={(e) => setStandbyTimeoutAc(parseInt(e.target.value, 10))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value={0}>Never Sleep (0)</option>
                          <option value={30}>30 Minutes</option>
                          <option value={60}>60 Minutes</option>
                          <option value={120}>120 Minutes</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Battery Power (DC / Laptops) */}
                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2.5">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-cyan-300">
                      <Battery className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Battery Power (DC / Laptops)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Display Turn-Off:</label>
                        <select
                          value={screenTimeoutDc}
                          onChange={(e) => setScreenTimeoutDc(parseInt(e.target.value, 10))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value={5}>5 Minutes</option>
                          <option value={10}>10 Minutes</option>
                          <option value={15}>15 Minutes</option>
                          <option value={20}>20 Minutes</option>
                          <option value={30}>30 Minutes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">System Sleep:</label>
                        <select
                          value={standbyTimeoutDc}
                          onChange={(e) => setStandbyTimeoutDc(parseInt(e.target.value, 10))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
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
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center space-x-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  checked={enableRdp}
                  onChange={(e) => setEnableRdp(e.target.checked)}
                  id="enable-rdp-toggle"
                  className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="enable-rdp-toggle" className="text-white cursor-pointer select-none font-medium">
                  Enable Remote Desktop (RDP) with Windows Firewall Rules & NLA
                </label>
              </div>
            </div>

            {!configurePowerSettings && (
              <p className="text-[11px] text-slate-500 italic pt-1">
                Note: Power plan modification is omitted. Workstations will retain their existing Windows power settings.
              </p>
            )}
          </div>

          {/* NETWORK DRIVES & PRINTER MAPPING (USER FIRST-LOGON STAGING) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-800/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Network Drives & Printer Mapping (First-Logon Staging)
                </h4>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-300 font-mono">
                {networkDrives.length} Drives • {printers.length} Printers
              </span>
            </div>

            {/* Architecture Explanation Banner */}
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3.5 flex items-start space-x-3 text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-amber-200 font-semibold">
                  Why this is staged for First Logon:
                </p>
                <p className="text-amber-300/80 text-[11px] leading-relaxed">
                  During workstation provisioning, only the technician is logged on. Network drives (<code className="bg-amber-900/40 px-1 rounded font-mono">HKCU:\Network</code>) and per-user network printers require domain Kerberos user credentials. FDIM stages <code className="bg-amber-900/40 px-1 rounded font-mono">C:\ProgramData\FDIM\UserLogonSetup.ps1</code> and registers it in Windows <strong>Active Setup</strong> (<code className="bg-amber-900/40 px-1 rounded font-mono">HKLM:\...\Active Setup</code>) &amp; machine print connections (<code className="bg-amber-900/40 px-1 rounded font-mono">printui /ga</code>). When the employee logs into Windows for the first time, their drives and printers map automatically!
                </p>
              </div>
            </div>

            {/* Sub-grid: Network Drives (Left) & Printers (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Network Drives List & Adder */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-white">
                    <Link2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mapped Network Drives</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{networkDrives.length} configured</span>
                </div>

                {/* Existing Drives */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {networkDrives.map((drv) => (
                    <div
                      key={drv.id}
                      className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-md bg-amber-950 border border-amber-800/80 text-amber-300 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                          {drv.driveLetter}
                        </span>
                        <div className="min-w-0">
                          <span className="text-white font-medium block truncate text-xs">{drv.label}</span>
                          <span className="text-[11px] text-cyan-400 font-mono truncate block">{drv.uncPath}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDrive(drv.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors shrink-0"
                        title="Remove drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {networkDrives.length === 0 && (
                    <div className="text-[11px] text-slate-500 italic p-3 text-center border border-dashed border-slate-800 rounded-lg">
                      No network drives mapped yet. Add below.
                    </div>
                  )}
                </div>

                {/* Add New Drive Row */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Add Network Drive:</span>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="col-span-1">
                      <select
                        value={newDriveLetter}
                        onChange={(e) => setNewDriveLetter(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                      >
                        {['S:', 'P:', 'M:', 'H:', 'Z:', 'N:', 'F:', 'L:', 'K:', 'O:', 'T:', 'X:'].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newDriveLabel}
                        onChange={(e) => setNewDriveLabel(e.target.value)}
                        placeholder="Label (e.g. Shared Documents)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <input
                      type="text"
                      value={newDriveUnc}
                      onChange={(e) => setNewDriveUnc(e.target.value)}
                      placeholder="UNC Path: \\server\share or \\server\users\%USERNAME%"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddDrive}
                      disabled={!newDriveUnc}
                      className="px-3 py-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-200 text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Network Printers List & Adder */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-white">
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Network Printers</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{printers.length} configured</span>
                </div>

                {/* Existing Printers */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {printers.map((prn) => (
                    <div
                      key={prn.id}
                      className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-white font-medium truncate text-xs">{prn.name}</span>
                          {prn.isDefault && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-semibold">
                              DEFAULT
                            </span>
                          )}
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${prn.connectionType === 'PerMachineUNC' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-purple-950 text-purple-300 border border-purple-800'}`}>
                            {prn.connectionType === 'PerMachineUNC' ? 'Per-Machine' : 'User-Logon'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono truncate block">{prn.pathOrIp}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePrinter(prn.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors shrink-0"
                        title="Remove printer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {printers.length === 0 && (
                    <div className="text-[11px] text-slate-500 italic p-3 text-center border border-dashed border-slate-800 rounded-lg">
                      No network printers configured yet. Add below.
                    </div>
                  )}
                </div>

                {/* Add New Printer Row */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Add Network Printer:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      value={newPrinterName}
                      onChange={(e) => setNewPrinterName(e.target.value)}
                      placeholder="Printer Name (e.g. Floor 2 MFP)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <select
                      value={newPrinterType}
                      onChange={(e) => setNewPrinterType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="PerMachineUNC">Per-Machine Connection (PrintUI /ga - All Users)</option>
                      <option value="UserLogonUNC">Per-User Network Connection (Active Setup)</option>
                    </select>
                  </div>
                  <div className="flex gap-2 text-xs items-center">
                    <input
                      type="text"
                      value={newPrinterPath}
                      onChange={(e) => setNewPrinterPath(e.target.value)}
                      placeholder="Path: \\printserver\printer_name"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-slate-300 shrink-0">
                      <input
                        type="checkbox"
                        checked={newPrinterDefault}
                        onChange={(e) => setNewPrinterDefault(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                      />
                      <span>Default</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPrinter}
                      disabled={!newPrinterPath}
                      className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-200 text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* USER FIRST-RUN LOGON AUTOMATION & CUSTOM SCRIPT SNIPPETS */}
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-800/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    First-Run User Logon Options & Custom Script Snippets
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Staged in Active Setup (<code className="text-amber-300 font-mono">UserLogonSetup.ps1</code>), executed silently when the employee first signs in
                  </p>
                </div>
              </div>
            </div>

            {/* General First-Run Checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={configureEdgeHomepage}
                    onChange={(e) => setConfigureEdgeHomepage(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4"
                  />
                  <span>Configure Microsoft Edge Corporate Homepage</span>
                </label>
                {configureEdgeHomepage && (
                  <input
                    type="text"
                    value={edgeHomepageUrl}
                    onChange={(e) => setEdgeHomepageUrl(e.target.value)}
                    placeholder="https://intranet.company.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono"
                  />
                )}
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={showWelcomeNotification}
                    onChange={(e) => setShowWelcomeNotification(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4"
                  />
                  <span>Show First-Logon IT Welcome Notification</span>
                </label>
                {showWelcomeNotification && (
                  <input
                    type="text"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Welcome message text"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  />
                )}
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={createDesktopShortcuts}
                    onChange={(e) => setCreateDesktopShortcuts(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4"
                  />
                  <span>Create Desktop Shortcuts to Mapped Network Shares</span>
                </label>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-200">
                  <input
                    type="checkbox"
                    checked={cleanUpAfterFirstRun}
                    onChange={(e) => setCleanUpAfterFirstRun(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4"
                  />
                  <span>Clean up Active Setup staging script after first run</span>
                </label>
              </div>
            </div>

            {/* Custom PowerShell Script Snippets Sub-section */}
            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-white">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <span>Custom First-Run PowerShell Snippets ({customScriptSnippets.length})</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Runs under user interactive Kerberos session
                </span>
              </div>

              {/* Snippet List */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {customScriptSnippets.map((snip) => (
                  <div
                    key={snip.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={snip.enabled !== false}
                        onChange={() => {
                          setCustomScriptSnippets((prev) =>
                            prev.map((s) => (s.id === snip.id ? { ...s, enabled: !s.enabled } : s))
                          );
                        }}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-400 w-3.5 h-3.5 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <strong className="text-white block text-xs">{snip.name}</strong>
                        <pre className="text-[10px] font-mono text-cyan-300/80 bg-slate-900/90 p-1.5 rounded mt-1 overflow-x-auto max-h-16">
                          {snip.script}
                        </pre>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomScriptSnippets((prev) => prev.filter((s) => s.id !== snip.id))}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {customScriptSnippets.length === 0 && (
                  <div className="text-[11px] text-slate-500 italic p-3 text-center border border-dashed border-slate-800 rounded-lg">
                    No custom script snippets added. You can add one below or choose a template.
                  </div>
                )}
              </div>

              {/* Add New Snippet Form */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Add Custom PowerShell Snippet:</span>
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="text-slate-500">Insert Template:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSnippetName('Set Outlook Signature Template');
                        setNewSnippetScript(`$sigDir = "$env:APPDATA\\Microsoft\\Signatures"\nif (-not (Test-Path $sigDir)) { New-Item -ItemType Directory -Path $sigDir -Force | Out-Null }\nWrite-Output "Signature folder initialized"`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono cursor-pointer"
                    >
                      Outlook Sig
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSnippetName('Pin Intranet Desktop Shortcut');
                        setNewSnippetScript(`$wsh = New-Object -ComObject WScript.Shell\n$shortcut = $wsh.CreateShortcut("$env:USERPROFILE\\Desktop\\Corporate Portal.url")\n$shortcut.TargetPath = "https://portal.${domainName || 'corp.internal'}"\n$shortcut.Save()`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono cursor-pointer"
                    >
                      Desktop Portal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSnippetName('Import Corporate Root CA to User Store');
                        setNewSnippetScript(`$certPath = "\\\\${uncShareRoot ? uncShareRoot.split('\\\\')[1] : 'corp-fs01'}\\Certs\\corp-root-ca.cer"\nif (Test-Path $certPath) { Import-Certificate -FilePath $certPath -CertStoreLocation Cert:\\CurrentUser\\Root }`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono cursor-pointer"
                    >
                      User Cert
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSnippetName('Disable Consumer Cloud Advertising in HKCU');
                        setNewSnippetScript(`Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" -Name "Enabled" -Value 0 -Type DWord -Force`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono cursor-pointer"
                    >
                      Privacy HKCU
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={newSnippetName}
                    onChange={(e) => setNewSnippetName(e.target.value)}
                    placeholder="Snippet Title (e.g. Map Outlook Signature Template)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <textarea
                    rows={2}
                    value={newSnippetScript}
                    onChange={(e) => setNewSnippetScript(e.target.value)}
                    placeholder="PowerShell commands executed at user logon..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSnippetName || !newSnippetScript) return;
                      setCustomScriptSnippets((prev) => [
                        ...prev,
                        {
                          id: `snip-${Date.now()}`,
                          name: newSnippetName,
                          script: newSnippetScript,
                          enabled: true,
                        },
                      ]);
                      setNewSnippetName('');
                      setNewSnippetScript('');
                    }}
                    disabled={!newSnippetName || !newSnippetScript}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    + Add Custom Snippet
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DEFAULT SOFTWARE SELECTION IN CUSTOMER PROFILE EDITOR */}
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Default Software Packages for this Customer ({selectedPkgIds.length} Selected)
                </h4>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectCorePackages}
                  className="text-[11px] px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800"
                >
                  Select Core Apps
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllPackages}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllPackages}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter available software..."
                  value={pkgSearch}
                  onChange={(e) => setPkgSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPkgCategoryFilter(cat)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                      pkgCategoryFilter === cat
                        ? 'bg-cyan-600 text-white font-semibold'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredFormPackages.map((pkg) => {
                const isSelected = selectedPkgIds.includes(pkg.id);
                return (
                  <div
                    key={pkg.id}
                    onClick={() => togglePackageSelection(pkg.id)}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-start space-x-3 ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/70 text-white ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/60 border-slate-850 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="text-xs font-bold text-white truncate">{pkg.name}</span>
                          {(pkg.sourceType === 'winget' || pkg.installerType === 'Winget' || pkg.wingetId) ? (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800 shrink-0">
                              Winget
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-900 shrink-0">
                              UNC
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                          {pkg.installerType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mb-1">{pkg.description}</p>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 truncate">
                        <span className="truncate">{pkg.wingetId || pkg.fileName}</span>
                        <span>•</span>
                        <span>{pkg.estimatedMinutes}m</span>
                        {pkg.id === 'pkg-teamviewer' && (
                          <span className="text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-800/50">
                            Custom Config
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {editingCustomer ? (
              <button
                type="button"
                onClick={() => setCustomerToDelete(editingCustomer)}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 border border-red-800/60 hover:bg-red-900/50 text-red-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Delete Profile</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setIsCreating(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!companyName}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 disabled:opacity-50 transition-all cursor-pointer"
              >
                Save Customer Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customers List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {customers.map((cust) => {
          const assignedPackages = packages.filter((p) => (cust.packageIds || []).includes(p.id));
          return (
            <div
              key={cust.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{cust.companyName}</h3>
                      <span className="text-xs text-slate-400 font-mono">
                        Domain: <strong className="text-slate-200">{cust.domainName}</strong> • Code: {cust.customerCode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => startEdit(cust)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit profile & software"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCustomerToDelete(cust)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/50 transition-colors cursor-pointer"
                      title={`Delete profile: ${cust.companyName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-xs space-y-1.5 text-slate-300 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delegated Admin Group:</span>
                    <span className="font-mono text-cyan-400 font-semibold">{cust.defaultAdAdminGroup}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Power Plan:</span>
                    {cust.powerPlanSettings?.enabled ? (
                      <span className="text-[11px] text-right">
                        <span className="text-amber-300 font-medium">AC: {cust.powerPlanSettings.screenTimeoutAc}m/{cust.powerPlanSettings.standbyTimeoutAc === 0 ? 'Never' : `${cust.powerPlanSettings.standbyTimeoutAc}m`}</span>
                        <span className="text-slate-500"> • </span>
                        <span className="text-cyan-300 font-medium">Battery: {cust.powerPlanSettings.screenTimeoutDc ?? 10}m/{cust.powerPlanSettings.standbyTimeoutDc === 0 ? 'Never' : `${cust.powerPlanSettings.standbyTimeoutDc ?? 20}m`}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Workstation default (Unchanged)</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">RDP Enabled:</span>
                    <span className="text-emerald-400 font-semibold">{cust.enableRdp ? 'Yes' : 'No'}</span>
                  </div>
                  {cust.packageCustomSwitches?.['pkg-teamviewer'] && (
                    <div className="flex flex-col pt-1 border-t border-slate-850 text-[11px]">
                      <span className="text-slate-400">TeamViewer Switches:</span>
                      <code className="text-emerald-300 font-mono truncate mt-0.5">
                        {cust.packageCustomSwitches['pkg-teamviewer']}
                      </code>
                    </div>
                  )}
                </div>

                {/* Assigned Default Software Badges */}
                <div className="mb-4">
                  <div className="text-[11px] text-slate-400 font-medium mb-1.5 flex items-center justify-between">
                    <span>Default Assigned Software ({assignedPackages.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {assignedPackages.map((pkg) => (
                      <span
                        key={pkg.id}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-medium"
                      >
                        {pkg.name.split(' ')[0]} {pkg.name.includes('TeamViewer') ? 'Host' : ''}
                      </span>
                    ))}
                    {assignedPackages.length === 0 && (
                      <span className="text-[11px] text-slate-500 italic">No default software assigned</span>
                    )}
                  </div>
                </div>

                {/* Staged Drives & Printers Badges */}
                {((cust.networkDrives && cust.networkDrives.length > 0) || (cust.printers && cust.printers.length > 0)) && (
                  <div className="mb-4 p-2 rounded-lg bg-slate-950 border border-slate-850 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-slate-300">First-Logon Staging (Active Setup):</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {cust.networkDrives && cust.networkDrives.length > 0 && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300 font-mono text-[10px]">
                          <HardDrive className="w-2.5 h-2.5" />
                          <span>{cust.networkDrives.length} Drives ({cust.networkDrives.map((d) => d.driveLetter).join(', ')})</span>
                        </span>
                      )}
                      {cust.printers && cust.printers.length > 0 && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-mono text-[10px]">
                          <Printer className="w-2.5 h-2.5" />
                          <span>{cust.printers.length} Printers</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-850">
                <span className="text-xs text-slate-400">
                  {cust.packageIds.length} Packages Default
                </span>

                <button
                  onClick={() => onSelectCustomerForSetup(cust.id)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors"
                >
                  Apply to Current PC
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800/80 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">Delete Customer Profile?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete profile <strong className="text-white">"{customerToDelete.companyName}"</strong> ({customerToDelete.customerCode})?
                </p>
                <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Domain:</span>
                    <span className="font-mono text-slate-200">{customerToDelete.domainName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Default Packages:</span>
                    <span className="font-mono text-slate-200">{customerToDelete.packageIds?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Network Drives:</span>
                    <span className="font-mono text-slate-200">{customerToDelete.networkDrives?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Printers:</span>
                    <span className="font-mono text-slate-200">{customerToDelete.printers?.length || 0}</span>
                  </div>
                </div>
                <p className="text-[11px] text-red-400 font-medium mt-2">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCustomer(customerToDelete.id);
                  if (editingCustomer?.id === customerToDelete.id) {
                    setEditingCustomer(null);
                    setIsCreating(false);
                  }
                  setCustomerToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-md shadow-red-600/30 flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
