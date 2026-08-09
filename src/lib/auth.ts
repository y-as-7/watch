import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'watch-room-super-secret-key-2026-secure-jwt';

// Mutable in-memory admin store (initialized with default credentials)
let adminData = {
  email: process.env.ADMIN_EMAIL || 'admin@admin.com',
  // bcrypt hash for 'password'
  passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'password', 10),
};

export function getAdminCredentials() {
  return { email: adminData.email };
}

export function updateAdminCredentials(newEmail?: string, newPassword?: string) {
  if (newEmail && newEmail.trim() !== '') {
    adminData.email = newEmail.trim();
  }
  if (newPassword && newPassword.trim() !== '') {
    adminData.passwordHash = bcrypt.hashSync(newPassword.trim(), 10);
  }
  return { email: adminData.email };
}

export function verifyAdminPassword(password: string): boolean {
  return bcrypt.compareSync(password, adminData.passwordHash);
}

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin', email: adminData.email }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAdminToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; email: string };
    if (decoded.role === 'admin') {
      return decoded;
    }
  } catch {
    return null;
  }
  return null;
}
