import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FacilityTreeNode from "./FacilityTreeNode";
import OperatorTopBar from "./OperatorTopBar";
import EquipmentHeader from "../workspace/EquipmentHeader";
import { annotateFacilityTreeAlarms } from "../../../lib/operator/pointAlarms";

vi.mock("../../../hooks/useSiteRuntimeStatus", () => ({
  useSiteRuntimeStatus: () => ({ siteStatus: "LIVE", siteStatusLabel: "Online" }),
}));
vi.mock("./OperatorGlobalSearch", () => ({ default: () => null }));
vi.mock("./DashboardModeSelector", () => ({ default: () => null }));

const treeProps = { depth: 0, expandedIds: new Set(), onSelect: () => {}, onToggleExpand: () => {} };

it("keeps online equipment names/icons without status text or indicators", () => {
  const { container } = render(<FacilityTreeNode {...treeProps}
    node={{ id: "eq", label: "AHU-2", kind: "equipment", commStatus: "LIVE", alarmCount: 0 }} />);
  expect(container.querySelector(".facility-tree__hit").textContent).toBe("AHU-2");
  expect(container.querySelector(".facility-tree__icon.plc-controller-icon")).toBeTruthy();
  expect(container.querySelector(".status-indicator, .operator-alarm-bell, .facility-tree__icon--offline")).toBeNull();
});

it("colors the existing controller icon red while keeping the alarm in the separate gutter", () => {
  const { container } = render(<FacilityTreeNode {...treeProps} selectedId="eq"
    node={{ id: "eq", label: "AHU-2", kind: "equipment", commStatus: "Offline", alarmCount: 3 }} />);
  const gutter = container.querySelector(".facility-tree__status-gutter");
  expect(gutter.children).toHaveLength(1);
  expect(gutter.querySelector(".operator-alarm-bell--active")).toBeTruthy();
  const icon = container.querySelector(".facility-tree__icons > .plc-controller-icon");
  expect(icon).toBeTruthy();
  expect(icon.classList.contains("facility-tree__icon--offline")).toBe(true);
  expect(icon.getAttribute("style")).toContain("color: rgb(214, 69, 69)");
  expect(icon.getAttribute("style")).toContain("stroke: #d64545");
  // The PLC SVG paints its outline with currentColor; the offline tree rule therefore colors the actual SVG.
  expect(icon.getAttribute("stroke")).toBe("currentColor");
  expect(icon.querySelectorAll("path, rect").length).toBeGreaterThan(0);
  expect(container.querySelector(".facility-tree__status-gutter .plc-controller-icon")).toBeNull();
  expect(container.querySelector(".facility-tree__label").textContent).toBe("AHU-2");
  expect(container.querySelector(".facility-tree__row.is-selected")).toBeTruthy();
  expect(container.querySelector(".facility-tree__alarm, .facility-tree__comm")).toBeNull();
});

it("passes the workspace Offline state through the annotated tree into the controller SVG", () => {
  const tree = {
    id: "site",
    kind: "site",
    children: [{ id: "floor", kind: "floor", children: [{ id: "fcu-3", kind: "equipment", label: "FCU-3", children: [] }] }],
  };
  const annotated = annotateFacilityTreeAlarms(
    tree,
    [],
    [],
    Date.parse("2026-09-06T12:00:00Z"),
    [{ equipmentId: "fcu-3", status: "ONLINE", lastSeenAt: null, pollRateMs: 20000 }]
  );
  const { container } = render(<FacilityTreeNode {...treeProps} node={annotated.children[0].children[0]} />);
  const icon = container.querySelector(".plc-controller-icon");
  expect(annotated.children[0].children[0].commStatus).toBe("OFFLINE");
  expect(icon.classList.contains("facility-tree__icon--offline")).toBe(true);
});

it.each(["site", "building", "floor"])("shows no alarm indicators on %s nodes", (kind) => {
  const { container } = render(<FacilityTreeNode {...treeProps}
    node={{ id: kind, label: "Facility", kind, alarmCount: 7, commStatus: "OFFLINE" }} />);
  expect(container.querySelector(".facility-tree__hit").textContent).toBe("Facility");
  expect(container.querySelector(".operator-alarm-bell, .facility-tree__icon--offline")).toBeNull();
});

it("keeps header Online status and replaces alarm count text with a bell", () => {
  const { container, getByText, queryByText } = render(<MemoryRouter><EquipmentHeader
    equipment={{ id: "eq", name: "AHU-2" }} commHeadline="LIVE" alarmCount={2} />
  </MemoryRouter>);
  expect(getByText("Online")).toBeTruthy();
  expect(container.querySelector(".operator-alarm-bell--active")).toBeTruthy();
  expect(queryByText(/\d+.*Alarm/)).toBeNull();
});

it("styles the existing top-bar bell from active alarms, with no badge/count", () => {
  const props = { currentUser: { fullName: "Operator", roleKey: "operator" } };
  const { container, rerender, getByLabelText } = render(<MemoryRouter>
    <OperatorTopBar {...props} hasActiveAlarms={false} />
  </MemoryRouter>);
  expect(getByLabelText("Notifications").querySelector('[data-icon="bell"]')).toBeTruthy();
  expect(container.querySelector(".operator-alarm-bell--active, .operator-topbar__badge")).toBeNull();
  rerender(<MemoryRouter><OperatorTopBar {...props} hasActiveAlarms /></MemoryRouter>);
  expect(getByLabelText("Notifications").querySelector(".operator-alarm-bell--active")).toBeTruthy();
  expect(container.querySelector(".operator-topbar__badge")).toBeNull();
});
