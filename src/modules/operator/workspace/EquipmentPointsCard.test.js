import React from "react";
import { render } from "@testing-library/react";
import EquipmentPointsCard from "./EquipmentPointsCard";
import { applyHierarchyLiveToWorkspaceRows } from "../../../lib/operator/operatorWorkspaceHierarchyMerge";

it("shows a real active alarm on an offline merged point without coloring the row", () => {
  const row = { id: "row", equipmentId: "eq", pointKey: "zoneTemp", pointName: "Zone Temperature" };
  const bundle = { controller: { status: "OFFLINE" }, points: [{ id: "db-point", pointCode: "SPACE_TEMP" }],
    mappings: [{ pointId: "db-point", fieldPointKey: "SPACE_TEMP", isBound: true }] };
  const rows = applyHierarchyLiveToWorkspaceRows([row], { equipment: [] }, new Map([["eq", bundle]]));
  const { getByText } = render(<EquipmentPointsCard displayPoints={rows} pointUiState={{}} equipmentId="eq"
    currentUser={{ roleKey: "viewer" }} onToggleExpand={() => {}}
    alarms={[{ state: "ACTIVE", pointId: "db-point", equipmentId: "eq", operator: "GT" }]} />);
  expect(getByText("High Alarm", { selector: ".status-indicator__label" })).toBeTruthy();
  expect(getByText("Offline")).toBeTruthy();
  const name = getByText("Zone Temperature");
  expect(name.classList.contains("points-table__name--alarm")).toBe(true);
  expect(name.querySelector("svg")).toBeNull();
  expect(name.textContent).toBe("Zone Temperature");
  expect(name.closest("tr").className).toBe("");
});

it("merges changing runtime samples and ages them through normal freshness rules", () => {
  const now = Date.now();
  const row = { id: "row", equipmentId: "eq", pointKey: "zoneTemp" };
  const point = { id: "db-point", pointCode: "SPACE_TEMP", pointName: "Space Temperature",
    presentValue: "72.1", lastSeenAt: new Date(now).toISOString(), commState: "ONLINE" };
  const bundle = { controller: { status: "ONLINE", lastSeenAt: point.lastSeenAt, pollRateMs: 20000 },
    points: [point], mappings: [{ pointId: point.id, fieldPointKey: "SPACE_TEMP", isBound: true }] };
  const merge = (at) => applyHierarchyLiveToWorkspaceRows([row], { equipment: [] }, new Map([["eq", bundle]]), at)[0];
  expect(merge(now).commFreshnessStatus).toBe("LIVE");
  const firstValue = merge(now).value;
  point.presentValue = "72.2";
  expect(merge(now).value).not.toEqual(firstValue);
  expect(merge(now + 45000).commFreshnessStatus).toBe("STALE");
  expect(merge(now + 100000).commFreshnessStatus).toBe("OFFLINE");
  expect(merge(now + 100000).presentValueRaw).toBeNull();
});
