import { db } from './db';
import { getRuntimeSecret } from './runtime-secret';
import { UserAccount, UserRole } from '@/types/quiz';

const PBKDF2_ITERATIONS = 120000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Emergency bootstrap hashes only. Plaintext passwords are never stored in the
// repository. Operators should replace these bootstrap accounts after login or
// override them with Cloudflare Secrets.
const BOOTSTRAP_ADMIN_HASH = 'pbkdf2$120000$VNQ8FXKnDHUSUX7ianX1Xw$yfE741mHe1jFOOhjIj8Gm27uRKunbIeeQ2KpewhibJ0';
const BOOTSTRAP_TRAINER_HASH = 'pbkdf2$120000$UzEGNdOkBj6D3e8GMdEnUA$dQsjS_j7fA28SgdfgX6r_385RFBjy24Tl0AzhkYqfK4';

function base64url(input: Uint8Array | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return buffer.toString('base64url');
}

function fromBase64url(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  return Uint8Array.from(input).buffer;
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(passwordBytes),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64url(salt)}$${base64url(hash)}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!encoded.startsWith('pbkdf2$')) return password === encoded;
  const [, iterationText, saltText, hashText] = encoded.split('$');
  const iterations = Number(iterationText);
  if (!iterations || !saltText || !hashText) return false;
  const actual = await derivePassword(password, fromBase64url(saltText), iterations);
  const expected = fromBase64url(hashText);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function getTokenSecret(): Promise<string> {
  const secret = process.env.AUTH_TOKEN_SECRET || process.env.AUTH_ADMIN_PASSWORD;
  if (secret) return secret;
  return getRuntimeSecret('auth-token');
}

async function sign(value: string): Promise<string> {
  const secretBytes = new TextEncoder().encode(await getTokenSecret());
  const valueBytes = new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(secretBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(valueBytes));
  return base64url(new Uint8Array(signature));
}

async function ensureBootstrapUsers(): Promise<void> {
  const users = await db.getUsers();
  if (users.length > 0) return;

  const now = new Date().toISOString();
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD;
  const trainerPassword = process.env.AUTH_TRAINER_PASSWORD;

  await db.saveUser({
    id: 'usr-admin-01',
    username: process.env.AUTH_ADMIN_USERNAME || 'admin',
    password_hash: adminPassword ? await hashPassword(adminPassword) : BOOTSTRAP_ADMIN_HASH,
    name: process.env.AUTH_ADMIN_NAME || 'Super Administrator',
    role: 'SUPER_ADMIN',
    email: process.env.AUTH_ADMIN_EMAIL || undefined,
    created_at: now,
  });

  await db.saveUser({
    id: 'usr-trainer-01',
    username: process.env.AUTH_TRAINER_USERNAME || 'trainer',
    password_hash: trainerPassword ? await hashPassword(trainerPassword) : BOOTSTRAP_TRAINER_HASH,
    name: process.env.AUTH_TRAINER_NAME || 'Senior Lead Trainer',
    role: 'TRAINER',
    email: process.env.AUTH_TRAINER_EMAIL || undefined,
    created_at: now,
  });
}

export type AuthPayload = {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  iat: number;
  exp: number;
};

export const authService = {
  getAllUsers: async (): Promise<Omit<UserAccount, 'password_hash'>[]> => {
    await ensureBootstrapUsers();
    return (await db.getUsers()).map(({ password_hash: _passwordHash, ...rest }) => rest);
  },

  authenticate: async (username: string, password: string): Promise<{ user: Omit<UserAccount, 'password_hash'>; token: string } | null> => {
    await ensureBootstrapUsers();
    const found = await db.getUserByUsername(username);
    if (!found || !(await verifyPassword(password, found.password_hash))) return null;

    if (!found.password_hash.startsWith('pbkdf2$')) {
      found.password_hash = await hashPassword(password);
      await db.saveUser(found);
    }

    const now = Date.now();
    const payload: AuthPayload = {
      id: found.id,
      username: found.username,
      role: found.role,
      name: found.name,
      iat: now,
      exp: now + TOKEN_TTL_MS,
    };
    const encoded = base64url(JSON.stringify(payload));
    const token = `${encoded}.${await sign(encoded)}`;
    const { password_hash: _passwordHash, ...user } = found;
    return { user, token };
  },

  verifyToken: async (token: string): Promise<AuthPayload | null> => {
    try {
      const [encoded, signature] = token.split('.');
      if (!encoded || !signature) return null;
      const expected = await sign(encoded);
      const actualBytes = fromBase64url(signature);
      const expectedBytes = fromBase64url(expected);
      if (actualBytes.length !== expectedBytes.length) return null;
      let diff = 0;
      for (let i = 0; i < actualBytes.length; i += 1) diff |= actualBytes[i] ^ expectedBytes[i];
      if (diff !== 0) return null;

      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AuthPayload;
      if (!payload.exp || payload.exp < Date.now()) return null;
      if (!['SUPER_ADMIN', 'TRAINER', 'PARTICIPANT'].includes(payload.role)) return null;
      return payload;
    } catch {
      return null;
    }
  },

  createUser: async (userData: { username: string; password: string; name: string; role: UserRole; email?: string }): Promise<Omit<UserAccount, 'password_hash'>> => {
    const username = userData.username?.trim();
    const name = userData.name?.trim();
    if (!username || !name) throw new Error('Username dan nama wajib diisi');
    if (!userData.password || userData.password.length < 10) throw new Error('Password minimal 10 karakter');
    if (!['SUPER_ADMIN', 'TRAINER'].includes(userData.role)) throw new Error('Role tidak valid');
    if (await db.getUserByUsername(username)) throw new Error('Username sudah digunakan');

    const user: UserAccount = {
      id: 'usr-' + Date.now(),
      username,
      password_hash: await hashPassword(userData.password),
      name,
      role: userData.role,
      email: userData.email?.trim() || undefined,
      created_at: new Date().toISOString(),
    };
    await db.saveUser(user);
    const { password_hash: _passwordHash, ...safeUser } = user;
    return safeUser;
  },
};
