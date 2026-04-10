export type AuthRole = 'master' | 'user';
export type AuthStatus = 'pending' | 'approved' | 'rejected';
export type AuthProvider = 'credentials' | 'google';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  status: AuthStatus;
  provider: AuthProvider;
  passwordHash: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthSessionPayload = {
  user: {
    id: string;
    email: string;
    role: AuthRole;
    status: AuthStatus;
    name: string;
  };
  exp: number;
};
