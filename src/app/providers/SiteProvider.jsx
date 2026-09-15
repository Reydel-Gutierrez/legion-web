import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from "react";
import { operatorRepository } from "../../lib/data";
import { USE_HIERARCHY_API } from "../../lib/data/config";
import { isBackendSiteId } from "../../lib/data/siteIdUtils";
import { coerceSiteKeyToApiId } from "../../lib/data/siteApiResolution";
import {
  pruneActiveReleasesNotBoundToApi,
  pruneWorkingVersionsNotBoundToApi,
} from "../../lib/data/persistence/engineeringVersionPersistence";
import { DEMO_CAMPUS_SITE_ID, SITE_IDS } from "../../lib/sites";

const SiteContext = createContext(null);

const LEGACY_DEFAULT_SITE = "Miami HQ";

/**
 * When the saved site id is invalid, pick a sensible default — prefer real projects over
 * seeded Demo Campus so Operator/Engineering land on user sites after mode switches or first load.
 */
function pickDefaultApiSiteId(apiSites) {
  if (!apiSites?.length) return null;
  const nonDemo = apiSites.filter((s) => s.id !== DEMO_CAMPUS_SITE_ID);
  const pool = nonDemo.length > 0 ? nonDemo : apiSites;
  const sorted = [...pool].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
  );
  return sorted[0]?.id ?? apiSites[0].id;
}

/** True if `prev` is allowed while using the API: real site id, wizard placeholder, or display name that maps to a site. */
function isApiModeSiteSelectionAllowed(prev, apiSites) {
  if (prev == null || prev === "") return false;
  if (prev === SITE_IDS.NEW_SITE || prev === "New Building") return true;
  if (!apiSites?.length) return true;
  const ids = new Set(apiSites.map((s) => s.id));
  if (ids.has(prev)) return true;
  if (coerceSiteKeyToApiId(prev, apiSites)) return true;
  return false;
}

function readInitialSite() {
  const stored = localStorage.getItem("legionSite");
  if (!USE_HIERARCHY_API) {
    return stored || LEGACY_DEFAULT_SITE;
  }
  if (stored === "") return "";
  if (stored != null) return stored;
  return "";
}

export function SiteProvider({ children }) {
  const [site, setSite] = useState(readInitialSite);
  const [apiSites, setApiSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(Boolean(USE_HIERARCHY_API));
  const [sitesError, setSitesError] = useState(null);

  useEffect(() => {
    localStorage.setItem("legionSite", site);
  }, [site]);

  useEffect(() => {
    if (!USE_HIERARCHY_API) {
      setSitesLoading(false);
      return undefined;
    }
    let cancelled = false;
    setSitesLoading(true);
    setSitesError(null);
    operatorRepository
      .fetchSites()
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setApiSites(list);
        setSitesError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setApiSites([]);
          setSitesError(e?.message || String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setSitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * After sites resolve: coerce name → UUID, pick default, or clear stale mock/local names when the
   * backend is unreachable or returns no projects (avoids showing e.g. "Brightline Trains" offline).
   */
  useEffect(() => {
    if (!USE_HIERARCHY_API) return;
    if (sitesLoading) return;

    if (sitesError || apiSites.length === 0) {
      setSite((prev) => {
        if (prev === SITE_IDS.NEW_SITE || prev === "New Building") return prev;
        return "";
      });
      return;
    }

    pruneWorkingVersionsNotBoundToApi(apiSites);
    pruneActiveReleasesNotBoundToApi(apiSites);
    setSite((prev) => {
      const coerced = coerceSiteKeyToApiId(prev, apiSites);
      if (coerced && coerced !== prev) return coerced;
      if (isApiModeSiteSelectionAllowed(prev, apiSites)) return prev;
      return pickDefaultApiSiteId(apiSites) ?? prev;
    });
  }, [apiSites, sitesLoading, sitesError]);

  useEffect(() => {
    if (!USE_HIERARCHY_API) return undefined;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        operatorRepository.fetchSites().then((rows) => {
          const list = Array.isArray(rows) ? rows : [];
          setApiSites(list);
          setSitesError(null);
        }).catch((e) => {
          setApiSites([]);
          setSitesError(e?.message || String(e));
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const refreshSites = useCallback(() => {
    if (!USE_HIERARCHY_API) return Promise.resolve();
    setSitesLoading(true);
    setSitesError(null);
    return operatorRepository
      .fetchSites()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setApiSites(list);
        setSitesError(null);
      })
      .catch((e) => {
        setApiSites([]);
        setSitesError(e?.message || String(e));
      })
      .finally(() => {
        setSitesLoading(false);
      });
  }, []);

  const value = useMemo(
    () => ({
      site,
      setSite,
      /** Same as `site` — explicit alias for call sites that expect a site id. */
      siteId: site,
      apiSites,
      sitesLoading,
      sitesError,
      refreshSites,
    }),
    [site, apiSites, sitesLoading, sitesError, refreshSites]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return ctx;
}
