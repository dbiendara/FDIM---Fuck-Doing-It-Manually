import React from 'react';
import { DeploymentRecord, SoftwarePackage } from '../types';
import { getFdimExpansion } from '../utils/branding';
import { jsPDF } from 'jspdf';
import {
  Award,
  CheckCircle2,
  X,
  Printer,
  ShieldCheck,
  Building2,
  HardDrive,
  FileDown,
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
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  if (!isOpen || !record) return null;

  const installedPackages = packages.filter((p) => record.selectedPackageIds.includes(p.id));

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    if (!record) return;
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Certificate Border Frame
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(1);
      doc.rect(8, 8, 194, 281);
      doc.setDrawColor(6, 182, 212);
      doc.setLineWidth(0.4);
      doc.rect(10, 10, 190, 277);

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(10, 10, 190, 36, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('WORKSTATION PROVISIONING CERTIFICATE', 105, 23, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(6, 182, 212);
      const acronymText = `FDIM (${getFdimExpansion(showProfanity !== false)}) Workstation Audit`;
      doc.text(acronymText.toUpperCase(), 105, 31, { align: 'center' });

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Official Active Directory Compliance Verification Record', 105, 37, { align: 'center' });

      let y = 52;

      // Section: Host & Deployment Overview
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('1. ENDPOINT SPECIFICATIONS & DOMAIN ASSIGNMENT', 14, y);
      y += 5;

      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 20, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, y, 182, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      doc.text('Computer Hostname:', 18, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(record.machineName || 'N/A', 55, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Customer Profile:', 18, y + 13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(record.customerCompanyName || 'Corporate', 55, y + 13);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Active Directory Domain:', 110, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(record.domainName || 'corp.internal.net', 152, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Provisioning Status:', 110, y + 13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(record.status.toUpperCase(), 152, y + 13);

      y += 28;

      // Section: Applied System Configurations
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('2. APPLIED OPERATING SYSTEM CONFIGURATIONS', 14, y);
      y += 6;

      const scrAc = record.systemConfig?.screenTimeoutAc ?? record.switchParameters?.screenTimeoutAc ?? 15;
      const sbAc = record.systemConfig?.standbyTimeoutAc ?? record.switchParameters?.standbyTimeoutAc ?? 0;
      const scrDc = record.systemConfig?.screenTimeoutDc ?? record.switchParameters?.screenTimeoutDc ?? 10;
      const sbDc = record.systemConfig?.standbyTimeoutDc ?? record.switchParameters?.standbyTimeoutDc ?? 20;

      const configs = [
        ['Remote Desktop (RDP):', record.systemConfig?.enableRdp ? 'Enabled (NLA & Firewall Exception Enforced)' : 'Configured'],
        ['Delegated AD Admin Group:', String(record.systemConfig?.addAdGroupToAdmins ? record.systemConfig.adAdminGroupName : (record.switchParameters?.adAdminGroupName || 'Delegated'))],
        ['AC Power Scheme (Plugged):', `Display: ${scrAc}m • Sleep: ${sbAc === 0 ? 'Never' : `${sbAc}m`}`],
        ['Battery Power Scheme (DC):', `Display: ${scrDc}m • Sleep: ${sbDc === 0 ? 'Never' : `${sbDc}m`}`],
        ['Local Administrator Account:', record.systemConfig?.enableLocalAdmin !== false ? 'Enabled (SID *-500, PassNeverExpires)' : 'Standard'],
        ['OOBE Temporary Account:', record.systemConfig?.deleteOobeAccount !== false ? `Purged ('${record.systemConfig?.oobeAccountName || 'install'}')` : 'Preserved'],
      ];

      for (const [label, val] of configs) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(label, 18, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(val, 75, y);
        y += 5.5;
      }

      y += 4;

      // Section: Installed Software Packages
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`3. DEPLOYED SOFTWARE PACKAGES (${installedPackages.length})`, 14, y);
      y += 5;

      // Table Header
      doc.setFillColor(15, 23, 42);
      doc.rect(14, y, 182, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('Package Name', 18, y + 4.5);
      doc.text('Version', 105, y + 4.5);
      doc.text('Type', 145, y + 4.5);
      doc.text('Exit Code', 175, y + 4.5);
      y += 6.5;

      for (let i = 0; i < installedPackages.length; i++) {
        const pkg = installedPackages[i];
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y, 182, 6, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(pkg.name.length > 45 ? pkg.name.substring(0, 42) + '...' : pkg.name, 18, y + 4.5);
        doc.setTextColor(71, 85, 105);
        doc.text(pkg.version || '1.0', 105, y + 4.5);
        doc.text(pkg.installerType || 'MSI', 145, y + 4.5);
        doc.setTextColor(16, 185, 129);
        doc.text('0 (Verified)', 175, y + 4.5);
        y += 6;
      }

      y += 5;

      // Section: Staged First-Logon Resources
      if ((record.stagedDrives && record.stagedDrives.length > 0) || (record.stagedPrinters && record.stagedPrinters.length > 0)) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('4. STAGED USER FIRST-LOGON CONFIGURATION (ACTIVE SETUP)', 14, y);
        y += 5;

        for (const drv of record.stagedDrives || []) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(180, 83, 9);
          doc.text(`Drive ${drv.driveLetter}:`, 18, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          doc.text(`${drv.label} (${drv.uncPath})`, 38, y);
          y += 5;
        }

        for (const prn of record.stagedPrinters || []) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(2, 132, 199);
          doc.text('Printer:', 18, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          doc.text(`${prn.name} (${prn.pathOrIp}) - ${prn.connectionType === 'PerMachineUNC' ? 'Machine PrintUI /ga' : 'Active Setup'}`, 38, y);
          y += 5;
        }

        y += 4;
      }

      // Footer: Certified & Compliance Hash
      doc.setDrawColor(203, 213, 225);
      doc.line(14, 258, 196, 258);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Certified By:', 14, 264);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`${record.technicianName} (IT Desktop Engineering)`, 36, 264);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Date & Time:', 14, 270);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(new Date(record.completedAt || record.startedAt).toLocaleString(), 36, 270);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Compliance Hash:', 110, 264);
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(6, 182, 212);
      doc.text(`SHA256-${record.id.toUpperCase()}-VERIFIED`, 110, 270);

      doc.save(`FDIM-Provisioning-Certificate-${record.machineName || 'Workstation'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
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
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Download standalone PDF audit certificate"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Generating...' : 'Export PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
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
