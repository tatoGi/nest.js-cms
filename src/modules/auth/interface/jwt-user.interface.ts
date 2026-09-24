export interface JwtUser {
  userId: number;
  email: string;
  roles: string[];
  permissions: string[];
}
