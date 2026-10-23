import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  Edit,
  Key,
  X,
  Save,
  Search,
} from 'lucide-react';
import { api, type UserAccount, type CurrentUser } from '../lib/api';
import { useToast } from './Toast';

interface UserManagementViewProps {
  currentUser: CurrentUser;
}

export function UserManagementView({ currentUser }: UserManagementViewProps) {
  const { success, error } = useToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<any>('Staff Accounting');
  const [formPassword, setFormPassword] = useState('');
  const [formActive, setFormActive] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      error('Gagal Memuat Pengguna', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenAdd = () => {
    setFormName('');
    setFormUsername('');
    setFormEmail('');
    setFormRole('Staff Accounting');
    setFormPassword('');
    setFormActive(true);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (u: UserAccount) => {
    setSelectedUser(u);
    setFormName(u.name);
    setFormUsername(u.username);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormPassword('');
    setFormActive(u.active);
  };

  const handleSaveNewUser = async () => {
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) {
      error('Validasi Gagal', 'Nama, username, dan password wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await api.createUser({
        name: formName.trim(),
        username: formUsername.trim(),
        role: formRole,
        email: formEmail.trim(),
        password: formPassword,
      });
      success('Pengguna Dibuat', `Akun ${formUsername} berhasil dibuat dengan kata sandi terenkripsi.`);
      setIsAddModalOpen(false);
      loadUsers();
    } catch (err: any) {
      error('Gagal Membuat Akun', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload: any = {
        name: formName.trim(),
        role: formRole,
        email: formEmail.trim(),
        active: formActive,
      };
      if (formPassword.trim()) {
        payload.password = formPassword.trim();
      }

      await api.updateUser(selectedUser.id, payload);
      success('Data Diperbarui', `Akun ${selectedUser.username} berhasil diperbarui.`);
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) {
      error('Gagal Memperbarui', err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Manajemen Pengguna & Otorisasi Hak Akses (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengelolaan akun konsultan, penugasan peran (role), dan status aktif personil
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-end sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* Role explanation alert */}
      <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-700">
        <p className="font-bold text-slate-900">Ketentuan Hak Akses & Pembagian Peran (RBAC):</p>
        <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
          <li><strong>Admin:</strong> Memiliki wewenang menyeluruh, pengaturan branding, manajemen user, dan semua modul.</li>
          <li><strong>SPV Accounting:</strong> Bertanggung jawab atas pengelolaan, review, dan approval pekerjaan Accounting.</li>
          <li><strong>SPV Tax:</strong> Bertanggung jawab atas pengelolaan, review, dan approval pekerjaan Tax.</li>
          <li><strong>Staff Accounting & Staff Tax:</strong> Input progres, mengunggah bukti kerja, dan mengajukan review pekerjaan ke SPV. <em>Staff tidak diizinkan menyetujui pekerjaannya sendiri.</em></li>
        </ul>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari nama personil, username, atau peran..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">Nama Personil & ID</th>
              <th className="py-3 px-3">Username</th>
              <th className="py-3 px-3">Peran (Role)</th>
              <th className="py-3 px-3">Email</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Memuat data pengguna...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Tidak ada pengguna ditemukan.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{u.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700">{u.username}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        u.role === 'Admin'
                          ? 'bg-amber-100 text-amber-900'
                          : u.role.startsWith('SPV')
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{u.email || '-'}</td>
                  <td className="py-3 px-3 text-center">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Aktif</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Nonaktif</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1 text-slate-400 hover:text-amber-700 transition-colors"
                      title="Edit Pengguna"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Tambah Akun Pengguna Baru</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Rian Anggara, SE"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Username</label>
                <input
                  type="text"
                  placeholder="rian_acc"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Peran (Role)</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                >
                  <option value="Admin">Admin</option>
                  <option value="SPV Accounting">SPV Accounting</option>
                  <option value="SPV Tax">SPV Tax</option>
                  <option value="Staff Accounting">Staff Accounting</option>
                  <option value="Staff Tax">Staff Tax</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  placeholder="rian@tmm-bma.id"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Kata Sandi Awal</label>
                <input
                  type="password"
                  placeholder="Minimal 8 karakter..."
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNewUser}
                disabled={saving}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold"
              >
                {saving ? 'Menyimpan...' : 'Simpan Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Pengguna: {selectedUser.username}
              </h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Peran (Role)</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold"
                >
                  <option value="Admin">Admin</option>
                  <option value="SPV Accounting">SPV Accounting</option>
                  <option value="SPV Tax">SPV Tax</option>
                  <option value="Staff Accounting">Staff Accounting</option>
                  <option value="Staff Tax">Staff Tax</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status Keaktifan</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="activeStatus"
                      checked={formActive}
                      onChange={() => setFormActive(true)}
                      className="accent-amber-600"
                    />
                    <span>Aktif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="activeStatus"
                      checked={!formActive}
                      onChange={() => setFormActive(false)}
                      className="accent-rose-600"
                    />
                    <span className="text-rose-600 font-medium">Nonaktifkan Akun</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reset Kata Sandi (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  placeholder="Masukkan kata sandi baru jika ingin mereset..."
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditUser}
                disabled={saving}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold"
              >
                {saving ? 'Menyimpan...' : 'Perbarui Akun'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
