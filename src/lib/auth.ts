import { UserAccount, UserRole } from '@/types/quiz';
import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

const defaultUsers: UserAccount[] = [
  {
    id: 'usr-admin-01',
    username: 'admin',
    password_hash: 'admin123',
    name: 'Super Administrator',
    role: 'SUPER_ADMIN',
    email: 'admin@audit-training.id',
    created_at: new Date().toISOString()
  },
  {
    id: 'usr-trainer-01',
    username: 'trainer',
    password_hash: 'trainer123',
    name: 'Senior Lead Trainer',
    role: 'TRAINER',
    email: 'trainer@audit-training.id',
    created_at: new Date().toISOString()
  }
];

function getUsers(): UserAccount[] {
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error reading users.json:', e);
    }
  }
  // Initialize default
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing users.json:', e);
  }
  return defaultUsers;
}

function saveUsers(users: UserAccount[]): void {
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving users.json:', e);
  }
}

export const authService = {
  getAllUsers: (): Omit<UserAccount, 'password_hash'>[] => {
    return getUsers().map(u => {
      const { password_hash, ...rest } = u;
      return rest;
    });
  },

  authenticate: (username: string, password: string): { user: Omit<UserAccount, 'password_hash'>; token: string } | null => {
    const users = getUsers();
    const cleanUser = username.trim().toLowerCase();
    const found = users.find(u => u.username.toLowerCase() === cleanUser);
    
    if (!found || found.password_hash !== password) {
      return null;
    }

    const token = Buffer.from(JSON.stringify({
      id: found.id,
      username: found.username,
      role: found.role,
      name: found.name,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    const { password_hash, ...userProfile } = found;
    return { user: userProfile, token };
  },

  verifyToken: (token: string): { id: string; username: string; role: UserRole; name: string } | null => {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      if (decoded.exp && decoded.exp < Date.now()) {
        return null;
      }
      return decoded;
    } catch (e) {
      return null;
    }
  },

  createUser: (userData: { username: string; password: string; name: string; role: UserRole; email?: string }): Omit<UserAccount, 'password_hash'> => {
    const users = getUsers();
    if (users.find(u => u.username.toLowerCase() === userData.username.trim().toLowerCase())) {
      throw new Error('Username sudah digunakan');
    }

    const newUser: UserAccount = {
      id: 'usr-' + Date.now(),
      username: userData.username.trim(),
      password_hash: userData.password,
      name: userData.name.trim(),
      role: userData.role,
      email: userData.email?.trim(),
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const { password_hash, ...rest } = newUser;
    return rest;
  }
};
