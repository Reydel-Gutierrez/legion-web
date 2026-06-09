import React from "react";

/** Top-left building title on the deployed layout graphic. */
export default function SiteBuildingHero({ buildingName }) {
  return (
    <header className="site-building-hero">
      <h1 className="site-building-hero__title">{buildingName}</h1>
    </header>
  );
}
