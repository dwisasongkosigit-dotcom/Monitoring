import { Router } from 'express';
import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs';
import {
  getDb,
  mutateDb,
  getDbHealthInfo,
  createBackupSnapshot,
  restoreFromSnapshot,
  logAudit,
} from './db.ts';
import {
  authenticateToken,
  requireRole,
  requireWritable,
  createSession,
  destroySession,
  verifyPassword,
  hashPassword,
  type AuthenticatedRequest,
} from './auth.ts';
import type {
  Client,
  Job,
  Case,
  DailyActivity,
  User,
  JobStatus,
  RiskLevel,
  RiskHistoryItem,
  PicHistoryItem,
} from './types.ts';

export const apiRouter = Router();

// ==========================================
// 1. HEALTH & PERSISTENCE VERIFICATION
// ==========================================
apiRouter.get('/health', (req: Request, res: Response) => {
  try {
    const health = getDbHealthInfo();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ==========================================
// 2. AUTHENTICATION (Login, Me, Change Password, Logout)
// ==========================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
    return;
  }

  const db = getDb();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );

  if (!user) {
    res.status(401).json({ error: 'Username atau kata sandi tidak cocok.' });
    return;
  }

  if (!user.active) {
    res.status(403).json({ error: 'Akun ini telah dinonaktifkan oleh Admin. Hubungi administrator.' });
    return;
  }

  const isValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) {
    res.status(401).json({ error: 'Username atau kata sandi tidak cocok.' });
    return;
  }

  const session = createSession(user);

  logAudit(
    'USER_LOGIN',
    'Auth',
    `Pengguna ${user.name} (${user.role}) berhasil masuk ke sistem.`,
    { userId: user.id, name: user.name, role: user.role }
  );

  res.json({
    token: session.token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      email: user.email,
      mustChangePassword: user.mustChangePassword || false,
    },
    branding: db.branding,
  });
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Tidak terautentikasi' });
    return;
  }
  const db = getDb();
  const user = db.users.find((u) => u.id === req.user?.userId);
  if (!user || !user.active) {
    res.status(401).json({ error: 'Pengguna tidak ditemukan atau dinonaktifkan.' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      email: user.email,
      mustChangePassword: user.mustChangePassword || false,
    },
    branding: db.branding,
  });
});

apiRouter.post('/auth/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Kata sandi saat ini dan kata sandi baru wajib diisi.' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
    return;
  }

  const currentUser = req.user!;
  mutateDb((database) => {
    const user = database.users.find((u) => u.id === currentUser.userId);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const isValid = verifyPassword(currentPassword, user.passwordHash, user.salt);
    if (!isValid) throw new Error('Kata sandi saat ini tidak cocok.');

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();

    logAudit(
      'PASSWORD_CHANGED',
      'Auth',
      `Kata sandi diperbarui oleh ${user.name}.`,
      { userId: user.id, name: user.name, role: user.role }
    );
  });

  res.json({ success: true, message: 'Kata sandi berhasil diperbarui.' });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.headers['x-session-token'] as string | undefined);
  if (token) {
    destroySession(token);
  }
  res.json({ success: true, message: 'Berhasil keluar.' });
});

// ==========================================
// 3. BRANDING SETTINGS (Admin Only)
// ==========================================
apiRouter.get('/branding', (req: Request, res: Response) => {
  const db = getDb();
  res.json(db.branding);
});

apiRouter.put(
  '/branding',
  authenticateToken,
  requireRole('Admin'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { appName, companyName, subtitle, logoUrl, faviconUrl, resetToDefault } = req.body;
    const currentUser = req.user!;

    mutateDb((db) => {
      if (resetToDefault) {
        db.branding = {
          appName: 'TMM/BMA Client Control Center',
          companyName: 'TMM & BMA Advisory',
          subtitle: 'Tax & Accounting Client Control Center',
          logoUrl: '/src/assets/images/tmm_bma_logo_1792761458459.jpg',
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.name,
        };
      } else {
        if (appName !== undefined) db.branding.appName = String(appName).trim();
        if (companyName !== undefined) db.branding.companyName = String(companyName).trim();
        if (subtitle !== undefined) db.branding.subtitle = String(subtitle).trim();
        if (logoUrl !== undefined) {
          if (typeof logoUrl === 'string' && logoUrl.startsWith('data:')) {
            const isImage = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/.test(logoUrl);
            if (!isImage) {
              throw new Error('Format file logo tidak valid. Harap gunakan file PNG, JPG, WebP, atau SVG.');
            }
          }
          db.branding.logoUrl = logoUrl;
        }
        if (faviconUrl !== undefined) db.branding.faviconUrl = faviconUrl;
        db.branding.updatedAt = new Date().toISOString();
        db.branding.updatedBy = currentUser.name;
      }

      logAudit(
        'BRANDING_UPDATED',
        'Branding',
        resetToDefault ? 'Branding dikembalikan ke default.' : 'Konfigurasi judul dan logo diperbarui.',
        { userId: currentUser.userId, name: currentUser.name, role: currentUser.role }
      );
    });

    const updated = getDb().branding;
    res.json({ success: true, branding: updated, message: 'Pengaturan branding berhasil disimpan secara persisten.' });
  }
);

// ==========================================
// 4. USER MANAGEMENT (Admin Only)
// ==========================================
apiRouter.get(
  '/users',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const sanitized = db.users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      email: u.email,
      active: u.active,
      mustChangePassword: u.mustChangePassword || false,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
    res.json(sanitized);
  }
);

apiRouter.post(
  '/users',
  authenticateToken,
  requireRole('Admin'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { name, username, role, email, password, mustChangePassword } = req.body;
    if (!name || !username || !role || !password) {
      res.status(400).json({ error: 'Nama, username, peran, dan kata sandi wajib diisi.' });
      return;
    }

    const validRoles = [
      'Owner',
      'Manager',
      'Admin',
      'SPV Accounting',
      'SPV Tax',
      'Staff Accounting',
      'Staff Tax',
    ];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Peran pengguna tidak valid.' });
      return;
    }

    const db = getDb();
    const existing = db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (existing) {
      res.status(400).json({ error: `Username '${username}' sudah digunakan.` });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const newId = `USR-${Date.now().toString(36).toUpperCase()}`;
    const newUser: User = {
      id: newId,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      role,
      email: (email || '').trim(),
      passwordHash: hash,
      salt,
      active: true,
      mustChangePassword: Boolean(mustChangePassword),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mutateDb((database) => {
      database.users.push(newUser);
      logAudit(
        'USER_CREATED',
        'User',
        `Pengguna baru ${newUser.name} (${newUser.username}) dengan role ${newUser.role} dibuat.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        newUser.id,
        newUser.name
      );
    });

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role,
        email: newUser.email,
        active: newUser.active,
        mustChangePassword: newUser.mustChangePassword,
        createdAt: newUser.createdAt,
      },
      message: 'Pengguna berhasil dibuat dan disimpan.',
    });
  }
);

apiRouter.put(
  '/users/:id',
  authenticateToken,
  requireRole('Admin'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, role, email, active, password, mustChangePassword } = req.body;
    let updatedUser: User | null = null;

    mutateDb((database) => {
      const target = database.users.find((u) => u.id === id);
      if (!target) throw new Error('Pengguna tidak ditemukan.');

      if (name !== undefined) target.name = name.trim();
      if (role !== undefined) target.role = role;
      if (email !== undefined) target.email = email.trim();
      if (active !== undefined) target.active = Boolean(active);
      if (mustChangePassword !== undefined) target.mustChangePassword = Boolean(mustChangePassword);
      if (password) {
        const { hash, salt } = hashPassword(password);
        target.passwordHash = hash;
        target.salt = salt;
      }
      target.updatedAt = new Date().toISOString();
      updatedUser = target;

      logAudit(
        'USER_UPDATED',
        'User',
        `Data pengguna ${target.name} (${target.username}) diperbarui oleh Admin.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        target.id,
        target.name
      );
    });

    res.json({
      success: true,
      user: updatedUser,
      message: 'Data pengguna berhasil diperbarui.',
    });
  }
);

// ==========================================
// 5. MASTER KLIEN & PEMBAGIAN PIC KLIEN
// ==========================================
apiRouter.get('/clients', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  let results = [...db.clients];

  const {
    type,
    entityType,
    pkpStatus,
    pphRegime,
    accRisk,
    taxRisk,
    status,
    picStatus,
    search,
    picId,
    spvId,
  } = req.query;

  if (type) results = results.filter((c) => c.type === type);
  if (entityType) results = results.filter((c) => c.entityType === entityType);
  if (pkpStatus) results = results.filter((c) => c.pkpStatus === pkpStatus);
  if (pphRegime) results = results.filter((c) => c.pphRegime === pphRegime);
  if (accRisk) results = results.filter((c) => c.accountingRisk === accRisk);
  if (taxRisk) results = results.filter((c) => c.taxRisk === taxRisk);
  if (status) results = results.filter((c) => c.status === status);
  if (picStatus) results = results.filter((c) => c.picAssignmentStatus === picStatus);

  if (picId) {
    results = results.filter(
      (c) =>
        c.accountingStaffPicId === picId ||
        c.taxStaffPicId === picId ||
        c.accountingSpvId === picId ||
        c.taxSpvId === picId
    );
  }
  if (spvId) {
    results = results.filter((c) => c.accountingSpvId === spvId || c.taxSpvId === spvId);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.npwp && c.npwp.toLowerCase().includes(q)) ||
        (c.accountingStaffPicName && c.accountingStaffPicName.toLowerCase().includes(q)) ||
        (c.taxStaffPicName && c.taxStaffPicName.toLowerCase().includes(q)) ||
        (c.accountingSpvName && c.accountingSpvName.toLowerCase().includes(q)) ||
        (c.taxSpvName && c.taxSpvName.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
    );
  }

  res.json(results);
});

apiRouter.get('/clients/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const client = db.clients.find((c) => c.id === req.params.id);
  if (!client) {
    res.status(404).json({ error: 'Klien tidak ditemukan.' });
    return;
  }
  res.json(client);
});

apiRouter.post(
  '/clients',
  authenticateToken,
  requireRole('Admin', 'SPV Accounting', 'SPV Tax'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const data = req.body;
    if (!data.name || !data.type) {
      res.status(400).json({ error: 'Nama klien dan jenis klien (OP/Badan) wajib diisi.' });
      return;
    }

    const db = getDb();
    const nextNumber = db.clients.length + 1;
    const newId = `CLI-${String(nextNumber).padStart(3, '0')}`;

    // Verify 4 PIC assignments
    const accStaffId = data.accountingStaffPicId || '';
    const accStaffName = data.accountingStaffPicName || '-';
    const taxStaffId = data.taxStaffPicId || '';
    const taxStaffName = data.taxStaffPicName || '-';
    const accSpvId = data.accountingSpvId || '';
    const accSpvName = data.accountingSpvName || '-';
    const taxSpvId = data.taxSpvId || '';
    const taxSpvName = data.taxSpvName || '-';

    const isComplete =
      Boolean(accStaffName && accStaffName !== '-' && accStaffName.trim()) &&
      Boolean(taxStaffName && taxStaffName !== '-' && taxStaffName.trim()) &&
      Boolean(accSpvName && accSpvName !== '-' && accSpvName.trim()) &&
      Boolean(taxSpvName && taxSpvName !== '-' && taxSpvName.trim());

    const initialPicHistory: PicHistoryItem[] = [
      {
        id: `PICH-${newId}-INIT`,
        timestamp: new Date().toISOString(),
        changedBy: req.user?.name || 'Admin',
        accountingStaff: accStaffName,
        taxStaff: taxStaffName,
        accountingSpv: accSpvName,
        taxSpv: taxSpvName,
        notes: isComplete ? 'Penugasan PIC awal lengkap saat pembuatan klien.' : 'Penugasan awal klien (belum lengkap).',
      },
    ];

    const newClient: Client = {
      id: newId,
      name: data.name.trim(),
      type: data.type,
      entityType: data.type === 'OP' ? '-' : data.entityType || 'PT',
      accountingStaffPicId: accStaffId,
      accountingStaffPicName: accStaffName,
      taxStaffPicId: taxStaffId,
      taxStaffPicName: taxStaffName,
      accountingSpvId: accSpvId,
      accountingSpvName: accSpvName,
      taxSpvId: taxSpvId,
      taxSpvName: taxSpvName,
      picAssignmentStatus: isComplete ? 'Lengkap' : 'Belum Lengkap',
      picHistory: initialPicHistory,

      accountingPicId: accStaffId,
      accountingPicName: accStaffName,
      taxPicId: taxStaffId,
      taxPicName: taxStaffName,
      spvId: accSpvId,
      spvName: accSpvName,

      status: data.status || 'Aktif',
      notes: data.notes || '',
      npwp: data.npwp || '',
      address: data.address || '',
      contactPerson: data.contactPerson || '',
      contactPhone: data.contactPhone || '',
      pkpStatus: data.pkpStatus || 'Belum Diisi',
      pphRegime: data.pphRegime || 'Belum Ditentukan',
      taxYearEffective: data.taxYearEffective || new Date().getFullYear(),
      umkmFacilityStartYear: data.umkmFacilityStartYear || null,
      umkmFacilityEndYear: data.umkmFacilityEndYear || null,
      taxProfileNotes: data.taxProfileNotes || '',
      taxProfileSource: data.taxProfileSource || '',
      accountingRisk: data.accountingRisk || 'Not Assessed',
      accountingRiskReason: data.accountingRiskReason || '',
      accountingRiskRecommendation: data.accountingRiskRecommendation || '',
      accountingRiskDate: data.accountingRisk ? new Date().toISOString().split('T')[0] : '',
      accountingRiskAssessedBy: data.accountingRisk ? (req.user?.name || '') : '',
      taxRisk: data.taxRisk || 'Not Assessed',
      taxRiskReason: data.taxRiskReason || '',
      taxRiskRecommendation: data.taxRiskRecommendation || '',
      taxRiskDate: data.taxRisk ? new Date().toISOString().split('T')[0] : '',
      taxRiskAssessedBy: data.taxRisk ? (req.user?.name || '') : '',
      riskHistory: [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.name,
    };

    mutateDb((database) => {
      database.clients.unshift(newClient);
      logAudit(
        'CLIENT_CREATED',
        'Client',
        `Klien baru ${newClient.name} (${newClient.id}) ditambahkan dengan status PIC: ${newClient.picAssignmentStatus}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        newClient.id,
        newClient.name
      );
    });

    res.status(201).json({
      success: true,
      client: newClient,
      message: 'Klien baru berhasil ditambahkan dan disimpan di database persisten.',
    });
  }
);

apiRouter.put(
  '/clients/:id',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    let savedClient: Client | null = null;

    mutateDb((database) => {
      const client = database.clients.find((c) => c.id === id);
      if (!client) throw new Error('Klien tidak ditemukan.');

      // Optimistic concurrency check if expectedVersion provided
      if (updates.expectedVersion !== undefined && client.version !== updates.expectedVersion) {
        throw new Error(
          `Konflik Perubahan: Data klien ini telah diperbarui oleh pengguna lain (Versi ${client.version}). Muat ulang data terbaru terlebih dahulu sebelum menyimpan.`
        );
      }

      // Check for PIC Assignment Changes
      const picChanged =
        (updates.accountingStaffPicName !== undefined && updates.accountingStaffPicName !== client.accountingStaffPicName) ||
        (updates.taxStaffPicName !== undefined && updates.taxStaffPicName !== client.taxStaffPicName) ||
        (updates.accountingSpvName !== undefined && updates.accountingSpvName !== client.accountingSpvName) ||
        (updates.taxSpvName !== undefined && updates.taxSpvName !== client.taxSpvName);

      if (picChanged) {
        const newAccStaff = updates.accountingStaffPicName ?? client.accountingStaffPicName;
        const newTaxStaff = updates.taxStaffPicName ?? client.taxStaffPicName;
        const newAccSpv = updates.accountingSpvName ?? client.accountingSpvName;
        const newTaxSpv = updates.taxSpvName ?? client.taxSpvName;

        const isComplete =
          Boolean(newAccStaff && newAccStaff !== '-' && newAccStaff.trim()) &&
          Boolean(newTaxStaff && newTaxStaff !== '-' && newTaxStaff.trim()) &&
          Boolean(newAccSpv && newAccSpv !== '-' && newAccSpv.trim()) &&
          Boolean(newTaxSpv && newTaxSpv !== '-' && newTaxSpv.trim());

        client.picAssignmentStatus = isComplete ? 'Lengkap' : 'Belum Lengkap';

        const picHistoryItem: PicHistoryItem = {
          id: `PICH-${id}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          changedBy: req.user?.name || 'User',
          accountingStaff: newAccStaff,
          taxStaff: newTaxStaff,
          accountingSpv: newAccSpv,
          taxSpv: newTaxSpv,
          notes: updates.picChangeNotes || 'Perubahan susunan 4 PIC klien.',
        };
        client.picHistory = client.picHistory || [];
        client.picHistory.unshift(picHistoryItem);

        logAudit(
          'PIC_ASSIGNMENT_UPDATED',
          'Client',
          `Perubahan penugasan 4 PIC klien ${client.name}: Acc Staff (${newAccStaff}), Tax Staff (${newTaxStaff}), Acc SPV (${newAccSpv}), Tax SPV (${newTaxSpv}). Status: ${client.picAssignmentStatus}.`,
          { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
          client.id,
          client.name
        );
      }

      // Risk Changes
      if (updates.accountingRisk && updates.accountingRisk !== client.accountingRisk) {
        const historyItem: RiskHistoryItem = {
          id: `RSH-${id}-ACC-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          division: 'Accounting',
          previousLevel: client.accountingRisk,
          newLevel: updates.accountingRisk,
          reason: updates.accountingRiskReason || client.accountingRiskReason || 'Pembaruan penilaian risiko Accounting',
          recommendation: updates.accountingRiskRecommendation || client.accountingRiskRecommendation || '',
          assessedBy: req.user?.name || 'User',
        };
        client.riskHistory = client.riskHistory || [];
        client.riskHistory.unshift(historyItem);
        client.accountingRisk = updates.accountingRisk;
        client.accountingRiskDate = new Date().toISOString().split('T')[0];
        client.accountingRiskAssessedBy = req.user?.name || 'User';
      }

      if (updates.taxRisk && updates.taxRisk !== client.taxRisk) {
        const historyItem: RiskHistoryItem = {
          id: `RSH-${id}-TAX-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          division: 'Tax',
          previousLevel: client.taxRisk,
          newLevel: updates.taxRisk,
          reason: updates.taxRiskReason || client.taxRiskReason || 'Pembaruan penilaian risiko Tax',
          recommendation: updates.taxRiskRecommendation || client.taxRiskRecommendation || '',
          assessedBy: req.user?.name || 'User',
        };
        client.riskHistory = client.riskHistory || [];
        client.riskHistory.unshift(historyItem);
        client.taxRisk = updates.taxRisk;
        client.taxRiskDate = new Date().toISOString().split('T')[0];
        client.taxRiskAssessedBy = req.user?.name || 'User';
      }

      // Synchronize backward compat fields
      if (updates.accountingStaffPicId) updates.accountingPicId = updates.accountingStaffPicId;
      if (updates.accountingStaffPicName) updates.accountingPicName = updates.accountingStaffPicName;
      if (updates.taxStaffPicId) updates.taxPicId = updates.taxStaffPicId;
      if (updates.taxStaffPicName) updates.taxPicName = updates.taxStaffPicName;
      if (updates.accountingSpvId) updates.spvId = updates.accountingSpvId;
      if (updates.accountingSpvName) updates.spvName = updates.accountingSpvName;

      // Update version and timestamp
      client.version = (client.version || 1) + 1;
      client.updatedAt = new Date().toISOString();
      client.updatedBy = req.user?.name;

      Object.assign(client, updates, {
        riskHistory: client.riskHistory,
        picHistory: client.picHistory,
        version: client.version,
        updatedAt: client.updatedAt,
        updatedBy: client.updatedBy,
      });

      savedClient = client;

      logAudit(
        'CLIENT_UPDATED',
        'Client',
        `Data klien ${client.name} (${client.id}) diperbarui ke versi ${client.version}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        client.id,
        client.name
      );
    });

    res.json({
      success: true,
      client: savedClient,
      message: 'Data klien berhasil diperbarui dan disimpan secara persisten.',
    });
  }
);

// Putus Kontrak Klien (Admin, SPV Accounting, SPV Tax)
apiRouter.post(
  '/clients/:id/terminate',
  authenticateToken,
  requireRole('Admin', 'SPV Accounting', 'SPV Tax'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { terminationReason, terminationDate } = req.body;
    let savedClient: Client | null = null;

    mutateDb((database) => {
      const client = database.clients.find((c) => c.id === id);
      if (!client) throw new Error('Klien tidak ditemukan.');

      client.status = 'Putus Kontrak';
      client.terminationDate = terminationDate || new Date().toISOString().split('T')[0];
      client.terminationReason = terminationReason?.trim() || 'Klien memutuskan kontrak kerja sama jasa konsultasi.';
      client.version = (client.version || 1) + 1;
      client.updatedAt = new Date().toISOString();
      client.updatedBy = req.user?.name;

      savedClient = client;

      logAudit(
        'CLIENT_TERMINATED',
        'Client',
        `Klien ${client.name} (${client.id}) diubah status menjadi Putus Kontrak. Alasan: ${client.terminationReason}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        client.id,
        client.name
      );
    });

    res.json({
      success: true,
      client: savedClient,
      message: `Status klien '${savedClient?.name}' berhasil diubah menjadi Putus Kontrak.`,
    });
  }
);

// Hapus Klien (Hanya Admin)
apiRouter.delete(
  '/clients/:id',
  authenticateToken,
  requireRole('Admin'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    let deletedClientName = '';

    mutateDb((database) => {
      const idx = database.clients.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Klien tidak ditemukan.');

      const deleted = database.clients.splice(idx, 1)[0];
      deletedClientName = deleted.name;

      logAudit(
        'CLIENT_DELETED',
        'Client',
        `Klien '${deleted.name}' (${deleted.id}) dihapus permanen dari sistem oleh Admin.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        deleted.id,
        deleted.name
      );
    });

    res.json({
      success: true,
      message: `Klien '${deletedClientName}' (${id}) berhasil dihapus dari database persisten.`,
    });
  }
);

// ==========================================
// 6. JOB MANAGEMENT & SPV APPROVAL
// ==========================================
apiRouter.get('/jobs', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  let results = [...db.jobs];
  const { division, status, picId, spvId, clientId, priority } = req.query;

  // Scoping according to user role
  if (req.user?.role === 'Staff Accounting') {
    results = results.filter((j) => j.division === 'Accounting');
  } else if (req.user?.role === 'Staff Tax') {
    results = results.filter((j) => j.division === 'Tax');
  } else if (req.user?.role === 'SPV Accounting') {
    if (!division) results = results.filter((j) => j.division === 'Accounting');
  } else if (req.user?.role === 'SPV Tax') {
    if (!division) results = results.filter((j) => j.division === 'Tax');
  }

  if (division) results = results.filter((j) => j.division === division);
  if (status) results = results.filter((j) => j.status === status);
  if (picId) results = results.filter((j) => j.picId === picId);
  if (spvId) results = results.filter((j) => j.spvId === spvId);
  if (clientId) results = results.filter((j) => j.clientId === clientId);
  if (priority) results = results.filter((j) => j.priority === priority);

  res.json(results);
});

apiRouter.post(
  '/jobs',
  authenticateToken,
  requireRole('Admin', 'SPV Accounting', 'SPV Tax'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const data = req.body;
    if (!data.clientId || !data.title || !data.division || !data.deadline) {
      res.status(400).json({ error: 'Klien, judul pekerjaan, divisi, dan deadline wajib diisi.' });
      return;
    }

    if (req.user?.role === 'SPV Accounting' && data.division !== 'Accounting') {
      res.status(403).json({ error: 'SPV Accounting hanya dapat membuat pekerjaan di Divisi Accounting.' });
      return;
    }
    if (req.user?.role === 'SPV Tax' && data.division !== 'Tax') {
      res.status(403).json({ error: 'SPV Tax hanya dapat membuat pekerjaan di Divisi Tax.' });
      return;
    }

    const db = getDb();
    const nextNumber = db.jobs.length + 1;
    const year = new Date().getFullYear();
    const newId = `JOB-${year}-${String(nextNumber).padStart(3, '0')}`;

    // Auto-assign PIC and SPV from Client based on division if not manually overridden
    const client = db.clients.find((c) => c.id === data.clientId);
    let assignedPicId = data.picId;
    let assignedPicName = data.picName;
    let assignedSpvId = data.spvId;
    let assignedSpvName = data.spvName;

    if (client) {
      if (data.division === 'Accounting') {
        if (!assignedPicId) assignedPicId = client.accountingStaffPicId;
        if (!assignedPicName) assignedPicName = client.accountingStaffPicName;
        if (!assignedSpvId) assignedSpvId = client.accountingSpvId;
        if (!assignedSpvName) assignedSpvName = client.accountingSpvName;
      } else {
        if (!assignedPicId) assignedPicId = client.taxStaffPicId;
        if (!assignedPicName) assignedPicName = client.taxStaffPicName;
        if (!assignedSpvId) assignedSpvId = client.taxSpvId;
        if (!assignedSpvName) assignedSpvName = client.taxSpvName;
      }
    }

    const newJob: Job = {
      id: newId,
      clientId: data.clientId,
      clientName: client?.name || data.clientName || 'Klien',
      division: data.division,
      title: data.title.trim(),
      picId: assignedPicId || req.user?.userId || '',
      picName: assignedPicName || req.user?.name || '',
      spvId: assignedSpvId || req.user?.userId || '',
      spvName: assignedSpvName || req.user?.name || '',
      createdAt: new Date().toISOString(),
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      deadline: data.deadline,
      priority: data.priority || 'Sedang',
      description: data.description || '',
      notes: data.notes || '',
      status: 'Belum Dimulai',
      progressPercent: 0,
      version: 1,
      history: [
        {
          id: `JH-${Date.now()}-1`,
          timestamp: new Date().toISOString(),
          userId: req.user?.userId || '',
          userName: req.user?.name || 'User',
          action: 'Pekerjaan Dibuat & Ditugaskan Otomatis Sesuai PIC Klien',
          toStatus: 'Belum Dimulai',
          notes: data.notes || `Ditugaskan kepada ${assignedPicName} (Reviewer: ${assignedSpvName}).`,
        },
      ],
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.name,
    };

    mutateDb((database) => {
      database.jobs.unshift(newJob);
      logAudit(
        'JOB_CREATED',
        'Job',
        `Pekerjaan ${newJob.id} (${newJob.title}) dibuat untuk ${newJob.clientName} (PIC: ${newJob.picName}, SPV: ${newJob.spvName}).`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        newJob.id,
        newJob.title
      );
    });

    res.status(201).json({
      success: true,
      job: newJob,
      message: 'Pekerjaan berhasil dibuat dan disimpan di database persisten.',
    });
  }
);

apiRouter.put(
  '/jobs/:id',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const currentUser = req.user!;

    let savedJob: Job | null = null;

    mutateDb((database) => {
      const job = database.jobs.find((j) => j.id === id);
      if (!job) throw new Error('Pekerjaan tidak ditemukan.');

      // Concurrency version check
      if (updates.expectedVersion !== undefined && job.version !== updates.expectedVersion) {
        throw new Error(
          `Konflik Perubahan: Pekerjaan ini telah diperbarui oleh pengguna lain (Versi ${job.version}). Muat ulang data terbaru terlebih dahulu.`
        );
      }

      // CRITICAL RBAC CHECK: Staff CANNOT approve own job to 'Selesai'!
      if (updates.status === 'Selesai' && job.status !== 'Selesai') {
        const isAuthorizedReviewer =
          currentUser.role === 'Admin' ||
          (currentUser.role === 'SPV Accounting' && job.division === 'Accounting') ||
          (currentUser.role === 'SPV Tax' && job.division === 'Tax');

        if (!isAuthorizedReviewer) {
          throw new Error(
            'HAK AKSES DITOLAK: Staff atau SPV lintas divisi tidak dapat menyetujui pekerjaan (status Selesai). Persetujuan hanya dapat dilakukan oleh SPV divisi terkait atau Admin.'
          );
        }

        job.completedAt = new Date().toISOString();
        job.approvedBy = currentUser.name;
      }

      // Check if SPV requests revision
      if (updates.status === 'Perlu Revisi' && job.status !== 'Perlu Revisi') {
        const isAuthorizedReviewer =
          currentUser.role === 'Admin' ||
          (currentUser.role === 'SPV Accounting' && job.division === 'Accounting') ||
          (currentUser.role === 'SPV Tax' && job.division === 'Tax');

        if (!isAuthorizedReviewer) {
          throw new Error('Hanya SPV penanggung jawab atau Admin yang dapat meminta revisi pekerjaan.');
        }

        if (!updates.reviewNotes && !updates.notes) {
          throw new Error('Catatan evaluasi/revisi dari SPV wajib dicantumkan saat meminta revisi.');
        }
      }

      // Record History item
      const statusChanged = updates.status && updates.status !== job.status;
      const historyAction = statusChanged
        ? updates.status === 'Selesai'
          ? 'Persetujuan Selesai oleh SPV'
          : updates.status === 'Perlu Revisi'
          ? 'Permintaan Revisi oleh SPV'
          : updates.status === 'Siap Direview'
          ? 'Pengajuan Review ke SPV'
          : `Perubahan Status ke ${updates.status}`
        : 'Pembaruan Progres / Catatan';

      const historyItem = {
        id: `JH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.userId,
        userName: currentUser.name,
        action: historyAction,
        fromStatus: job.status,
        toStatus: updates.status || job.status,
        notes: updates.historyNote || updates.reviewNotes || updates.notes || `Progres: ${updates.progressPercent ?? job.progressPercent}%`,
      };

      job.history = job.history || [];
      job.history.push(historyItem);

      // Increment version
      job.version = (job.version || 1) + 1;
      job.updatedAt = new Date().toISOString();
      job.updatedBy = currentUser.name;

      // Apply updates
      if (updates.title !== undefined) job.title = updates.title;
      if (updates.priority !== undefined) job.priority = updates.priority;
      if (updates.deadline !== undefined) job.deadline = updates.deadline;
      if (updates.description !== undefined) job.description = updates.description;
      if (updates.notes !== undefined) job.notes = updates.notes;
      if (updates.picId !== undefined) job.picId = updates.picId;
      if (updates.picName !== undefined) job.picName = updates.picName;
      if (updates.progressPercent !== undefined) job.progressPercent = Number(updates.progressPercent);
      if (updates.status !== undefined) job.status = updates.status;
      if (updates.reviewNotes !== undefined) job.reviewNotes = updates.reviewNotes;

      savedJob = job;

      logAudit(
        'JOB_UPDATED',
        'Job',
        `Pekerjaan ${job.id} diperbarui: ${historyAction}. Status saat ini: ${job.status}.`,
        { userId: currentUser.userId, name: currentUser.name, role: currentUser.role },
        job.id,
        job.title
      );
    });

    res.json({
      success: true,
      job: savedJob,
      message: 'Pekerjaan berhasil diperbarui dan tersimpan di database persisten.',
    });
  }
);

// Hapus Pekerjaan (Admin, SPV Accounting, SPV Tax)
apiRouter.delete(
  '/jobs/:id',
  authenticateToken,
  requireRole('Admin', 'SPV Accounting', 'SPV Tax'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    let deletedTitle = '';

    mutateDb((database) => {
      const idx = database.jobs.findIndex((j) => j.id === id);
      if (idx === -1) throw new Error('Pekerjaan tidak ditemukan.');

      const target = database.jobs[idx];
      // Role scope check
      if (req.user?.role === 'SPV Accounting' && target.division !== 'Accounting') {
        throw new Error('SPV Accounting hanya dapat menghapus pekerjaan divisi Accounting.');
      }
      if (req.user?.role === 'SPV Tax' && target.division !== 'Tax') {
        throw new Error('SPV Tax hanya dapat menghapus pekerjaan divisi Tax.');
      }

      const deleted = database.jobs.splice(idx, 1)[0];
      deletedTitle = deleted.title;

      logAudit(
        'JOB_DELETED',
        'Job',
        `Pekerjaan '${deleted.title}' (${deleted.id}) untuk klien ${deleted.clientName} dihapus oleh ${req.user?.name}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        deleted.id,
        deleted.title
      );
    });

    res.json({
      success: true,
      message: `Pekerjaan '${deletedTitle}' (${id}) berhasil dihapus dari database.`,
    });
  }
);

// ==========================================
// 7. CASE REGISTER & FOLLOW-UP TRACKER
// ==========================================
apiRouter.get('/cases', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  let results = [...db.cases];
  const { division, status, priority, clientId, picId } = req.query;

  if (division) results = results.filter((c) => c.division === division);
  if (status) results = results.filter((c) => c.status === status);
  if (priority) results = results.filter((c) => c.priority === priority);
  if (clientId) results = results.filter((c) => c.clientId === clientId);
  if (picId) results = results.filter((c) => c.picId === picId || c.followUpPicId === picId);

  res.json(results);
});

apiRouter.post(
  '/cases',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const data = req.body;
    if (!data.clientId || !data.title || !data.division || !data.description) {
      res.status(400).json({ error: 'Klien, judul, divisi, dan uraian masalah wajib diisi.' });
      return;
    }

    const db = getDb();
    const year = new Date().getFullYear();
    const nextNumber = db.cases.length + 1;
    const newId = `CAS-${year}-${String(nextNumber).padStart(3, '0')}`;

    const newCase: Case = {
      id: newId,
      createdAt: new Date().toISOString(),
      clientId: data.clientId,
      clientName: data.clientName || 'Klien',
      division: data.division,
      title: data.title.trim(),
      description: data.description.trim(),
      priority: data.priority || 'Sedang',
      picId: data.picId || req.user?.userId || '',
      picName: data.picName || req.user?.name || '',
      rootCause: data.rootCause || '',
      actionsTaken: data.actionsTaken || '',
      latestProgress: data.latestProgress || '',
      status: data.status || 'Open',
      followUpPlan: data.followUpPlan || '',
      nextFollowUpDate: data.nextFollowUpDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      followUpPicId: data.followUpPicId || data.picId || req.user?.userId || '',
      followUpPicName: data.followUpPicName || data.picName || req.user?.name || '',
      version: 1,
      timeline: [
        {
          id: `CTL-${Date.now()}-1`,
          date: new Date().toISOString().split('T')[0],
          userId: req.user?.userId || '',
          userName: req.user?.name || '',
          activity: 'Pencatatan awal kasus baru.',
          notes: data.description,
          nextStep: data.followUpPlan || 'Analisis dokumen pendukung.',
        },
      ],
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.name,
    };

    mutateDb((database) => {
      database.cases.unshift(newCase);
      logAudit(
        'CASE_CREATED',
        'Case',
        `Kasus baru ${newCase.id} (${newCase.title}) dicatat untuk ${newCase.clientName}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        newCase.id,
        newCase.title
      );
    });

    res.status(201).json({
      success: true,
      case: newCase,
      message: 'Kasus berhasil dicatat di Case Register dan tersimpan secara persisten.',
    });
  }
);

apiRouter.put(
  '/cases/:id',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    let savedCase: Case | null = null;

    mutateDb((database) => {
      const item = database.cases.find((c) => c.id === id);
      if (!item) throw new Error('Kasus tidak ditemukan.');

      if (updates.status === 'Resolved' && item.status !== 'Resolved') {
        item.resolvedAt = new Date().toISOString();
        item.resolutionNotes = updates.resolutionNotes || 'Kasus diselesaikan oleh tim konsultasi.';
      }

      item.version = (item.version || 1) + 1;
      item.updatedAt = new Date().toISOString();
      item.updatedBy = req.user?.name;

      Object.assign(item, updates, {
        version: item.version,
        updatedAt: item.updatedAt,
        updatedBy: item.updatedBy,
      });

      savedCase = item;

      logAudit(
        'CASE_UPDATED',
        'Case',
        `Kasus ${item.id} diperbarui. Status: ${item.status}. Follow-up berikutnya: ${item.nextFollowUpDate}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        item.id,
        item.title
      );
    });

    res.json({
      success: true,
      case: savedCase,
      message: 'Kasus berhasil diperbarui dan disimpan di database.',
    });
  }
);

apiRouter.post(
  '/cases/:id/timeline',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { activity, notes, nextStep, date } = req.body;

    if (!activity) {
      res.status(400).json({ error: 'Uraian aktivitas tindakan kasus wajib diisi.' });
      return;
    }

    let updatedCase: Case | null = null;

    mutateDb((database) => {
      const item = database.cases.find((c) => c.id === id);
      if (!item) throw new Error('Kasus tidak ditemukan.');

      const timelineItem = {
        id: `CTL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: date || new Date().toISOString().split('T')[0],
        userId: req.user?.userId || '',
        userName: req.user?.name || '',
        activity: activity.trim(),
        notes: notes || '',
        nextStep: nextStep || '',
      };

      item.timeline = item.timeline || [];
      item.timeline.push(timelineItem);
      item.latestProgress = activity.trim();
      if (nextStep) item.followUpPlan = nextStep;
      item.version = (item.version || 1) + 1;
      item.updatedAt = new Date().toISOString();
      item.updatedBy = req.user?.name;
      updatedCase = item;

      logAudit(
        'CASE_TIMELINE_ADDED',
        'Case',
        `Aktivitas baru ditambahkan pada Kasus ${item.id}: ${activity.trim()}`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        item.id,
        item.title
      );
    });

    res.status(201).json({
      success: true,
      case: updatedCase,
      message: 'Catatan tindakan kasus berhasil ditambahkan secara persisten.',
    });
  }
);

// Hapus Kasus (Admin, SPV Accounting, SPV Tax)
apiRouter.delete(
  '/cases/:id',
  authenticateToken,
  requireRole('Admin', 'SPV Accounting', 'SPV Tax'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    let deletedTitle = '';

    mutateDb((database) => {
      const idx = database.cases.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Kasus tidak ditemukan.');

      const target = database.cases[idx];
      // Role scope check
      if (req.user?.role === 'SPV Accounting' && target.division !== 'Accounting') {
        throw new Error('SPV Accounting hanya dapat menghapus kasus divisi Accounting.');
      }
      if (req.user?.role === 'SPV Tax' && target.division !== 'Tax') {
        throw new Error('SPV Tax hanya dapat menghapus kasus divisi Tax.');
      }

      const deleted = database.cases.splice(idx, 1)[0];
      deletedTitle = deleted.title;

      logAudit(
        'CASE_DELETED',
        'Case',
        `Kasus '${deleted.title}' (${deleted.id}) untuk klien ${deleted.clientName} dihapus oleh ${req.user?.name}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        deleted.id,
        deleted.title
      );
    });

    res.json({
      success: true,
      message: `Kasus '${deletedTitle}' (${id}) berhasil dihapus dari Case Register.`,
    });
  }
);

// Hapus Item Tindakan Timeline Kasus (Follow-up item)
apiRouter.delete(
  '/cases/:id/timeline/:timelineId',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id, timelineId } = req.params;
    let updatedCase: Case | null = null;

    mutateDb((database) => {
      const targetCase = database.cases.find((c) => c.id === id);
      if (!targetCase) throw new Error('Kasus tidak ditemukan.');

      targetCase.timeline = targetCase.timeline || [];
      const itemIdx = targetCase.timeline.findIndex((t) => t.id === timelineId);
      if (itemIdx === -1) throw new Error('Catatan tindakan tidak ditemukan.');

      // Check author or SPV/Admin
      const item = targetCase.timeline[itemIdx];
      const isPrivileged =
        req.user?.role === 'Admin' ||
        req.user?.role === 'SPV Accounting' ||
        req.user?.role === 'SPV Tax';

      if (!isPrivileged && item.userId && item.userId !== req.user?.userId) {
        throw new Error('Hanya pembuat catatan atau SPV/Admin yang dapat menghapus catatan ini.');
      }

      targetCase.timeline.splice(itemIdx, 1);
      targetCase.version = (targetCase.version || 1) + 1;
      targetCase.updatedAt = new Date().toISOString();
      targetCase.updatedBy = req.user?.name;
      updatedCase = targetCase;

      logAudit(
        'CASE_TIMELINE_DELETED',
        'Case',
        `Catatan timeline tindakan pada Kasus ${targetCase.id} dihapus oleh ${req.user?.name}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        targetCase.id,
        targetCase.title
      );
    });

    res.json({
      success: true,
      case: updatedCase,
      message: 'Catatan tindakan berhasil dihapus dari riwayat kasus.',
    });
  }
);

// ==========================================
// 8. DAILY ACTIVITY LOG
// ==========================================
apiRouter.get('/daily-activities', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  let results = [...db.activities];
  const { date, division, picId, clientId, jobId, caseId } = req.query;

  if (date) results = results.filter((a) => a.date === date);
  if (division) results = results.filter((a) => a.division === division);
  if (picId) results = results.filter((a) => a.picId === picId);
  if (clientId) results = results.filter((a) => a.clientId === clientId);
  if (jobId) results = results.filter((a) => a.jobId === jobId);
  if (caseId) results = results.filter((a) => a.caseId === caseId);

  res.json(results);
});

apiRouter.post(
  '/daily-activities',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const data = req.body;
    if (!data.clientId || !data.description || !data.division) {
      res.status(400).json({ error: 'Klien, divisi, dan deskripsi aktivitas wajib diisi.' });
      return;
    }

    const db = getDb();
    const nextNumber = db.activities.length + 1;
    const newId = `ACT-${new Date().getFullYear()}-${String(nextNumber).padStart(3, '0')}`;

    const newActivity: DailyActivity = {
      id: newId,
      date: data.date || new Date().toISOString().split('T')[0],
      clientId: data.clientId,
      clientName: data.clientName || 'Klien',
      division: data.division,
      picId: req.user?.userId || data.picId || '',
      picName: req.user?.name || data.picName || '',
      jobId: data.jobId || undefined,
      caseId: data.caseId || undefined,
      description: data.description.trim(),
      resultProgress: data.resultProgress || '',
      obstacles: data.obstacles || '',
      followUp: data.followUp || '',
      status: data.status || 'Selesai',
      durationMinutes: Number(data.durationMinutes) || 60,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.name,
    };

    mutateDb((database) => {
      database.activities.unshift(newActivity);
      logAudit(
        'ACTIVITY_LOGGED',
        'Activity',
        `Log aktivitas ${newActivity.id} dicatat oleh ${newActivity.picName} untuk ${newActivity.clientName}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        newActivity.id
      );
    });

    res.status(201).json({
      success: true,
      activity: newActivity,
      message: 'Aktivitas harian berhasil dicatat dan disimpan di database.',
    });
  }
);

apiRouter.put(
  '/daily-activities/:id',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    let saved: DailyActivity | null = null;

    mutateDb((database) => {
      const act = database.activities.find((a) => a.id === id);
      if (!act) throw new Error('Aktivitas tidak ditemukan.');

      if (req.user?.role.startsWith('Staff') && act.picId !== req.user.userId) {
        throw new Error('Staff hanya dapat memperbarui catatan aktivitas miliknya sendiri.');
      }

      Object.assign(act, updates, {
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.name,
      });
      saved = act;
    });

    res.json({
      success: true,
      activity: saved,
      message: 'Aktivitas harian berhasil diperbarui.',
    });
  }
);

apiRouter.delete(
  '/daily-activities/:id',
  authenticateToken,
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    mutateDb((database) => {
      const index = database.activities.findIndex((a) => a.id === id);
      if (index === -1) throw new Error('Aktivitas tidak ditemukan.');

      if (req.user?.role.startsWith('Staff') && database.activities[index].picId !== req.user.userId) {
        throw new Error('Staff tidak memiliki izin menghapus log aktivitas staf lain.');
      }

      const deleted = database.activities.splice(index, 1)[0];
      logAudit(
        'ACTIVITY_DELETED',
        'Activity',
        `Log aktivitas ${deleted.id} dihapus oleh ${req.user?.name}.`,
        { userId: req.user!.userId, name: req.user!.name, role: req.user!.role },
        deleted.id
      );
    });

    res.json({ success: true, message: 'Log aktivitas berhasil dihapus.' });
  }
);

// ==========================================
// 9. DASHBOARD STATS AGGREGATOR
// ==========================================
apiRouter.get('/stats', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const totalClients = db.clients.length;
  const activeClients = db.clients.filter((c) => c.status === 'Aktif').length;
  const badanClients = db.clients.filter((c) => c.type === 'Badan').length;
  const opClients = db.clients.filter((c) => c.type === 'OP').length;

  const pkpCount = db.clients.filter((c) => c.pkpStatus === 'PKP').length;
  const nonPkpCount = db.clients.filter((c) => c.pkpStatus === 'Non-PKP').length;
  const unassignedPkp = db.clients.filter((c) => c.pkpStatus === 'Belum Diisi').length;

  // PIC completeness count
  const completePicCount = db.clients.filter((c) => c.picAssignmentStatus === 'Lengkap').length;
  const incompletePicCount = db.clients.filter((c) => c.picAssignmentStatus === 'Belum Lengkap').length;

  // PPh Regimes
  const pphRegimes: Record<string, number> = {};
  db.clients.forEach((c) => {
    pphRegimes[c.pphRegime] = (pphRegimes[c.pphRegime] || 0) + 1;
  });

  // Accounting & Tax Risks
  const accRisks = {
    High: db.clients.filter((c) => c.accountingRisk === 'High').length,
    Medium: db.clients.filter((c) => c.accountingRisk === 'Medium').length,
    Low: db.clients.filter((c) => c.accountingRisk === 'Low').length,
    NotAssessed: db.clients.filter((c) => c.accountingRisk === 'Not Assessed').length,
  };

  const taxRisks = {
    High: db.clients.filter((c) => c.taxRisk === 'High').length,
    Medium: db.clients.filter((c) => c.taxRisk === 'Medium').length,
    Low: db.clients.filter((c) => c.taxRisk === 'Low').length,
    NotAssessed: db.clients.filter((c) => c.taxRisk === 'Not Assessed').length,
  };

  // Jobs
  const totalJobs = db.jobs.length;
  const completedJobs = db.jobs.filter((j) => j.status === 'Selesai').length;
  const readyForReviewJobs = db.jobs.filter((j) => j.status === 'Siap Direview').length;
  const needsRevisionJobs = db.jobs.filter((j) => j.status === 'Perlu Revisi').length;
  const inProgressJobs = db.jobs.filter((j) => j.status === 'Dalam Proses').length;
  const overdueJobs = db.jobs.filter((j) => j.status !== 'Selesai' && j.deadline < today);

  // Cases & Follow-up
  const openCases = db.cases.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const overdueFollowUps = db.cases.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Closed' && c.nextFollowUpDate < today
  ).length;

  // Workload per PIC
  const workloadByPic: Record<string, { name: string; activeJobs: number; readyReview: number; overdue: number }> = {};
  db.jobs.forEach((j) => {
    if (j.status !== 'Selesai') {
      const picKey = j.picName || 'Unassigned';
      if (!workloadByPic[picKey]) {
        workloadByPic[picKey] = { name: picKey, activeJobs: 0, readyReview: 0, overdue: 0 };
      }
      workloadByPic[picKey].activeJobs += 1;
      if (j.status === 'Siap Direview') workloadByPic[picKey].readyReview += 1;
      if (j.deadline < today) workloadByPic[picKey].overdue += 1;
    }
  });

  res.json({
    clients: {
      total: totalClients,
      active: activeClients,
      badan: badanClients,
      op: opClients,
      pkp: pkpCount,
      nonPkp: nonPkpCount,
      unassignedPkp,
      completePicCount,
      incompletePicCount,
      pphRegimes,
      accRisks,
      taxRisks,
    },
    jobs: {
      total: totalJobs,
      completed: completedJobs,
      readyForReview: readyForReviewJobs,
      needsRevision: needsRevisionJobs,
      inProgress: inProgressJobs,
      overdue: overdueJobs.length,
      overdueList: overdueJobs.slice(0, 5),
    },
    cases: {
      open: openCases,
      overdueFollowUps,
      total: db.cases.length,
    },
    activities: {
      todayCount: db.activities.filter((a) => a.date === today).length,
      total: db.activities.length,
    },
    workload: Object.values(workloadByPic),
  });
});

// ==========================================
// 10. BACKUP & RESTORE (Admin Only)
// ==========================================
apiRouter.post(
  '/backup/now',
  authenticateToken,
  requireRole('Admin'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { notes } = req.body;
    const backupInfo = createBackupSnapshot('manual', notes, {
      userId: req.user!.userId,
      name: req.user!.name,
      role: req.user!.role,
    });
    res.json({
      success: true,
      backup: backupInfo,
      message: `Cadangan data manual '${backupInfo.filename}' berhasil dibuat dan diverifikasi di server.`,
    });
  }
);

apiRouter.get(
  '/backup/list',
  authenticateToken,
  requireRole('Admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    res.json(db.backups || []);
  }
);

apiRouter.get(
  '/backup/download/:filename',
  authenticateToken,
  requireRole('Admin'),
  (req: AuthenticatedRequest, res: Response) => {
    const { filename } = req.params;
    const cleanFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'data', 'backups', cleanFilename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas cadangan tidak ditemukan di server.' });
      return;
    }

    res.download(filePath, cleanFilename);
  }
);

apiRouter.post(
  '/backup/restore',
  authenticateToken,
  requireRole('Admin'),
  requireWritable,
  (req: AuthenticatedRequest, res: Response) => {
    const { filename } = req.body;
    if (!filename) {
      res.status(400).json({ error: 'Nama berkas cadangan wajib disertakan untuk restore.' });
      return;
    }

    const cleanFilename = path.basename(filename);
    const result = restoreFromSnapshot(cleanFilename, {
      userId: req.user!.userId,
      name: req.user!.name,
      role: req.user!.role,
    });

    res.json(result);
  }
);

// ==========================================
// 11. AUDIT LOGS (Admin, Owner, Manager)
// ==========================================
apiRouter.get(
  '/audit-logs',
  authenticateToken,
  requireRole('Admin', 'Owner', 'Manager'),
  (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const limit = Number(req.query.limit) || 200;
    res.json((db.auditLogs || []).slice(0, limit));
  }
);

// ==========================================
// 12. EXCEL EXPORT (TMM/BMA Management Activity Report)
// ==========================================
apiRouter.get(
  '/reports/excel',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TMM/BMA Client Control Center';
    workbook.lastModifiedBy = req.user?.name || 'Administrator';
    workbook.created = new Date();
    workbook.modified = new Date();

    const todayStr = new Date().toISOString().split('T')[0];

    // Helper for header styling
    const applyHeaderStyle = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B132B' }, // Dark Navy
      };
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      row.height = 26;
    };

    // -----------------------------------------------------------------
    // Sheet 1: Executive Summary
    // -----------------------------------------------------------------
    const ws1 = workbook.addWorksheet('Executive Summary', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
    });

    ws1.columns = [
      { width: 32 },
      { width: 18 },
      { width: 35 },
      { width: 22 },
    ];

    ws1.mergeCells('A1:D1');
    ws1.getCell('A1').value = 'TMM/BMA MANAGEMENT ACTIVITY REPORT - EXECUTIVE SUMMARY';
    ws1.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0B132B' } };
    ws1.getCell('A1').alignment = { vertical: 'middle' };

    ws1.mergeCells('A2:D2');
    ws1.getCell('A2').value = `Waktu Ekspor: ${new Date().toLocaleString('id-ID')} | Dicetak oleh: ${req.user?.name} (${req.user?.role})`;
    ws1.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

    ws1.addRow([]);

    const summaryHeader = ws1.addRow(['Kategori Matriks', 'Nilai Terdata', 'Uraian Komposisi', 'Status Kepatuhan']);
    applyHeaderStyle(summaryHeader);

    const activeClients = db.clients.filter((c) => c.status === 'Aktif').length;
    const badanCount = db.clients.filter((c) => c.type === 'Badan').length;
    const opCount = db.clients.filter((c) => c.type === 'OP').length;
    const pkpCount = db.clients.filter((c) => c.pkpStatus === 'PKP').length;
    const nonPkpCount = db.clients.filter((c) => c.pkpStatus === 'Non-PKP').length;
    const completePicCount = db.clients.filter((c) => c.picAssignmentStatus === 'Lengkap').length;
    const incompletePicCount = db.clients.filter((c) => c.picAssignmentStatus === 'Belum Lengkap').length;

    const completedJobs = db.jobs.filter((j) => j.status === 'Selesai').length;
    const overdueJobs = db.jobs.filter((j) => j.status !== 'Selesai' && j.deadline < todayStr).length;
    const openCases = db.cases.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length;
    const highRiskCount = db.clients.filter((c) => c.taxRisk === 'High' || c.accountingRisk === 'High').length;

    const summaryRows = [
      ['Total Klien Terdaftar', db.clients.length, `${activeClients} Klien Aktif, ${db.clients.length - activeClients} Tidak Aktif`, 'Tersinkronisasi'],
      ['Segmentasi Badan vs OP', `${badanCount} Badan / ${opCount} OP`, `${Math.round((badanCount / (db.clients.length || 1)) * 100)}% Badan Usaha`, 'Valid'],
      ['Kepatuhan Pengusaha Kena Pajak (PKP)', `${pkpCount} PKP / ${nonPkpCount} Non-PKP`, `${Math.round((pkpCount / (db.clients.length || 1)) * 100)}% Terdaftar PKP`, 'Sesuai SKT'],
      ['Status Pembagian 4 PIC Klien', `${completePicCount} Lengkap / ${incompletePicCount} Belum`, '1 Staf Acc, 1 Staf Tax, 1 SPV Acc, 1 SPV Tax', incompletePicCount > 0 ? 'Perlu Dilengkapi' : 'Lengkap 100%'],
      ['Total Pekerjaan (Jobs)', db.jobs.length, `${completedJobs} Selesai, ${overdueJobs} Terlambat`, overdueJobs > 0 ? 'Ada Keterlambatan' : 'Sesuai SLA'],
      ['Kasus Perpajakan & Akuntansi Terbuka', openCases, `${openCases} Case Aktif dalam Penanganan`, openCases > 0 ? 'Monitoring Aktif' : 'Nihil Kasus'],
      ['Eksposur Klien Risiko Tinggi (High Risk)', highRiskCount, `${highRiskCount} Klien Berisiko Pajak/Akuntansi Tinggi`, 'Mitigasi Berjalan'],
      ['Total Log Aktivitas Harian', db.activities.length, 'Catatan riil pekerjaan operasional konsultan', 'Aktif Harian'],
    ];

    summaryRows.forEach((r) => {
      const row = ws1.addRow(r);
      row.alignment = { vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
    });

    // -----------------------------------------------------------------
    // Sheet 2: Daily Activity
    // -----------------------------------------------------------------
    const ws2 = workbook.addWorksheet('Daily Activity', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    ws2.columns = [
      { header: 'Activity ID', key: 'id', width: 16 },
      { header: 'Tanggal', key: 'date', width: 14 },
      { header: 'Nama Klien', key: 'clientName', width: 30 },
      { header: 'Divisi', key: 'division', width: 14 },
      { header: 'PIC Pelaksana', key: 'picName', width: 24 },
      { header: 'Ref Job/Case', key: 'ref', width: 18 },
      { header: 'Deskripsi Aktivitas Nyata', key: 'description', width: 45 },
      { header: 'Hasil & Progres', key: 'resultProgress', width: 35 },
      { header: 'Kendala Ditemui', key: 'obstacles', width: 30 },
      { header: 'Rencana Tindak Lanjut', key: 'followUp', width: 30 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Durasi (Menit)', key: 'durationMinutes', width: 15 },
    ];
    applyHeaderStyle(ws2.getRow(1));

    db.activities.forEach((act) => {
      const row = ws2.addRow({
        id: act.id,
        date: act.date,
        clientName: act.clientName,
        division: act.division,
        picName: act.picName,
        ref: act.jobId || act.caseId || '-',
        description: act.description,
        resultProgress: act.resultProgress || '-',
        obstacles: act.obstacles || '-',
        followUp: act.followUp || '-',
        status: act.status,
        durationMinutes: act.durationMinutes || 60,
      });
      row.alignment = { vertical: 'middle', wrapText: true };
      row.getCell('durationMinutes').alignment = { horizontal: 'center' };
    });

    // -----------------------------------------------------------------
    // Sheet 3: Case Register
    // -----------------------------------------------------------------
    const ws3 = workbook.addWorksheet('Case Register', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    ws3.columns = [
      { header: 'Case ID', key: 'id', width: 16 },
      { header: 'Tanggal Dibuat', key: 'createdAt', width: 15 },
      { header: 'Klien', key: 'clientName', width: 30 },
      { header: 'Divisi', key: 'division', width: 14 },
      { header: 'Judul Masalah', key: 'title', width: 35 },
      { header: 'Prioritas / Risiko', key: 'priority', width: 18 },
      { header: 'PIC Penanggung Jawab', key: 'picName', width: 24 },
      { header: 'Uraian Kasus & Temuan', key: 'description', width: 45 },
      { header: 'Akar Masalah (Root Cause)', key: 'rootCause', width: 35 },
      { header: 'Tindakan yang Dilakukan', key: 'actionsTaken', width: 35 },
      { header: 'Progres Terkini', key: 'latestProgress', width: 35 },
      { header: 'Status Kasus', key: 'status', width: 18 },
      { header: 'Target Follow-up', key: 'nextFollowUpDate', width: 16 },
      { header: 'Catatan Penyelesaian', key: 'resolutionNotes', width: 35 },
    ];
    applyHeaderStyle(ws3.getRow(1));

    db.cases.forEach((c) => {
      const row = ws3.addRow({
        id: c.id,
        createdAt: c.createdAt?.split('T')[0] || '-',
        clientName: c.clientName,
        division: c.division,
        title: c.title,
        priority: c.priority,
        picName: c.picName,
        description: c.description,
        rootCause: c.rootCause || '-',
        actionsTaken: c.actionsTaken || '-',
        latestProgress: c.latestProgress || '-',
        status: c.status,
        nextFollowUpDate: c.nextFollowUpDate || '-',
        resolutionNotes: c.resolutionNotes || '-',
      });
      row.alignment = { vertical: 'middle', wrapText: true };
    });

    // -----------------------------------------------------------------
    // Sheet 4: Pending Follow Up
    // -----------------------------------------------------------------
    const ws4 = workbook.addWorksheet('Pending Follow Up', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    ws4.columns = [
      { header: 'Case ID', key: 'id', width: 16 },
      { header: 'Klien', key: 'clientName', width: 30 },
      { header: 'Divisi', key: 'division', width: 14 },
      { header: 'Judul Permasalahan', key: 'title', width: 35 },
      { header: 'Prioritas', key: 'priority', width: 15 },
      { header: 'Jatuh Tempo Follow-up', key: 'nextFollowUpDate', width: 22 },
      { header: 'Status Keterlambatan', key: 'overdueStatus', width: 22 },
      { header: 'PIC Penanggung Jawab', key: 'followUpPicName', width: 25 },
      { header: 'Rencana Tindak Lanjut', key: 'followUpPlan', width: 45 },
      { header: 'Status Kasus Saat Ini', key: 'status', width: 18 },
    ];
    applyHeaderStyle(ws4.getRow(1));

    const activeCases = db.cases.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed');
    activeCases.forEach((c) => {
      const isOverdue = c.nextFollowUpDate && c.nextFollowUpDate < todayStr;
      const row = ws4.addRow({
        id: c.id,
        clientName: c.clientName,
        division: c.division,
        title: c.title,
        priority: c.priority,
        nextFollowUpDate: c.nextFollowUpDate || '-',
        overdueStatus: isOverdue ? 'TERLAMBAT (Lewat Batas)' : 'Sesuai Jadwal (Aktif)',
        followUpPicName: c.followUpPicName || c.picName,
        followUpPlan: c.followUpPlan || c.latestProgress || '-',
        status: c.status,
      });
      row.alignment = { vertical: 'middle', wrapText: true };
      if (isOverdue) {
        row.getCell('overdueStatus').font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    // -----------------------------------------------------------------
    // Sheet 5: Job Management
    // -----------------------------------------------------------------
    const ws5 = workbook.addWorksheet('Job Management', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    ws5.columns = [
      { header: 'Job ID', key: 'id', width: 16 },
      { header: 'Nama Klien', key: 'clientName', width: 30 },
      { header: 'Divisi', key: 'division', width: 14 },
      { header: 'Judul Pekerjaan', key: 'title', width: 35 },
      { header: 'Prioritas', key: 'priority', width: 14 },
      { header: 'Staff PIC', key: 'picName', width: 24 },
      { header: 'SPV Reviewer', key: 'spvName', width: 24 },
      { header: 'Tgl Mulai', key: 'startDate', width: 14 },
      { header: 'Deadline', key: 'deadline', width: 14 },
      { header: 'Progres', key: 'progressPercent', width: 12 },
      { header: 'Status Pekerjaan', key: 'status', width: 18 },
      { header: 'Catatan Review SPV', key: 'reviewNotes', width: 35 },
    ];
    applyHeaderStyle(ws5.getRow(1));

    db.jobs.forEach((job) => {
      const row = ws5.addRow({
        id: job.id,
        clientName: job.clientName,
        division: job.division,
        title: job.title,
        priority: job.priority,
        picName: job.picName,
        spvName: job.spvName,
        startDate: job.startDate,
        deadline: job.deadline,
        progressPercent: `${job.progressPercent}%`,
        status: job.status,
        reviewNotes: job.reviewNotes || '-',
      });
      row.alignment = { vertical: 'middle', wrapText: true };
      row.getCell('progressPercent').alignment = { horizontal: 'center' };
    });

    // -----------------------------------------------------------------
    // Sheet 6: Master Klien & Profil Pajak
    // -----------------------------------------------------------------
    const ws6 = workbook.addWorksheet('Master Klien & Pajak', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    ws6.columns = [
      { header: 'Client ID', key: 'id', width: 14 },
      { header: 'Nama Klien', key: 'name', width: 32 },
      { header: 'Tipe', key: 'type', width: 10 },
      { header: 'Bentuk Usaha', key: 'entityType', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Status PKP', key: 'pkpStatus', width: 14 },
      { header: 'Rezim PPh', key: 'pphRegime', width: 24 },
      { header: 'Tahun Pajak', key: 'taxYearEffective', width: 12 },
      { header: 'Fasilitas UMKM', key: 'umkm', width: 18 },
      { header: 'Staff Acc PIC', key: 'accountingStaffPicName', width: 22 },
      { header: 'Staff Tax PIC', key: 'taxStaffPicName', width: 22 },
      { header: 'SPV Acc', key: 'accountingSpvName', width: 22 },
      { header: 'SPV Tax', key: 'taxSpvName', width: 22 },
      { header: 'Status 4 PIC', key: 'picAssignmentStatus', width: 16 },
      { header: 'Risiko Acc', key: 'accountingRisk', width: 14 },
      { header: 'Risiko Tax', key: 'taxRisk', width: 14 },
      { header: 'Alasan Risiko', key: 'riskReason', width: 35 },
    ];
    applyHeaderStyle(ws6.getRow(1));

    db.clients.forEach((c) => {
      const row = ws6.addRow({
        id: c.id,
        name: c.name,
        type: c.type,
        entityType: c.entityType,
        status: c.status,
        pkpStatus: c.pkpStatus,
        pphRegime: c.pphRegime,
        taxYearEffective: c.taxYearEffective,
        umkm: c.umkmFacilityEndYear ? `s/d ${c.umkmFacilityEndYear}` : '-',
        accountingStaffPicName: c.accountingStaffPicName || '-',
        taxStaffPicName: c.taxStaffPicName || '-',
        accountingSpvName: c.accountingSpvName || '-',
        taxSpvName: c.taxSpvName || '-',
        picAssignmentStatus: c.picAssignmentStatus,
        accountingRisk: c.accountingRisk,
        taxRisk: c.taxRisk,
        riskReason: c.taxRiskReason || c.accountingRiskReason || '-',
      });
      row.alignment = { vertical: 'middle', wrapText: true };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TMM_BMA_Management_Activity_Report_${Date.now()}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  }
);
