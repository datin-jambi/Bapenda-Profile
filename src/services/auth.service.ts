import { NextRequest } from "next/server";
import { userRepository } from "@/repositories/user.repository";
import { signAccessToken, signRefreshToken, setAuthCookies, clearAuthCookies, getAuthUser } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ValidationError, NotFoundError, TooManyRequestsError } from "@/lib/errors";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export async function POST_login(request: NextRequest) {
  // Rate limiting berdasarkan IP untuk mencegah brute-force attack
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : (request.headers.get("x-real-ip") || "127.0.0.1");
  const rateLimitKey = `login:${ip}`;

  const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000); // Max 5 percobaan per 15 menit
  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.retryAfterSeconds / 60);
    throw new TooManyRequestsError(
      `Terlalu banyak percobaan login yang gagal. Akses dibatasi sementara selama ${minutes} menit demi keamanan.`
    );
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Data tidak valid", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const user = await userRepository.findByEmail(parsed.data.email);
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Email atau password salah");
  }

  const valid = await userRepository.verifyPassword(user, parsed.data.password);
  if (!valid) {
    throw new UnauthorizedError("Email atau password salah");
  }

  // Reset rate limit jika login berhasil
  resetRateLimit(rateLimitKey);

  const accessToken = await signAccessToken({
    sub: user.id, email: user.email, role: user.role,
    name: user.name, uptdId: user.uptdId,
  });
  const refreshToken = await signRefreshToken(user.id);
  await setAuthCookies(accessToken, refreshToken);

  return ApiResponse.success({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, uptdId: user.uptdId, avatarUrl: user.avatarUrl },
  }, "Login berhasil");
}

export async function POST_logout() {
  await clearAuthCookies();
  return ApiResponse.success(null, "Logout berhasil");
}

export async function GET_me() {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();

  const fullUser = await userRepository.findById(user.id);
  if (!fullUser) throw new NotFoundError("User tidak ditemukan");

  return ApiResponse.success(fullUser);
}
