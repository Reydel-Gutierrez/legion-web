import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import EquipmentOccupancyWorkspace from "./EquipmentOccupancyWorkspace";
import { operatorDefinitionsRepository } from "../../../lib/data";

afterEach(() => vi.restoreAllMocks());

it("shows current state and next schedule change in the full workspace", () => {
  const { getByText, getAllByText } = render(<EquipmentOccupancyWorkspace
    equipment={{ id: "fcu-1", name: "FCU-1", type: "FCU" }}
    schedules={[{ id: "s1", equipmentId: "fcu-1", name: "Weekday", days: ["Mon"], startTime: "07:00", endTime: "18:00", action: "Occupied" }]}
    occupancy={{ label: "Occupied", occupied: true, source: "schedule" }}
    currentUser={{ roleKey: "viewer" }}
    now={new Date("2026-09-07T12:00:00")}
    siteKey="local-site"
    onBack={vi.fn()}
  />);
  expect(getByText("Current Occupancy")).toBeTruthy();
  expect(getAllByText("Occupied").length).toBeGreaterThan(0);
  expect(getByText("Weekly schedule")).toBeTruthy();
  expect(getByText(/Unoccupied at/)).toBeTruthy();
});

it("keeps schedule editing permission gated", () => {
  const { queryByText } = render(<EquipmentOccupancyWorkspace equipment={{ id: "fcu-1", name: "FCU-1" }} schedules={[]} occupancy={{ label: "Unoccupied" }} currentUser={{ roleKey: "viewer" }} now={new Date()} siteKey="local-site" onBack={vi.fn()} />);
  expect(queryByText("Add schedule")).toBeNull();
});

it("waits for durable schedule save before updating occupancy rows", async () => {
  let complete;
  const save = vi.spyOn(operatorDefinitionsRepository, "saveDefinition").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const rows = [{ id: "assignment:0", definitionId: "definition", equipmentId: "fcu-1", name: "FCU-1 Occupancy", days: ["Mon"], startTime: "07:00", endTime: "18:00", action: "Occupied" }];
  vi.spyOn(operatorDefinitionsRepository, "fetchSchedules").mockResolvedValue(rows);
  const changed = vi.fn();
  const view = render(<EquipmentOccupancyWorkspace equipment={{ id: "fcu-1", name: "FCU-1" }} schedules={[]} occupancy={{ label: "Unoccupied" }} currentUser={{ roleKey: "operator" }} now={new Date()} siteKey="saved-site" onBack={vi.fn()} onSchedulesChange={changed} />);
  fireEvent.click(view.getByRole("button", { name: "Add schedule" }));
  fireEvent.click(view.getByRole("button", { name: "Save schedule" }));
  expect(save).toHaveBeenCalledWith("saved-site", "schedule", expect.objectContaining({ equipmentIds: ["fcu-1"], weeklyWindows: [expect.objectContaining({ startTime: "07:00", endTime: "18:00" })] }));
  expect(changed).not.toHaveBeenCalled();
  await act(async () => { complete({ id: "definition" }); });
  expect(changed).toHaveBeenCalledWith(rows);
  expect(view.queryByRole("button", { name: "Save schedule" })).toBeNull();
});
