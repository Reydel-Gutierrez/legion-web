import { useState, useEffect, useMemo } from "react";

const DEFAULT_PAGE_SIZE = 20;

/**
 * Reusable client-side table pagination hook for Legion list tables.
 * Resets to page 1 when filter/search dependencies change.
 *
 * @param {Array} filteredRows - The filtered result set (after search/filters)
 * @param {number} pageSize - Rows per page (default 20)
 * @param {string|*} filterKeyOrFirstDep - A string key (e.g. "search|type|state") or first filter value
 * @param {...*} restDeps - Additional filter values (used when filterKey is not a string)
 * @returns {Object} { page, setPage, pagedRows, total, totalPages, startIndex, endIndex, hasPrev, hasNext }
 */
export function useTablePagination(filteredRows, pageSize = DEFAULT_PAGE_SIZE, filterKeyOrFirstDep, ...restDeps) {
  const [page, setPage] = useState(1);

  // Build stable filter key: use string directly, or join all deps for proper change detection
  const filterKey =
    typeof filterKeyOrFirstDep === "string" && restDeps.length === 0
      ? filterKeyOrFirstDep
      : [filterKeyOrFirstDep, ...restDeps].join("|");

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

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
