"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, Suspense } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, MapPin, SlidersHorizontal } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";

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
  user: { id: number; name: string };
};

type CheckLogResponse = {
  data: CheckLog[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Warna badge per kondisi kendaraan — tiap kondisi punya warna berbeda. */
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function RiwayatPajakPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 2000);
  const isSearching = searchInput !== debouncedSearch;

  // Filter riwayat — "all" berarti tanpa filter.
  const [statusFilter, setStatusFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const hasFilter = statusFilter !== "all" || conditionFilter !== "all" || searchInput !== "";

  const { data, isLoading } = useQuery<CheckLogResponse>({
    queryKey: ["cek-pajak", page, pageSize, debouncedSearch, statusFilter, conditionFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (conditionFilter !== "all") params.set("condition", conditionFilter);
      return api.get(`/seloko/pajak-kendaraan?${params.toString()}`).then((r) => r.data);
    },
  });

  function resetFilter() {
    setStatusFilter("all");
    setConditionFilter("all");
    setSearchInput("");
    setPage(1);
  }

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const columns: ColumnDef<CheckLog>[] = [
    {
      key: "licensePlate",
      header: "No. Polisi",
      cellClassName: "font-mono font-bold",
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
      key: "lokasi",
      header: "Lokasi",
      render: (log) => log.lokasi ?? "-",
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
        <h1 className="text-2xl font-bold text-primary">Riwayat Pengecekan</h1>
        <p className="text-sm text-muted-foreground">
          Daftar log pengecekan pajak kendaraan yang sudah kamu simpan
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <DataTableFilter
            value={searchInput}
            onChange={(v) => {
              setSearchInput(v);
              setPage(1);
            }}
            placeholder="Cari nomor polisi..."
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
            {hasFilter && (
              <Button variant="outline" size="sm" onClick={resetFilter}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Reset Filter
              </Button>
            )}
          </DataTableFilter>

          <DataTable<CheckLog>
            data={logs}
            columns={columns}
            isLoading={isLoading || isSearching}
            emptyMessage="Belum ada data pengecekan"
            skeletonRows={pageSize}
            mobileCard={(log) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold">{log.licensePlate.toUpperCase()}</span>
                  <Badge variant={log.status === "Lunas" ? "success" : "destructive"}>
                    {log.status === "Lunas" ? (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {log.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {log.lokasi ?? "-"}
                </p>
                {log.condition && (
                  <div className="pt-0.5">
                    <ConditionBadge value={log.condition} />
                  </div>
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
            onPageChange={(p) => setPage(p)}
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
      <RiwayatPajakPage />
    </Suspense>
  );
}
