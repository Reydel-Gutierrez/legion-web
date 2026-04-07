import React, { useMemo } from "react";
import SiteBuildingHero from "./SiteBuildingHero";
import SiteQuickNavigation from "./SiteQuickNavigation";
import SiteBuildingInsightWidgets from "./SiteBuildingInsightWidgets";
import {
  findBuildingInRelease,
  sortedFloorsForBuilding,
  equipmentForBuilding,
  resolveBuildingHeroCopy,
} from "../../../../lib/siteBuildingOverviewUtils";

/**
 * Operator building main page: vignette, hero copy, Quick navigation card, bottom insight strip.
 */
export default function SiteBuildingOverview({ releaseData, buildingId, onSelectFloor, onBackToMap }) {
  const building = useMemo(() => findBuildingInRelease(releaseData, buildingId), [releaseData, buildingId]);
  const floors = useMemo(() => sortedFloorsForBuilding(building), [building]);
  const buildingEquipment = useMemo(() => equipmentForBuilding(releaseData, buildingId), [releaseData, buildingId]);

  const hero = useMemo(
    () => resolveBuildingHeroCopy(building, releaseData?.site ?? null),
    [building, releaseData?.site]
  );

  return (
    <div className="site-building-overview">
      <div className="site-building-overview__vignette" aria-hidden />
      <SiteBuildingHero buildingName={hero.name} subtitle={hero.subtitle} tagline={hero.tagline} />
      <SiteQuickNavigation
        variant="building"
        releaseData={releaseData}
        building={building}
        floors={floors}
        onSelectFloor={onSelectFloor}
        onBackToMap={onBackToMap}
      />
      <SiteBuildingInsightWidgets buildingId={buildingId} buildingEquipment={buildingEquipment} />
    </div>
  );
}
