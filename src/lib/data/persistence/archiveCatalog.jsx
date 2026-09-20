/**
 * The "folder" where local archives live — a lightweight catalog (name, timestamps) pointing at
 * working-version drafts already persisted by engineeringVersionPersistence. The catalog is what
 * makes an id a named, listable "archive file"; without an entry here, a site key is just an
 * unsaved/untitled draft (see EngineeringArchiveProvider).
 */

const STORAGE_KEY = "legion_archive_catalog";

function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readCatalog() {
  return safeParse(STORAGE_KEY, []);
}

function writeCatalog(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[Legion] Failed to save archive catalog", e);
  }
}

function normalizeName(name) {
  return String(name || "").trim();
}

/** Archives sorted by most recently updated first. */
export function listArchiveEntries() {
  return [...readCatalog()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function getArchiveEntry(id) {
  if (!id) return null;
  return readCatalog().find((e) => e.id === id) || null;
}

export function getArchiveEntryByName(name) {
  const needle = normalizeName(name).toLowerCase();
  if (!needle) return null;
  return readCatalog().find((e) => normalizeName(e.name).toLowerCase() === needle) || null;
}

export function isArchiveNameTaken(name, excludeId) {
  const needle = normalizeName(name).toLowerCase();
  if (!needle) return false;
  return readCatalog().some((e) => e.id !== excludeId && normalizeName(e.name).toLowerCase() === needle);
}

/** Registers a brand-new archive file. Throws if the name is already used by another archive. */
export function createArchiveEntry(id, name) {
  const trimmed = normalizeName(name);
  if (!id || !trimmed) throw new Error("Archive name is required.");
  if (isArchiveNameTaken(trimmed, id)) {
    throw new Error(`An archive named "${trimmed}" already exists.`);
  }
  const now = new Date().toISOString();
  const entries = readCatalog().filter((e) => e.id !== id);
  entries.push({ id, name: trimmed, createdAt: now, updatedAt: now });
  writeCatalog(entries);
  return { id, name: trimmed, createdAt: now, updatedAt: now };
}

/** Renames an existing archive. Throws if the new name is already used by another archive. */
export function renameArchiveEntry(id, name) {
  const trimmed = normalizeName(name);
  if (!id || !trimmed) throw new Error("Archive name is required.");
  if (isArchiveNameTaken(trimmed, id)) {
    throw new Error(`An archive named "${trimmed}" already exists.`);
  }
  const entries = readCatalog();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("Archive not found.");
  entries[idx] = { ...entries[idx], name: trimmed, updatedAt: new Date().toISOString() };
  writeCatalog(entries);
  return entries[idx];
}

/** Bumps updatedAt for an existing archive (Save Archive on an already-named archive). */
export function touchArchiveEntry(id) {
  const entries = readCatalog();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], updatedAt: new Date().toISOString() };
  writeCatalog(entries);
  return entries[idx];
}

export function deleteArchiveEntry(id) {
  const entries = readCatalog().filter((e) => e.id !== id);
  writeCatalog(entries);
}
