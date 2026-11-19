"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, UserCheck, UserX, ShieldCheck, Wrench, MapPin, ExternalLink } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { Role } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type UptdUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  avatarUrl: string | null;
};

type UptdStats = {
  totalUser: number;
  totalAdmin: number;
  totalOperator: number;
  totalAktif: number;
  totalNonaktif: number;
};

type UptdDetail = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  headName: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  subDistrict: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  isActive: boolean;
  showOnPublicMap: boolean;
  createdAt: string;
  updatedAt: string;
  stats: UptdStats;
  users: UptdUser[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatRole(role: Role): string {
  return role.replace(/_/g, " ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg p-2 ${className ?? "bg-muted"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-44 shrink-0 text-sm">{label}</span>
      <span className="font-medium flex-1 text-sm">{value}</span>
    </div>
  );
}

function MapEmbed({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.015},${lat - 0.015},${lng + 0.015},${lat + 0.015}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="rounded-lg overflow-hidden border">
      <iframe
        src={src}
        width="100%"
        height="280"
        loading="lazy"
        title={`Lokasi ${name}`}
        className="block"
      />
      <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 flex items-center gap-4">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>Lat: {lat}</span>
        <span>Lng: {lng}</span>
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-primary hover:underline flex items-center gap-1"
        >
          Buka di peta <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UptdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery<{ data: UptdDetail }>({
    queryKey: ["seloko-uptd-detail", id],
    queryFn: () => api.get(`/seloko/uptd/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const uptd = data?.data;

  const userColumns: ColumnDef<UptdUser>[] = [
    {
      key: "avatar",
      header: "",
      render: (u) => (
        <Avatar className="h-8 w-8">
          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
          <AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback>
        </Avatar>
      ),
    },
    {
      key: "name",
      header: "Nama",
      cellClassName: "font-medium",
      render: (u) => u.name,
    },
    {
      key: "email",
      header: "Email",
      cellClassName: "text-sm text-muted-foreground",
      render: (u) => u.email,
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <Badge variant="outline" className="text-xs">
          {formatRole(u.role)}
        </Badge>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (u) => (
        <Badge variant={u.isActive ? "success" : "destructive"}>
          {u.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Dibuat",
      cellClassName: "text-sm text-muted-foreground whitespace-nowrap",
      render: (u) => formatDate(u.createdAt),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !uptd) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-lg font-medium">UPTD tidak ditemukan</p>
        <p className="text-sm text-muted-foreground">Data yang Anda cari tidak tersedia atau telah dihapus.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />Kembali
        </Button>
      </div>
    );
  }

  const hasCoords = uptd.latitude !== null && uptd.longitude !== null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />Kembali
      </Button>

      {/* Title */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">{uptd.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{uptd.code}</p>
          {uptd.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">{uptd.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={uptd.showOnPublicMap ? "success" : "outline"}>
            {uptd.showOnPublicMap ? "Tampil di Peta Publik" : "Disembunyikan dari Peta"}
          </Badge>
          <Badge variant={uptd.isActive ? "success" : "outline"}>
            {uptd.isActive ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Informasi Umum */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informasi Umum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <InfoRow label="Nama UPTD" value={uptd.name} />
            <InfoRow label="Kode" value={<span className="font-mono">{uptd.code}</span>} />
            <InfoRow label="Kepala UPTD" value={uptd.headName ?? "-"} />
            <InfoRow label="Status" value={
              <Badge variant={uptd.isActive ? "success" : "outline"} className="text-xs">
                {uptd.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            } />
            <InfoRow label="Dibuat" value={formatDate(uptd.createdAt)} />
            <InfoRow label="Diperbarui" value={formatDate(uptd.updatedAt)} />
          </CardContent>
        </Card>

        {/* Alamat & Kontak */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Alamat & Kontak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <InfoRow label="Alamat" value={uptd.address ?? "-"} />
            <InfoRow label="Kelurahan" value={uptd.subDistrict ?? "-"} />
            <InfoRow label="Kecamatan" value={uptd.district ?? "-"} />
            <InfoRow label="Kota/Kabupaten" value={uptd.city ?? "-"} />
            <InfoRow label="Provinsi" value={uptd.province ?? "-"} />
            <InfoRow label="Kode Pos" value={uptd.postalCode ?? "-"} />
            <InfoRow label="Telepon" value={uptd.phone ?? "-"} />
            <InfoRow label="Email" value={uptd.email ?? "-"} />
          </CardContent>
        </Card>

        {/* Lokasi */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lokasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <InfoRow label="Latitude" value={hasCoords ? String(uptd.latitude) : <span className="text-muted-foreground italic text-xs">Belum diisi</span>} />
            <InfoRow label="Longitude" value={hasCoords ? String(uptd.longitude) : <span className="text-muted-foreground italic text-xs">Belum diisi</span>} />
            <InfoRow label="Google Maps" value={
              uptd.googleMapsUrl ? (
                <a href={uptd.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm">
                  Buka Maps <ExternalLink className="h-3 w-3" />
                </a>
              ) : "-"
            } />
            <InfoRow label="Tampil di Peta" value={
              <Badge variant={uptd.showOnPublicMap ? "success" : "outline"} className="text-xs">
                {uptd.showOnPublicMap ? "Ya" : "Tidak"}
              </Badge>
            } />
          </CardContent>
        </Card>
      </div>

      {/* Map embed */}
      {hasCoords ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Peta Lokasi</h2>
          <MapEmbed lat={uptd.latitude!} lng={uptd.longitude!} name={uptd.name} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <MapPin className="h-6 w-6 mx-auto mb-2 opacity-40" />
          Koordinat belum diisi. Edit UPTD untuk menambahkan lokasi.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total User" value={uptd.stats.totalUser} icon={Users} className="bg-blue-50 text-seloko-blue" />
        <StatCard label="Total Admin" value={uptd.stats.totalAdmin} icon={ShieldCheck} className="bg-purple-50 text-purple-600" />
        <StatCard label="Total Operator" value={uptd.stats.totalOperator} icon={Wrench} className="bg-orange-50 text-orange-600" />
        <StatCard label="User Aktif" value={uptd.stats.totalAktif} icon={UserCheck} className="bg-green-50 text-green-600" />
        <StatCard label="User Nonaktif" value={uptd.stats.totalNonaktif} icon={UserX} className="bg-red-50 text-red-600" />
      </div>

      {/* User list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Daftar User</h2>
        <DataTable<UptdUser>
          data={uptd.users}
          columns={userColumns}
          emptyMessage="Belum ada user terdaftar di UPTD ini"
        />
      </div>
    </div>
  );
}
