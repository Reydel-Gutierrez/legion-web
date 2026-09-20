/**
 * Local "Archive Library" — New/Save/Import/Export/Manage for Engineering projects.
 *
 * An archive is just a named entry in the catalog (src/lib/data/persistence/archiveCatalog.jsx)
 * pointing at a working-version draft keyed by site id (the existing per-site localStorage
 * mechanism in engineeringVersionPersistence.jsx does the actual read/write — this provider only
 * adds naming, uniqueness, dirty-tracking, and the New/Import/Export/Manage flows on top of it).
 *
 * Opening an archive is just `setSite(id)` — EngineeringVersionProvider's existing per-site load
 * effect does the rest, so there's no separate "load" step here.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSite } from "./SiteProvider";
import { useWorkingVersion } from "../../hooks/useWorkingVersion";
import { USE_HIERARCHY_API } from "../../lib/data/config";
import { isBackendSiteId } from "../../lib/data/siteIdUtils";
import { coerceSiteKeyToApiId } from "../../lib/data/siteApiResolution";
import { saveWorkingVersion as saveWorkingVersionToApi, notifyEngineeringHierarchyChanged } from "../../lib/data/repositories/engineeringRepository";
import {
  saveWorkingVersionForSite,
  deleteWorkingVersionForSite,
} from "../../lib/data/persistence/engineeringVersionPersistence";
import {
  listArchiveEntries,
  getArchiveEntry,
  createArchiveEntry,
  renameArchiveEntry,
  touchArchiveEntry,
  deleteArchiveEntry,
} from "../../lib/data/persistence/archiveCatalog";
import { ARCHIVE_NONE_SITE_KEY, generateArchiveSiteKey } from "../../lib/data/archiveConstants";
import { appNotify } from "../../lib/app-activity";

const ARCHIVE_FORMAT = "legion-archive";
const ARCHIVE_FORMAT_VERSION = 1;

const EngineeringArchiveContext = createContext(null);

function suggestNameFromFile(fileName) {
  return String(fileName || "")
    .replace(/\.json$/i, "")
    .trim();
}

export function EngineeringArchiveProvider({ children }) {
  const { site, setSite, apiSites } = useSite();
  const { workingState } = useWorkingVersion();

  const [archiveEntries, setArchiveEntries] = useState(() => listArchiveEntries());
  const refreshCatalog = useCallback(() => setArchiveEntries(listArchiveEntries()), []);

  // Dirty tracking: opening a site produces at least two workingState changes in quick succession
  // (the reducer's synchronous default, then the actual loaded draft from EngineeringVersionProvider's
  // effect) — a single-shot "skip the next change" flag only covers the first one and misreports the
  // second as a user edit. Use a short settle window instead: anything landing within it after a site
  // switch is treated as load noise, not a real edit.
  const [isDirty, setIsDirty] = useState(false);
  const settlingRef = useRef(true);
  useEffect(() => {
    settlingRef.current = true;
    setIsDirty(false);
    const timer = setTimeout(() => {
      settlingRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, [site]);
  useEffect(() => {
    if (settlingRef.current) return;
    setIsDirty(true);
  }, [workingState]);

  const activeArchive = useMemo(() => getArchiveEntry(site), [site, archiveEntries]);
  // Whether an archive slot is open at all — true the instant New/Import/Open completes, even
  // before the user has built out any site/building content in it.
  const hasArchiveOpen = site !== ARCHIVE_NONE_SITE_KEY;

  const [nameModal, setNameModal] = useState(null);
  const [unsavedGuard, setUnsavedGuard] = useState(null);

  const siteKeyForApi = useMemo(() => {
    const c = coerceSiteKeyToApiId(site, apiSites);
    if (c) return c;
    return isBackendSiteId(site) ? site : null;
  }, [site, apiSites]);

  /** The actual data write — unchanged from the previous plain "Save" action. */
  const persistWorkingState = useCallback(async () => {
    if (USE_HIERARCHY_API && siteKeyForApi) {
      await saveWorkingVersionToApi(siteKeyForApi, workingState, undefined, { activity: { silent: true } });
      notifyEngineeringHierarchyChanged(siteKeyForApi);
      return;
    }
    saveWorkingVersionForSite(site, workingState);
    if (workingState?.site?.name && workingState.site.name !== site) {
      saveWorkingVersionForSite(workingState.site.name, workingState);
    }
  }, [site, siteKeyForApi, workingState]);

  /**
   * Runs the actual save and calls `onDone` only once it has genuinely completed — for an
   * already-named archive that's just after the persist write; for a never-saved one, only after
   * the user confirms a name (or never, if they cancel naming). This is what lets guardUnsaved's
   * "Save" button safely chain into whatever happens next (New/Close/Open/Delete) without racing
   * an async save or a still-open naming modal.
   */
  const performSave = useCallback(
    (onDone) => {
      if (!hasArchiveOpen) {
        appNotify.error("Nothing to save yet — create or open an archive first.");
        return;
      }
      if (activeArchive) {
        persistWorkingState()
          .then(() => {
            touchArchiveEntry(site);
            refreshCatalog();
            setIsDirty(false);
            appNotify.success("Archive saved");
            onDone?.();
          })
          .catch((e) => appNotify.error(e?.message || "Failed to save archive"));
        return;
      }
      setNameModal({
        title: "Save Archive",
        confirmLabel: "Save",
        defaultName: workingState?.site?.name || "",
        excludeId: site,
        onConfirm: (name) => {
          try {
            createArchiveEntry(site, name);
          } catch (e) {
            appNotify.error(e?.message || "Failed to save archive");
            return;
          }
          setNameModal(null);
          persistWorkingState()
            .then(() => {
              refreshCatalog();
              setIsDirty(false);
              appNotify.success("Archive saved");
              onDone?.();
            })
            .catch((e) => appNotify.error(e?.message || "Failed to save archive"));
        },
        onCancel: () => setNameModal(null),
      });
    },
    [activeArchive, hasArchiveOpen, persistWorkingState, refreshCatalog, site, workingState]
  );

  const saveActiveArchive = useCallback(() => performSave(), [performSave]);

  const guardUnsaved = useCallback(
    (proceed) => {
      if (!isDirty) {
        proceed();
        return;
      }
      setUnsavedGuard({
        label: activeArchive?.name || workingState?.site?.name || "this archive",
        onSave: () => {
          setUnsavedGuard(null);
          performSave(proceed);
        },
        onDiscard: () => {
          setUnsavedGuard(null);
          proceed();
        },
        onCancel: () => setUnsavedGuard(null),
      });
    },
    [isDirty, activeArchive, workingState, performSave]
  );

  const startNewArchive = useCallback(() => {
    // Name it up front — New Archive should never land on an unnamed "Create Your New Site"
    // screen; the archive exists and is cataloged the moment this modal is confirmed.
    guardUnsaved(() => {
      setNameModal({
        title: "New Archive",
        confirmLabel: "Create",
        defaultName: "",
        excludeId: undefined,
        onConfirm: (name) => {
          const newId = generateArchiveSiteKey();
          try {
            createArchiveEntry(newId, name);
          } catch (e) {
            appNotify.error(e?.message || "Failed to create archive");
            return;
          }
          setSite(newId);
          refreshCatalog();
          setNameModal(null);
          appNotify.success("Archive created");
        },
        onCancel: () => setNameModal(null),
      });
    });
  }, [guardUnsaved, setSite, refreshCatalog]);

  const renameActiveArchive = useCallback(() => {
    if (!activeArchive) return;
    setNameModal({
      title: "Rename Archive",
      confirmLabel: "Rename",
      defaultName: activeArchive.name,
      excludeId: activeArchive.id,
      onConfirm: (name) => {
        try {
          renameArchiveEntry(activeArchive.id, name);
        } catch (e) {
          appNotify.error(e?.message || "Failed to rename archive");
          return;
        }
        refreshCatalog();
        setNameModal(null);
        appNotify.success("Archive renamed");
      },
      onCancel: () => setNameModal(null),
    });
  }, [activeArchive, refreshCatalog]);

  const closeActiveArchive = useCallback(() => {
    guardUnsaved(() => setSite(ARCHIVE_NONE_SITE_KEY));
  }, [guardUnsaved, setSite]);

  const openArchive = useCallback(
    (id) => {
      guardUnsaved(() => setSite(id));
    },
    [guardUnsaved, setSite]
  );

  /** @returns {boolean} true once the archive was actually deleted (false if the user canceled the confirm). */
  const deleteArchive = useCallback(
    (id) => {
      const entry = getArchiveEntry(id);
      if (!window.confirm(`Delete archive "${entry?.name || id}"? This cannot be undone.`)) return false;
      deleteArchiveEntry(id);
      deleteWorkingVersionForSite(id);
      refreshCatalog();
      if (id === site) {
        setSite(ARCHIVE_NONE_SITE_KEY);
      }
      return true;
    },
    [refreshCatalog, site, setSite]
  );

  const importArchiveFile = useCallback(
    (file) => {
      if (!file) return;
      guardUnsaved(() => {
        const reader = new FileReader();
        reader.onload = () => {
          let parsed;
          try {
            parsed = JSON.parse(String(reader.result || ""));
          } catch {
            appNotify.error("That file isn't a valid archive export.");
            return;
          }
          const payload = parsed && parsed.format === ARCHIVE_FORMAT ? parsed.payload : parsed;
          if (!payload || typeof payload !== "object") {
            appNotify.error("That file isn't a valid archive export.");
            return;
          }
          const suggested = parsed?.name || payload?.site?.name || suggestNameFromFile(file.name);
          const newId = generateArchiveSiteKey();
          const previousSite = site;
          saveWorkingVersionForSite(newId, payload);
          setSite(newId);
          setNameModal({
            title: "Name this archive",
            confirmLabel: "Import",
            defaultName: suggested,
            excludeId: newId,
            onConfirm: (name) => {
              try {
                createArchiveEntry(newId, name);
              } catch (e) {
                appNotify.error(e?.message || "Failed to import archive");
                return;
              }
              refreshCatalog();
              setIsDirty(false);
              setNameModal(null);
              appNotify.success("Archive imported");
            },
            onCancel: () => {
              deleteWorkingVersionForSite(newId);
              setSite(previousSite);
              setNameModal(null);
            },
          });
        };
        reader.onerror = () => appNotify.error("Could not read that file.");
        reader.readAsText(file);
      });
    },
    [guardUnsaved, refreshCatalog, site, setSite]
  );

  const exportActiveArchive = useCallback(() => {
    if (!hasArchiveOpen) {
      appNotify.error("Nothing to export yet — create or open an archive first.");
      return;
    }
    const name = activeArchive?.name || workingState?.site?.name || "Untitled Archive";
    const exportPayload = {
      format: ARCHIVE_FORMAT,
      version: ARCHIVE_FORMAT_VERSION,
      name,
      exportedAt: new Date().toISOString(),
      payload: workingState,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const fileName = `${name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "archive"}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    appNotify.success("Archive exported");
  }, [activeArchive, hasArchiveOpen, workingState]);

  const value = useMemo(
    () => ({
      archiveEntries,
      activeArchive,
      hasArchiveOpen,
      isClosed: site === ARCHIVE_NONE_SITE_KEY,
      isDirty,
      startNewArchive,
      closeActiveArchive,
      saveActiveArchive,
      renameActiveArchive,
      importArchiveFile,
      exportActiveArchive,
      openArchive,
      deleteArchive,
      nameModal,
      unsavedGuard,
    }),
    [
      archiveEntries,
      activeArchive,
      hasArchiveOpen,
      site,
      isDirty,
      startNewArchive,
      closeActiveArchive,
      saveActiveArchive,
      renameActiveArchive,
      importArchiveFile,
      exportActiveArchive,
      openArchive,
      deleteArchive,
      nameModal,
      unsavedGuard,
    ]
  );

  return <EngineeringArchiveContext.Provider value={value}>{children}</EngineeringArchiveContext.Provider>;
}

export function useEngineeringArchive() {
  const ctx = useContext(EngineeringArchiveContext);
  if (!ctx) {
    throw new Error("useEngineeringArchive must be used within an EngineeringArchiveProvider");
  }
  return ctx;
}
