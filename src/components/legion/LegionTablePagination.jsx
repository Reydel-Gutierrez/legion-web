import React from "react";
import { Button, ButtonGroup } from "@themesberg/react-bootstrap";

const PAGE_WINDOW = 2;

/**
 * Reusable pagination footer for Legion list tables.
 * Shows "Showing 1–20 of 84" and Previous / page numbers / Next.
 * Hides page controls when total <= pageSize; still shows summary.
 */
export default function LegionTablePagination({
  page,
  setPage,
  totalPages,
  total,
  startIndex,
  endIndex,
  pageSize,
  hasPrev,
  hasNext,
}) {
  const showPageControls = total > pageSize && totalPages > 1;

  const pageNumbers = [];
  let lo = Math.max(1, page - PAGE_WINDOW);
  let hi = Math.min(totalPages, page + PAGE_WINDOW);
  for (let i = lo; i <= hi; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
      <div className="text-white small fw-semibold">
        Showing {total === 0 ? "0" : `${startIndex + 1}–${endIndex}`} of {total}
      </div>
      {showPageControls && (
        <div className="d-flex align-items-center gap-1">
          <ButtonGroup size="sm">
            <Button
              variant="outline-light"
              className="border-opacity-10"
              disabled={!hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            {pageNumbers.map((n) => (
              <Button
                key={n}
                variant={n === page ? "light" : "outline-light"}
                className={n === page ? "" : "border-opacity-10"}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              variant="outline-light"
              className="border-opacity-10"
              disabled={!hasNext}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </ButtonGroup>
        </div>
      )}
    </div>
  );
}
