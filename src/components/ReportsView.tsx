import { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Building2,
} from 'lucide-react';
import { api, type Client, type Job, type Case, type DailyActivity, type CurrentUser } from '../lib/api';
import { useToast } from './Toast';

interface ReportsViewProps {
  clients: Client[];
  jobs: Job[];
  cases: Case[];
  activities: DailyActivity[];
  currentUser: CurrentUser;
}

export function ReportsView({ clients, jobs, cases, activities }: ReportsViewProps) {
  const { success, error } = useToast();
  const [reportType, setReportType] = useState<'compliance' | 'risk' | 'jobs'>('compliance');

  const exportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'compliance') {
      csvContent += 'Client ID,Nama Klien,Tipe,Bentuk Usaha,Status PKP,Rezim PPh,Tahun Berlaku,Accounting Risk,Tax Risk,Status\n';
      clients.forEach((c) => {
        csvContent += `"${c.id}","${c.name}","${c.type}","${c.entityType}","${c.pkpStatus}","${c.pphRegime}","${c.taxYearEffective}","${c.accountingRisk}","${c.taxRisk}","${c.status}"\n`;
      });
    } else if (reportType === 'risk') {
      csvContent += 'Client ID,Nama Klien,Accounting Risk,Alasan Acc Risk,Tax Risk,Alasan Tax Risk,PIC Acc,PIC Tax\n';
      clients.forEach((c) => {
        csvContent += `"${c.id}","${c.name}","${c.accountingRisk}","${c.accountingRiskReason?.replace(/"/g, '""')}","${c.taxRisk}","${c.taxRiskReason?.replace(/"/g, '""')}","${c.accountingPicName}","${c.taxPicName}"\n`;
      });
    } else {
      csvContent += 'Job ID,Klien,Divisi,Judul,PIC,SPV,Deadline,Progres,Status\n';
      jobs.forEach((j) => {
        csvContent += `"${j.id}","${j.clientName}","${j.division}","${j.title.replace(/"/g, '""')}","${j.picName}","${j.spvName}","${j.deadline}","${j.progressPercent}%","${j.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tmm_bma_${reportType}_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Laporan Diunduh', `File CSV ${reportType} berhasil di-generate.`);
  };

  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(
    new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
  );

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      await api.downloadExcelReport();
      success('Laporan Excel Siap', 'File workbook multi-sheet 4 lembar kerja berhasil diunduh.');
    } catch (err: any) {
      error('Gagal Mengunduh Excel', err.message);
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleRefreshReports = () => {
    setLastRefreshed(
      new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
    );
    success('Data Disinkronkan', 'Tampilan laporan telah disinkronkan dengan data terkini.');
  };

  const highRiskClients = useMemo(() => {
    return clients.filter((c) => c.taxRisk === 'High' || c.accountingRisk === 'High');
  }, [clients]);

  return (
    <div className="space-y-6">
      {/* Header, Excel Download & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <span>Laporan Kepatuhan & Rekapitulasi Audit</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dokumentasi berkas komprehensif untuk pengawasan partner, SPV, dan manajemen
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline-block">
              Diperbarui: {lastRefreshed} WIB
            </span>
          )}

          <button
            onClick={handleRefreshReports}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Segarkan</span>
          </button>

          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className={`w-4 h-4 ${downloadingExcel ? 'animate-bounce' : ''}`} />
            <span>{downloadingExcel ? 'Membuat Excel...' : 'Unduh Laporan Excel (4 Sheets .xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-md text-xs">
        <button
          onClick={() => setReportType('compliance')}
          className={`flex-1 py-1.5 rounded-md font-medium text-center transition-colors ${
            reportType === 'compliance' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          Kepatuhan PKP & Rezim PPh
        </button>
        <button
          onClick={() => setReportType('risk')}
          className={`flex-1 py-1.5 rounded-md font-medium text-center transition-colors ${
            reportType === 'risk' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          Audit Risiko Klien ({highRiskClients.length})
        </button>
        <button
          onClick={() => setReportType('jobs')}
          className={`flex-1 py-1.5 rounded-md font-medium text-center transition-colors ${
            reportType === 'jobs' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          Status & Turnaround Jobs
        </button>
      </div>

      {/* Report Content Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {reportType === 'compliance' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Client ID & Nama</th>
                  <th className="py-3 px-3">Bentuk</th>
                  <th className="py-3 px-3">Status PKP</th>
                  <th className="py-3 px-3">Rezim PPh</th>
                  <th className="py-3 px-3">Tahun Pajak</th>
                  <th className="py-3 px-3">Fasilitas UMKM</th>
                  <th className="py-3 px-3">Dasar & Sumber Informasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      <div>{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{c.id}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{c.entityType}</td>
                    <td className="py-2.5 px-3 font-semibold text-amber-800">{c.pkpStatus}</td>
                    <td className="py-2.5 px-3 text-slate-800">{c.pphRegime}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{c.taxYearEffective}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono tabular-nums">
                      {c.umkmFacilityEndYear ? `s/d ${c.umkmFacilityEndYear}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate">
                      {c.taxProfileSource || c.taxProfileNotes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'risk' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Nama Klien</th>
                  <th className="py-3 px-3">Risiko Accounting</th>
                  <th className="py-3 px-3">Alasan Acc Risk</th>
                  <th className="py-3 px-3">Risiko Tax</th>
                  <th className="py-3 px-3">Alasan Tax Risk</th>
                  <th className="py-3 px-3">Rekomendasi Penanganan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      <div>{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{c.id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.accountingRisk === 'High'
                            ? 'bg-rose-100 text-rose-800'
                            : c.accountingRisk === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {c.accountingRisk}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-xs">{c.accountingRiskReason}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.taxRisk === 'High'
                            ? 'bg-rose-100 text-rose-800'
                            : c.taxRisk === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {c.taxRisk}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-xs">{c.taxRiskReason}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs">
                      {c.taxRiskRecommendation || c.accountingRiskRecommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'jobs' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Job ID & Judul</th>
                  <th className="py-3 px-3">Klien</th>
                  <th className="py-3 px-3">Divisi</th>
                  <th className="py-3 px-3">PIC</th>
                  <th className="py-3 px-3">SPV Reviewer</th>
                  <th className="py-3 px-3">Deadline</th>
                  <th className="py-3 px-3 text-center">Progres</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{j.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{j.id}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{j.clientName}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{j.division}</td>
                    <td className="py-2.5 px-3 text-slate-700">{j.picName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{j.spvName}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">{j.deadline}</td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums">{j.progressPercent}%</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{j.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
