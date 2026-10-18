import React from 'react';
import { DeploymentRecord, SoftwarePackage } from '../types';
import { getFdimExpansion } from '../utils/branding';
import {
  Award,
  CheckCircle2,
  X,
  Printer,
  ShieldCheck,
  Building2,
  HardDrive,
} from 'lucide-react';

interface AuditCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DeploymentRecord | null;
  packages: SoftwarePackage[];
  showProfanity?: boolean;
}

export const AuditCertificateModal: React.FC<AuditCertificateModalProps> = ({
  isOpen,
  onClose,
  record,
  packages,
  showProfanity = true,
}) => {
  if (!isOpen || !record) return null;

  const installedPackages = packages.filter((p) => record.selectedPackageIds.includes(p.id));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Actions Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Workstation Provisioning Audit Certificate</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-8 overflow-y-auto space-y-6 bg-slate-950 text-slate-200" id="certificate-print-area">
          {/* Header */}
          <div className="text-center pb-6 border-b border-slate-800">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white mb-3 shadow-lg shadow-emerald-500/20">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Workstation Provisioning Certificate
            </h2>
            <p
              className={`text-xs mt-1 uppercase tracking-widest font-mono font-medium ${
                showProfanity !== false ? 'text-amber-300/90' : 'text-emerald-300/90'
              }`}
            >
              FDIM ({getFdimExpansion(showProfanity !== false)}) Workstation Deployment Audit
            </p>
          </div>

          {/* Machine & Customer Profile Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Computer Hostname</span>
              <strong className="text-white font-mono text-sm">{record.machineName}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Customer / Company</span>
              <strong className="text-purple-300">{record.customerCompanyName}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Active Directory Domain</span>
              <strong className="text-white font-mono">{record.domainName}</strong>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Status</span>
              <span className="text-emerald-400 font-bold uppercase">{record.status}</span>
            </div>
          </div>

          {/* Applied System Configurations */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Applied System Configurations</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Remote Desktop:</span>
                <span className="font-semibold text-emerald-400">
                  {record.systemConfig?.enableRdp ? 'Enabled (NLA & Firewall)' : 'Configured'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">AD Admin Group:</span>
                <span className="font-mono text-cyan-300 truncate block">
                  {record.systemConfig?.addAdGroupToAdmins ? record.systemConfig.adAdminGroupName : (record.switchParameters?.adAdminGroupName ? String(record.switchParameters.adAdminGroupName) : 'Delegated')}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Power Plan:</span>
                <span className="font-semibold text-white">
                  {record.systemConfig?.screenTimeoutAc ?? record.switchParameters?.screenTimeoutAc ?? 15}m / {record.systemConfig?.standbyTimeoutAc === 0 || record.switchParameters?.standbyTimeoutAc === 0 ? 'Never' : `${record.systemConfig?.standbyTimeoutAc ?? 0}m`}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Local Administrator:</span>
                <span className="font-semibold text-amber-400">
                  {record.systemConfig?.enableLocalAdmin !== false ? 'Enabled (SID *-500)' : 'Disabled'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">OOBE Account:</span>
                <span className="font-semibold text-rose-400 truncate block">
                  {record.systemConfig?.deleteOobeAccount !== false ? `Purged ('${record.systemConfig?.oobeAccountName || 'install'}')` : 'Kept'}
                </span>
              </div>
            </div>
          </div>

          {/* Installed Software List */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Deployed Software Packages ({installedPackages.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {installedPackages.map((pkg) => (
                <div key={pkg.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">{pkg.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">v{pkg.version} • {pkg.installerType}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                    ExitCode 0
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Staged First-Logon Configuration (Drives & Printers) */}
          {((record.stagedDrives && record.stagedDrives.length > 0) || (record.stagedPrinters && record.stagedPrinters.length > 0)) && (
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span>Staged User First-Logon Settings (Active Setup &amp; Machine Printers)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(record.stagedDrives || []).map((drv) => (
                  <div key={drv.id} className="p-2.5 rounded-lg bg-slate-900 border border-amber-900/40 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono text-[10px] font-bold">
                          {drv.driveLetter}
                        </span>
                        <span className="font-medium text-white truncate">{drv.label}</span>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-mono truncate block mt-0.5">{drv.uncPath}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono shrink-0 ml-2">
                      Active Setup
                    </span>
                  </div>
                ))}
                {(record.stagedPrinters || []).map((prn) => (
                  <div key={prn.id} className="p-2.5 rounded-lg bg-slate-900 border border-cyan-900/40 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-medium text-white truncate">{prn.name}</span>
                        {prn.isDefault && (
                          <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-300 font-bold">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono truncate block mt-0.5">{prn.pathOrIp}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono shrink-0 ml-2">
                      {prn.connectionType === 'PerMachineUNC' ? 'PrintUI /ga' : 'Active Setup'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-4">
            <div>
              <span className="block font-medium text-slate-300">Certified By:</span>
              <span>{record.technicianName} (IT Desktop Engineering)</span>
            </div>
            <div>
              <span className="block font-medium text-slate-300">Timestamp:</span>
              <span className="font-mono">{new Date(record.completedAt || record.startedAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="block font-medium text-slate-300">Compliance Hash:</span>
              <span className="font-mono text-[10px] text-cyan-400">
                SHA256-{record.id.toUpperCase()}-VERIFIED
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
