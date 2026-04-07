/**
 * Sort buildings/floors by sortOrder then name. Use after findMany/orderBy { name }
 * so the API works even when Prisma Client was generated before sortOrder existed
 * (orderBy.sortOrder would throw until `npx prisma generate` is run).
 */
function bySortOrderThenName(a, b) {
  const ao = a.sortOrder != null ? Number(a.sortOrder) : 0;
  const bo = b.sortOrder != null ? Number(b.sortOrder) : 0;
  if (ao !== bo) return ao - bo;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function sortBySortOrderThenName(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  rows.sort(bySortOrderThenName);
  return rows;
}

module.exports = {
  bySortOrderThenName,
  sortBySortOrderThenName,
};
