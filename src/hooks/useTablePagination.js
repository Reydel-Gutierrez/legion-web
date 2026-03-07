import { useState, useEffect, useMemo } from "react";

const DEFAULT_PAGE_SIZE = 20;

/**
 * Reusable client-side table pagination hook for Legion list tables.
 * Resets to page 1 when filter/search dependencies change.
 *
 * @param {Array} filteredRows - The filtered result set (after search/filters)
 * @param {number} pageSize - Rows per page (default 20)
 * @param {...*} resetDeps - Dependencies that trigger page reset (search, filters, etc.)
 * @returns {Object} { page, setPage, pagedRows, total, totalPages, startIndex, endIndex, hasPrev, hasNext }
 */
export function useTablePagination(filteredRows, pageSize = DEFAULT_PAGE_SIZE, ...resetDeps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, resetDeps);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);

  const startIndex = (clampedPage - 1) * pageSize;
  const pagedRows = useMemo(
    () => filteredRows.slice(startIndex, startIndex + pageSize),
    [filteredRows, startIndex, pageSize]
  );
  const endIndex = total === 0 ? 0 : startIndex + pagedRows.length;

  return {
    page: clampedPage,
    setPage,
    pagedRows,
    total,
    totalPages,
    startIndex,
    endIndex,
    pageSize,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
  };
}
