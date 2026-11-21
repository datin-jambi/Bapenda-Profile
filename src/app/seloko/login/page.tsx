"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useState, useRef } from "react";
import Image from "next/image";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 menit

export default function LoginPage() {
  const { setUser } = useAuthStore();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  function startCooldown(until: number) {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSeconds(Math.ceil((until - Date.now()) / 1000));
    cooldownRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(cooldownRef.current!);
        setCooldownSeconds(0);
        setLockedUntil(null);
        setAttempts(0);
      } else {
        setCooldownSeconds(remaining);
      }
    }, 1000);
  }

  async function onSubmit(data: LoginInput) {
    if (lockedUntil && Date.now() < lockedUntil) {
      toast.error(`Terlalu banyak percobaan. Coba lagi dalam ${cooldownSeconds} detik.`);
      return;
    }

    try {
      const res = await api.post("/auth/login", data);
      setUser(res.data.data.user);
      setAttempts(0);
      toast.success("Login berhasil");
      router.push("/seloko/dashboard");
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(until);
        startCooldown(until);
        toast.error("Terlalu banyak percobaan login. Akun dikunci sementara selama 1 menit.");
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        toast.error(
          (error.response?.data?.message || "Login gagal") +
          ` (${remaining} percobaan tersisa)`
        );
      }
    }
  }

  const isLocked = !!lockedUntil && Date.now() < lockedUntil;

  return (
    <div className="w-full max-w-md">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mb-4 flex items-center gap-2 text-white/80 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Beranda
      </button>

      <Card className="shadow-2xl">
        <CardHeader className="space-y-2 text-center pb-4">
          <Image
            src="/images/seloko/seloko-full.png"
            alt="SELOKO — Sistem Elektronik Penelusuran Informasi Kendaraan"
            width={640}
            height={217}
            priority
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <CardTitle className="text-2xl font-bold text-seloko-navy">Masuk</CardTitle>
          <CardDescription>Masuk ke Seloko BAPENDA Provinsi Jambi</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@contoh.com"
                autoComplete="email"
                disabled={isLocked}
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLocked}
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {isLocked && (
              <p className="text-xs text-destructive text-center">
                Login dikunci. Coba lagi dalam {cooldownSeconds} detik.
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={isSubmitting}
              disabled={isLocked}
            >
              Masuk
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Seloko BAPENDA Provinsi Jambi
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
