import { db } from './db';
import { getRuntimeSecret } from './runtime-secret';
import { UserAccount, UserRole } from '@/types/quiz';

// Cloudflare Workers currently rejects PBKDF2 iteration counts above 10,000
// in the runtime used by this application. Keep new password hashes within the
// supported limit so authentication works consistently in production.
const PBKDF2_ITERATIONS = 10000;
const MAX_RUNTIME_PBKDF2_ITERATIONS = 10000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Emergency bootstrap/recovery hashes only. Plaintext passwords are never
// stored in the repository. These hashes also provide a one-time recovery path
// for legacy 120,000-iteration staff hashes that Cloudflare can no longer
// evaluate. A successful recovery login immediately rewrites the stored hash
// using the runtime-compatible iteration count.
const BOOTSTRAP_ADMIN_HASH = 'pbkdf2$10000$uW2sN3w-ZTGafIyHylaelA$_x5eLHFalRap-iFbY0c1jF_Hu3mfDq45S0hDrPPY7Y0';
const BOOTSTRAP_TRAINER_HASH = 'pbkdf2$10000$WkRpKAasJcU8qur7VMN4_Q$vQH1z3rxXO2ze4VpQyqU4waER144RlprMjZ1U45mjj4';

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

function getEncodedIterations(encoded: string): number | null {
  if (!encoded.startsWith('pbkdf2$')) return null;
  const [, iterationText] = encoded.split('$');
  const iterations = Number(iterationText);
  return Number.isFinite(iterations) && iterations > 0 ? iterations : null;
}

function needsRuntimeMigration(encoded: string): boolean {
  const iterations = getEncodedIterations(encoded);
  return iterations !== null && iterations > MAX_RUNTIME_PBKDF2_ITERATIONS;
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  if (iterations > MAX_RUNTIME_PBKDF2_ITERATIONS) {
    throw new Error(`Unsupported PBKDF2 iteration count: ${iterations}`);
  }

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

  // Do not call WebCrypto with an iteration count the Cloudflare runtime will
  // reject. Legacy staff accounts are handled through the recovery path below.
  if (iterations > MAX_RUNTIME_PBKDF2_ITERATIONS) return false;

  const actual = await derivePassword(password, fromBase64url(saltText), iterations);
  const expected = fromBase64url(hashText);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function verifyRecoveryCredential(user: UserAccount, password: string): Promise<boolean> {
  if (!needsRuntimeMigration(user.password_hash)) return false;

  if (user.role === 'SUPER_ADMIN') {
    const configured = process.env.AUTH_ADMIN_PASSWORD;
    if (configured && password === configured) return true;
    return verifyPassword(password, BOOTSTRAP_ADMIN_HASH);
  }

  if (user.role === 'TRAINER') {
    const configured = process.env.AUTH_TRAINER_PASSWORD;
    if (configured && password === configured) return true;
    return verifyPassword(password, BOOTSTRAP_TRAINER_HASH);
  }

  return false;
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
    if (!found) return null;

    const passwordValid = await verifyPassword(password, found.password_hash);
    const recoveredLegacyHash = !passwordValid && (await verifyRecoveryCredential(found, password));
    if (!passwordValid && !recoveredLegacyHash) return null;

    if (recoveredLegacyHash || !found.password_hash.startsWith('pbkdf2$')) {
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