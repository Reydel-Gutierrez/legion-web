import React, { useMemo } from "react";
import { Card } from "@themesberg/react-bootstrap";

/**
 * @param {{
 *   series: { pointId: string; label: string; unit: string; min: number; max: number; values: number[] }[];
 *   showPoints: Record<string, boolean>;
 *   referenceBands: { pointId: string; min: number; max: number; enabled: boolean }[];
 *   events: { kind: string; startIdx?: number; endIdx?: number }[];
 *   sessionActive?: boolean;
 *   collecting?: boolean;
 * }} props
 */
export default function TrendSummaryCard({ series, showPoints, referenceBands, events, sessionActive = true, collecting = false }) {
  const lines = useMemo(() => {
    if (!sessionActive) return ["Insights appear after you start a trend and data is loaded for the selected equipment."];
    if (collecting) return ["Trend started. Historical logging is active — insights will use trend data as enough history accumulates."];
    const out = [];
    const active = series.filter((s) => showPoints[s.pointId]);
    if (!active.length) {
      out.push("Select points to generate a short summary.");
      return out;
    }

    for (const s of active) {
      const vals = s.values;
      if (!vals.length) continue;
      const last = vals[vals.length - 1];
      const band = referenceBands.find((b) => b.enabled && b.pointId === s.pointId);
      if (band) {
        const inBand = last >= Math.min(band.min, band.max) && last <= Math.max(band.min, band.max);
        out.push(
          inBand
            ? `${s.label}: latest value is inside the reference band.`
            : `${s.label}: latest value is outside the reference band — check operating conditions.`
        );
      } else {
        out.push(`${s.label}: latest reading ${last} ${s.unit}.`);
      }
    }

    const comm = events.find((e) => e.kind === "comm_loss");
    if (comm && comm.startIdx != null && comm.endIdx != null) {
      out.push("A communication loss window overlaps this period — gaps may align with offline intervals.");
    }

    for (const s of active) {
      if (s.values.length < 4) continue;
      const mx = Math.max(...s.values);
      const avg = s.values.reduce((a, b) => a + b, 0) / s.values.length;
      if (mx > avg * 1.12) {
        out.push(`${s.label}: recent values run higher than the window average — compare against schedule or occupancy.`);
        break;
      }
    }

    return out.slice(0, 4);
  }, [sessionActive, collecting, series, showPoints, referenceBands, events]);

  return (
    <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
      <Card.Body className="py-2 px-3">
        <div className="text-white fw-semibold small mb-2">Insight</div>
        <ul className="text-white small mb-0 ps-3 opacity-90">
          {lines.map((t, i) => (
            <li key={i} className="mb-1">
              {t}
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
}
