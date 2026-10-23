import { useState } from 'react';
import {
  Building2,
  Briefcase,
  AlertCircle,
  Clock,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { CurrentUser } from '../lib/api';

interface DashboardViewProps {
  stats: any;
  currentUser: CurrentUser;
  onNavigateTab: (tab: any) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  lastUpdated?: string;
}

export function DashboardView({
  stats,
  currentUser,
  onNavigateTab,
  onRefresh,
  isRefreshing = false,
  lastUpdated,
}: DashboardViewProps) {
  const [divisionFilter, setDivisionFilter] = useState<'All' | 'Accounting' | 'Tax'>('All');

  if (!stats) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
        <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Memuat metrik aktual dashboard...</p>
      </div>
    );
  }

  const { clients, jobs, cases, activities, workload } = stats;
  const isReadOnly = currentUser.role === 'Owner' || currentUser.role === 'Manager';

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Ringkasan Kendali Operasional
            </h2>
            {isReadOnly && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Mode Akses: Read-Only
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Data aktual dari basis 50 klien TMM/BMA. Pengguna:{' '}
            <span className="font-semibold text-slate-700">{currentUser.name}</span> ({currentUser.role})
          </p>
        </div>

        {/* Division Filter & Explicit Refresh Button */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Division Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setDivisionFilter('All')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                divisionFilter === 'All'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Divisi
            </button>
            <button
              onClick={() => setDivisionFilter('Accounting')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                divisionFilter === 'Accounting'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Accounting
            </button>
            <button
              onClick={() => setDivisionFilter('Tax')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                divisionFilter === 'Tax'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax
            </button>
          </div>

          {/* Refresh Button with Last Updated Timestamp */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              title="Perbarui tampilan data terbaru dari database persisten"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : 'text-slate-600'}`} />
              <span>{isRefreshing ? 'Memuat Data...' : 'Muat Ulang'}</span>
            </button>
            {lastUpdated && (
              <span className="hidden md:inline-block text-[11px] text-slate-400 font-mono tabular-nums">
                {lastUpdated}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Incomplete PIC Alert Banner (Prompt 2 requirement) */}
      {clients.incompletePicCount > 0 && (
        <div
          onClick={() => onNavigateTab('clients')}
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-100/60 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Perhatian Penugasan:</strong> Terdapat{' '}
              <span className="font-bold underline">{clients.incompletePicCount} klien</span> dengan status{' '}
              <span className="font-semibold text-rose-700">"Pembagian PIC Belum Lengkap"</span> (wajib memiliki 4 PIC: 1 Staf Acc, 1 Staf Tax, 1 SPV Acc, 1 SPV Tax).
            </span>
          </div>
          <span className="font-semibold text-amber-800 text-[11px] shrink-0 underline">
            Lengkapi Penugasan PIC →
          </span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Klien Aktif */}
        <div
          onClick={() => onNavigateTab('clients')}
          className="p-5 bg-white border border-slate-200/90 rounded-xl hover:border-slate-300 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Basis Klien Aktif</span>
            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {clients.active}
            </span>
            <span className="text-xs text-slate-500">/ {clients.total} Terdaftar</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Badan: <strong className="text-slate-800 font-mono tabular-nums">{clients.badan}</strong></span>
            <span>·</span>
            <span>OP: <strong className="text-slate-800 font-mono tabular-nums">{clients.op}</strong></span>
            <span>·</span>
            <span>PKP: <strong className="text-slate-800 font-mono tabular-nums">{clients.pkp}</strong></span>
          </div>
        </div>

        {/* Pekerjaan Aktif & Review */}
        <div
          onClick={() => onNavigateTab('jobs')}
          className="p-5 bg-white border border-slate-200/90 rounded-xl hover:border-slate-300 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Pekerjaan Siap Review SPV</span>
            <Briefcase className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600 font-mono tabular-nums">
              {jobs.readyForReview}
            </span>
            <span className="text-xs text-slate-500">Menunggu Approval</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Proses: <strong className="text-slate-800 font-mono tabular-nums">{jobs.inProgress}</strong></span>
            <span>·</span>
            <span>Revisi: <strong className="text-rose-600 font-mono tabular-nums">{jobs.needsRevision}</strong></span>
            <span>·</span>
            <span>Selesai: <strong className="text-emerald-600 font-mono tabular-nums">{jobs.completed}</strong></span>
          </div>
        </div>

        {/* Overdue Jobs Alert */}
        <div
          onClick={() => onNavigateTab('jobs')}
          className={`p-5 rounded-xl border transition-all cursor-pointer shadow-sm group ${
            jobs.overdue > 0
              ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pekerjaan Jatuh Tempo</span>
            <Clock className={`w-4 h-4 ${jobs.overdue > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold font-mono tabular-nums ${jobs.overdue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {jobs.overdue}
            </span>
            <span className="text-xs text-slate-500">Terlambat</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Follow-up lewat batas:</span>
            <strong className="text-rose-600 font-mono tabular-nums">{cases.overdueFollowUps}</strong>
          </div>
        </div>

        {/* Eksposur Kasus & Risiko */}
        <div
          onClick={() => onNavigateTab('cases')}
          className="p-5 bg-white border border-slate-200/90 rounded-xl hover:border-slate-300 transition-all cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Kasus Terbuka & Risiko</span>
            <ShieldAlert className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {cases.open}
            </span>
            <span className="text-xs text-slate-500">Kasus Terbuka</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>High Tax: <strong className="text-amber-700 font-mono tabular-nums">{clients.taxRisks.High}</strong></span>
            <span>·</span>
            <span>High Acc: <strong className="text-amber-700 font-mono tabular-nums">{clients.accRisks.High}</strong></span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Compliance Distribution & Separate Risk Matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance & Tax Profile Matrix */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Distribusi Rezim Pajak & Kepatuhan PKP
            </h3>
            <span className="text-xs text-slate-400 font-mono tabular-nums">Total {clients.active} Klien</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Status PKP ({clients.pkp} PKP · {clients.nonPkp} Non-PKP)</span>
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {Math.round((clients.pkp / (clients.active || 1)) * 100)}% PKP
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  className="bg-amber-600 h-full"
                  style={{ width: `${(clients.pkp / (clients.active || 1)) * 100}%` }}
                />
                <div
                  className="bg-slate-300 h-full"
                  style={{ width: `${(clients.nonPkp / (clients.active || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs font-semibold text-slate-700 mb-2">Rezim PPh Klien:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(clients.pphRegimes || {}).map(([regime, count]: [string, any]) => (
                  <div key={regime} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 truncate">{regime}</div>
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {count} <span className="text-[10px] text-slate-400 font-normal">klien</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Accounting & Tax Risk Breakdown */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Matriks Penilaian Risiko Terpisah
            </h3>
            <span className="text-xs text-slate-400 font-medium">Accounting vs Tax</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Accounting Risk Box */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-800 mb-2.5">Risiko Accounting</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Tinggi (High)</span>
                  <span className="font-mono tabular-nums font-bold text-rose-600">{clients.accRisks.High}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Sedang (Medium)</span>
                  <span className="font-mono tabular-nums font-bold text-amber-600">{clients.accRisks.Medium}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600">Rendah (Low)</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600">{clients.accRisks.Low}</span>
                </div>
              </div>
            </div>

            {/* Tax Risk Box */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-800 mb-2.5">Risiko Tax</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Tinggi (High)</span>
                  <span className="font-mono tabular-nums font-bold text-rose-600">{clients.taxRisks.High}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Sedang (Medium)</span>
                  <span className="font-mono tabular-nums font-bold text-amber-600">{clients.taxRisks.Medium}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600">Rendah (Low)</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600">{clients.taxRisks.Low}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 leading-relaxed">
            <strong>Catatan Kepatuhan:</strong> Penilaian risiko perpajakan dan akuntansi dievaluasi independen oleh masing-masing SPV berdasarkan riwayat equalisasi dan keabsahan dokumen transaksi.
          </div>
        </div>
      </div>

      {/* Workload per PIC and Division */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Beban Kerja Tim (Workload per PIC)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribusi tugas aktif, pekerjaan siap review, dan mitigasi keterlambatan per personil
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 px-3 font-semibold">Nama PIC</th>
                <th className="py-2.5 px-3 font-semibold text-center">Pekerjaan Berjalan</th>
                <th className="py-2.5 px-3 font-semibold text-center">Siap Review SPV</th>
                <th className="py-2.5 px-3 font-semibold text-center">Terlambat</th>
                <th className="py-2.5 px-3 font-semibold text-right">Status Beban</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workload.map((w: any) => (
                <tr key={w.name} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-900">{w.name}</td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-700">
                    {w.activeJobs}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                    {w.readyReview > 0 ? (
                      <span className="font-semibold text-amber-600">{w.readyReview}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                    {w.overdue > 0 ? (
                      <span className="font-bold text-rose-600">{w.overdue}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        w.activeJobs > 4
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {w.activeJobs > 4 ? 'Kapasitas Penuh' : 'Optimal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
