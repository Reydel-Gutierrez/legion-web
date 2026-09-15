import React from "react";
import { fireEvent, render } from "@testing-library/react";
import EquipmentAlarmWorkspace from "./EquipmentAlarmWorkspace";
import { operatorRepository } from "../../../lib/data";

const points = [
  { id: "dat", pointKey: "DAT", pointName: "Discharge Air Temperature", pointDescription: "Discharge Air Temperature", value: 72 },
  { id: "fan", pointKey: "FAN_STATUS", pointName: "Supply Fan Status", value: "ON" },
];

const props = {
  equipment: { id: "fcu-1", name: "FCU-1", type: "FCU" },
  points,
  alarms: [],
  releaseData: { equipment: [{ id: "fcu-1", name: "FCU-1", type: "FCU" }] },
  siteKey: "local-site",
  onBack: vi.fn(),
};

it("opens with Configure Alarm point as Input 1 and supports additional semantic inputs", () => {
  const { getByText, getAllByText, container } = render(<EquipmentAlarmWorkspace {...props} initialPoint={points[0]} />);
  expect(getAllByText("Discharge Air Temperature", { selector: "strong" }).length).toBeGreaterThan(0);
  fireEvent.change(container.querySelector("select"), { target: { value: "fan" } });
  expect(getAllByText("Supply Fan Status", { selector: "strong" }).length).toBeGreaterThan(0);
  fireEvent.click(container.querySelector(".logic-wizard__footer .btn-primary"));
  expect(getByText("Define the condition")).toBeTruthy();
});

it("does not execute an output while saving a rule and keeps unsupported multi-input deployment guarded", async () => {
  const create = vi.spyOn(operatorRepository, "createOperatorAlarmDefinition").mockResolvedValue({});
  const { getByText, container } = render(<EquipmentAlarmWorkspace {...props} initialPoint={points[0]} />);
  const next = () => container.querySelector(".logic-wizard__footer .btn-primary");
  fireEvent.change(container.querySelector("select"), { target: { value: "fan" } });
  fireEvent.click(next());
  fireEvent.click(next());
  fireEvent.click(next());
  fireEvent.click(getByText("Save Rule"));
  expect(create).not.toHaveBeenCalled();
  expect(getByText(/Choose Input A/)).toBeTruthy();
  create.mockRestore();
});

it("shows one wizard step at a time while retaining selected inputs", () => {
  const { container, getByText } = render(<EquipmentAlarmWorkspace {...props} initialPoint={points[0]} />);
  expect(container.querySelector(".logic-wizard__inputs")).toBeTruthy();
  fireEvent.click(container.querySelector(".logic-wizard__footer .btn-primary"));
  expect(getByText("Define the condition")).toBeTruthy();
  expect(container.querySelector(".logic-wizard__inputs")).toBeNull();
  fireEvent.click(container.querySelector(".logic-wizard__footer .btn-outline-secondary"));
  expect(container.querySelectorAll(".logic-wizard__selected strong").length).toBe(1);
  expect(container.querySelector(".logic-wizard__selected").textContent).toContain("Discharge Air Temperature");
});
