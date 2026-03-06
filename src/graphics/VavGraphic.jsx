// components/legion/VavDuctDamperGraphic.jsx
import React from "react";

export default function VavDuctDamperGraphic({
  title = "VAV Duct",
  damperPct = 50,      // 0–100
  flowCfm = 420,
  datF = 55.8,
  alarm = false
}) {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const d = clamp(Number(damperPct) || 0, 0, 100);

  // Damper blade angle: closed = -45°, open = +45°
  const angle = -45 + (d * 90) / 100;

  return (
    <div className="w-100">
      <svg viewBox="0 0 980 220" className="w-100" style={{ height: 220 }}>
        {/* Card-ish background */}
        <rect
          x="0"
          y="0"
          width="980"
          height="220"
          rx="14"
          fill="rgba(255,255,255,0.04)"
          stroke={alarm ? "rgba(250,82,82,0.45)" : "rgba(255,255,255,0.10)"}
        />

        {/* Title */}
        <text x="24" y="36" fill="rgba(255,255,255,0.92)" fontSize="18" fontWeight="700">
          {title}
        </text>
        {alarm && (
          <text x="120" y="36" fill="rgba(250,82,82,0.95)" fontSize="12" fontWeight="700">
            ● ALARM
          </text>
        )}

        {/* Duct (long bar with arrow ends) */}
        <g>
          {/* main duct body */}
          <rect
            x="90"
            y="86"
            width="800"
            height="64"
            rx="10"
            fill="rgba(255,255,255,0.10)"
            stroke="rgba(255,255,255,0.12)"
          />

          {/* left arrow end */}
          <path
            d="M90 86 L55 118 L90 150 Z"
            fill="rgba(255,255,255,0.10)"
            stroke="rgba(255,255,255,0.12)"
          />

          {/* right arrow end */}
          <path
            d="M890 86 L925 118 L890 150 Z"
            fill="rgba(255,255,255,0.10)"
            stroke="rgba(255,255,255,0.12)"
          />
        </g>

        {/* Small “taps” / sensors (optional flair like your example) */}
        <g>
          <rect x="120" y="70" width="8" height="18" fill="rgba(245,183,89,0.9)" />
          <circle cx="124" cy="156" r="8" fill="rgba(30,144,255,0.9)" />
          <text x="124" y="160" textAnchor="middle" fontSize="10" fill="rgba(0,0,0,0.75)" fontWeight="700">
            S
          </text>

          <rect x="852" y="70" width="8" height="18" fill="rgba(245,183,89,0.9)" />
          <circle cx="856" cy="156" r="8" fill="rgba(30,144,255,0.9)" />
          <text x="856" y="160" textAnchor="middle" fontSize="10" fill="rgba(0,0,0,0.75)" fontWeight="700">
            D
          </text>
        </g>

        {/* Modulating damper in the middle */}
        <g>
          {/* damper frame */}
          <rect
            x="470"
            y="78"
            width="40"
            height="80"
            rx="6"
            fill="rgba(0,0,0,0.18)"
            stroke="rgba(255,255,255,0.16)"
          />

          {/* pivot */}
          <circle cx="490" cy="118" r="5" fill="rgba(255,255,255,0.55)" />

          {/* blade group rotates around pivot */}
          <g style={{ transformOrigin: "490px 118px", transform: `rotate(${angle}deg)` }}>
            <rect x="450" y="114" width="80" height="8" rx="4" fill="rgba(201,226,101,0.95)" />
          </g>

          {/* label */}
          <text x="490" y="170" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="12">
            Damper: <tspan fontWeight="700" fill="rgba(255,255,255,0.92)">{d.toFixed(0)}%</tspan>
          </text>
        </g>

        {/* Airflow arrows (simple) */}
        <g fill="rgba(93,243,0,0.45)">
          <path d="M210 118 l12 -9 v7 h24 v4 h-24 v7 z" />
          <path d="M700 118 l12 -9 v7 h24 v4 h-24 v7 z" />
        </g>

        {/* Bottom stats (optional) */}
        <text x="24" y="206" fill="rgba(255,255,255,0.55)" fontSize="12">
          Flow: <tspan fill="rgba(255,255,255,0.9)" fontWeight="700">{flowCfm} CFM</tspan>
          <tspan dx="18" />
          DAT: <tspan fill="rgba(255,255,255,0.9)" fontWeight="700">{Number(datF).toFixed(1)}°F</tspan>
        </text>
      </svg>
    </div>
  );
}
