import { useState, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Search,
  ArrowRight,
  Filter,
  Check,
} from 'lucide-react';
import { api, type Case, type CurrentUser } from '../lib/api';
import { useToast } from './Toast';

interface FollowUpViewProps {
  cases: Case[];
  currentUser: CurrentUser;
  onRefresh: () => void;
  onOpenCaseDetail: (item: Case) => void;
}

export function FollowUpView({
  cases,
  currentUser,
  onRefresh,
  onOpenCaseDetail,
}: FollowUpViewProps) {
  const { success, error } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewFilter, setViewFilter] = useState<'All' | 'Overdue' | 'Upcoming'>('All');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const activeCasesWithFollowUp = useMemo(() => {
    return cases.filter(
      (c) => c.status !== 'Resolved' && c.status !== 'Closed' && c.nextFollowUpDate
    );
  }, [cases]);

  const { overdueList, upcomingList } = useMemo(() => {
    const overdue: Case[] = [];
    const upcoming: Case[] = [];

    activeCasesWithFollowUp.forEach((c) => {
      if (c.nextFollowUpDate < today) {
        overdue.push(c);
      } else {
        upcoming.push(c);
      }
    });

    // Sort by follow-up date
    overdue.sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate));
    upcoming.sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate));

    return { overdueList: overdue, upcomingList: upcoming };
  }, [activeCasesWithFollowUp, today]);

  const displayedCases = useMemo(() => {
    let list =
      viewFilter === 'Overdue'
        ? overdueList
        : viewFilter === 'Upcoming'
        ? upcomingList
        : [...overdueList, ...upcomingList];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.picName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [viewFilter, overdueList, upcomingList, searchTerm]);

  // Quick postpone / update next follow up
  const handleQuickExtend = async (caseItem: Case, days: number) => {
    setUpdatingId(caseItem.id);
    const targetDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    try {
      await api.updateCase(caseItem.id, {
        nextFollowUpDate: targetDate,
      });
      success('Jadwal Diperbarui', `Follow-up untuk ${caseItem.clientName} dijadwalkan ulang ke ${targetDate}.`);
      onRefresh();
    } catch (err: any) {
      error('Gagal Memperbarui', err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Pusat Pengawasan Follow-up Kasus
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar komitmen tindak lanjut dan penanganan risiko klien yang jatuh tempo
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto text-xs">
          <button
            onClick={() => setViewFilter('All')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewFilter === 'All' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
            }`}
          >
            Semua ({activeCasesWithFollowUp.length})
          </button>
          <button
            onClick={() => setViewFilter('Overdue')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewFilter === 'Overdue'
                ? 'bg-rose-50 text-rose-700 shadow-sm font-semibold'
                : 'text-slate-600'
            }`}
          >
            Terlambat ({overdueList.length})
          </button>
          <button
            onClick={() => setViewFilter('Upcoming')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewFilter === 'Upcoming' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
            }`}
          >
            Mendatang ({upcomingList.length})
          </button>
        </div>
      </div>

      {/* Overdue Alert Banner if any */}
      {overdueList.length > 0 && viewFilter !== 'Upcoming' && (
        <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-rose-900">
                Perhatian: Terdapat {overdueList.length} tindak lanjut yang melewati batas tanggal!
              </p>
              <p className="text-rose-700 mt-0.5">
                Segera lakukan kontak klien atau perbarui status progres penanganan masalah.
              </p>
            </div>
          </div>
          <button
            onClick={() => setViewFilter('Overdue')}
            className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg shrink-0 text-xs hover:bg-rose-500"
          >
            Tampilkan Terlambat
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari klien, judul kasus, atau PIC..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Follow-up Cards */}
      <div className="space-y-3">
        {displayedCases.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl text-xs">
            Tidak ada tindak lanjut aktif pada kategori ini.
          </div>
        ) : (
          displayedCases.map((item) => {
            const isOverdue = item.nextFollowUpDate < today;

            return (
              <div
                key={item.id}
                className={`p-4 bg-white border rounded-xl shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isOverdue ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">{item.id}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-semibold text-amber-700">{item.division}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-bold text-slate-900">{item.clientName}</span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{item.title}</h4>

                  <p className="text-xs text-slate-600 line-clamp-1">
                    <strong>Rencana Tindak Lanjut:</strong> {item.followUpPlan || item.latestProgress || 'Menunggu tindak lanjut staf.'}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>PIC: {item.picName}</span>
                    <span>·</span>
                    <span>Status: {item.status}</span>
                  </div>
                </div>

                {/* Right Date & Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Jatuh Tempo Follow-up
                    </div>
                    <div
                      className={`text-sm font-mono font-bold tabular-nums ${
                        isOverdue ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {item.nextFollowUpDate}
                    </div>
                    {isOverdue && (
                      <span className="text-[10px] font-semibold text-rose-500">
                        Lewat Batas Waktu
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleQuickExtend(item, 7)}
                      disabled={updatingId === item.id}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium transition-colors"
                      title="Perpanjang 7 hari"
                    >
                      +7 Hari
                    </button>
                    <button
                      onClick={() => onOpenCaseDetail(item)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Buka Kasus
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
