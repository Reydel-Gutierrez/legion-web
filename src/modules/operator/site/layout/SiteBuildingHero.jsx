import React from "react";

/**
 * Top-left hero for the operator building main page (deployed layout graphic backdrop).
 *
 * Typography (see `.site-building-hero` in `_legion-layout.scss`):
 * - Title: building name — font **Nunito Sans** (Volt base / `--bs-font-sans-serif`), ~**2.125rem–3.5rem** responsive, weight **800**, uppercase, horizontal flow.
 * - Building type (blue): same stack, ~**0.9375rem–1.125rem**, weight **700**, uppercase, letter-spacing **0.1em**.
 * - Tagline (gray): same stack, ~**0.875rem–1rem**, weight **400**, line-height **1.5**.
 */
export default function SiteBuildingHero({ buildingName, subtitle, tagline }) {
  return (
    <header className="site-building-hero">
      <h1 className="site-building-hero__title">{buildingName}</h1>
      <p className="site-building-hero__kicker">{subtitle}</p>
      <hr className="site-building-hero__rule" />
      <p className="site-building-hero__tagline">{tagline}</p>
    </header>
  );
}
