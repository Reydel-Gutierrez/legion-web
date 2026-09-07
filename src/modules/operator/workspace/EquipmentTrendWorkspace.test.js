import React from "react";
import { fireEvent, render } from "@testing-library/react";
import EquipmentTrendWorkspace from "./EquipmentTrendWorkspace";
import { operatorRepository } from "../../../lib/data";

const props = {
  equipment: { id: "fcu-1", name: "FCU-1", type: "FCU" },
  releaseData: { equipment: [{ id: "fcu-1", name: "FCU-1", type: "FCU" }] },
  siteKey: "trend-test-site",
  onBack: jest.fn(),
  onSaved: jest.fn(),
};

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(operatorRepository, "getTrendPointCatalog").mockReturnValue([
    { id: "DAT", label: "Discharge Air Temperature", unit: "°F", kind: "analog", value: 59.5 },
    { id: "FAN-S", label: "Fan Status", kind: "binary", value: "On" },
  ]);
});

afterEach(() => jest.restoreAllMocks());

it("supports point search, selection, preview, and trend save navigation", () => {
  const { getByPlaceholderText, getByText, getByRole } = render(<EquipmentTrendWorkspace {...props} />);
  fireEvent.change(getByPlaceholderText("Filter points (optional)"), { target: { value: "Fan" } });
  expect(getByText("Fan Status")).toBeTruthy();
  fireEvent.click(getByRole("button", { name: "+" }));
  expect(getByText("1 points selected")).toBeTruthy();
  fireEvent.click(getByRole("button", { name: "Next" }));
  expect(getByText("Save trend")).toBeTruthy();
});
