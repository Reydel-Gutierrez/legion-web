import { useMemo } from "react";
import { useSite } from "../app/providers/SiteProvider";
import { useEngineeringVersionContext } from "../app/providers/EngineeringVersionProvider";
import { USE_HIERARCHY_API } from "../lib/data/config";
import { SITE_IDS } from "../lib/sites";
import { getSiteDisplayLabel } from "../lib/siteDisplayLabel";

const NOT_CONNECTED_LABEL = "Not Connected";

/** Resolves sidebar / header labels: API site name, legacy mock name, or working draft name for "New Site". */
export function useSiteDisplayLabel() {
  const { site, apiSites, sitesLoading, sitesError } = useSite();
  const { workingVersion } = useEngineeringVersionContext();
  const workingSiteName = workingVersion?.data?.site?.name;
  return useMemo(() => {
    if (!USE_HIERARCHY_API) {
      return getSiteDisplayLabel(site, apiSites, { workingSiteName });
    }
    if (sitesLoading && apiSites.length === 0) {
      return "Loading…";
    }
    if (sitesError) {
      if (site === SITE_IDS.NEW_SITE || site === "New Building") {
        return getSiteDisplayLabel(site, apiSites, { workingSiteName });
      }
      return NOT_CONNECTED_LABEL;
    }
    if (!sitesLoading && apiSites.length === 0) {
      if (site === SITE_IDS.NEW_SITE || site === "New Building") {
        return getSiteDisplayLabel(site, apiSites, { workingSiteName });
      }
      return "No sites";
    }
    return getSiteDisplayLabel(site, apiSites, { workingSiteName });
  }, [site, apiSites, sitesLoading, sitesError, workingSiteName]);
}
