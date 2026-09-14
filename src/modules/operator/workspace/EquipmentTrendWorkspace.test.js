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
  expect(operatorDefinitionsRepository.saveDefinition).toHaveBeenCalledWith(props.siteKey, "trend", expect.objectContaining({ name: "Fan trend", isTemplate: false, equipmentIds: ["fcu-1"], pointRequirements: [{ pointKey: "FAN-S", kind: "binary" }] }));
  expect(localStorage.length).toBe(0);
});

it("Save as Template is a separate, explicit action from a plain per-equipment Save", async () => {
  const view = render(<EquipmentTrendWorkspace {...props} />);
  await act(async () => {});
  fireEvent.change(view.getByPlaceholderText("Filter points (optional)"), { target: { value: "Fan" } });
  fireEvent.click(view.getByRole("button", { name: "+" }));
  fireEvent.click(view.getByRole("button", { name: "Next" }));
  fireEvent.change(view.getByPlaceholderText("FCU temperature and fan trend"), { target: { value: "Fan trend" } });
  await act(async () => { fireEvent.click(view.getByRole("button", { name: "Save as Template" })); });
  expect(operatorDefinitionsRepository.saveDefinition).toHaveBeenCalledWith(props.siteKey, "trend", expect.objectContaining({ name: "Fan trend", isTemplate: true, equipmentIds: ["fcu-1"] }));
});

it("validates required points before allowing template assignment and reports success/failure per target", async () => {
  const template = { id: "tmpl-1", name: "Fan Trend", isTemplate: true, enabled: true, pointRequirements: [{ pointKey: "FAN-S", kind: "binary" }], pointIds: ["FAN-S"] };
  operatorDefinitionsRepository.fetchTrendStore.mockResolvedValue({ definitions: [template], assignments: [] });
  jest.spyOn(operatorDefinitionsRepository, "assignDefinition").mockResolvedValue({});
  jest.spyOn(operatorRepository, "getWorkspacePointsForEquipment").mockImplementation((id) => {
    if (id === "fcu-2") return [{ pointKey: "FAN-S", databasePointId: "db-fan-2", commandType: "boolean" }];
    return [];
  });
  const releaseData = { equipment: [
    { id: "fcu-1", name: "FCU-1", type: "FCU" },
    { id: "fcu-2", name: "FCU-2", type: "FCU" },
    { id: "fcu-3", name: "FCU-3", type: "FCU" },
  ] };
  const view = render(<EquipmentTrendWorkspace {...props} releaseData={releaseData} />);
  await act(async () => {});
  fireEvent.click(view.getByRole("button", { name: "Assignments" }));
  expect(view.queryByLabelText(/FCU-3/)).toBeNull();
  await act(async () => { fireEvent.click(view.getByLabelText(/FCU-2/)); });
  fireEvent.click(view.getByRole("button", { name: /Preview \(1\)/ }));
  await act(async () => { fireEvent.click(view.getByRole("button", { name: "Confirm Assignment" })); });
  expect(operatorDefinitionsRepository.assignDefinition).toHaveBeenCalledWith(props.siteKey, "trend", "tmpl-1", ["fcu-2"], { "fcu-2": { "FAN-S": "db-fan-2" } });
  expect(operatorDefinitionsRepository.assignDefinition).toHaveBeenCalledTimes(1);
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
