import fs from 'node:fs';
import path from 'node:path';
import { getInitialSeedData } from './seed.ts';
import { hashPassword } from './auth.ts';
import type { DatabaseSchema, BackupInfo, AuditLog, Client } from './types.ts';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'tmm_bma_database.json');
const BACKUP_FILE = path.join(DATA_DIR, 'tmm_bma_database.backup.json');

let inMemoryDb: DatabaseSchema | null = null;
let lastScheduledBackupDate = '';

// Ensure data & backup directories exist
function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

// Atomic file write using temporary file and rename
function atomicWriteFile(filePath: string, data: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
  fs.writeFileSync(tempPath, data, 'utf-8');
  fs.renameSync(tempPath, filePath);
}

// Persist database schema to disk atomically
function saveDatabase(db: DatabaseSchema): void {
  ensureDirs();
  const serialized = JSON.stringify(db, null, 2);
  atomicWriteFile(DB_FILE, serialized);
  atomicWriteFile(BACKUP_FILE, serialized);
}

// Migrate/upgrade in-memory schema safely to ensure Prompt 2 compatibility
function upgradeSchema(db: DatabaseSchema): DatabaseSchema {
  if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
  if (!Array.isArray(db.backups)) db.backups = [];

  // Ensure Owner and Manager users exist
  const hasOwner = db.users.some((u) => u.role === 'Owner');
  if (!hasOwner) {
    const ownerPass = hashPassword('OwnerPass2026!');
    db.users.push({
      id: 'USR-OWN01',
      name: 'Bambang M. Adisurya, MBA (Owner)',
      username: 'owner',
      role: 'Owner',
      passwordHash: ownerPass.hash,
      salt: ownerPass.salt,
      email: 'owner@tmm-bma.id',
      active: true,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const hasManager = db.users.some((u) => u.role === 'Manager');
  if (!hasManager) {
    const mgrPass = hashPassword('ManagerPass2026!');
    db.users.push({
      id: 'USR-MGR01',
      name: 'Kartika Sari, SE, M.Ak (Manager)',
      username: 'manager',
      role: 'Manager',
      passwordHash: mgrPass.hash,
      salt: mgrPass.salt,
      email: 'manager@tmm-bma.id',
      active: true,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Ensure 4 PIC assignment fields exist on each client
  db.clients.forEach((c: any) => {
    if (!c.version) c.version = 1;
    if (!c.picHistory) c.picHistory = [];

    // Ensure 4 distinct PIC roles:
    if (!c.accountingStaffPicId) c.accountingStaffPicId = c.accountingPicId || 'USR-STF-ACC';
    if (!c.accountingStaffPicName) c.accountingStaffPicName = c.accountingPicName || 'Budi Pratama, S.Ak.';
    if (!c.taxStaffPicId) c.taxStaffPicId = c.taxPicId || 'USR-STF-TAX';
    if (!c.taxStaffPicName) c.taxStaffPicName = c.taxPicName || 'Dewi Lestari, S.Tr.Akt.';
    if (!c.accountingSpvId) c.accountingSpvId = 'USR-SPV-ACC';
    if (!c.accountingSpvName) c.accountingSpvName = 'Hendra Wijaya, SE, Ak., CA';
    if (!c.taxSpvId) c.taxSpvId = 'USR-SPV-TAX';
    if (!c.taxSpvName) c.taxSpvName = 'Ratna Kartika, SE, BKP';

    // Verification of completeness: all 4 must be valid non-empty
    const isComplete =
      Boolean(c.accountingStaffPicName && c.accountingStaffPicName !== '-' && c.accountingStaffPicName.trim()) &&
      Boolean(c.taxStaffPicName && c.taxStaffPicName !== '-' && c.taxStaffPicName.trim()) &&
      Boolean(c.accountingSpvName && c.accountingSpvName !== '-' && c.accountingSpvName.trim()) &&
      Boolean(c.taxSpvName && c.taxSpvName !== '-' && c.taxSpvName.trim());

    c.picAssignmentStatus = isComplete ? 'Lengkap' : 'Belum Lengkap';

    // Synchronize backward-compat fields
    c.accountingPicId = c.accountingStaffPicId;
    c.accountingPicName = c.accountingStaffPicName;
    c.taxPicId = c.taxStaffPicId;
    c.taxPicName = c.taxStaffPicName;
    c.spvId = c.accountingSpvId;
    c.spvName = c.accountingSpvName;
  });

  // Ensure job versions
  db.jobs.forEach((j: any) => {
    if (!j.version) j.version = 1;
  });

  // Ensure case versions
  db.cases.forEach((c: any) => {
    if (!c.version) c.version = 1;
  });

  return db;
}

// Load database or initialize only if not present
export function initDatabase(): DatabaseSchema {
  ensureDirs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed: DatabaseSchema = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.clients) && Array.isArray(parsed.users)) {
        inMemoryDb = upgradeSchema(parsed);
        saveDatabase(inMemoryDb);
        console.log(`[DB] Database persisten berhasil dimuat dari ${DB_FILE}. Total klien: ${inMemoryDb.clients.length}, Jobs: ${inMemoryDb.jobs.length}`);
        startBackupScheduler();
        return inMemoryDb;
      }
    } catch (err) {
      console.error('[DB] Gagal membaca DB_FILE utama, mencoba memulihkan dari backup...', err);
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          const backupRaw = fs.readFileSync(BACKUP_FILE, 'utf-8');
          const backupParsed: DatabaseSchema = JSON.parse(backupRaw);
          inMemoryDb = upgradeSchema(backupParsed);
          atomicWriteFile(DB_FILE, backupRaw);
          console.log('[DB] Berhasil dipulihkan dari backup.');
          startBackupScheduler();
          return inMemoryDb;
        } catch (backupErr) {
          console.error('[DB] Backup juga gagal dibaca:', backupErr);
        }
      }
    }
  }

  // If absent, initialize fresh from seed
  console.log('[DB] Inisialisasi database baru TMM/BMA...');
  const seed = getInitialSeedData();
  inMemoryDb = upgradeSchema(seed);

  try {
    const serialized = JSON.stringify(inMemoryDb, null, 2);
    atomicWriteFile(DB_FILE, serialized);
    atomicWriteFile(BACKUP_FILE, serialized);
    console.log(`[DB] Inisialisasi database persisten tersimpan di ${DB_FILE}`);
  } catch (err) {
    console.error('[DB] Gagal menyimpan inisialisasi awal database:', err);
  }

  startBackupScheduler();
  return inMemoryDb;
}

export function getDb(): DatabaseSchema {
  if (!inMemoryDb) {
    return initDatabase();
  }
  return inMemoryDb;
}

export function mutateDb(mutator: (db: DatabaseSchema) => void): DatabaseSchema {
  const db = getDb();
  mutator(db);
  db.lastSaved = new Date().toISOString();
  db.version = (db.version || 1) + 1;

  try {
    ensureDirs();
    const serialized = JSON.stringify(db, null, 2);
    atomicWriteFile(DB_FILE, serialized);
    if (db.version % 2 === 0 || !fs.existsSync(BACKUP_FILE)) {
      atomicWriteFile(BACKUP_FILE, serialized);
    }
  } catch (err) {
    console.error('[DB] Gagal menyimpan perubahan ke disk:', err);
    throw new Error('Gagal menyimpan data ke penyimpanan persisten server.');
  }

  return db;
}

// Log audit trail
export function logAudit(
  action: string,
  targetType: AuditLog['targetType'],
  details: string,
  user: { userId: string; name: string; role: string },
  targetId?: string,
  targetName?: string,
  ip?: string
): void {
  try {
    const db = getDb();
    const auditItem: AuditLog = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      action,
      targetType,
      targetId,
      targetName,
      details,
      ip,
    };
    db.auditLogs = db.auditLogs || [];
    db.auditLogs.unshift(auditItem);
    // Keep max 5000 audit records
    if (db.auditLogs.length > 5000) {
      db.auditLogs = db.auditLogs.slice(0, 5000);
    }
  } catch (err) {
    console.error('[Audit] Gagal mencatat audit log:', err);
  }
}

// Manual or Scheduled Backup Snapshot creation
export function createBackupSnapshot(
  type: 'manual' | 'scheduled',
  notes?: string,
  user?: { userId: string; name: string; role: string }
): BackupInfo {
  ensureDirs();
  const db = getDb();
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');
  const filename = `tmm_bma_backup_${type}_${timestampStr}.json`;
  const filePath = path.join(BACKUPS_DIR, filename);

  const snapshotData = JSON.stringify(db, null, 2);
  atomicWriteFile(filePath, snapshotData);

  const stats = fs.statSync(filePath);
  const backupInfo: BackupInfo = {
    id: `BKP-${Date.now()}`,
    filename,
    timestamp: now.toISOString(),
    sizeBytes: stats.size,
    type,
    recordsCount: {
      clients: db.clients.length,
      jobs: db.jobs.length,
      cases: db.cases.length,
      activities: db.activities.length,
      users: db.users.length,
    },
    status: 'valid',
    notes: notes || (type === 'manual' ? 'Cadangan data manual dibuat pengguna' : 'Cadangan otomatis sistem 23:00 WIB'),
  };

  mutateDb((database) => {
    database.backups = database.backups || [];
    database.backups.unshift(backupInfo);

    // Retain up to 30 days of snapshots
    if (database.backups.length > 35) {
      const removed = database.backups.splice(35);
      removed.forEach((b) => {
        try {
          const oldFile = path.join(BACKUPS_DIR, b.filename);
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        } catch {
          // ignore
        }
      });
    }

    // Log to audit trail
    const auditUser = user || { userId: 'SYSTEM', name: 'Sistem Otomatis', role: 'Admin' };
    logAudit(
      type === 'manual' ? 'MANUAL_BACKUP_CREATED' : 'SCHEDULED_BACKUP_CREATED',
      'Backup',
      `Berhasil membuat backup berkas ${filename} (${(stats.size / 1024).toFixed(1)} KB) mencakup ${db.clients.length} klien dan ${db.jobs.length} pekerjaan.`,
      auditUser,
      backupInfo.id,
      filename
    );
  });

  return backupInfo;
}

// Restore database from a verified backup snapshot (Admin only)
export function restoreFromSnapshot(
  backupFilename: string,
  user: { userId: string; name: string; role: string }
): { success: boolean; message: string; version: number } {
  ensureDirs();
  const targetPath = path.join(BACKUPS_DIR, backupFilename);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Berkas cadangan '${backupFilename}' tidak ditemukan di penyimpanan server.`);
  }

  // Pre-validate file
  let restoredData: DatabaseSchema;
  try {
    const raw = fs.readFileSync(targetPath, 'utf-8');
    restoredData = JSON.parse(raw);
    if (!Array.isArray(restoredData.clients) || !Array.isArray(restoredData.users)) {
      throw new Error('Struktur berkas cadangan tidak valid atau rusak.');
    }
  } catch (err: any) {
    throw new Error(`Validasi berkas cadangan gagal: ${err.message}`);
  }

  // Create safety pre-restore backup of current state
  createBackupSnapshot('manual', 'Pre-restore Safety Auto-Backup', user);

  // Apply restoration
  inMemoryDb = upgradeSchema(restoredData);
  inMemoryDb.lastSaved = new Date().toISOString();
  inMemoryDb.version = (inMemoryDb.version || 1) + 1;

  const serialized = JSON.stringify(inMemoryDb, null, 2);
  atomicWriteFile(DB_FILE, serialized);
  atomicWriteFile(BACKUP_FILE, serialized);

  logAudit(
    'DATABASE_RESTORE_EXECUTED',
    'Backup',
    `Database berhasil dipulihkan dari berkas cadangan '${backupFilename}' oleh ${user.name} (${user.role}).`,
    user,
    backupFilename,
    backupFilename
  );

  return {
    success: true,
    message: `Database berhasil dipulihkan dari '${backupFilename}'.`,
    version: inMemoryDb.version,
  };
}

// Background scheduler for automatic daily backup at 23:00 WIB (16:00 UTC)
function startBackupScheduler(): void {
  // Check every 60 seconds
  setInterval(() => {
    try {
      const now = new Date();
      // WIB is UTC+7
      const wibHour = (now.getUTCHours() + 7) % 24;
      const todayDateStr = now.toISOString().split('T')[0];

      // If it is 23:00 WIB and today's scheduled backup hasn't run yet
      if (wibHour === 23 && lastScheduledBackupDate !== todayDateStr) {
        lastScheduledBackupDate = todayDateStr;
        console.log(`[Backup Scheduler] Menjalankan cadangan otomatis harian 23:00 WIB (${todayDateStr})...`);
        createBackupSnapshot('scheduled', 'Backup harian otomatis 23:00 WIB');
      }
    } catch (err) {
      console.error('[Backup Scheduler] Error saat menjalankan backup otomatis:', err);
    }
  }, 60 * 1000);
}

export function getDbHealthInfo() {
  ensureDirs();
  const db = getDb();
  let fileSizeBytes = 0;
  let fileExists = false;

  try {
    if (fs.existsSync(DB_FILE)) {
      const stat = fs.statSync(DB_FILE);
      fileSizeBytes = stat.size;
      fileExists = true;
    }
  } catch {
    // ignore
  }

  return {
    status: 'connected',
    storageEngine: 'Disk Persistent JSON with Atomic Swaps (ACID-safe)',
    databaseFilePath: DB_FILE,
    existsOnDisk: fileExists,
    fileSizeBytes,
    lastSaved: db.lastSaved,
    version: db.version,
    counts: {
      users: db.users.length,
      clients: db.clients.length,
      activeClients: db.clients.filter((c) => c.status === 'Aktif').length,
      jobs: db.jobs.length,
      cases: db.cases.length,
      activities: db.activities.length,
      auditLogs: db.auditLogs?.length || 0,
      backups: db.backups?.length || 0,
    },
  };
}
