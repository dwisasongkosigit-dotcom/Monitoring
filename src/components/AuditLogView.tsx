import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  User,
  Shield,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import { api, type AuditLog, type CurrentUser } from '../lib/api';
import { useToast } from './Toast';

interface AuditLogViewProps {
  currentUser: CurrentUser;
}

export function AuditLogView({ currentUser }: AuditLogViewProps) {
  const { error } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(300);
      setLogs(data);
      setLastRefreshed(
        new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date())
      );
    } catch (err: any) {
      error('Gagal Memuat Audit Log', err.message);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== 'All') {
        if (!log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const mUser = log.userName.toLowerCase().includes(q) || log.userId.toLowerCase().includes(q);
        const mAction = log.action.toLowerCase().includes(q);
        const mTarget = log.target?.toLowerCase().includes(q) || '';
        const mTargetId = log.targetId?.toLowerCase().includes(q) || '';
        const mDetails = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false;
        if (!mUser && !mAction && !mTarget && !mTargetId && !mDetails) return false;
      }
      return true;
    });
  }, [logs, actionFilter, searchTerm]);

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN') || act.includes('AUTH')) return 'bg-sky-100 text-sky-800';
    if (act.includes('CREATE') || act.includes('ADD')) return 'bg-emerald-100 text-emerald-800';
    if (act.includes('UPDATE') || act.includes('EDIT')) return 'bg-amber-100 text-amber-800';
    if (act.includes('RESTORE')) return 'bg-rose-100 text-rose-800';
    if (act.includes('BACKUP')) return 'bg-purple-100 text-purple-800';
    if (act.includes('DELETE')) return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <span>Audit Log Sistem & Rekam Jejak Operasional</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan kronologis aktivitas pengguna, otentikasi, mutasi data, dan penanganan data
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline-block">
              Diperbarui: {lastRefreshed} WIB
            </span>
          )}
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            <span>{loading ? 'Memuat...' : 'Segarkan'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-2.5 items-center text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari user, aksi, target, atau rincian log..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-transparent text-slate-700 font-medium text-xs focus:outline-none"
          >
            <option value="All">Semua Kategori Aksi</option>
            <option value="LOGIN">Autentikasi (LOGIN)</option>
            <option value="CREATE">Pembuatan (CREATE)</option>
            <option value="UPDATE">Pembaruan (UPDATE)</option>
            <option value="RESTORE">Pemulihan (RESTORE)</option>
            <option value="BACKUP">Pencadangan (BACKUP)</option>
            <option value="DELETE">Penghapusan (DELETE)</option>
          </select>
        </div>

        <span className="ml-auto text-slate-400 font-mono tabular-nums text-[11px]">
          {filteredLogs.length} Entri Log Tercatat
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Waktu (WIB)</th>
                <th className="py-3 px-3">Pengguna & Peran</th>
                <th className="py-3 px-3">Tindakan (Action)</th>
                <th className="py-3 px-3">Target / Entitas</th>
                <th className="py-3 px-3">Rincian Perubahan</th>
                <th className="py-3 px-3">Alamat IP</th>
                <th className="py-3 px-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {loading ? 'Memuat log aktivitas sistem...' : 'Tidak ada catatan audit yang cocok dengan filter.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                        <span>{log.userId}</span>
                        <span>·</span>
                        <span className="text-amber-700 font-semibold">{log.userRole}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{log.target || '-'}</div>
                      {log.targetId && (
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                          {log.targetId}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-600">
                      {log.details ? (
                        <span className="font-mono text-[11px] text-slate-500">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {log.ip || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {log.details && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 text-slate-400 hover:text-amber-700 rounded transition-colors"
                          title="Lihat detail lengkap JSON"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rincian Log Audit #{selectedLog.id}</h3>
                <p className="text-[11px] text-slate-500">
                  {formatTimestamp(selectedLog.timestamp)} oleh {selectedLog.userName} ({selectedLog.userRole})
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto leading-relaxed">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
