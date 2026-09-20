import React from "react";
import { render, fireEvent } from "@testing-library/react";
import EquipmentScheduleModal from "./EquipmentScheduleModal";
import { operatorRepository } from "../../../lib/data";

const equipment = { id: "vav", name: "VAV-1", type: "VAV" };
const props = { show: true, onHide: () => {}, siteKey: "test-site", equipment,
  occupancy: { occupied: true, label: "Occupied", source: "schedule" },
  schedules: [], now: new Date("2026-09-07T12:00:00") };

it("shows occupancy and schedule information but no mutation controls for viewers", () => {
  const { getByText, queryByText } = render(<EquipmentScheduleModal {...props} currentUser={{ roleKey: "viewer" }} />);
  expect(getByText("Current occupancy")).toBeTruthy();
  expect(getByText("Weekly schedule")).toBeTruthy();
  expect(getByText("Next occupancy change")).toBeTruthy();
  expect(getByText("No schedule configured")).toBeTruthy();
  expect(queryByText("Edit Schedule")).toBeNull();
  expect(queryByText("Temporary override")).toBeNull();
});

it("saves through the shared repository with the actual equipment type", () => {
  const save = vi.spyOn(operatorRepository, "upsertScheduleForSite").mockReturnValue([]);
  const { getByText } = render(<EquipmentScheduleModal {...props} currentUser={{ roleKey: "operator" }} />);
  fireEvent.click(getByText("Edit Schedule"));
  fireEvent.click(getByText("Save schedule"));
  expect(save).toHaveBeenCalledWith("test-site", expect.objectContaining({ equipmentId: "vav", equipType: "VAV" }));
  save.mockRestore();
});
