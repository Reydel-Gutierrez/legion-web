import React from "react";
import { fireEvent, render } from "@testing-library/react";
import EquipmentOccupancyWorkspace from "./EquipmentOccupancyWorkspace";

it("shows current state and next schedule change in the full workspace", () => {
  const { getByText, getAllByText } = render(<EquipmentOccupancyWorkspace
    equipment={{ id: "fcu-1", name: "FCU-1", type: "FCU" }}
    schedules={[{ id: "s1", equipmentId: "fcu-1", name: "Weekday", days: ["Mon"], startTime: "07:00", endTime: "18:00", action: "Occupied" }]}
    occupancy={{ label: "Occupied", occupied: true, source: "schedule" }}
    currentUser={{ roleKey: "viewer" }}
    now={new Date("2026-09-07T12:00:00")}
    siteKey="local-site"
    onBack={jest.fn()}
  />);
  expect(getByText("Current Occupancy")).toBeTruthy();
  expect(getAllByText("Occupied").length).toBeGreaterThan(0);
  expect(getByText("Weekly schedule")).toBeTruthy();
  expect(getByText(/Unoccupied at/)).toBeTruthy();
});

it("keeps schedule editing permission gated", () => {
  const { queryByText } = render(<EquipmentOccupancyWorkspace equipment={{ id: "fcu-1", name: "FCU-1" }} schedules={[]} occupancy={{ label: "Unoccupied" }} currentUser={{ roleKey: "viewer" }} now={new Date()} siteKey="local-site" onBack={jest.fn()} />);
  expect(queryByText("Add schedule")).toBeNull();
});
