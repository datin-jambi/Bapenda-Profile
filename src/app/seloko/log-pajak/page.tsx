"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, Suspense } from "react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { CheckCircle2, XCircle, MapPin, SlidersHorizontal } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";
import { Role } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckLog = {
  id: number;
  licensePlate: string;
  status: string;
  condition: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  lokasi: string | null;
  createdAt: string;
  user: { id: number; name: string; role: Role };
};

type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pilihan kondisi kendaraan yang disimpan di kolom `condition`. */
const CONDITION_OPTIONS = [
  "Baik",
  "Rusak",
  "Rusak berat",
  "Tidak sesuai kondisi",
  "Lainnya",
] as const;

const CONDITION_BADGE_VARIANT: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  Baik: "success",
  Rusak: "warning",
  "Rusak berat": "danger",
  "Tidak sesuai kondisi": "info",
  Lainnya: "default",
};

function ConditionBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge variant={CONDITION_BADGE_VARIANT[value] ?? "outline"} size="sm">
      {value}
    </Badge>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LogPajakPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [tanggal, setTanggal] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);
  const isSearching = searchInput !== debouncedSearch;

  const { data, isLoading } = useQuery<Paginated<CheckLog>>({
    queryKey: ["log-pajak", page, pageSize, debouncedSearch, statusFilter, conditionFilter, tanggal],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (conditionFilter !== "all") params.set("condition", conditionFilter);
      // Satu tanggal = rentang satu hari penuh di sisi server.
      if (tanggal) {
        params.set("dateFrom", tanggal);
        params.set("dateTo", tanggal);
      }
      return api.get(`/seloko/pajak-kendaraan?${params}`).then((r) => r.data);
    },
  });

  const meta = data?.meta;

  const hasActiveFilter =
    searchInput !== "" || statusFilter !== "all" || conditionFilter !== "all" || tanggal !== "";

  function resetFilter() {
    setSearchInput("");
    setStatusFilter("all");
    setConditionFilter("all");
    setTanggal("");
    setPage(1);
  }

  const columns: ColumnDef<CheckLog>[] = [
    {
      key: "licensePlate",
      header: "No. Polisi",
      cellClassName: "font-mono font-bold whitespace-nowrap",
      render: (log) => log.licensePlate.toUpperCase(),
    },
    {
      key: "status",
      header: "Status",
      render: (log) => (
        <Badge variant={log.status === "Lunas" ? "success" : "destructive"}>
          {log.status === "Lunas" ? (
            <CheckCircle2 className="mr-1 h-3 w-3" />
          ) : (
            <XCircle className="mr-1 h-3 w-3" />
          )}
          {log.status}
        </Badge>
      ),
    },
    {
      key: "condition",
      header: "Kondisi",
      render: (log) => <ConditionBadge value={log.condition} />,
    },
    {
      key: "user",
      header: "Petugas",
      cellClassName: "font-medium",
      render: (log) => log.user?.name ?? "-",
    },
    {
      key: "lokasi",
      header: "Lokasi",
      render: (log) =>
        log.latitude && log.longitude ? (
          <a
            href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {log.lokasi ?? "Lihat peta"}
          </a>
        ) : (
          (log.lokasi ?? "-")
        ),
    },
    {
      key: "notes",
      header: "Catatan",
      render: (log) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {log.notes ?? "-"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Waktu",
      cellClassName: "text-sm text-muted-foreground whitespace-nowrap",
      render: (log) => formatDateTime(log.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Log Cek Pajak</h1>
        <p className="text-sm text-muted-foreground">
          Seluruh riwayat pengecekan pajak kendaraan yang dilakukan petugas
        </p>
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={(v) => {
          setSearchInput(v);
          setPage(1);
        }}
        placeholder="Cari nopol, petugas, lokasi, atau catatan..."
        isSearching={isSearching}
        selects={[
          {
            value: statusFilter,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
            placeholder: "Status",
            allLabel: "Semua Status",
            options: [
              { label: "Lunas", value: "Lunas" },
              { label: "Belum Lunas", value: "Belum Lunas" },
            ],
          },
          {
            value: conditionFilter,
            onChange: (v) => {
              setConditionFilter(v);
              setPage(1);
            },
            placeholder: "Kondisi",
            allLabel: "Semua Kondisi",
            options: CONDITION_OPTIONS.map((c) => ({ label: c, value: c })),
          },
        ]}
      >
        <DatePicker
          value={tanggal}
          onChange={(v) => {
            setTanggal(v);
            setPage(1);
          }}
          placeholder="Pilih tanggal"
          aria-label="Filter tanggal pengecekan"
          className="w-[170px]"
        />
        {hasActiveFilter && (
          <Button variant="outline" size="sm" onClick={resetFilter}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Reset Filter
          </Button>
        )}
      </DataTableFilter>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Riwayat Pengecekan{meta ? ` (${meta.totalItems})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable<CheckLog>
            data={data?.data}
            columns={columns}
            isLoading={isLoading || isSearching}
            emptyMessage="Belum ada data pengecekan"
            skeletonRows={pageSize}
            mobileCard={(log) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold">{log.licensePlate.toUpperCase()}</span>
                  <div className="flex items-center gap-1.5">
                    <ConditionBadge value={log.condition} />
                    <Badge variant={log.status === "Lunas" ? "success" : "destructive"}>
                      {log.status === "Lunas" ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      {log.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Petugas: <span className="text-foreground font-medium">{log.user?.name ?? "-"}</span>
                </p>
                {log.latitude && log.longitude ? (
                  <a
                    href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary"
                  >
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {log.lokasi ?? "Lihat peta"}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {log.lokasi ?? "-"}
                  </p>
                )}
                {log.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{log.notes}</p>
                )}
                <p className="text-[11px] text-muted-foreground">{formatDateTime(log.createdAt)}</p>
              </div>
            )}
          />

          <DataTablePagination
            page={page}
            totalPages={meta?.totalPages ?? 1}
            totalItems={meta?.totalItems ?? 0}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <LogPajakPage />
    </Suspense>
  );
}
