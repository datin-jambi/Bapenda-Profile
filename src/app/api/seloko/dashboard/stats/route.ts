import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/with-error-handler";
import { UnauthorizedError } from "@/lib/errors";
import { ContentStatus } from "@prisma/client";

type TrendRange = "day" | "week" | "month";

function parseTrendRange(raw: string | null): TrendRange {
  return raw === "week" || raw === "month" ? raw : "day";
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayLabel = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

/** Senin sebagai awal minggu. */
function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * Rentang tren + bucket per granularitas (tanggal lokal server).
 * day: 14 hari, week: 8 minggu (mulai Senin), month: 12 bulan.
 */
function trendWindow(range: TrendRange, now: Date) {
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return {
      start,
      buckets: Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1)),
      key: (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      label: (d: Date) => d.toLocaleDateString("id-ID", { month: "short", year: "numeric" }),
    };
  }
  if (range === "week") {
    const first = weekStart(now);
    first.setDate(first.getDate() - 7 * 7);
    return {
      start: first,
      buckets: Array.from({ length: 8 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * i)),
      key: (d: Date) => dayKey(weekStart(d)),
      label: dayLabel,
    };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
  return {
    start,
    buckets: Array.from({ length: 14 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)),
    key: dayKey,
    label: dayLabel,
  };
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();

  // Cakupan data per role (lihat docs/dashboard.md):
  // - Super_Admin, Admin : seluruh sistem + moderasi
  // - Editor, Ketua_Uptd, Admin_Uptd : konten milik sendiri saja
  // - Petugas : hanya statistik pajak miliknya sendiri
  const isAdminOrSuper = user.role === "Super_Admin" || user.role === "Admin";
  const isEditor = user.role === "Editor" || user.role === "Admin_Uptd" || user.role === "Ketua_Uptd";
  const isPetugas = user.role === "Petugas";
  const showContent = isAdminOrSuper || isEditor;

  // Filter by authorId for non-admin roles
  const authorFilter = isEditor ? { authorId: user.id } : {};

  // Petugas tidak punya akses konten: kembalikan statistik pajak saja.
  if (isPetugas) {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const mine = { userId: user.id };
    // 14 hari terakhir untuk grafik tren; dihitung per tanggal lokal server.
    const startTrend = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    const [today, month, total, belumLunas, lunas, recentLogs, trendRows, conditionRows] = await Promise.all([
      prisma.vehicleTaxCheckLog.count({ where: { ...mine, createdAt: { gte: startToday } } }),
      prisma.vehicleTaxCheckLog.count({ where: { ...mine, createdAt: { gte: startMonth } } }),
      prisma.vehicleTaxCheckLog.count({ where: mine }),
      prisma.vehicleTaxCheckLog.count({ where: { ...mine, status: "Belum Lunas" } }),
      prisma.vehicleTaxCheckLog.count({ where: { ...mine, status: "Lunas" } }),
      prisma.vehicleTaxCheckLog.findMany({
        where: mine,
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, licensePlate: true, status: true, condition: true, createdAt: true },
      }),
      prisma.vehicleTaxCheckLog.findMany({
        where: { ...mine, createdAt: { gte: startTrend } },
        select: { createdAt: true, status: true },
      }),
      prisma.vehicleTaxCheckLog.groupBy({
        by: ["condition"],
        where: mine,
        _count: { _all: true },
      }),
    ]);

    const trendMap = new Map<string, { date: string; total: number; lunas: number; belumLunas: number }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(startTrend.getFullYear(), startTrend.getMonth(), startTrend.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      trendMap.set(key, { date: key, total: 0, lunas: 0, belumLunas: 0 });
    }
    for (const row of trendRows) {
      const c = row.createdAt;
      const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
      const bucket = trendMap.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (row.status === "Lunas") bucket.lunas += 1;
      else bucket.belumLunas += 1;
    }

    return ApiResponse.success({
      role: "Petugas",
      tax: {
        today,
        month,
        total,
        belumLunas,
        lunas,
        recentLogs,
        trend: Array.from(trendMap.values()),
        byCondition: conditionRows.map((r) => ({ condition: r.condition ?? "Belum diisi", count: r._count._all })),
      },
    });
  }

  // --- Stat counts ---
  const [newsTotal, galleryTotal, faqTotal] = await Promise.all([
    prisma.news.count({ where: { deletedAt: null, ...authorFilter } }),
    prisma.gallery.count({ where: { deletedAt: null, ...authorFilter } }),
    prisma.faq.count({ where: { deletedAt: null } }),
  ]);

  // --- News by status ---
  const newsByStatus = await prisma.news.groupBy({
    by: ["status"],
    where: { deletedAt: null, ...authorFilter },
    _count: { _all: true },
  });

  // --- Gallery by status ---
  const galleryByStatus = await prisma.gallery.groupBy({
    by: ["status"],
    where: { deletedAt: null, ...authorFilter },
    _count: { _all: true },
  });

  // --- News per month (last 6 months) ---
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const recentNews = await prisma.news.findMany({
    where: { deletedAt: null, createdAt: { gte: sixMonthsAgo }, ...authorFilter },
    select: { createdAt: true },
  });

  const monthMap: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = 0;
  }
  for (const n of recentNews) {
    const d = new Date(n.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthMap) monthMap[key]++;
  }
  const newsPerMonth = Object.entries(monthMap).map(([month, count]) => ({
    month,
    count,
  }));

  // --- Admin/Super only: users by role ---
  let usersByRole = null;
  if (isAdminOrSuper) {
    const rows = await prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    usersByRole = rows.map((r) => ({ role: r.role, count: r._count._all }));
  }

  // --- Admin/Super only: news by category ---
  let newsByCategory = null;
  if (isAdminOrSuper) {
    const rows = await prisma.news.groupBy({
      by: ["categoryId"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const categories = await prisma.newsCategory.findMany({
      where: { id: { in: rows.map((r) => r.categoryId) } },
      select: { id: true, name: true },
    });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    newsByCategory = rows.map((r) => ({
      category: catMap[r.categoryId] ?? "Unknown",
      count: r._count._all,
    }));
  }

  // --- Admin/Super only: recent audit logs ---
  let recentActivity = null;
  if (isAdminOrSuper) {
    recentActivity = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });
  }

  // --- FAQ top viewed ---
  const topFaqs = isAdminOrSuper
    ? await prisma.faq.findMany({
        where: { deletedAt: null, isPublished: true },
        orderBy: { viewCount: "desc" },
        take: 5,
        select: { id: true, question: true, viewCount: true },
      })
    : [];

  // --- Published vs draft counts ---
  const publishedNews = newsByStatus.find((s) => s.status === ContentStatus.PUBLISHED)?._count._all ?? 0;
  const pendingNews = newsByStatus.find((s) => s.status === ContentStatus.PENDING_REVIEW)?._count._all ?? 0;

  // --- Admin/Super only: ringkasan cek pajak seluruh petugas ---
  let tax = null;
  if (isAdminOrSuper) {
    const range = parseTrendRange(request.nextUrl.searchParams.get("range"));
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const win = trendWindow(range, now);
    const [today, month, belumLunas, lunas, recentLogs, trendRows, conditionRows, officerRows] = await Promise.all([
      prisma.vehicleTaxCheckLog.count({ where: { createdAt: { gte: startToday } } }),
      prisma.vehicleTaxCheckLog.count({ where: { createdAt: { gte: startMonth } } }),
      prisma.vehicleTaxCheckLog.count({ where: { status: "Belum Lunas" } }),
      prisma.vehicleTaxCheckLog.count({ where: { status: "Lunas" } }),
      prisma.vehicleTaxCheckLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, licensePlate: true, status: true, condition: true, createdAt: true, user: { select: { name: true } } },
      }),
      prisma.vehicleTaxCheckLog.findMany({
        where: { createdAt: { gte: win.start } },
        select: { createdAt: true, status: true },
      }),
      prisma.vehicleTaxCheckLog.groupBy({ by: ["condition"], _count: { _all: true } }),
      prisma.vehicleTaxCheckLog.groupBy({
        by: ["userId"],
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
      }),
    ]);

    // Tren per granularitas (harian / mingguan / bulanan).
    const trendMap = new Map<string, { date: string; label: string; total: number; lunas: number; belumLunas: number }>();
    for (const b of win.buckets) {
      const key = win.key(b);
      trendMap.set(key, { date: key, label: win.label(b), total: 0, lunas: 0, belumLunas: 0 });
    }
    for (const row of trendRows) {
      const bucket = trendMap.get(win.key(row.createdAt));
      if (!bucket) continue;
      bucket.total += 1;
      if (row.status === "Lunas") bucket.lunas += 1;
      else bucket.belumLunas += 1;
    }

    // Ringkasan per petugas: nama + jumlah cek (bukan detail log).
    const officerIds = officerRows.map((r) => r.userId);
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(officers.map((o) => [o.id, o.name]));

    tax = {
      today,
      month,
      belumLunas,
      lunas,
      total: belumLunas + lunas,
      recentLogs,
      trend: Array.from(trendMap.values()),
      byCondition: conditionRows.map((r) => ({ condition: r.condition ?? "Belum diisi", count: r._count._all })),
      byOfficer: officerRows.map((r) => ({ name: nameMap.get(r.userId) ?? "-", count: r._count._all })),
    };
  }

  return ApiResponse.success({
    role: user.role,
    showContent,
    tax,
    counts: { news: newsTotal, gallery: galleryTotal, faq: faqTotal },
    newsByStatus: newsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
    galleryByStatus: galleryByStatus.map((s) => ({ status: s.status, count: s._count._all })),
    newsPerMonth,
    publishedNews,
    pendingNews,
    usersByRole,
    newsByCategory,
    recentActivity,
    topFaqs,
  });
});
