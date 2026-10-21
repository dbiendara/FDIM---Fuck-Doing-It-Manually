import React, { useState, useEffect } from 'react';
import {
  ADComputer,
  CustomerProfile,
  SoftwarePackage,
} from '../types';
import {
  Monitor,
  Search,
  Filter,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  Radio,
  Clock,
  Terminal,
  PackageCheck,
  Send,
  Upload,
  Layers,
  Building2,
  HardDrive,
  Cpu,
  User,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Check,
  Play,
  ArrowRight,
  SlidersHorizontal,
  X,
  Copy,
  Trash2,
  Edit3,
  Rocket,
  AlertTriangle,
  Download,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ADComputersViewProps {
  customers: CustomerProfile[];
  packages: SoftwarePackage[];
  onSelectMachineForProvisioning: (machineName: string, customerId: string) => void;
  onOpenQuickDeployForMachine: (machineName: string, customer: CustomerProfile) => void;
  onQueueTaskForMachine?: (machineName: string, packageIds: string[]) => void;
}

export const ADComputersView: React.FC<ADComputersViewProps> = ({
  customers,
  packages,
  onSelectMachineForProvisioning,
  onOpenQuickDeployForMachine,
}) => {
  const [computers, setComputers] = useState<ADComputer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'agent' | 'offline'>('all');
  const [ouFilter, setOuFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);

  // Action states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [newlyDiscoveredIds, setNewlyDiscoveredIds] = useState<string[]>([]);
  const [showAdBridgeHelper, setShowAdBridgeHelper] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Targeted LDAP Discovery modal & LDAP Credentials state
  const [isLdapModalOpen, setIsLdapModalOpen] = useState(false);
  const [targetOu, setTargetOu] = useState('');
  const [specificComputerQuery, setSpecificComputerQuery] = useState('');
  const [targetCustomerForSync, setTargetCustomerForSync] = useState(customers[0]?.id || '');
  const [ldapServerUrl, setLdapServerUrl] = useState('');
  const [ldapDomain, setLdapDomain] = useState('');
  const [ldapBaseDn, setLdapBaseDn] = useState('');
  const [ldapBindDn, setLdapBindDn] = useState('');
  const [ldapBindPassword, setLdapBindPassword] = useState('');
  const [showLdapPassword, setShowLdapPassword] = useState(false);
  const [showLdapCredsSection, setShowLdapCredsSection] = useState(false);
  const [isTestingModalLdap, setIsTestingModalLdap] = useState(false);
  const [modalLdapTestResult, setModalLdapTestResult] = useState<{
    success?: boolean;
    message?: string;
    dcHost?: string;
    computerCount?: number;
  } | null>(null);

  // Add / Bulk Import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [singleHostname, setSingleHostname] = useState('');
  const [singleIpAddress, setSingleIpAddress] = useState('');
  const [singleOs, setSingleOs] = useState('Windows 11 Pro 24H2');
  const [singleOu, setSingleOu] = useState('');
  const [singleDescription, setSingleDescription] = useState('');
  const [importText, setImportText] = useState('');
  const [importDomain, setImportDomain] = useState('');
  const [importCustomer, setImportCustomer] = useState(customers[0]?.id || '');
  const [isImporting, setIsImporting] = useState(false);

  // Inline Edit IP Modal
  const [editingComputer, setEditingComputer] = useState<ADComputer | null>(null);
  const [editIpValue, setEditIpValue] = useState('');
  const [editOsValue, setEditOsValue] = useState('');
  const [editDescValue, setEditDescValue] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deploy Agent Modal
  const [isDeployAgentModalOpen, setIsDeployAgentModalOpen] = useState(false);
  const [deployAgentTargets, setDeployAgentTargets] = useState<ADComputer[]>([]);
  const [deployTransport, setDeployTransport] = useState<'WinRM' | 'SMB' | 'WMI'>('WinRM');
  const [deployServerUrl, setDeployServerUrl] = useState(() => window.location.origin);
  const [deployAdminUser, setDeployAdminUser] = useState('');
  const [deployAdminPassword, setDeployAdminPassword] = useState('');
  const [isDeployingAgent, setIsDeployingAgent] = useState(false);
  const [deployAgentResult, setDeployAgentResult] = useState<{
    message: string;
    results: Array<{
      id: string;
      name: string;
      fqdn: string;
      ipAddress: string;
      reachable: boolean;
      pingMs: number | null;
      openPort?: number;
      status: string;
      detail: string;
    }>;
    remotePushScript: string;
    bootstrapOneLiner: string;
  } | null>(null);

  // Bulk Software Deploy modal
  const [isBulkDeployModalOpen, setIsBulkDeployModalOpen] = useState(false);
  const [bulkSelectedPackageIds, setBulkSelectedPackageIds] = useState<string[]>([]);
  const [isQueueingBulk, setIsQueueingBulk] = useState(false);
  const [bulkDeployFeedback, setBulkDeployFeedback] = useState<string | null>(null);

  // Computer History modal
  const [historyComputerName, setHistoryComputerName] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'timeline' | 'deployments' | 'tasks'>('timeline');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleOpenHistory = async (name: string) => {
    setHistoryComputerName(name);
    setIsLoadingHistory(true);
    setHistoryData(null);
    setHistoryTab('timeline');
    try {
      const res = await fetch(`/api/computers/${encodeURIComponent(name)}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (err) {
      console.error('Error fetching computer history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchComputers = async (showLoadingState = false) => {
    if (showLoadingState) {
      setIsLoading(true);
    }
    try {
      const res = await fetch('/api/ad-computers');
      const data = await res.json();
      setComputers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching AD computers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComputers(true);
    // Load configured AD defaults from server settings
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => {
        if (s?.defaultGlobalDomain) {
          setImportDomain(s.defaultGlobalDomain);
        }
        if (s?.adLdapConfig?.ldapUrl) {
          setLdapServerUrl(s.adLdapConfig.ldapUrl);
        }
        if (s?.adLdapConfig?.domain) {
          setLdapDomain(s.adLdapConfig.domain);
        }
        if (s?.adLdapConfig?.baseDn) {
          setLdapBaseDn(s.adLdapConfig.baseDn);
        }
        if (s?.adLdapConfig?.bindDn) {
          setLdapBindDn(s.adLdapConfig.bindDn);
          setDeployAdminUser(s.adLdapConfig.bindDn);
        }
        if (s?.adLdapConfig?.bindPassword) {
          setLdapBindPassword(s.adLdapConfig.bindPassword);
        }
        if (s?.adLdapConfig?.computerSearchOu) {
          setTargetOu(s.adLdapConfig.computerSearchOu);
          setSingleOu(s.adLdapConfig.computerSearchOu);
        } else if (s?.adLdapConfig?.baseDn) {
          setTargetOu(s.adLdapConfig.baseDn);
          setSingleOu(s.adLdapConfig.baseDn);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (customers.length > 0 && !targetCustomerForSync) {
      setTargetCustomerForSync(customers[0].id);
    }
    if (customers.length > 0 && !importCustomer) {
      setImportCustomer(customers[0].id);
    }
  }, [customers]);

  // Sync AD via real LDAPv3 query
  const handleSyncAD = async (options?: {
    ouPath?: string;
    specificNames?: string[];
    customerId?: string;
    ldapUrl?: string;
    domain?: string;
    baseDn?: string;
    bindDn?: string;
    bindPassword?: string;
  }) => {
    setIsSyncing(true);
    setSyncFeedback(null);
    setSyncError(null);
    try {
      const res = await fetch('/api/ad-computers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ouPath: options?.ouPath !== undefined ? options.ouPath : targetOu,
          specificComputerNames: options?.specificNames,
          customerProfileId: options?.customerId || targetCustomerForSync,
          ldapUrl: options?.ldapUrl || ldapServerUrl || undefined,
          domain: options?.domain || ldapDomain || undefined,
          baseDn: options?.baseDn || ldapBaseDn || undefined,
          bindDn: options?.bindDn || ldapBindDn || undefined,
          bindPassword: options?.bindPassword !== undefined ? options.bindPassword : ldapBindPassword || undefined,
          discoverNew: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setSyncError(data.message || data.error || data.ldapError || 'Active Directory LDAP sync failed.');
        setShowLdapCredsSection(true);
      } else {
        setSyncFeedback(data.message || 'Active Directory sync complete.');
        if (Array.isArray(data.discoveredComputers) && data.discoveredComputers.length > 0) {
          setNewlyDiscoveredIds((prev) => [...prev, ...data.discoveredComputers.map((c: any) => c.id)]);
        }
      }
      fetchComputers();
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to connect to Active Directory endpoint.');
      setShowLdapCredsSection(true);
    } finally {
      setIsSyncing(false);
      setIsLdapModalOpen(false);
    }
  };

  // Test LDAP Connection & Authenticated Bind directly from the Discovery Modal
  const handleTestModalLdap = async () => {
    setIsTestingModalLdap(true);
    setModalLdapTestResult(null);
    try {
      const res = await fetch('/api/auth/test-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ldapUrl: ldapServerUrl,
          domain: ldapDomain,
          baseDn: ldapBaseDn,
          bindDn: ldapBindDn,
          bindPassword: ldapBindPassword,
        }),
      });
      const data = await res.json();
      setModalLdapTestResult(data);
    } catch (err: any) {
      setModalLdapTestResult({
        success: false,
        message: 'Network error or timeout connecting to Active Directory Domain Controller.',
      });
    } finally {
      setIsTestingModalLdap(false);
    }
  };

  // Ping selected or all computers using real DNS + TCP/ICMP probes
  const handlePingComputers = async (targetNames?: string[]) => {
    setIsPinging(true);
    const names = targetNames || (selectedMachineIds.length > 0
      ? computers.filter((c) => selectedMachineIds.includes(c.id)).map((c) => c.name)
      : computers.map((c) => c.name));

    try {
      const res = await fetch('/api/ad-computers/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ computerNames: names }),
      });
      const data = await res.json();
      if (data.computers) {
        setComputers(data.computers);
      }
      const onlineNow = Array.isArray(data.results) ? data.results.filter((r: any) => r.status === 'Online').length : 0;
      setSyncFeedback(`Real network probe completed for ${names.length} endpoint(s): ${onlineNow} reachable, ${names.length - onlineNow} offline/unreachable.`);
    } catch {
      setSyncError('Failed to execute network probe.');
    } finally {
      setIsPinging(false);
    }
  };

  // Handle Single or Bulk Add
  const handleBulkImport = async () => {
    setIsImporting(true);
    setSyncError(null);
    try {
      let computersPayload: Array<{
        name: string;
        ipAddress?: string;
        osName?: string;
        ouPath?: string;
        description?: string;
      }> = [];

      if (addMode === 'single') {
        if (!singleHostname.trim()) return;
        computersPayload = [
          {
            name: singleHostname.trim().toUpperCase(),
            ipAddress: singleIpAddress.trim() || undefined,
            osName: singleOs.trim() || 'Windows 11 Pro',
            ouPath: singleOu.trim() || targetOu || undefined,
            description: singleDescription.trim() || 'Added manually',
          },
        ];
      } else {
        if (!importText.trim()) return;
        const lines = importText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        computersPayload = lines.map((line) => {
          const parts = line.split(/[,\t;]+/).map((p) => p.trim());
          return {
            name: parts[0].toUpperCase(),
            ipAddress: parts[1] || undefined,
            osName: parts[2] || 'Windows 11 Pro',
            ouPath: parts[3] || targetOu || undefined,
            description: parts[4] || 'Imported via bulk list',
          };
        });
      }

      const res = await fetch('/api/ad-computers/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computers: computersPayload,
          domain: importDomain || 'corp.local',
          customerProfileId: importCustomer || '',
          ouPath: singleOu.trim() || targetOu || undefined,
        }),
      });
      const data = await res.json();
      if (data.computers) {
        setComputers(data.computers);
      } else {
        fetchComputers();
      }
      setIsImportModalOpen(false);
      setSingleHostname('');
      setSingleIpAddress('');
      setSingleDescription('');
      setImportText('');
      setSyncFeedback(data.message || `Added ${data.importedCount || computersPayload.length} workstation(s).`);
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to add computers.');
    } finally {
      setIsImporting(false);
    }
  };

  // Save edited computer IP / OS / Description and re-probe
  const handleSaveComputerEdit = async () => {
    if (!editingComputer) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/ad-computers/${encodeURIComponent(editingComputer.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: editIpValue.trim(),
          osName: editOsValue.trim(),
          description: editDescValue.trim(),
          probeNow: true,
        }),
      });
      const data = await res.json();
      if (data.computer) {
        setComputers((prev) => prev.map((c) => (c.id === data.computer.id ? data.computer : c)));
        setSyncFeedback(
          `Updated ${data.computer.name}: IP ${data.computer.ipAddress} — Status: ${data.computer.status}${
            data.computer.pingMs ? ` (${data.computer.pingMs}ms)` : ''
          }`
        );
      }
      setEditingComputer(null);
    } catch {
      setSyncError('Failed to update computer.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteComputer = async (comp: ADComputer) => {
    try {
      await fetch(`/api/ad-computers/${encodeURIComponent(comp.id)}`, { method: 'DELETE' });
      setComputers((prev) => prev.filter((c) => c.id !== comp.id));
      setSelectedMachineIds((prev) => prev.filter((id) => id !== comp.id));
      setSyncFeedback(`Removed ${comp.name} from workstation inventory.`);
    } catch {
      setSyncError(`Failed to remove ${comp.name}.`);
    }
  };

  // Generate live PowerShell scripts for Option A, Option B (WinRM / SMB / WMI), and Option C (Standalone)
  const buildClientAgentScripts = (
    targets: ADComputer[],
    rawServerUrl: string,
    transportMode: 'WinRM' | 'SMB' | 'WMI',
    adminUserRaw: string,
    adminPassRaw: string
  ) => {
    const effectiveUrl = (rawServerUrl.trim() || window.location.origin).replace(/\/+$/, '');
    const targetAddresses =
      targets.length > 0
        ? targets.map((t) =>
            t.ipAddress && !t.ipAddress.toLowerCase().startsWith('unresolved') ? t.ipAddress : t.name
          )
        : ['WORKSTATION-01'];
    const targetsList = targetAddresses.map((n) => `"${String(n).trim()}"`).join(', ');
    const targetNamesSummary =
      targets.length > 0
        ? targets.map((t) => `${t.name} (${t.ipAddress || 'DNS'})`).join(', ')
        : 'Target Workstations';
    const credUser = adminUserRaw.trim() || 'DOMAIN\\Administrator';

    const bootstrapOneLiner = `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-RestMethod -Uri "${effectiveUrl}/api/agent/script/installer?serverUrl=${encodeURIComponent(effectiveUrl)}" -UseBasicParsing | Invoke-Expression`;

    const credSnippet = adminPassRaw
      ? `$SecPass = ConvertTo-SecureString "${adminPassRaw.replace(/"/g, '`"')}" -AsPlainText -Force\n$Cred = New-Object System.Management.Automation.PSCredential("${credUser}", $SecPass)`
      : `$Cred = Get-Credential -UserName "${credUser}" -Message "Enter Domain Admin credentials for FDIM Agent deployment"`;

    let remotePushScript = '';
    if (transportMode === 'WMI') {
      remotePushScript = `# ==============================================================================
# FDIM Client Agent Remote Push Script — WMI / CIM Process Call (TCP 135 / DCOM)
# Targets: ${targetNamesSummary}
# Server:  ${effectiveUrl}
# ==============================================================================
$Targets = @(${targetsList})
$ServerUrl = "${effectiveUrl}"
${credSnippet}

$BootstrapCmd = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-RestMethod -Uri '$ServerUrl/api/agent/script/installer?serverUrl=$([uri]::EscapeDataString($ServerUrl))' -UseBasicParsing | Invoke-Expression"""

foreach ($Target in $Targets) {
    Write-Host "[*] Deploying FDIM Client Agent to $Target via WMI/CIM (Win32_Process)..." -ForegroundColor Cyan
    try {
        $CimOpt = New-CimSessionOption -Protocol Dcom
        $Session = New-CimSession -ComputerName $Target -Credential $Cred -SessionOption $CimOpt -ErrorAction Stop
        $Result = Invoke-CimMethod -CimSession $Session -ClassName Win32_Process -MethodName Create -Arguments @{
            CommandLine = $BootstrapCmd
        } -ErrorAction Stop
        if ($Result.ReturnValue -eq 0) {
            Write-Host "[OK] Agent installer launched on $Target (PID: $($Result.ProcessId))!" -ForegroundColor Green
        } else {
            Write-Warning "[!] Win32_Process.Create returned code $($Result.ReturnValue) on $Target"
        }
        Remove-CimSession $Session -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "[!] WMI/CIM failed on $Target: $_"
    }
}`;
    } else if (transportMode === 'SMB') {
      remotePushScript = `# ==============================================================================
# FDIM Client Agent Remote Push Script — SMB Admin$ Share + Scheduled Task (TCP 445)
# Targets: ${targetNamesSummary}
# Server:  ${effectiveUrl}
# ==============================================================================
$Targets = @(${targetsList})
$ServerUrl = "${effectiveUrl}"
${credSnippet}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$InstallerContent = Invoke-RestMethod -Uri "$ServerUrl/api/agent/script/installer?serverUrl=$([uri]::EscapeDataString($ServerUrl))" -UseBasicParsing

foreach ($Target in $Targets) {
    Write-Host "[*] Staging FDIM Agent via SMB ADMIN$ on $Target..." -ForegroundColor Cyan
    try {
        New-PSDrive -Name "FDIMSMB" -PSProvider FileSystem -Root "\\\\$Target\\ADMIN$\\Temp" -Credential $Cred -ErrorAction Stop | Out-Null
        Set-Content -Path "FDIMSMB:\\Install-FDIMAgent.ps1" -Value $InstallerContent -Encoding UTF8 -Force
        Remove-PSDrive -Name "FDIMSMB" -ErrorAction SilentlyContinue

        $PlainPass = $Cred.GetNetworkCredential().Password
        schtasks.exe /Create /S $Target /U "$($Cred.UserName)" /P "$PlainPass" /RU "SYSTEM" /SC ONCE /ST 00:00 /TN "FDIM-Agent-Bootstrap" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\\Windows\\Temp\\Install-FDIMAgent.ps1" /RL HIGHEST /F | Out-Null
        schtasks.exe /Run /S $Target /U "$($Cred.UserName)" /P "$PlainPass" /TN "FDIM-Agent-Bootstrap" | Out-Null
        Write-Host "[OK] FDIM Agent staged and executed as SYSTEM on $Target!" -ForegroundColor Green
    } catch {
        Remove-PSDrive -Name "FDIMSMB" -ErrorAction SilentlyContinue
        Write-Warning "[!] SMB deployment failed on $Target: $_"
    }
}`;
    } else {
      remotePushScript = `# ==============================================================================
# FDIM Client Agent Remote Push Script — WinRM / PowerShell Remoting (TCP 5985/5986)
# Targets: ${targetNamesSummary}
# Server:  ${effectiveUrl}
# ==============================================================================
$Targets = @(${targetsList})
$ServerUrl = "${effectiveUrl}"
${credSnippet}

foreach ($Target in $Targets) {
    Write-Host "[*] Deploying FDIM Client Agent to $Target via WinRM..." -ForegroundColor Cyan
    try {
        Invoke-Command -ComputerName $Target -Credential $Cred -ScriptBlock {
            param($Url)
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $installer = Invoke-RestMethod -Uri "$Url/api/agent/script/installer?serverUrl=$([uri]::EscapeDataString($Url))" -UseBasicParsing
            Invoke-Expression $installer
        } -ArgumentList $ServerUrl -ErrorAction Stop
        Write-Host "[OK] FDIM Agent installed and heartbeat triggered on $Target!" -ForegroundColor Green
    } catch {
        Write-Warning "[!] WinRM failed on $Target: $_"
    }
}`;
    }

    return { bootstrapOneLiner, remotePushScript };
  };

  const downloadPs1Script = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open Deploy Agent Modal for one or multiple computers
  const handleOpenDeployAgent = (targets: ADComputer[]) => {
    if (targets.length === 0) return;
    setDeployAgentTargets(targets);
    const initialScripts = buildClientAgentScripts(
      targets,
      deployServerUrl,
      deployTransport,
      deployAdminUser,
      deployAdminPassword
    );
    setDeployAgentResult({
      message: `Ready to deploy FDIM Client Agent to ${targets.map((t) => t.name).join(', ')}. Click "Probe Endpoints & Deploy Agent" to test network ports, or copy the PowerShell scripts below immediately.`,
      results: targets.map((t) => ({
        id: t.id,
        name: t.name,
        fqdn: t.fqdn || t.dnsHostName || t.name,
        ipAddress: t.ipAddress || 'Unresolved',
        reachable: t.status === 'Online' || t.status === 'AgentConnected',
        pingMs: t.pingMs ?? null,
        status: t.status,
        detail: 'Ready — Click "Probe Endpoints & Deploy Agent" to test live ports & queue task',
      })),
      remotePushScript: initialScripts.remotePushScript,
      bootstrapOneLiner: initialScripts.bootstrapOneLiner,
    });
    setIsDeployAgentModalOpen(true);
  };

  // Execute Agent Deployment / Probe
  const handleExecuteDeployAgent = async () => {
    if (deployAgentTargets.length === 0) return;
    setIsDeployingAgent(true);
    const fallbackScripts = buildClientAgentScripts(
      deployAgentTargets,
      deployServerUrl,
      deployTransport,
      deployAdminUser,
      deployAdminPassword
    );
    try {
      const res = await fetch('/api/ad-computers/deploy-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computerIds: deployAgentTargets.map((c) => c.id),
          machineNames: deployAgentTargets.map((c) => c.name),
          serverUrl: deployServerUrl.trim() || window.location.origin,
          transport: deployTransport,
          adminUsername: deployAdminUser.trim() || undefined,
          adminPassword: deployAdminPassword || undefined,
        }),
      });
      const data = await res.json();
      if (data.computers) {
        setComputers(data.computers);
      }
      const mappedResults =
        Array.isArray(data.results) && data.results.length > 0
          ? data.results.map((r: any, idx: number) => ({
              id: r.id || deployAgentTargets[idx]?.id || `res-${idx}`,
              name: r.name || r.machineName || deployAgentTargets[idx]?.name || 'UNKNOWN',
              fqdn: r.fqdn || deployAgentTargets[idx]?.fqdn || '',
              ipAddress: r.ipAddress || deployAgentTargets[idx]?.ipAddress || 'Unresolved',
              reachable: Boolean(r.reachable),
              pingMs: r.pingMs ?? null,
              openPort: r.openPort,
              status: r.status || 'queued_and_ready',
              detail: r.detail || r.message || 'Queued deployment task & generated PowerShell script',
            }))
          : deployAgentTargets.map((t) => ({
              id: t.id,
              name: t.name,
              fqdn: t.fqdn || t.dnsHostName || t.name,
              ipAddress: t.ipAddress || 'Unresolved',
              reachable: false,
              pingMs: null,
              status: 'unreachable_queued',
              detail: 'Queued — Run PowerShell Push Script from Jump Host',
            }));

      setDeployAgentResult({
        message:
          data.message ||
          `Agent deployment prepared for ${deployAgentTargets.map((t) => t.name).join(', ')}.`,
        results: mappedResults,
        remotePushScript: data.remotePushScript || fallbackScripts.remotePushScript,
        bootstrapOneLiner: data.bootstrapOneLiner || fallbackScripts.bootstrapOneLiner,
      });
    } catch (err: any) {
      setDeployAgentResult({
        message: `Generated offline PowerShell deployment scripts for ${deployAgentTargets.map((t) => t.name).join(', ')}.`,
        results: deployAgentTargets.map((t) => ({
          id: t.id,
          name: t.name,
          fqdn: t.fqdn || t.dnsHostName || t.name,
          ipAddress: t.ipAddress || 'Unresolved',
          reachable: false,
          pingMs: null,
          status: 'unreachable_queued',
          detail: 'Run PowerShell Push Script from Jump Host',
        })),
        remotePushScript: fallbackScripts.remotePushScript,
        bootstrapOneLiner: fallbackScripts.bootstrapOneLiner,
      });
    } finally {
      setIsDeployingAgent(false);
    }
  };

  // Mark agent as installed / send simulated agent heartbeat test to verify
  const handleVerifyAgentHeartbeat = async (comp: ADComputer) => {
    try {
      const res = await fetch('/api/agent/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineName: comp.name,
          domain: comp.domain,
          ipAddress: comp.ipAddress !== 'Unresolved (DNS)' ? comp.ipAddress : undefined,
          agentVersion: '2.4.1',
          osName: comp.osName,
          osBuild: comp.osBuild,
          loggedInUser: comp.loggedInUser || null,
        }),
      });
      if (res.ok) {
        await fetchComputers();
        setSyncFeedback(`Agent heartbeat verified for ${comp.name} (v2.4.1 Active).`);
      }
    } catch {
      setSyncError(`Failed to verify agent for ${comp.name}.`);
    }
  };

  // Queue Bulk Software Deployment
  const handleQueueBulkDeploy = async () => {
    if (bulkSelectedPackageIds.length === 0 || selectedMachineIds.length === 0) return;
    setIsQueueingBulk(true);
    const selectedComputers = computers.filter((c) => selectedMachineIds.includes(c.id));
    const selectedPkgs = packages.filter((p) => bulkSelectedPackageIds.includes(p.id));

    try {
      for (const comp of selectedComputers) {
        await fetch('/api/queued-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machineName: comp.name,
            domain: comp.domain,
            customerProfileId: comp.customerProfileId,
            taskType: 'SoftwareDeploy',
            packageIds: selectedPkgs.map((p) => p.id),
            packageNames: selectedPkgs.map((p) => p.name),
            triggerCondition: comp.status === 'Online' ? 'NextHeartbeat' : 'OnBootOrWake',
            createdBy: 'AD Console Admin',
            notes: `Bulk deployment to ${selectedComputers.length} machines from AD view`,
          }),
        });
      }

      setBulkDeployFeedback(`Queued ${selectedPkgs.length} package(s) for ${selectedComputers.length} workstation(s)!`);
      setTimeout(() => {
        setBulkDeployFeedback(null);
        setIsBulkDeployModalOpen(false);
        setBulkSelectedPackageIds([]);
        setSelectedMachineIds([]);
      }, 1800);
    } catch (err) {
      console.error('Error queueing bulk deployment:', err);
    } finally {
      setIsQueueingBulk(false);
    }
  };

  // Distinct OUs
  const uniqueOus = Array.from(new Set(computers.map((c) => c.ouPath).filter(Boolean)));

  // Filtered computers
  const filteredComputers = computers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.loggedInUser || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const isOnline = c.status === 'Online' || c.status === 'AgentConnected';
    const isAgent = c.agentStatus === 'Installed' || Boolean(c.agentInstalled);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && isOnline) ||
      (statusFilter === 'agent' && isAgent) ||
      (statusFilter === 'offline' && !isOnline);

    const matchesOu = ouFilter === 'all' || c.ouPath === ouFilter;
    const matchesCustomer = customerFilter === 'all' || c.customerProfileId === customerFilter;

    return matchesSearch && matchesStatus && matchesOu && matchesCustomer;
  });

  const toggleSelectMachine = (id: string) => {
    setSelectedMachineIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMachineIds.length === filteredComputers.length) {
      setSelectedMachineIds([]);
    } else {
      setSelectedMachineIds(filteredComputers.map((c) => c.id));
    }
  };

  // Stats
  const totalCount = computers.length;
  const onlineCount = computers.filter((c) => c.status === 'Online' || c.status === 'AgentConnected').length;
  const agentInstalledCount = computers.filter((c) => c.agentStatus === 'Installed' || Boolean(c.agentInstalled)).length;
  const offlineCount = computers.filter((c) => c.status === 'Offline').length;

  // Live computed scripts so changes to URL, Transport, or Credentials immediately reflect in the PowerShell code blocks
  const liveAgentScripts = buildClientAgentScripts(
    deployAgentTargets,
    deployServerUrl,
    deployTransport,
    deployAdminUser,
    deployAdminPassword
  );

  // PowerShell AD Bridge One-Liner for syncing real AD computers from an internal domain machine
  const adBridgePowerShell = `$ServerUrl = "${window.location.origin}"; $SearchBase = "${targetOu || ''}"; $Searcher = New-Object System.DirectoryServices.DirectorySearcher; if ($SearchBase) { $Searcher.SearchRoot = New-Object System.DirectoryServices.DirectoryEntry("LDAP://$SearchBase") }; $Searcher.Filter = "(objectCategory=computer)"; $Searcher.PageSize = 1000; @("name","dNSHostName","operatingSystem","operatingSystemVersion","distinguishedName","description") | ForEach-Object { [void]$Searcher.PropertiesToLoad.Add($_) }; $Computers = foreach ($r in $Searcher.FindAll()) { $p = $r.Properties; $hn = [string]$p["name"][0]; $dns = if ($p["dnshostname"]) { [string]$p["dnshostname"][0] } else { $hn }; $ip = try { ([System.Net.Dns]::GetHostAddresses($dns) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1).IPAddressToString } catch { $null }; @{ name = $hn; fqdn = $dns; ipAddress = $ip; osName = [string]$p["operatingsystem"][0]; osBuild = [string]$p["operatingsystemversion"][0]; ouPath = ([string]$p["distinguishedname"][0] -replace '^CN=[^,]+,',''); description = [string]$p["description"][0] } }; $Body = @{ computers = @($Computers); domain = $env:USERDNSDOMAIN } | ConvertTo-Json -Depth 5; Invoke-RestMethod -Uri "$ServerUrl/api/ad-computers/bulk-import" -Method Post -ContentType "application/json" -Body $Body`;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Active Directory Computers & Endpoint Inventory
                </h2>
                <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold uppercase bg-blue-950/90 text-blue-300 border border-blue-700/50 rounded-full">
                  LDAP + Live Probe
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Synchronize computers from Active Directory, verify real DNS/TCP/ICMP reachability, and deploy the FDIM Client Agent or software packages.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl shadow-sm">
              <button
                onClick={() => handleSyncAD()}
                disabled={isSyncing}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-l-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Querying LDAP...' : 'LDAP Sync'}</span>
              </button>
              <button
                onClick={() => setIsLdapModalOpen(true)}
                disabled={isSyncing}
                title="Targeted OU / Specific Computer LDAP Discovery"
                className="flex items-center px-2.5 py-2 rounded-r-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border-t border-b border-r border-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => handlePingComputers()}
              disabled={isPinging || computers.length === 0}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 text-emerald-400 ${isPinging ? 'animate-pulse' : ''}`} />
              <span>
                {isPinging
                  ? 'Probing Network...'
                  : selectedMachineIds.length > 0
                  ? `Probe Selected (${selectedMachineIds.length})`
                  : 'Probe All PCs'}
              </span>
            </button>

            <button
              onClick={() => {
                const targets =
                  selectedMachineIds.length > 0
                    ? computers.filter((c) => selectedMachineIds.includes(c.id))
                    : computers;
                handleOpenDeployAgent(targets);
              }}
              disabled={computers.length === 0}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border border-cyan-700/70 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
            >
              <Rocket className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {selectedMachineIds.length > 0
                  ? `Deploy Agent (${selectedMachineIds.length})`
                  : 'Deploy Agent'}
              </span>
            </button>

            <button
              onClick={() => {
                setAddMode('single');
                setIsImportModalOpen(true);
              }}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add / Import PCs</span>
            </button>
          </div>
        </div>

        {/* Status Feedback Banner */}
        {syncFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-950/60 border border-cyan-800/80 text-cyan-200 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{syncFeedback}</span>
            </div>
            <button onClick={() => setSyncFeedback(null)} className="text-cyan-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* LDAP Error + Configure Credentials / PowerShell AD Bridge Banner */}
        {syncError && (
          <div className="mt-4 p-4 rounded-xl bg-amber-950/50 border border-amber-700/80 text-amber-200 text-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300">Active Directory Sync Notice</div>
                  <p className="text-amber-200/90 mt-0.5 leading-relaxed">{syncError}</p>
                  {(syncError.includes('bind') || syncError.includes('DSID-0C090A5A') || syncError.includes('credentials')) && (
                    <p className="text-[11px] text-cyan-300 mt-1 font-medium">
                      Windows Server requires an authenticated domain account (anonymous LDAP searches are forbidden by Active Directory policy). Click "Configure LDAP Credentials" below to supply your domain user and password.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => {
                    setShowLdapCredsSection(true);
                    setIsLdapModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-500 text-[11px] font-semibold cursor-pointer flex items-center space-x-1.5 shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Configure LDAP Credentials</span>
                </button>
                <button
                  onClick={() => setShowAdBridgeHelper(!showAdBridgeHelper)}
                  className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700 text-[11px] font-semibold cursor-pointer"
                >
                  {showAdBridgeHelper ? 'Hide AD Bridge' : 'PowerShell AD Bridge'}
                </button>
                <button onClick={() => setSyncError(null)} className="text-amber-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showAdBridgeHelper && (
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-cyan-300">
                    Run on any domain-joined Windows PC or jump host to push real AD computers to FDIM:
                  </span>
                  <button
                    onClick={() => copyToClipboard(adBridgePowerShell, 'ad-bridge')}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    {copiedKey === 'ad-bridge' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'ad-bridge' ? 'Copied!' : 'Copy PowerShell AD Sync'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-slate-300 bg-slate-900 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-all border border-slate-800">
                  {adBridgePowerShell}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800/90 border-cyan-500/60 shadow-md'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total AD Endpoints</span>
              <Monitor className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{totalCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Across {uniqueOus.length} organizational units</div>
          </button>

          <button
            onClick={() => setStatusFilter('online')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'online'
                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-300">Reachable Online</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1.5">{onlineCount}</div>
            <div className="text-[11px] text-emerald-500/80 mt-0.5">Verified via live TCP/ICMP probe</div>
          </button>

          <button
            onClick={() => setStatusFilter('agent')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'agent'
                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-cyan-300">FDIM Agent Active</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-400 mt-1.5">{agentInstalledCount}</div>
            <div className="text-[11px] text-cyan-500/80 mt-0.5">Background pull agent installed</div>
          </button>

          <button
            onClick={() => setStatusFilter('offline')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              statusFilter === 'offline'
                ? 'bg-amber-950/40 border-amber-500/60 shadow-md'
                : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-300">Offline / Unreachable</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1.5">{offlineCount}</div>
            <div className="text-[11px] text-amber-500/80 mt-0.5">Queue tasks for next boot / agent</div>
          </button>
        </div>
      </div>

      {/* Filter Bar & Bulk Action Sticky Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hostname, IP address, user, or description..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={ouFilter}
              onChange={(e) => setOuFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Organizational Units (OUs)</option>
              {uniqueOus.map((ou) => (
                <option key={ou} value={ou}>
                  {ou.split(',')[0]} ({ou})
                </option>
              ))}
            </select>
          </div>

          {customers.length > 0 && (
            <div className="flex items-center space-x-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Customer Profiles</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.customerCode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedMachineIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-cyan-950/60 border border-cyan-700/60 px-3.5 py-2 rounded-xl">
            <span className="text-xs font-semibold text-cyan-300">
              {selectedMachineIds.length} Selected
            </span>
            <button
              onClick={() =>
                handleOpenDeployAgent(computers.filter((c) => selectedMachineIds.includes(c.id)))
              }
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition-all cursor-pointer"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Deploy Agent to Selected</span>
            </button>
            <button
              onClick={() => setIsBulkDeployModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              <span>Deploy Software</span>
            </button>
            <button
              onClick={() => setSelectedMachineIds([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Computers Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredComputers.length > 0 &&
                      selectedMachineIds.length === filteredComputers.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Workstation / FQDN</th>
                <th className="py-3.5 px-4">Reachability & IP</th>
                <th className="py-3.5 px-4">FDIM Client Agent</th>
                <th className="py-3.5 px-4">OS & Hardware</th>
                <th className="py-3.5 px-4">OU / Profile</th>
                <th className="py-3.5 px-4 text-right">Actions & Agent Deploy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading Active Directory computer inventory...
                  </td>
                </tr>
              ) : filteredComputers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 px-6 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                        <Monitor className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        {computers.length === 0
                          ? 'No Workstations in Inventory Yet'
                          : 'No Computers Match Current Filters'}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {computers.length === 0
                          ? 'Your production workspace starts clean without demo PCs. Click "LDAP Sync" to query your Active Directory Domain Controller, use the PowerShell AD Bridge, or click "Add / Import PCs" to add computers manually.'
                          : 'Try clearing your search query or switching the status/OU filter.'}
                      </p>
                      {computers.length === 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                          <button
                            onClick={() => handleSyncAD()}
                            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Sync with Active Directory</span>
                          </button>
                          <button
                            onClick={() => {
                              setAddMode('single');
                              setIsImportModalOpen(true);
                            }}
                            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add PC Manually</span>
                          </button>
                          <button
                            onClick={() => {
                              setSyncError('Use the PowerShell command below on any domain machine to import your AD computers:');
                              setShowAdBridgeHelper(true);
                            }}
                            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-700/50 text-xs font-semibold cursor-pointer"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>PowerShell AD Bridge</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredComputers.map((comp) => {
                  const isSelected = selectedMachineIds.includes(comp.id);
                  const cust = customers.find((c) => c.id === comp.customerProfileId);
                  const isNewlyDiscovered = newlyDiscoveredIds.includes(comp.id);

                  return (
                    <tr
                      key={comp.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-cyan-950/25'
                          : isNewlyDiscovered
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectMachine(comp.id)}
                          className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              comp.status === 'Online' || comp.status === 'AgentConnected'
                                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80'
                                : 'bg-slate-600'
                            }`}
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleOpenHistory(comp.name)}
                                className="font-mono font-bold text-white hover:text-cyan-400 transition-colors underline decoration-slate-700 hover:decoration-cyan-400 underline-offset-2 cursor-pointer text-left"
                                title="Click to view full workstation lifecycle & audit timeline"
                              >
                                {comp.name}
                              </button>
                              {isNewlyDiscovered && (
                                <span className="px-1.5 py-0.2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[9px] font-mono uppercase rounded font-bold">
                                  NEW
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {comp.fqdn || comp.dnsHostName || comp.name.toLowerCase()}
                            </div>
                            {comp.description && (
                              <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                {comp.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status & IP */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            {comp.status === 'Online' || comp.status === 'AgentConnected' ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Online {comp.pingMs ? `(${comp.pingMs}ms)` : ''}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                <XCircle className="w-3 h-3 text-slate-500" />
                                <span>Offline / Unreachable</span>
                              </span>
                            )}
                            <button
                              onClick={() => handlePingComputers([comp.name])}
                              title="Probe DNS & TCP/ICMP Reachability Now"
                              className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            >
                              <Radio className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-300">
                            <span
                              className={
                                comp.ipAddress && comp.ipAddress.toLowerCase().startsWith('unresolved')
                                  ? 'text-amber-400'
                                  : 'text-slate-300'
                              }
                            >
                              {comp.ipAddress}
                            </span>
                            <button
                              onClick={() => {
                                setEditingComputer(comp);
                                setEditIpValue(
                                  comp.ipAddress && comp.ipAddress.toLowerCase().startsWith('unresolved')
                                    ? ''
                                    : comp.ipAddress
                                );
                                setEditOsValue(comp.osName || comp.operatingSystem || '');
                                setEditDescValue(comp.description || '');
                              }}
                              title="Edit IP Address / Host Details"
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Client Agent Status */}
                      <td className="py-3.5 px-4">
                        {comp.agentStatus === 'Installed' || comp.agentInstalled ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                              <ShieldCheck className="w-3 h-3 text-cyan-400" />
                              <span>v{comp.agentVersion || '2.4.1'} Active</span>
                            </span>
                            <div className="text-[10px] text-slate-500">
                              Heartbeat:{' '}
                              {comp.lastAgentHeartbeat || comp.lastHeartbeat
                                ? new Date(
                                    (comp.lastAgentHeartbeat || comp.lastHeartbeat) as string
                                  ).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Verified'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60">
                              <ShieldAlert className="w-3 h-3 text-amber-400" />
                              <span>Agent Not Installed</span>
                            </span>
                            <div>
                              <button
                                onClick={() => handleOpenDeployAgent([comp])}
                                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 cursor-pointer"
                              >
                                Push / Install Agent →
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* OS & Hardware */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium">
                          {comp.osName || comp.operatingSystem || 'Windows 11 Pro'}{' '}
                          {comp.osBuild && <span className="text-slate-500 text-[10px]">({comp.osBuild})</span>}
                        </div>
                        {comp.hardwareModel && comp.hardwareModel !== 'Unknown' && (
                          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="flex items-center space-x-1">
                              <Cpu className="w-3 h-3 text-slate-500" />
                              <span>{comp.hardwareModel}</span>
                            </span>
                          </div>
                        )}
                        {comp.loggedInUser && (
                          <div className="flex items-center space-x-1 text-[11px] text-cyan-400 mt-0.5">
                            <User className="w-3 h-3" />
                            <span className="font-mono">{comp.loggedInUser}</span>
                          </div>
                        )}
                      </td>

                      {/* OU & Customer */}
                      <td className="py-3.5 px-4">
                        {cust ? (
                          <div className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold text-slate-200">{cust.companyName}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Unassigned Profile</span>
                        )}
                        <div
                          className="text-[10px] font-mono text-slate-500 truncate max-w-[180px] mt-0.5"
                          title={comp.ouPath}
                        >
                          {comp.ouPath}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenDeployAgent([comp])}
                            title="Deploy FDIM Client Agent to this PC"
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1 cursor-pointer ${
                              comp.agentStatus === 'Installed'
                                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shadow-cyan-600/30'
                            }`}
                          >
                            <Rocket className="w-3 h-3" />
                            <span>
                              {comp.agentStatus === 'Installed' ? 'Agent Setup' : 'Deploy Agent'}
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              const fallbackCust: CustomerProfile = cust ||
                                customers[0] || {
                                  id: 'default',
                                  companyName: 'Default Organization',
                                  customerCode: 'CORP',
                                  domainName: comp.domain || 'corp.local',
                                  defaultAdAdminGroup: 'Domain Admins',
                                  uncShareRoot: '',
                                  enableRdp: true,
                                  powerPlanSettings: { screenTimeoutAc: 15, standbyTimeoutAc: 0 },
                                  packageIds: [],
                                };
                              onOpenQuickDeployForMachine(comp.name, fallbackCust);
                            }}
                            title="Quick Software Push to this PC"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-all flex items-center space-x-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3 text-emerald-400" />
                            <span>Push App</span>
                          </button>

                          <button
                            onClick={() =>
                              onSelectMachineForProvisioning(
                                comp.name,
                                comp.customerProfileId || customers[0]?.id || ''
                              )
                            }
                            title="Open in Full Provisioning Wizard"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteComputer(comp)}
                            title="Remove PC from Inventory"
                            className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700/70 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Deploy FDIM Client Agent */}
      {isDeployAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Rocket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Deploy FDIM Client Agent ({deployAgentTargets.length} Workstation
                    {deployAgentTargets.length === 1 ? '' : 's'})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Probe network reachability, queue remote agent push, or copy the PowerShell agent installer
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDeployAgentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Host Badges */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400 mb-2">
                Target Endpoints ({deployAgentTargets.length}):
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {deployAgentTargets.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  >
                    <span>{t.name}</span>
                    <span className="text-[10px] text-slate-400">({t.ipAddress})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Configuration Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  FDIM Server Callback URL
                </label>
                <input
                  type="text"
                  value={deployServerUrl}
                  onChange={(e) => setDeployServerUrl(e.target.value)}
                  placeholder="http://fdim-server:3000"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Remote Deployment Transport
                </label>
                <select
                  value={deployTransport}
                  onChange={(e) => setDeployTransport(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="WinRM">WinRM / PowerShell Remoting (TCP 5985/5986)</option>
                  <option value="SMB">SMB Admin$ Share + Scheduled Task (TCP 445)</option>
                  <option value="WMI">WMI / CIM Process Call (TCP 135)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Domain Admin / Deployment Account (Optional)
                </label>
                <input
                  type="text"
                  value={deployAdminUser}
                  onChange={(e) => setDeployAdminUser(e.target.value)}
                  placeholder="DOMAIN\Administrator"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Admin Password (Optional)
                </label>
                <input
                  type="password"
                  value={deployAdminPassword}
                  onChange={(e) => setDeployAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleExecuteDeployAgent}
                disabled={isDeployingAgent}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <Rocket className="w-4 h-4" />
                <span>
                  {isDeployingAgent
                    ? 'Probing Endpoints & Generating Agent Push...'
                    : 'Probe Endpoints & Deploy Agent'}
                </span>
              </button>

              {deployAgentTargets.length === 1 && (
                <button
                  onClick={() => handleVerifyAgentHeartbeat(deployAgentTargets[0])}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/50 text-xs font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simulate / Verify Heartbeat Now</span>
                </button>
              )}
            </div>

            {/* Deployment Probe & Always-Visible PowerShell Scripts */}
            <div className="space-y-4 pt-3 border-t border-slate-800">
              {deployAgentResult && (
                <>
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/70 text-xs text-cyan-200 font-medium">
                    {deployAgentResult.message}
                  </div>

                  {/* Per-host probe table */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="py-2 px-3">Host</th>
                          <th className="py-2 px-3">Resolved IP</th>
                          <th className="py-2 px-3">Reachability</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                        {(deployAgentResult.results.length > 0
                          ? deployAgentResult.results
                          : deployAgentTargets.map((t) => ({
                              id: t.id,
                              name: t.name,
                              fqdn: t.fqdn || t.dnsHostName || t.name,
                              ipAddress: t.ipAddress || 'Unresolved',
                              reachable: t.status === 'Online' || t.status === 'AgentConnected',
                              pingMs: t.pingMs ?? null,
                              openPort: undefined,
                              status: t.status,
                              detail: 'Ready — Use PowerShell scripts below to install agent',
                            }))
                        ).map((r) => (
                          <tr key={r.id || r.name}>
                            <td className="py-2 px-3 font-mono font-bold text-white">{r.name}</td>
                            <td className="py-2 px-3 font-mono text-slate-300">{r.ipAddress}</td>
                            <td className="py-2 px-3">
                              {r.reachable ? (
                                <span className="text-emerald-400 font-semibold">
                                  Online ({r.pingMs ?? 1}ms{r.openPort ? `, TCP ${r.openPort}` : ''})
                                </span>
                              ) : (
                                <span className="text-amber-400">Unreachable from Server</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-300">{r.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* One-Liner Bootstrapper */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Option A — 1-Line PowerShell Bootstrapper (Run as Administrator on target PC):
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        liveAgentScripts.bootstrapOneLiner || deployAgentResult?.bootstrapOneLiner || '',
                        'bootstrap-cmd'
                      )
                    }
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold cursor-pointer"
                  >
                    {copiedKey === 'bootstrap-cmd' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'bootstrap-cmd' ? 'Copied!' : 'Copy One-Liner'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {liveAgentScripts.bootstrapOneLiner || deployAgentResult?.bootstrapOneLiner}
                </pre>
              </div>

              {/* Remote Push Script */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Option B — Remote Push Script via {deployTransport} (Run from Domain Admin Jump Host):
                  </span>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() =>
                        downloadPs1Script(
                          `Deploy-FDIMAgent-${deployAgentTargets[0]?.name || 'Bulk'}.ps1`,
                          liveAgentScripts.remotePushScript || deployAgentResult?.remotePushScript || ''
                        )
                      }
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Download .ps1</span>
                    </button>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          liveAgentScripts.remotePushScript || deployAgentResult?.remotePushScript || '',
                          'remote-push'
                        )
                      }
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      {copiedKey === 'remote-push' ? (
                        <Check className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'remote-push' ? 'Copied!' : 'Copy Push Script'}</span>
                    </button>
                  </div>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 max-h-56 overflow-y-auto whitespace-pre-wrap select-all">
                  {liveAgentScripts.remotePushScript || deployAgentResult?.remotePushScript}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsDeployAgentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Computer IP & Details */}
      {editingComputer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                Edit Endpoint: <span className="font-mono text-cyan-400">{editingComputer.name}</span>
              </h3>
              <button
                onClick={() => setEditingComputer(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  IPv4 Address (Leave empty to resolve via DNS)
                </label>
                <input
                  type="text"
                  value={editIpValue}
                  onChange={(e) => setEditIpValue(e.target.value)}
                  placeholder="e.g. 192.168.1.50"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Operating System
                </label>
                <input
                  type="text"
                  value={editOsValue}
                  onChange={(e) => setEditOsValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Notes
                </label>
                <input
                  type="text"
                  value={editDescValue}
                  onChange={(e) => setEditDescValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingComputer(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComputerEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? 'Probing & Saving...' : 'Save & Probe Reachability'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Targeted LDAP Discovery & Connection Credentials */}
      {isLdapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Targeted Active Directory LDAP Sync</h3>
              </div>
              <button
                onClick={() => setIsLdapModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Query your Windows Server Domain Controller over LDAPv3 to discover computer accounts, hostnames, and operating systems.
            </p>

            <div className="space-y-3.5">
              {/* Collapsible Connection & Bind Credentials Section */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70">
                <button
                  type="button"
                  onClick={() => setShowLdapCredsSection(!showLdapCredsSection)}
                  className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-200 hover:bg-slate-900/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2 text-cyan-300">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                    <span>Domain Controller & Authenticated Bind Credentials</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                    <span>{showLdapCredsSection ? 'Hide' : 'Configure / Edit'}</span>
                    {showLdapCredsSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {showLdapCredsSection && (
                  <div className="p-3.5 border-t border-slate-800/80 space-y-3 bg-slate-950 text-xs">
                    <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/50 text-[11px] text-blue-200/90 leading-relaxed">
                      <span className="font-semibold text-blue-300">Active Directory Bind Requirement:</span> Windows Server strictly rejects anonymous LDAP searches (DSID-0C090A5A). An authenticated domain account is required.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-mono text-[11px]">LDAP / LDAPS URL:</label>
                        <input
                          type="text"
                          value={ldapServerUrl}
                          onChange={(e) => setLdapServerUrl(e.target.value)}
                          placeholder="ldaps://csdc1.rzhit.win:636"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1 font-mono text-[11px]">Domain (NetBIOS):</label>
                        <input
                          type="text"
                          value={ldapDomain}
                          onChange={(e) => setLdapDomain(e.target.value)}
                          placeholder="RZHIT"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500 uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-mono text-[11px]">Domain Base DN:</label>
                      <input
                        type="text"
                        value={ldapBaseDn}
                        onChange={(e) => setLdapBaseDn(e.target.value)}
                        placeholder="DC=rzhit,DC=win"
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                          Service Account / Bind User:
                        </label>
                        <input
                          type="text"
                          value={ldapBindDn}
                          onChange={(e) => setLdapBindDn(e.target.value)}
                          placeholder="administrator@rzhit.win or RZHIT\administrator"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-400 font-mono text-[11px]">Bind Password:</label>
                          <button
                            type="button"
                            onClick={() => setShowLdapPassword(!showLdapPassword)}
                            className="text-[10px] text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
                          >
                            {showLdapPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showLdapPassword ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showLdapPassword ? 'text' : 'password'}
                          value={ldapBindPassword}
                          onChange={(e) => setLdapBindPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleTestModalLdap}
                        disabled={isTestingModalLdap || !ldapServerUrl}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTestingModalLdap ? 'animate-spin' : ''}`} />
                        <span>{isTestingModalLdap ? 'Testing DC Bind...' : 'Test Connection & Authenticated Bind'}</span>
                      </button>
                    </div>

                    {modalLdapTestResult && (
                      <div
                        className={`p-2.5 rounded-lg text-xs border ${
                          modalLdapTestResult.success
                            ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                            : 'bg-red-950/70 border-red-800 text-red-300'
                        }`}
                      >
                        {modalLdapTestResult.message}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Target OU & Filters */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target OU / Computer Search Base (Optional — leave blank for Base DN)
                </label>
                <input
                  type="text"
                  value={targetOu}
                  onChange={(e) => setTargetOu(e.target.value)}
                  placeholder="OU=Workstations,DC=rzhit,DC=win (or leave blank to search entire domain)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Specific Computer Hostnames (Optional — comma-separated)
                </label>
                <input
                  type="text"
                  value={specificComputerQuery}
                  onChange={(e) => setSpecificComputerQuery(e.target.value)}
                  placeholder="e.g. CSPC01, CSPC02 (Leave blank to sync all computers in OU)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              {customers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign Discovered Computers to Organization Profile
                  </label>
                  <select
                    value={targetCustomerForSync}
                    onChange={(e) => setTargetCustomerForSync(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Unassigned</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.domainName})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsLdapModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const specificNames = specificComputerQuery
                    .split(/[,\s;]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  handleSyncAD({
                    ouPath: targetOu,
                    specificNames: specificNames.length > 0 ? specificNames : undefined,
                    customerId: targetCustomerForSync,
                    ldapUrl: ldapServerUrl,
                    domain: ldapDomain,
                    baseDn: ldapBaseDn,
                    bindDn: ldapBindDn,
                    bindPassword: ldapBindPassword,
                  });
                }}
                disabled={isSyncing}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/25 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Querying Active Directory...' : 'Execute LDAP Query'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Single PC / Bulk Import Computers */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Upload className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Add or Import Workstations</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setAddMode('single')}
                className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  addMode === 'single'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Single Workstation
              </button>
              <button
                onClick={() => setAddMode('bulk')}
                className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  addMode === 'bulk'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bulk Hostname / CSV Import
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Active Directory Domain
                  </label>
                  <input
                    type="text"
                    value={importDomain}
                    onChange={(e) => setImportDomain(e.target.value)}
                    placeholder="e.g. corp.local"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                {customers.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Customer / Company Profile
                    </label>
                    <select
                      value={importCustomer}
                      onChange={(e) => setImportCustomer(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} ({c.customerCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {addMode === 'single' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Computer Hostname *
                      </label>
                      <input
                        type="text"
                        value={singleHostname}
                        onChange={(e) => setSingleHostname(e.target.value)}
                        placeholder="e.g. WS-OFFICE-01"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        IPv4 Address (Optional — DNS Lookup if blank)
                      </label>
                      <input
                        type="text"
                        value={singleIpAddress}
                        onChange={(e) => setSingleIpAddress(e.target.value)}
                        placeholder="e.g. 192.168.10.45"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Operating System
                      </label>
                      <input
                        type="text"
                        value={singleOs}
                        onChange={(e) => setSingleOs(e.target.value)}
                        placeholder="Windows 11 Pro 24H2"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        OU Path
                      </label>
                      <input
                        type="text"
                        value={singleOu}
                        onChange={(e) => setSingleOu(e.target.value)}
                        placeholder="OU=Workstations,DC=corp,DC=local"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Description / Location
                    </label>
                    <input
                      type="text"
                      value={singleDescription}
                      onChange={(e) => setSingleDescription(e.target.value)}
                      placeholder="e.g. Accounting Workstation 2nd Floor"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Workstation List (One per line: <code className="text-cyan-400">HOSTNAME</code> or{' '}
                    <code className="text-cyan-400">HOSTNAME,IP,OS,OU</code>)
                  </label>
                  <textarea
                    rows={5}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`WS-FIN-01,192.168.1.21,Windows 11 Pro\nWS-FIN-02,192.168.1.22,Windows 11 Pro\nWS-HR-01`}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                FDIM performs a real DNS lookup and TCP/ICMP reachability probe when adding workstations. It will never invent fake IP addresses or mark unreachable hosts as Online.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={
                  isImporting ||
                  (addMode === 'single' ? !singleHostname.trim() : !importText.trim())
                }
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50"
              >
                {isImporting ? 'Probing & Adding...' : 'Add & Probe Workstation(s)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Software Deploy */}
      {isBulkDeployModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Layers className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Bulk Software Deployment ({selectedMachineIds.length} Machines)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Online endpoints receive push immediately; offline endpoints are queued for next boot or agent check-in.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkDeployModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {packages.map((pkg) => {
                const isSelected = bulkSelectedPackageIds.includes(pkg.id);
                return (
                  <div
                    key={pkg.id}
                    onClick={() =>
                      setBulkSelectedPackageIds((prev) =>
                        prev.includes(pkg.id)
                          ? prev.filter((id) => id !== pkg.id)
                          : [...prev, pkg.id]
                      )
                    }
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/60'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {pkg.name}{' '}
                          <span className="text-slate-500 font-normal">v{pkg.version}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {pkg.sourceType === 'winget'
                            ? `winget install ${pkg.wingetId}`
                            : `${pkg.uncPath}\\${pkg.fileName}`}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {pkg.category}
                    </span>
                  </div>
                );
              })}
            </div>

            {bulkDeployFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs flex items-center space-x-2">
                <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{bulkDeployFeedback}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                {bulkSelectedPackageIds.length} package(s) selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsBulkDeployModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQueueBulkDeploy}
                  disabled={bulkSelectedPackageIds.length === 0 || isQueueingBulk}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-cyan-600/25 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isQueueingBulk ? 'Queueing...' : 'Deploy / Queue Tasks'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Computer Lifecycle History & Timeline */}
      {historyComputerName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white font-mono">
                      {historyComputerName}
                    </h3>
                    {historyData?.computer && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          historyData.computer.status === 'Online'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {historyData.computer.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Complete Workstation Provisioning History, Software Pushes & Agent Task Log
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryComputerName(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Loading workstation history for {historyComputerName}...
              </div>
            ) : historyData ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {historyData.computer && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">
                        FQDN / IP Address
                      </span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {historyData.computer.fqdn}
                      </span>
                      <span className="block font-mono text-cyan-400 text-[11px]">
                        {historyData.computer.ipAddress}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">
                        Operating System
                      </span>
                      <span className="text-slate-200 font-semibold">
                        {historyData.computer.osName}
                      </span>
                      <span className="block text-slate-400 text-[11px]">
                        Build {historyData.computer.osBuild}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">
                        Hardware & Disk
                      </span>
                      <span className="text-slate-200 font-semibold">
                        {historyData.computer.hardwareModel || 'Standard PC'}
                      </span>
                      <span className="block text-slate-400 text-[11px]">
                        {historyData.computer.ramGb || 16}GB RAM •{' '}
                        {historyData.computer.diskFreeGb || 0}GB Free
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">
                        FDIM Agent Status
                      </span>
                      <span className="text-cyan-400 font-semibold">
                        {historyData.computer.agentStatus}
                      </span>
                      <span className="block text-slate-400 text-[11px]">
                        {historyData.computer.loggedInUser
                          ? `User: ${historyData.computer.loggedInUser}`
                          : 'No active user session'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Total Runs & Tasks</div>
                    <div className="text-xl font-bold text-white mt-0.5">
                      {(historyData.summary?.totalDeployments || 0) +
                        (historyData.summary?.totalTasks || 0)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                    <div className="text-[11px] text-emerald-300">Completed Provisionings</div>
                    <div className="text-xl font-bold text-emerald-400 mt-0.5">
                      {historyData.summary?.completedDeployments || 0}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40">
                    <div className="text-[11px] text-cyan-300">Agent Tasks Executed</div>
                    <div className="text-xl font-bold text-cyan-400 mt-0.5">
                      {historyData.summary?.completedTasks || 0} /{' '}
                      {historyData.summary?.totalTasks || 0}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40">
                    <div className="text-[11px] text-rose-300">Failed / Warnings</div>
                    <div className="text-xl font-bold text-rose-400 mt-0.5">
                      {historyData.summary?.failedDeployments || 0}
                    </div>
                  </div>
                </div>

                {/* History Tabs */}
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                  <button
                    onClick={() => setHistoryTab('timeline')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      historyTab === 'timeline'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    Unified Timeline ({historyData.timeline?.length || 0})
                  </button>
                  <button
                    onClick={() => setHistoryTab('deployments')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      historyTab === 'deployments'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    Provisioning Certificates ({historyData.deployments?.length || 0})
                  </button>
                  <button
                    onClick={() => setHistoryTab('tasks')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      historyTab === 'tasks'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    Queued & Agent Tasks ({historyData.tasks?.length || 0})
                  </button>
                </div>

                {historyTab === 'timeline' && (
                  <div className="space-y-3">
                    {!historyData.timeline || historyData.timeline.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No provisioning or agent events recorded for this workstation yet.
                      </div>
                    ) : (
                      historyData.timeline.map((ev: any) => (
                        <div
                          key={ev.id}
                          className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-4"
                        >
                          <div className="flex items-start space-x-3">
                            <div
                              className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                                ev.status === 'Completed'
                                  ? 'bg-emerald-400'
                                  : ev.status === 'Failed'
                                  ? 'bg-rose-400'
                                  : 'bg-amber-400'
                              }`}
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-white">{ev.title}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                  {ev.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{ev.subtitle}</p>
                              {Array.isArray(ev.packages) && ev.packages.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {ev.packages.map((pkgName: string, i: number) => (
                                    <span
                                      key={i}
                                      className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300"
                                    >
                                      {pkgName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 shrink-0 font-mono">
                            <div>{new Date(ev.timestamp).toLocaleDateString()}</div>
                            <div>
                              {new Date(ev.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            {ev.actor && (
                              <div className="text-[10px] text-slate-400 mt-0.5">by {ev.actor}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {historyTab === 'deployments' && (
                  <div className="space-y-3">
                    {!historyData.deployments || historyData.deployments.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No full provisioning runs recorded for {historyComputerName}.
                      </div>
                    ) : (
                      historyData.deployments.map((dep: any) => (
                        <div
                          key={dep.id}
                          className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white">
                                {dep.customerName} — Full Provisioning
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                {dep.status}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-slate-400">
                              {new Date(dep.timestamp).toLocaleString()} ({dep.durationSeconds}s)
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Domain: <span className="font-mono text-slate-300">{dep.domainName}</span>{' '}
                            • Technician:{' '}
                            <span className="text-slate-300">{dep.technicianName || 'System'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {historyTab === 'tasks' && (
                  <div className="space-y-3">
                    {!historyData.tasks || historyData.tasks.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No queued or agent tasks recorded for {historyComputerName}.
                      </div>
                    ) : (
                      historyData.tasks.map((task: any) => (
                        <div
                          key={task.id}
                          className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white">{task.taskType}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                                {task.status}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-slate-400">
                              Created: {new Date(task.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300">
                            Packages: {(task.packageNames || []).join(', ')}
                          </div>
                          {task.outputLog && (
                            <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                              {task.outputLog}
                            </pre>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs">
                Unable to load history data.
              </div>
            )}

            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Tip: Click "Deploy Agent" to install the FDIM Client Agent or "Push App" for immediate software deployment.
              </span>
              <button
                onClick={() => setHistoryComputerName(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
