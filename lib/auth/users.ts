import { randomUUID } from 'crypto';
import { ensureAuthTables, isPgConfigured, pgQuery } from '@/lib/db/pg';
import { hashPassword } from '@/lib/auth/password';
import type { AuthProvider, AuthRole, AuthStatus, AuthUser } from '@/lib/auth/types';

type DbUserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  role: AuthRole;
  status: AuthStatus;
  provider: AuthProvider;
  approved_at: string | null;
  approved_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role,
    status: row.status,
    provider: row.provider,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireAuthStorage(): Promise<void> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL not configured');
  }
  const ok = await ensureAuthTables();
  if (!ok) {
    throw new Error('Auth tables unavailable');
  }
}

export async function ensureAuthBootstrap(): Promise<void> {
  if (!isPgConfigured()) return;
  const ok = await ensureAuthTables();
  if (!ok) return;

  const email = String(process.env.MASTER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.MASTER_PASSWORD || '').trim();
  const name = String(process.env.MASTER_NAME || 'Master User').trim();
  if (!email || !password) {
    console.warn('[AUTH_BOOTSTRAP_SKIPPED] MASTER_EMAIL/MASTER_PASSWORD not configured');
    return;
  }

  const existing = await findAuthUserByEmail(email);
  const passwordHash = hashPassword(password);
  if (!existing) {
    const id = randomUUID();
    await pgQuery(
      `INSERT INTO auth_users (id, email, password_hash, name, role, status, provider, approved_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'master', 'approved', 'credentials', NOW(), NOW(), NOW())`,
      [id, email, passwordHash, name]
    );
    console.info('[AUTH_BOOTSTRAP_MASTER_CREATED]');
    return;
  }

  await pgQuery(
    `UPDATE auth_users
     SET role='master', status='approved', provider='credentials', password_hash=$2, name=$3, approved_at=COALESCE(approved_at, NOW()), updated_at=NOW()
     WHERE id=$1`,
    [existing.id, passwordHash, name]
  );
}

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const rows = await pgQuery<DbUserRow>(
    `SELECT * FROM auth_users WHERE LOWER(email)=LOWER($1) LIMIT 1`,
    [email]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const rows = await pgQuery<DbUserRow>(
    `SELECT * FROM auth_users WHERE id=$1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function createPendingCredentialsUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthUser> {
  await requireAuthStorage();
  const id = randomUUID();
  const passwordHash = hashPassword(input.password);
  const rows = await pgQuery<DbUserRow>(
    `INSERT INTO auth_users (id, email, password_hash, name, role, status, provider, created_at, updated_at)
     VALUES ($1, LOWER($2), $3, $4, 'user', 'pending', 'credentials', NOW(), NOW())
     RETURNING *`,
    [id, input.email, passwordHash, input.name]
  );
  return mapUser(rows[0]);
}

export async function createOrUpdateGooglePendingUser(input: {
  email: string;
  name: string;
}): Promise<AuthUser> {
  await requireAuthStorage();
  const existing = await findAuthUserByEmail(input.email);
  if (!existing) {
    const id = randomUUID();
    const rows = await pgQuery<DbUserRow>(
      `INSERT INTO auth_users (id, email, password_hash, name, role, status, provider, created_at, updated_at)
       VALUES ($1, LOWER($2), NULL, $3, 'user', 'pending', 'google', NOW(), NOW())
       RETURNING *`,
      [id, input.email, input.name]
    );
    return mapUser(rows[0]);
  }

  const rows = await pgQuery<DbUserRow>(
    `UPDATE auth_users
     SET provider='google', name=$2, updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [existing.id, input.name || existing.name]
  );
  return mapUser(rows[0]);
}

export async function markLastLogin(userId: string): Promise<void> {
  await pgQuery(
    `UPDATE auth_users SET last_login_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [userId]
  );
}

export async function listUsersByStatus(status: AuthStatus): Promise<AuthUser[]> {
  const rows = await pgQuery<DbUserRow>(
    `SELECT * FROM auth_users WHERE status=$1 ORDER BY created_at ASC`,
    [status]
  );
  return rows.map(mapUser);
}

export async function setUserApprovalStatus(input: {
  userId: string;
  actorId: string;
  action: 'approve' | 'reject';
  reason?: string;
}): Promise<AuthUser | null> {
  await requireAuthStorage();
  const status: AuthStatus = input.action === 'approve' ? 'approved' : 'rejected';
  const isApproved = status === 'approved';
  const rows = await pgQuery<DbUserRow>(
    `UPDATE auth_users
     SET status=$2, approved_by=$3, approved_at=CASE WHEN $4 THEN NOW() ELSE approved_at END, updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [input.userId, status, input.actorId, isApproved]
  );

  if (!rows[0]) return null;

  await pgQuery(
    `INSERT INTO auth_approval_audit (user_id, action, actor_id, reason, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [input.userId, input.action, input.actorId, input.reason || null]
  );

  return mapUser(rows[0]);
}

export async function updateAuthUserProfile(input: {
  userId: string;
  name?: string;
  email?: string;
}): Promise<AuthUser | null> {
  await requireAuthStorage();

  const current = await findAuthUserById(input.userId);
  if (!current) return null;

  const nextName = String(input.name ?? current.name).trim();
  const nextEmail = String(input.email ?? current.email).trim().toLowerCase();

  const rows = await pgQuery<DbUserRow>(
    `UPDATE auth_users
     SET name=$2, email=LOWER($3), updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [input.userId, nextName, nextEmail]
  );

  return rows[0] ? mapUser(rows[0]) : null;
}
