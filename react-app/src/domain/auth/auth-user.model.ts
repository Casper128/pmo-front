export interface AuthUser {
  name: string;
  email: string;
  id?: string | number;
  role?: string;
  area?: string;
  position?: string;
  username?: string;
  raw?: unknown;
}
