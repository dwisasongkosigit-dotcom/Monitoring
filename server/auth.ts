import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { User, UserRole } from './types.ts';

export interface SessionInfo {
  token: string;
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  expiresAt: number;
}

// In-memory active session tokens mapped to user session info
const sessions = new Map<string, SessionInfo>();

// 12 hours session validity
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

export function createSession(user: User): SessionInfo {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const sessionInfo: SessionInfo = {
    token,
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    expiresAt,
  };
  sessions.set(token, sessionInfo);
  return sessionInfo;
}

export function getSession(token?: string): SessionInfo | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function destroySession(token?: string): boolean {
  if (!token) return false;
  return sessions.delete(token);
}

// Express extended request interface
export interface AuthenticatedRequest extends Request {
  user?: SessionInfo;
}

// Auth Middleware: extracts token from Authorization: Bearer <token> or X-Session-Token
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.headers['x-session-token'] as string | undefined);

  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login kembali.' });
    return;
  }

  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid. Silakan login kembali.' });
    return;
  }

  req.user = session;
  next();
}

// Role Guard Middleware
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Akses ditolak: belum terautentikasi.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Akses ditolak: Peran '${req.user.role}' tidak memiliki izin untuk tindakan ini. Diperlukan salah satu dari: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

// Read-only Enforcement: Owner & Manager can never write/modify data
export function requireWritable(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Akses ditolak: belum terautentikasi.' });
    return;
  }

  if (req.user.role === 'Owner' || req.user.role === 'Manager') {
    res.status(403).json({
      error: `HAK AKSES DITOLAK: Peran '${req.user.role}' bersifat Read-Only (Hanya Lihat). Anda tidak memiliki izin untuk menambah, mengubah, menyetujui, atau menghapus data.`,
    });
    return;
  }

  next();
}
