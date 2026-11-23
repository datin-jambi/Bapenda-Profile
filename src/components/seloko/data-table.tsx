"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export interface ColumnDef<T> {
  key: string;
  header: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => React.ReactNode;
  /** Sembunyikan kolom ini pada tampilan kartu mobile. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  data: T[] | undefined;
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  /** Render kustom satu baris sebagai kartu di mobile. Default: daftar label–nilai. */
  mobileCard?: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = "Tidak ada data",
  skeletonRows = 3,
  mobileCard,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 md:p-6 space-y-3">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <Skeleton key={i} className="h-16 md:h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="p-12 text-center text-muted-foreground">{emptyMessage}</div>
        </CardContent>
      </Card>
    );
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile);

  return (
    <>
      {/* Mobile: daftar baris ala aplikasi, tidak ada scroll horizontal. */}
      <div className="lg:hidden rounded-xl border bg-card divide-y">
        {data.map((row) => (
          <div key={row.id} className="p-4">
            {mobileCard ? (
              mobileCard(row)
            ) : (
              <dl className="space-y-2">
                {mobileColumns.map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground flex-shrink-0">{col.header}</dt>
                    <dd className="text-right min-w-0">{col.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: tabel seperti semula. */}
      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.headerClassName}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.cellClassName}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
