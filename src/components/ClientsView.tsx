import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  Edit,
  Save,
  Check,
} from 'lucide-react';
import { api, type Client, type CurrentUser, type UserAccount } from '../lib/api';
import { useToast } from './Toast';

interface ClientsViewProps {
  clients: Client[];
  currentUser: CurrentUser;
  onRefresh: () => void;
  isRefreshing?: boolean;
  lastUpdated?: string;
}

export function ClientsView({
  clients,
  currentUser,
  onRefresh,
  isRefreshing = false,
  lastUpdated,
}: ClientsViewProps) {
  const { success, error } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterPkp, setFilterPkp] = useState<string>('All');
  const [filterPph, setFilterPph] = useState<string>('All');
  const [filterRisk, setFilterRisk] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPicStatus, setFilterPicStatus] = useState<string>('All');

  // Modal states
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picChangeNote, setPicChangeNote] = useState('');

  // Form state
  const [formData, setFormData] = useState<Partial<Client>>({});

  const isReadOnly = currentUser.role === 'Owner' || currentUser.role === 'Manager';
  const canEdit = !isReadOnly && (
    currentUser.role === 'Admin' ||
    currentUser.role === 'SPV Accounting' ||
    currentUser.role === 'SPV Tax'
  );

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (filterType !== 'All' && c.type !== filterType) return false;
      if (filterPkp !== 'All' && c.pkpStatus !== filterPkp) return false;
      if (filterPph !== 'All' && c.pphRegime !== filterPph) return false;
      if (filterRisk !== 'All') {
        if (filterRisk === 'High' && c.taxRisk !== 'High' && c.accountingRisk !== 'High') return false;
        if (filterRisk === 'Medium' && c.taxRisk !== 'Medium' && c.accountingRisk !== 'Medium') return false;
        if (filterRisk === 'Low' && c.taxRisk !== 'Low' && c.accountingRisk !== 'Low') return false;
      }
      if (filterStatus !== 'All' && c.status !== filterStatus) return false;
      if (filterPicStatus !== 'All' && c.picAssignmentStatus !== filterPicStatus) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesAccStaff = c.accountingStaffPicName && c.accountingStaffPicName.toLowerCase().includes(q);
        const matchesTaxStaff = c.taxStaffPicName && c.taxStaffPicName.toLowerCase().includes(q);
        const matchesAccSpv = c.accountingSpvName && c.accountingSpvName.toLowerCase().includes(q);
        const matchesTaxSpv = c.taxSpvName && c.taxSpvName.toLowerCase().includes(q);
        const matchesNotes = c.notes && c.notes.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesAccStaff && !matchesTaxStaff && !matchesAccSpv && !matchesTaxSpv && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [clients, searchTerm, filterType, filterPkp, filterPph, filterRisk, filterStatus, filterPicStatus]);

  const handleOpenDetail = (client: Client, edit = false) => {
    setSelectedClient(client);
    setFormData({ ...client });
    setPicChangeNote('');
    setIsEditMode(!isReadOnly && edit);
  };

  const handleOpenAddModal = () => {
    setFormData({
      type: 'Badan',
      entityType: 'PT',
      status: 'Aktif',
      pkpStatus: 'PKP',
      pphRegime: 'PPh Badan Tarif Umum',
      taxYearEffective: new Date().getFullYear(),
      accountingRisk: 'Not Assessed',
      taxRisk: 'Not Assessed',
      accountingStaffPicName: 'Budi Pratama, S.Ak.',
      accountingStaffPicId: 'USR-STF-ACC',
      taxStaffPicName: 'Dewi Lestari, S.Tr.Akt.',
      taxStaffPicId: 'USR-STF-TAX',
      accountingSpvName: 'Hendra Wijaya, SE, Ak., CA',
      accountingSpvId: 'USR-SPV-ACC',
      taxSpvName: 'Ratna Kartika, SE, BKP',
      taxSpvId: 'USR-SPV-TAX',
    });
    setPicChangeNote('');
    setIsAddModalOpen(true);
  };

  // Section 7.A & 7.B: Save and Update handling
  const handleSaveClient = async () => {
    if (!formData.name?.trim()) {
      error('Validasi Gagal', 'Nama klien wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (selectedClient && isEditMode) {
        // Update existing record
        const res = await api.updateClient(selectedClient.id, {
          ...formData,
          expectedVersion: selectedClient.version,
          picChangeNotes: picChangeNote.trim() || undefined,
        });
        success('Berhasil Disimpan', `Perubahan data klien ${formData.name} berhasil disimpan di database.`);
      } else {
        // Create new record
        const res = await api.createClient(formData);
        success('Berhasil Disimpan', `Klien ${formData.name} berhasil ditambahkan dan disimpan di database.`);
      }
      setSelectedClient(null);
      setIsAddModalOpen(false);
      onRefresh();
    } catch (err: any) {
      error('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan ke database server. Data lama Anda tetap utuh.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari ID, nama klien, 4 PIC, atau catatan..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            title="Muat data terbaru dari database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : 'text-slate-600'}`} />
            <span>{isRefreshing ? 'Memuat Data...' : 'Muat Ulang'}</span>
          </button>
          {lastUpdated && (
            <span className="hidden lg:inline-block text-[11px] text-slate-400 font-mono tabular-nums">
              {lastUpdated}
            </span>
          )}

          {canEdit && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Klien</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-facet Filter Row */}
      <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-wrap gap-2.5 items-center text-xs">
        <div className="flex items-center gap-1 text-slate-500 font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filter:</span>
        </div>

        {/* Status Penugasan 4 PIC */}
        <select
          value={filterPicStatus}
          onChange={(e) => setFilterPicStatus(e.target.value)}
          className={`px-2.5 py-1.5 border rounded-md font-semibold focus:outline-none ${
            filterPicStatus === 'Belum Lengkap'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <option value="All">Semua Status PIC</option>
          <option value="Lengkap">PIC Lengkap (4 PIC)</option>
          <option value="Belum Lengkap">PIC Belum Lengkap</option>
        </select>

        {/* Jenis OP / Badan */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none"
        >
          <option value="All">Semua Jenis (OP/Badan)</option>
          <option value="Badan">Badan Usaha</option>
          <option value="OP">Orang Pribadi (OP)</option>
        </select>

        {/* Status PKP */}
        <select
          value={filterPkp}
          onChange={(e) => setFilterPkp(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none"
        >
          <option value="All">Semua Status PKP</option>
          <option value="PKP">PKP</option>
          <option value="Non-PKP">Non-PKP</option>
          <option value="Belum Diisi">Belum Diisi</option>
        </select>

        {/* Rezim PPh */}
        <select
          value={filterPph}
          onChange={(e) => setFilterPph(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none"
        >
          <option value="All">Semua Rezim PPh</option>
          <option value="PPh Final UMKM">PPh Final UMKM (PP 55)</option>
          <option value="PPh Badan Tarif Umum">PPh Badan Tarif Umum</option>
          <option value="PPh OP Tarif Umum">PPh OP Tarif Umum</option>
          <option value="PPh Final Lainnya">PPh Final Lainnya</option>
        </select>

        {/* Tingkat Risiko */}
        <select
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none"
        >
          <option value="All">Semua Risiko</option>
          <option value="High">Risiko Tinggi (High)</option>
          <option value="Medium">Risiko Sedang (Medium)</option>
          <option value="Low">Risiko Rendah (Low)</option>
        </select>

        <span className="ml-auto text-slate-400 font-mono tabular-nums text-[11px]">
          Menampilkan {filteredClients.length} dari {clients.length} klien
        </span>
      </div>

      {/* Clients Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Client ID & Nama</th>
                <th className="py-3 px-3">Bentuk & Profil</th>
                <th className="py-3 px-3">Status PKP</th>
                <th className="py-3 px-3">Rezim PPh</th>
                <th className="py-3 px-3">Penugasan 4 PIC Klien</th>
                <th className="py-3 px-3 text-center">Status PIC</th>
                <th className="py-3 px-3 text-center">Risiko Acc / Tax</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada klien yang sesuai dengan kriteria filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isPicComplete = client.picAssignmentStatus === 'Lengkap';

                  return (
                    <tr
                      key={client.id}
                      onClick={() => handleOpenDetail(client, false)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* ID & Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                          {client.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                          {client.id} · {client.status}
                        </div>
                      </td>

                      {/* Bentuk & Profil */}
                      <td className="py-3 px-3">
                        <div className="text-slate-700 font-medium">
                          {client.type === 'OP' ? 'Orang Pribadi' : client.entityType}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tahun {client.taxYearEffective}
                        </div>
                      </td>

                      {/* Status PKP */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block font-medium ${
                            client.pkpStatus === 'PKP'
                              ? 'text-amber-700 font-semibold'
                              : client.pkpStatus === 'Non-PKP'
                              ? 'text-slate-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {client.pkpStatus}
                        </span>
                      </td>

                      {/* Rezim PPh */}
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-medium max-w-[160px] truncate" title={client.pphRegime}>
                          {client.pphRegime}
                        </div>
                        {client.umkmFacilityEndYear && (
                          <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                            Fasilitas s/d {client.umkmFacilityEndYear}
                          </div>
                        )}
                      </td>

                      {/* 4 PIC Assignments Detail */}
                      <td className="py-3 px-3 text-[11px] space-y-0.5 max-w-[210px]">
                        <div className="truncate text-slate-800">
                          <span className="font-semibold text-slate-500">Staf Acc:</span> {client.accountingStaffPicName || '-'}
                        </div>
                        <div className="truncate text-slate-800">
                          <span className="font-semibold text-slate-500">Staf Tax:</span> {client.taxStaffPicName || '-'}
                        </div>
                        <div className="truncate text-slate-500 text-[10px]">
                          <span>SPV: {client.accountingSpvName?.split(',')[0]} (Acc) · {client.taxSpvName?.split(',')[0]} (Tax)</span>
                        </div>
                      </td>

                      {/* Status PIC Badge (Prompt 2 requirement) */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isPicComplete
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {isPicComplete ? 'PIC Lengkap' : 'Pembagian PIC Belum Lengkap'}
                        </span>
                      </td>

                      {/* Risk Scores */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              client.accountingRisk === 'High' ? 'text-rose-700 bg-rose-50' : 'text-slate-600'
                            }`}
                          >
                            A: {client.accountingRisk}
                          </span>
                          <span>·</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              client.taxRisk === 'High' ? 'text-rose-700 bg-rose-50' : 'text-slate-600'
                            }`}
                          >
                            T: {client.taxRisk}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <button
                            onClick={() => handleOpenDetail(client, true)}
                            className="p-1 text-slate-400 hover:text-amber-700 transition-colors"
                            title="Edit Data Klien & PIC"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Edit Drawer Modal */}
      {(selectedClient || isAddModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isAddModalOpen
                    ? 'Tambah Klien Baru'
                    : isEditMode
                    ? `Edit Klien: ${selectedClient?.name}`
                    : `Detail Klien: ${selectedClient?.name}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedClient ? `${selectedClient.id} · Versi Data: v${selectedClient.version}` : 'Input master data konsultan'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedClient && !isEditMode && canEdit && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Data & PIC</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setIsAddModalOpen(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Basic Client Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                  1. Informasi Identitas Klien
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Nama Klien / Perusahaan</label>
                    <input
                      type="text"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Jenis Klien</label>
                    <select
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.type || 'Badan'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as any,
                          entityType: e.target.value === 'OP' ? '-' : 'PT',
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
                    >
                      <option value="Badan">Badan Usaha</option>
                      <option value="OP">Orang Pribadi (OP)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Bentuk Badan Usaha</label>
                    <select
                      disabled={!isEditMode && !isAddModalOpen || formData.type === 'OP'}
                      value={formData.entityType || '-'}
                      onChange={(e) => setFormData({ ...formData, entityType: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
                    >
                      <option value="-">- (Khusus OP)</option>
                      <option value="PT">PT (Perseroan Terbatas)</option>
                      <option value="CV">CV (Commanditaire Vennootschap)</option>
                      <option value="Firma">Firma</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NPWP 16 Digit</label>
                    <input
                      type="text"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.npwp || ''}
                      onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                      placeholder="00.000.000.0-000.000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Status Klien</label>
                    <select
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.status || 'Aktif'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Tidak Aktif">Tidak Aktif</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* PEMBAGIAN 4 PIC KLIEN (Section 3 Prompt 2) */}
              <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>2. Pembagian 4 PIC Klien Wajib</span>
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      formData.picAssignmentStatus === 'Lengkap'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    Status: {formData.picAssignmentStatus || 'Belum Lengkap'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      1. Staff Accounting PIC
                    </label>
                    <input
                      type="text"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.accountingStaffPicName || ''}
                      onChange={(e) => setFormData({ ...formData, accountingStaffPicName: e.target.value })}
                      placeholder="Nama Staf Accounting..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      2. Staff Tax PIC
                    </label>
                    <input
                      type="text"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.taxStaffPicName || ''}
                      onChange={(e) => setFormData({ ...formData, taxStaffPicName: e.target.value })}
                      placeholder="Nama Staf Tax..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      3. SPV Accounting Reviewer
                    </label>
                    <input
                      type="text"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.accountingSpvName || ''}
                      onChange={(e) => setFormData({ ...formData, accountingSpvName: e.target.value })}
                      placeholder="Nama SPV Accounting..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      4. SPV Tax Reviewer
                    </label>
                    <input
                      type="text"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.taxSpvName || ''}
                      onChange={(e) => setFormData({ ...formData, taxSpvName: e.target.value })}
                      placeholder="Nama SPV Tax..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* PIC change note if editing */}
                {isEditMode && (
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Catatan Perubahan PIC (Opsional untuk riwayat audit):
                    </label>
                    <input
                      type="text"
                      value={picChangeNote}
                      onChange={(e) => setPicChangeNote(e.target.value)}
                      placeholder="Alasan pergantian atau penugasan PIC baru..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
                    />
                  </div>
                )}

                {/* Riwayat Penugasan PIC */}
                {selectedClient?.picHistory && selectedClient.picHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                      Riwayat Perubahan Penugasan PIC:
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {selectedClient.picHistory.map((h) => (
                        <div key={h.id} className="p-2 bg-white border border-slate-200 rounded text-[10px]">
                          <div className="flex justify-between text-slate-400 mb-0.5">
                            <span>Oleh: {h.changedBy}</span>
                            <span className="font-mono">{h.timestamp?.split('T')[0]}</span>
                          </div>
                          <p className="text-slate-700 font-medium">
                            Acc: {h.accountingStaff} (SPV: {h.accountingSpv}) | Tax: {h.taxStaff} (SPV: {h.taxSpv})
                          </p>
                          {h.notes && <p className="text-slate-500 italic mt-0.5">{h.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tax Profile Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                  3. Profil Perpajakan (PKP & Rezim PPh Terpisah)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Status PKP</label>
                    <select
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.pkpStatus || 'Belum Diisi'}
                      onChange={(e) => setFormData({ ...formData, pkpStatus: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold disabled:bg-slate-100"
                    >
                      <option value="PKP">PKP (Pengusaha Kena Pajak)</option>
                      <option value="Non-PKP">Non-PKP</option>
                      <option value="Belum Diisi">Belum Diisi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Rezim PPh</label>
                    <select
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.pphRegime || 'Belum Ditentukan'}
                      onChange={(e) => setFormData({ ...formData, pphRegime: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold disabled:bg-slate-100"
                    >
                      <option value="PPh Final UMKM">PPh Final UMKM (PP 55/2022)</option>
                      <option value="PPh Badan Tarif Umum">PPh Badan Tarif Umum</option>
                      <option value="PPh OP Tarif Umum">PPh OP Tarif Umum</option>
                      <option value="PPh Final Lainnya">PPh Final Lainnya</option>
                      <option value="Belum Ditentukan">Belum Ditentukan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tahun Pajak Berlaku</label>
                    <input
                      type="number"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.taxYearEffective || 2026}
                      onChange={(e) => setFormData({ ...formData, taxYearEffective: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tahun Akhir Fasilitas UMKM</label>
                    <input
                      type="number"
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.umkmFacilityEndYear || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          umkmFacilityEndYear: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Contoh: 2026"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100 font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Catatan & Sumber Data Pajak</label>
                    <textarea
                      rows={2}
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.taxProfileNotes || ''}
                      onChange={(e) => setFormData({ ...formData, taxProfileNotes: e.target.value })}
                      placeholder="Dasar data penetapan rezim..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Separate Risk Assessment */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                  4. Penilaian Risiko Accounting & Tax (Terpisah)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Accounting Risk */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <label className="block text-slate-700 font-bold">Tingkat Risiko Accounting</label>
                    <select
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.accountingRisk || 'Not Assessed'}
                      onChange={(e) => setFormData({ ...formData, accountingRisk: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-900 font-semibold"
                    >
                      <option value="Not Assessed">Not Assessed</option>
                      <option value="Low">Low (Rendah)</option>
                      <option value="Medium">Medium (Sedang)</option>
                      <option value="High">High (Tinggi)</option>
                    </select>
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Alasan Risiko Accounting:</span>
                      <textarea
                        rows={2}
                        disabled={!isEditMode && !isAddModalOpen}
                        value={formData.accountingRiskReason || ''}
                        onChange={(e) => setFormData({ ...formData, accountingRiskReason: e.target.value })}
                        className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded text-[11px]"
                      />
                    </div>
                  </div>

                  {/* Tax Risk */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <label className="block text-slate-700 font-bold">Tingkat Risiko Tax</label>
                    <select
                      disabled={!isEditMode && !isAddModalOpen}
                      value={formData.taxRisk || 'Not Assessed'}
                      onChange={(e) => setFormData({ ...formData, taxRisk: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-900 font-semibold"
                    >
                      <option value="Not Assessed">Not Assessed</option>
                      <option value="Low">Low (Rendah)</option>
                      <option value="Medium">Medium (Sedang)</option>
                      <option value="High">High (Tinggi)</option>
                    </select>
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Alasan Risiko Tax:</span>
                      <textarea
                        rows={2}
                        disabled={!isEditMode && !isAddModalOpen}
                        value={formData.taxRiskReason || ''}
                        onChange={(e) => setFormData({ ...formData, taxRiskReason: e.target.value })}
                        className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Risk History Timeline */}
                {selectedClient?.riskHistory && selectedClient.riskHistory.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
                      <History className="w-3.5 h-3.5 text-amber-600" />
                      <span>Riwayat Perubahan Penilaian Risiko:</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {selectedClient.riskHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px]"
                        >
                          <div className="flex justify-between items-center text-slate-500 mb-1">
                            <span className="font-semibold text-slate-800">
                              {item.division}: {item.previousLevel} → {item.newLevel}
                            </span>
                            <span className="font-mono tabular-nums">{item.date}</span>
                          </div>
                          <p className="text-slate-600">{item.reason}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Penilai: {item.assessedBy}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer with Save / Update Button (Section 7.A & 7.B) */}
            {(isEditMode || isAddModalOpen) && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setIsAddModalOpen(false);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveClient}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-semibold text-xs disabled:opacity-50 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {saving
                      ? 'Menyimpan ke Database...'
                      : isEditMode
                      ? 'Simpan Perubahan (Update)'
                      : 'Simpan Klien Baru (Save)'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
