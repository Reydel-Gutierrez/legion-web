import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from "react";
import { operatorRepository } from "../../lib/data";
import { USE_HIERARCHY_API } from "../../lib/data/config";
import { isBackendSiteId } from "../../lib/data/siteIdUtils";
import { DEMO_CAMPUS_SITE_ID, SITE_IDS } from "../../lib/sites";

const SiteContext = createContext(null);

const LEGACY_DEFAULT_SITE = "Miami HQ";

const LEGACY_MOCK_SITE_VALUES = new Set([
  SITE_IDS.MIAMI_HQ,
  SITE_IDS.BRIGHTLINE,
  SITE_IDS.NEW_SITE,
  "New Building",
]);

function pickDefaultApiSiteId(apiSites) {
  if (!apiSites?.length) return null;
  const preferred = apiSites.find((s) => s.id === DEMO_CAMPUS_SITE_ID);
  return preferred ? preferred.id : apiSites[0].id;
}

/** Persisted selection is invalid for the API list (deleted site, or legacy mock while API has real sites). */
function shouldReselectFromApiList(prev, apiSites) {
  if (!apiSites?.length) return false;
  const ids = new Set(apiSites.map((s) => s.id));
  if (ids.has(prev)) return false;
  if (isBackendSiteId(prev)) return true;
  return LEGACY_MOCK_SITE_VALUES.has(prev) || prev === LEGACY_DEFAULT_SITE;
}

export function SiteProvider({ children }) {
  const [site, setSite] = useState(() => localStorage.getItem("legionSite") || LEGACY_DEFAULT_SITE);
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
        setSite((prev) => {
          if (!list.length) return prev;
          if (!shouldReselectFromApiList(prev, list)) return prev;
          return pickDefaultApiSiteId(list) ?? prev;
        });
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
