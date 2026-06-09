import React, { useMemo } from "react";
import SiteBuildingHero from "./SiteBuildingHero";
import SiteQuickNavigation from "./SiteQuickNavigation";
import {
  findBuildingInRelease,
  sortedFloorsForBuilding,
  formatBuildingHeroTitle,
} from "../../../../lib/siteBuildingOverviewUtils";

/** Operator building main page overlay: vignette, title, and quick navigation. */
export default function SiteBuildingOverview({ releaseData, buildingId, onSelectFloor, navKey }) {
  const building = useMemo(() => findBuildingInRelease(releaseData, buildingId), [releaseData, buildingId]);
  const floors = useMemo(() => sortedFloorsForBuilding(building), [building]);
  const buildingName = useMemo(() => formatBuildingHeroTitle(building?.name || "Building"), [building]);

  return (
    <div className="site-building-overview">
      <div className="site-building-overview__vignette" aria-hidden />
      <SiteBuildingHero buildingName={buildingName} />
      <SiteQuickNavigation
        variant="building"
        releaseData={releaseData}
        building={building}
        floors={floors}
        onSelectFloor={onSelectFloor}
        navKey={navKey}
      />
    </div>
  );
}
