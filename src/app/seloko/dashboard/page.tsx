"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Images, HelpCircle, Clock, Users, TrendingUp, Eye, Car, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store";
import { formatDate } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, CartesianGrid,
} from "recharts";

// Cakupan per role ada di docs/dashboard.md. Data di-filter di API
// (src/app/api/seloko/dashboard/stats/route.ts); halaman hanya menampilkan.

type Counts = { news: number; gallery: number; faq: number };
type NewsStatusRow = { status: string; count: number };
type MonthRow = { month: string; count: number };
type RecentLog = { id: number; action: string; entityType: string; createdAt: string; user: { name: string } };
type TopFaq = { id: number; question: string; viewCount: number };
type TaxSummary = { today: number; belumLunas: number; lunas: number; total: number };
type PetugasTax = {
  today: number; month: number; total: number; belumLunas: number; lunas: number;
  recentLogs: { id: number; licensePlate: string; status: string; condition: string | null; createdAt: string }[];
  trend?: { date: string; total: number; lunas: number; belumLunas: number }[];
  byCondition?: { condition: string; count: number }[];
};
type Stats = {
  role: string;
  counts?: Counts;
  newsByStatus?: NewsStatusRow[];
  galleryByStatus?: NewsStatusRow[];
  newsPerMonth?: MonthRow[];
  publishedNews?: number;
  pendingNews?: number;
  usersByRole?: { role: string; count: number }[] | null;
  newsByCategory?: { category: string; count: number }[] | null;
  recentActivity?: RecentLog[] | null;
  topFaqs?: TopFaq[];
  tax?: TaxSummary | PetugasTax | null;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  PENDING_REVIEW: "#f59e0b",
  APPROVED: "#3b82f6",
  REJECTED: "#ef4444",
  PUBLISHED: "#22c55e",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Menunggu Review",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  PUBLISHED: "Dipublikasi",
};

const ROLE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const CHART_H = 200;

function formatMonthKey(key: string) {
  const [, m] = key.split("-");
  return MONTH_NAMES[parseInt(m, 10) - 1];
}

function toStatusData(rows: NewsStatusRow[] = []) {
  return rows.map((s) => ({
    name: STATUS_LABEL[s.status] ?? s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] ?? "#94a3b8",
  }));
}

function toMonthData(rows: MonthRow[] = []) {
  return rows.map((m) => ({ month: formatMonthKey(m.month), Berita: m.count }));
}

function StatCard({ title, value, icon: Icon, sub, color }: {
  title: string; value: number; icon: React.ElementType; sub?: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl font-bold text-primary mt-1">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
        <div className={`p-2 rounded-md shrink-0 ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{text}</p>;
}

function MonthlyNewsChart({ rows }: { rows: MonthRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <LineChart data={toMonthData(rows)}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
        <Tooltip />
        <Line type="monotone" dataKey="Berita" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StatusPie({ rows }: { rows: NewsStatusRow[] }) {
  const data = toStatusData(rows);
  if (data.length === 0) return <Empty text="Belum ada data" />;
  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
          {data.map((e, i) => <Cell key={i} fill={e.color} />)}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Petugas: hanya cek pajak miliknya ─────────────────────────────────────────

const LUNAS_COLOR = "#10b981";
const BELUM_COLOR = "#f43f5e";
const CONDITION_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#a855f7"];

function shortDay(key: string) {
  const [, m, d] = key.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}

function HeroCard({ today, month }: { today: number; month: number }) {
  return (
    <Link
      href="/seloko/pajak-kendaraan"
      className="relative block overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 p-5 text-white shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-transform"
    >
      <div aria-hidden className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15" />
      <div aria-hidden className="absolute -right-2 bottom-2 h-14 w-14 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-white/80">Cek hari ini</p>
          <p className="text-4xl font-extrabold leading-none mt-1">{today}</p>
          <p className="text-xs text-white/80 mt-2">{month} pengecekan bulan ini</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-white text-blue-600 px-4 py-2.5 text-sm font-semibold shadow">
          <Car className="h-4 w-4" />
          Cek Baru
        </span>
      </div>
    </Link>
  );
}

function MiniStat({ title, value, color, icon: Icon }: { title: string; value: number; color: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-2xl font-bold mt-3 leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{title}</p>
    </div>
  );
}

function PetugasDashboard({ tax }: { tax: PetugasTax }) {
  // Lindungi terhadap respons yang belum lengkap (mis. API versi lama).
  const recentLogs = tax.recentLogs ?? [];
  const trend = (tax.trend ?? []).map((t) => ({ ...t, label: shortDay(t.date) }));
  const condition = tax.byCondition ?? [];
  const donut = [
    { name: "Lunas", value: tax.lunas, color: LUNAS_COLOR },
    { name: "Belum lunas", value: tax.belumLunas, color: BELUM_COLOR },
  ].filter((d) => d.value > 0);
  const lunasPct = tax.total > 0 ? Math.round((tax.lunas / tax.total) * 100) : 0;

  return (
    <>
      <HeroCard today={tax.today} month={tax.month} />

      <div className="grid grid-cols-3 gap-2">
        <MiniStat title="Total cek" value={tax.total} color="bg-indigo-500" icon={ClipboardList} />
        <MiniStat title="Lunas" value={tax.lunas} color="bg-emerald-500" icon={CheckCircle2} />
        <MiniStat title="Belum lunas" value={tax.belumLunas} color="bg-rose-500" icon={XCircle} />
      </div>

      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            Tren 14 hari
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="total" name="Cek" stroke="#6366f1" strokeWidth={2.5} fill="url(#trendFill)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Status pajak
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {donut.length === 0 ? (
              <Empty text="Belum ada data" />
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none">
                      {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-extrabold text-emerald-600">{lunasPct}%</p>
                  <p className="text-[10px] text-muted-foreground">lunas</p>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-4 text-xs text-muted-foreground pb-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Lunas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Belum lunas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Car className="h-4 w-4 text-sky-500" />
              Kondisi kendaraan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {condition.length === 0 ? (
              <Empty text="Belum ada data" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(150, condition.length * 36 + 20)}>
                <BarChart data={condition} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="condition" width={96} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Jumlah" radius={[0, 8, 8, 0]} barSize={16}>
                    {condition.map((_, i) => <Cell key={i} fill={CONDITION_COLORS[i % CONDITION_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Pengecekan terakhir
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          {recentLogs.length === 0 ? (
            <Empty text="Belum ada pengecekan" />
          ) : (
            <div className="divide-y">
              {recentLogs.map((log) => (
                <Link
                  key={log.id}
                  href="/seloko/riwayat-pajak"
                  className="flex items-center gap-3 px-2 py-3 active:bg-muted/60 rounded-lg"
                >
                  <span className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${log.status === "Lunas" ? "bg-emerald-100" : "bg-rose-100"}`}>
                    {log.status === "Lunas"
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      : <XCircle className="h-5 w-5 text-rose-600" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tracking-wide truncate">{log.licensePlate}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.condition ?? "Kondisi belum diisi"} · {formatDate(new Date(log.createdAt))}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${log.status === "Lunas" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {log.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/seloko/riwayat-pajak"
            className="flex items-center justify-center h-11 mt-2 rounded-xl bg-slate-100 text-sm font-semibold text-primary active:bg-slate-200"
          >
            Lihat semua riwayat
          </Link>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Editor / Ketua_Uptd / Admin_Uptd: konten miliknya sendiri ─────────────────

function KontenDashboard({ stats }: { stats: Stats }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard title="Berita saya" value={stats.counts?.news ?? 0} icon={Newspaper} color="bg-blue-500" sub="Semua status" />
        <StatCard title="Galeri saya" value={stats.counts?.gallery ?? 0} icon={Images} color="bg-purple-500" sub="Semua status" />
        <StatCard title="Dipublikasi" value={stats.publishedNews ?? 0} icon={TrendingUp} color="bg-green-500" sub="Berita live" />
      </div>

      <Section title="Berita 6 Bulan Terakhir" icon={TrendingUp}>
        <MonthlyNewsChart rows={stats.newsPerMonth ?? []} />
      </Section>

      <Section title="Status Berita Saya" icon={Newspaper}>
        <StatusPie rows={stats.newsByStatus ?? []} />
      </Section>
    </>
  );
}

// ─── Super_Admin / Admin: sistem + moderasi ────────────────────────────────────

function AdminDashboard({ stats, isSuper }: { stats: Stats; isSuper: boolean }) {
  const tax = stats.tax as TaxSummary | null | undefined;
  const usersByRole = (stats.usersByRole ?? []).map((r) => ({ name: r.role.replace(/_/g, " "), value: r.count }));
  const byCategory = (stats.newsByCategory ?? []).map((c) => ({ name: c.category, Berita: c.count }));
  const galleryData = (stats.galleryByStatus ?? []).map((s) => ({ name: STATUS_LABEL[s.status] ?? s.status, Jumlah: s.count }));

  return (
    <>
      {/* Moderasi: yang perlu tindakan dulu */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Menunggu review" value={stats.pendingNews ?? 0} icon={Clock} color="bg-amber-500" sub="Perlu persetujuan" />
        <StatCard title="Total berita" value={stats.counts?.news ?? 0} icon={Newspaper} color="bg-blue-500" sub={`${stats.publishedNews ?? 0} dipublikasi`} />
        <StatCard title="Total galeri" value={stats.counts?.gallery ?? 0} icon={Images} color="bg-purple-500" sub="Semua status" />
        <StatCard title="Total FAQ" value={stats.counts?.faq ?? 0} icon={HelpCircle} color="bg-green-500" sub="Semua pertanyaan" />
      </div>

      {tax && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Cek pajak hari ini" value={tax.today} icon={Car} color="bg-blue-500" sub="Semua petugas" />
          <StatCard title="Belum lunas" value={tax.belumLunas} icon={XCircle} color="bg-red-500" sub="Dari total cek" />
          <StatCard title="Lunas" value={tax.lunas} icon={CheckCircle2} color="bg-green-500" sub="Dari total cek" />
          <StatCard title="Total cek pajak" value={tax.total} icon={ClipboardList} color="bg-indigo-500" sub="Semua waktu" />
        </div>
      )}

      <Section title="Berita 6 Bulan Terakhir" icon={TrendingUp}>
        <MonthlyNewsChart rows={stats.newsPerMonth ?? []} />
      </Section>

      <Section title="Status Berita" icon={Newspaper}>
        <StatusPie rows={stats.newsByStatus ?? []} />
      </Section>

      {byCategory.length > 0 && (
        <Section title="Berita per Kategori" icon={Newspaper}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip />
              <Bar dataKey="Berita" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {isSuper && usersByRole.length > 0 && (
        <Section title="Pengguna per Role" icon={Users}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <PieChart>
              <Pie data={usersByRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>
                {usersByRole.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      )}

      {isSuper && galleryData.length > 0 && (
        <Section title="Galeri per Status" icon={Images}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={galleryData} layout="vertical">
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={96} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="Jumlah" fill="#a855f7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {(stats.topFaqs ?? []).length > 0 && (
        <Section title="FAQ Paling Banyak Dilihat" icon={Eye}>
          <div className="space-y-3">
            {(stats.topFaqs ?? []).map((faq, i) => (
              <div key={faq.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{faq.question}</p>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, (faq.viewCount / (stats.topFaqs?.[0]?.viewCount || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{faq.viewCount}x</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(stats.recentActivity ?? []).length > 0 && (
        <Section title="Aktivitas Terbaru" icon={Clock}>
          <div className="divide-y">
            {(stats.recentActivity ?? []).map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{log.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{log.action} · {log.entityType}</p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(new Date(log.createdAt))}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role;

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/seloko/dashboard/stats").then((r) => r.data.data),
  });

  // Sapaan, tanggal, dan nama user bergantung jam/locale/localStorage klien —
  // render hanya setelah mounted supaya identik dengan HTML server.
  const mounted = useMounted();
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Selamat Pagi" : currentHour < 17 ? "Selamat Siang" : "Selamat Malam";
  const hello = mounted ? `${greeting}, ${user?.name?.split(" ")[0] ?? ""}` : "";
  const today = mounted ? formatDate(new Date()) : "";

  const subtitle =
    role === "Petugas" ? "Ringkasan pengecekan pajak Anda"
    : role === "Super_Admin" || role === "Admin" ? "Ringkasan sistem dan moderasi konten"
    : "Ringkasan berita dan galeri Anda";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-primary md:text-2xl">{hello}</h1>
        <p className="text-muted-foreground text-xs mt-1 md:text-sm">
          {today} · {subtitle}
        </p>
      </div>

      {isLoading || !stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="h-20 animate-pulse bg-muted rounded m-4" /></Card>
          ))}
        </div>
      ) : role === "Petugas" && stats.tax ? (
        <PetugasDashboard tax={stats.tax as PetugasTax} />
      ) : role === "Super_Admin" || role === "Admin" ? (
        <AdminDashboard stats={stats} isSuper={role === "Super_Admin"} />
      ) : (
        <KontenDashboard stats={stats} />
      )}

      {/* Info akun untuk semua role */}
      <Section title="Informasi Akun" icon={Users}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3 py-1.5 border-b">
            <span className="text-muted-foreground">Nama</span>
            <span className="font-medium truncate">{user?.name}</span>
          </div>
          <div className="flex justify-between gap-3 py-1.5 border-b">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium truncate">{user?.email}</span>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{role?.replace(/_/g, " ")}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}
