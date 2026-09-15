import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';
import { UserAccount, UserRole } from '@/types/quiz';

const DATA_DIR = process.env.QAIP_DATA_DIR || path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STAFF_ROLES: UserRole[] = ['SUPER_ADMIN', 'TRAINER'];

export interface AuthTokenPayload {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  exp: number;
}

export interface ParticipantTokenPayload {
  participantId: string;
  sessionId: string;
  scope: 'PARTICIPANT';
  exp: number;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET wajib diatur minimal 32 karakter pada environment produksi.');
  }

  return 'qaipquiz-development-only-secret-change-before-production';
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('scrypt$')) {
    const [, saltEncoded, hashEncoded] = stored.split('$');
    if (!saltEncoded || !hashEncoded) return false;

    try {
      const salt = Buffer.from(saltEncoded, 'base64url');
      const expected = Buffer.from(hashEncoded, 'base64url');
      const actual = scryptSync(password, salt, expected.length);
      return safeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  // Backward-compatible one-time migration for legacy plaintext records.
  return safeEqual(Buffer.from(password), Buffer.from(stored));
}

function buildBootstrapUsers(): UserAccount[] {
  const now = new Date().toISOString();
  const users: UserAccount[] = [];

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminPassword) {
    users.push({
      id: 'usr-admin-bootstrap',
      username: (process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin').trim(),
      password_hash: hashPassword(adminPassword),
      name: (process.env.BOOTSTRAP_ADMIN_NAME || 'Super Administrator').trim(),
      role: 'SUPER_ADMIN',
      email: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim(),
      created_at: now,
    });
  }

  const trainerPassword = process.env.BOOTSTRAP_TRAINER_PASSWORD;
  if (trainerPassword) {
    users.push({
      id: 'usr-trainer-bootstrap',
      username: (process.env.BOOTSTRAP_TRAINER_USERNAME || 'trainer').trim(),
      password_hash: hashPassword(trainerPassword),
      name: (process.env.BOOTSTRAP_TRAINER_NAME || 'Lead Trainer').trim(),
      role: 'TRAINER',
      email: process.env.BOOTSTRAP_TRAINER_EMAIL?.trim(),
      created_at: now,
    });
  }

  return users;
}

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveUsers(users: UserAccount[]): void {
  ensureDataDir();
  const tmpFile = `${USERS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tmpFile, USERS_FILE);
}

function getUsers(): UserAccount[] {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as UserAccount[];
    } catch (error) {
      console.error('Gagal membaca users.json:', error);
    }
  }

  const bootstrapUsers = buildBootstrapUsers();
  if (bootstrapUsers.length > 0) {
    try {
      saveUsers(bootstrapUsers);
    } catch (error) {
      console.error('Gagal menyimpan bootstrap users:', error);
    }
  }

  return bootstrapUsers;
}

function signPayload(payload: object): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getAuthSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function decodeVerifiedPayload(token: string): unknown | null {
  try {
    const [encodedPayload, encodedSignature, extra] = token.split('.');
    if (!encodedPayload || !encodedSignature || extra) return null;

    const expectedSignature = createHmac('sha256', getAuthSecret())
      .update(encodedPayload)
      .digest();
    const suppliedSignature = Buffer.from(encodedSignature, 'base64url');
    if (!safeEqual(expectedSignature, suppliedSignature)) return null;

    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function verifySignedToken(token: string): AuthTokenPayload | null {
  const decoded = decodeVerifiedPayload(token) as AuthTokenPayload | null;
  if (
    !decoded ||
    typeof decoded.id !== 'string' ||
    typeof decoded.username !== 'string' ||
    typeof decoded.name !== 'string' ||
    !STAFF_ROLES.includes(decoded.role) ||
    typeof decoded.exp !== 'number' ||
    decoded.exp < Date.now()
  ) {
    return null;
  }
  return decoded;
}

function verifyParticipantToken(token: string): ParticipantTokenPayload | null {
  const decoded = decodeVerifiedPayload(token) as ParticipantTokenPayload | null;
  if (
    !decoded ||
    decoded.scope !== 'PARTICIPANT' ||
    typeof decoded.participantId !== 'string' ||
    typeof decoded.sessionId !== 'string' ||
    typeof decoded.exp !== 'number' ||
    decoded.exp < Date.now()
  ) {
    return null;
  }
  return decoded;
}

function validateNewUser(userData: { username: string; password: string; name: string; role: UserRole; email?: string }): void {
  const username = userData.username?.trim();
  const name = userData.name?.trim();

  if (!username || !/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new Error('Username harus 3-40 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.');
  }
  if (!name || name.length < 2 || name.length > 100) {
    throw new Error('Nama wajib diisi 2-100 karakter.');
  }
  if (!STAFF_ROLES.includes(userData.role)) {
    throw new Error('Role pengguna tidak valid.');
  }
  if (!userData.password || userData.password.length < 10) {
    throw new Error('Password minimal 10 karakter.');
  }
}

export const authService = {
  getAllUsers: (): Omit<UserAccount, 'password_hash'>[] => {
    return getUsers().map(({ password_hash: _passwordHash, ...user }) => user);
  },

  authenticate: (username: string, password: string): { user: Omit<UserAccount, 'password_hash'>; token: string } | null => {
    const users = getUsers();
    const cleanUser = username.trim().toLowerCase();
    const foundIndex = users.findIndex(user => user.username.toLowerCase() === cleanUser);
    if (foundIndex < 0) return null;

    const found = users[foundIndex];
    if (!verifyPassword(password, found.password_hash)) return null;

    if (!found.password_hash.startsWith('scrypt$')) {
      found.password_hash = hashPassword(password);
      users[foundIndex] = found;
      saveUsers(users);
    }

    const payload: AuthTokenPayload = {
      id: found.id,
      username: found.username,
      role: found.role,
      name: found.name,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };

    const { password_hash: _passwordHash, ...userProfile } = found;
    return { user: userProfile, token: signPayload(payload) };
  },

  verifyToken: (token: string): AuthTokenPayload | null => verifySignedToken(token),

  createParticipantToken: (participantId: string, sessionId: string): string => signPayload({
    participantId,
    sessionId,
    scope: 'PARTICIPANT',
    exp: Date.now() + 12 * 60 * 60 * 1000,
  } satisfies ParticipantTokenPayload),

  verifyParticipantToken: (token: string): ParticipantTokenPayload | null => verifyParticipantToken(token),

  createUser: (userData: { username: string; password: string; name: string; role: UserRole; email?: string }): Omit<UserAccount, 'password_hash'> => {
    validateNewUser(userData);

    const users = getUsers();
    const cleanUsername = userData.username.trim();
    if (users.some(user => user.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new Error('Username sudah digunakan.');
    }

    const newUser: UserAccount = {
      id: `usr-${randomBytes(12).toString('hex')}`,
      username: cleanUsername,
      password_hash: hashPassword(userData.password),
      name: userData.name.trim(),
      role: userData.role,
      email: userData.email?.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    const { password_hash: _passwordHash, ...safeUser } = newUser;
    return safeUser;
  },
};
