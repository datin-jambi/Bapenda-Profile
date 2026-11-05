import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { JwtPayload, AuthUser } from "@/types";
import { Role } from "@prisma/client";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("SECURITY ERROR: JWT_SECRET wajib diisi di .env dan minimal 32 karakter pada mode production!");
    }
  }
  return new TextEncoder().encode(secret || "fallback-secret-min-32-chars-long-development-only!!");
}

function getJwtRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("SECURITY ERROR: JWT_REFRESH_SECRET wajib diisi di .env dan minimal 32 karakter pada mode production!");
    }
  }
  return new TextEncoder().encode(secret || "fallback-refresh-secret-min-32-chars-development-only!!");
}

export const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN ?? "15m";
export const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Parse duration string like "15m", "7d", "1h" to seconds
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 60 * 60;
    case "d": return value * 24 * 60 * 60;
    default: return 15 * 60;
  }
}

export const ACCESS_TOKEN_MAX_AGE = parseDurationToSeconds(ACCESS_TOKEN_EXPIRY);
export const REFRESH_TOKEN_MAX_AGE = parseDurationToSeconds(REFRESH_TOKEN_EXPIRY);

// ─── Token Generation ─────────────────────────────────────────────────────────

export async function generateAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload, sub: String(payload.sub) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function generateRefreshToken(sub: number): Promise<string> {
  return new SignJWT({ sub: String(sub) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getJwtRefreshSecret());
}

// ─── Aliases for backward compatibility ──────────────────────────────────────

export const signAccessToken = generateAccessToken;
export const signRefreshToken = generateRefreshToken;

// ─── Token Verification ───────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtRefreshSecret());
    if (!payload.sub) return null;
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}

// ─── Cookie Management ────────────────────────────────────────────────────────

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set("access_token", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  cookieStore.set("refresh_token", refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
}

// ─── Auth User ────────────────────────────────────────────────────────────────

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    if (!token) return null;
    const payload = await verifyAccessToken(token);
    if (!payload) return null;
    return {
      id: Number(payload.sub),
      email: payload.email,
      role: payload.role as Role,
      name: payload.name,
      uptdId: payload.uptdId,
    };
  } catch {
    return null;
  }
}

