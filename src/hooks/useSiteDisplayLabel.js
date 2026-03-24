import { useMemo } from "react";
import { useSite } from "../app/providers/SiteProvider";
import { useEngineeringVersionContext } from "../app/providers/EngineeringVersionProvider";
import { getSiteDisplayLabel } from "../lib/siteDisplayLabel";

/** Resolves sidebar / header labels: API site name, legacy mock name, or working draft name for "New Site". */
export function useSiteDisplayLabel() {
  const { site, apiSites } = useSite();
  const { workingVersion } = useEngineeringVersionContext();
  const workingSiteName = workingVersion?.data?.site?.name;
  return useMemo(
    () => getSiteDisplayLabel(site, apiSites, { workingSiteName }),
    [site, apiSites, workingSiteName]
  );
}
