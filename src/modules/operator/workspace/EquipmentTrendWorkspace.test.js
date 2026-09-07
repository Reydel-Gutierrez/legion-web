import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import EquipmentTrendWorkspace from "./EquipmentTrendWorkspace";
import { operatorRepository, operatorDefinitionsRepository } from "../../../lib/data";

const props = {
  equipment: { id: "fcu-1", name: "FCU-1", type: "FCU" },
  releaseData: { equipment: [{ id: "fcu-1", name: "FCU-1", type: "FCU" }] },
  siteKey: "trend-test-site",
  onBack: jest.fn(),
  onSaved: jest.fn(),
};

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(operatorDefinitionsRepository, "fetchTrendStore").mockResolvedValue({ definitions: [], assignments: [] });
  jest.spyOn(operatorDefinitionsRepository, "saveDefinition").mockResolvedValue({ id: "saved" });
  jest.spyOn(operatorRepository, "getTrendPointCatalog").mockReturnValue([
    { id: "DAT", label: "Discharge Air Temperature", unit: "°F", kind: "analog", value: 59.5 },
    { id: "FAN-S", label: "Fan Status", kind: "binary", value: "On" },
  ]);
});

afterEach(() => jest.restoreAllMocks());

it("supports point search, selection, preview, and trend save navigation", async () => {
  const { getByPlaceholderText, getByText, getByRole } = render(<EquipmentTrendWorkspace {...props} />);
  fireEvent.change(getByPlaceholderText("Filter points (optional)"), { target: { value: "Fan" } });
  expect(getByText("Fan Status")).toBeTruthy();
  fireEvent.click(getByRole("button", { name: "+" }));
  expect(getByText("1 points selected")).toBeTruthy();
  fireEvent.click(getByRole("button", { name: "Next" }));
  expect(getByText("Save trend")).toBeTruthy();
  await act(async () => {});
});

it("persists semantic point requirements and equipment assignment before reporting success", async () => {
  const view = render(<EquipmentTrendWorkspace {...props} />);
  await act(async () => {});
  fireEvent.change(view.getByPlaceholderText("Filter points (optional)"), { target: { value: "Fan" } });
  fireEvent.click(view.getByRole("button", { name: "+" }));
  fireEvent.click(view.getByRole("button", { name: "Next" }));
  fireEvent.change(view.getByPlaceholderText("FCU temperature and fan trend"), { target: { value: "Fan trend" } });
  await act(async () => { fireEvent.click(view.getAllByRole("button", { name: "Save Trend" }).slice(-1)[0]); });
  expect(view.getByText("Trend configuration saved. Waiting for historian data.")).toBeTruthy();
  expect(operatorDefinitionsRepository.saveDefinition).toHaveBeenCalledWith(props.siteKey, "trend", expect.objectContaining({ name: "Fan trend", equipmentIds: ["fcu-1"], pointRequirements: [{ pointKey: "FAN-S", kind: "binary" }] }));
  expect(localStorage.length).toBe(0);
});

it("keeps an unsuccessful save visible and does not announce recording", async () => {
  operatorDefinitionsRepository.saveDefinition.mockRejectedValue(new Error("Database unavailable"));
  const view = render(<EquipmentTrendWorkspace {...props} />);
  await act(async () => {});
  fireEvent.change(view.getByPlaceholderText("Filter points (optional)"), { target: { value: "Fan" } });
  fireEvent.click(view.getByRole("button", { name: "+" }));
  fireEvent.click(view.getByRole("button", { name: "Next" }));
  fireEvent.change(view.getByPlaceholderText("FCU temperature and fan trend"), { target: { value: "Fan trend" } });
  await act(async () => { fireEvent.click(view.getAllByRole("button", { name: "Save Trend" }).slice(-1)[0]); });
  expect(view.getByText("Database unavailable")).toBeTruthy();
  expect(view.queryByText(/recording started/i)).toBeNull();
});
