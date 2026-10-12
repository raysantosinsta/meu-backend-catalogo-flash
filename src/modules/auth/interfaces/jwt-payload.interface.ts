export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId: string;
}
