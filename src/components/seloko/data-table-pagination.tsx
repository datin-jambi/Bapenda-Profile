"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function DataTablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  function handlePageSizeChange(val: string) {
    onPageSizeChange(Number(val));
    onPageChange(1);
  }

  return (
    <div className="flex items-center justify-between px-1 flex-wrap gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden sm:inline">Tampilkan</span>
        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
          {/* Target sentuh dinaikkan di HP (h-10) dan kembali ringkas di desktop. */}
          <SelectTrigger className="w-[76px] h-10 sm:h-8 sm:w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">data — menampilkan {from}–{to} dari {totalItems}</span>
        <span className="sm:hidden">{from}–{to} / {totalItems}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" className="h-10 w-10 p-0 sm:h-8 sm:w-8" onClick={() => onPageChange(1)} disabled={page <= 1}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-10 w-10 p-0 sm:h-8 sm:w-8" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm">
          {page} / {totalPages}
        </span>
        <Button size="sm" variant="outline" className="h-10 w-10 p-0 sm:h-8 sm:w-8" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-10 w-10 p-0 sm:h-8 sm:w-8" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
