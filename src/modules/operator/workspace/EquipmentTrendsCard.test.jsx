import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LineChart, Line, XAxis } from "recharts";
import EquipmentTrendsCard from "./EquipmentTrendsCard";
import { operatorRepository, operatorDefinitionsRepository } from "../../../lib/data";

vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    LineChart: vi.fn(({ children }) => <div data-testid="chart">{children}</div>),
    Line: vi.fn(() => null), XAxis: vi.fn(() => null), YAxis: () => null,
    CartesianGrid: () => null, Tooltip: () => null,
  };
});

const now = Date.parse("2026-09-07T16:00:00Z");
const dat = { id: "row-dat", pointKey: "DAT", databasePointId: "db-dat", pointName: "Discharge Air Temperature", presentValueRaw: 59.3, commFreshnessStatus: "LIVE" };
const space = { id: "row-space", pointKey: "SPACE", databasePointId: "db-space", pointName: "Space Temperature", presentValueRaw: 72.1, commFreshnessStatus: "LIVE" };
const props = { siteKey: "site", equipmentId: "eq", displayPoints: [dat, space], now, pollRateMs: 20000, onToggleExpand: vi.fn(), onConfigure: vi.fn() };
const definition = (id, pointIds) => ({ id, name: id, pointIds, enabled: true });
const store = (definitions) => ({ definitions, assignments: definitions.map((item) => ({ trendDefinitionId: item.id, assetId: "eq", enabled: true })) });
const lastChart = () => LineChart.mock.calls.slice(-1)[0][0];
// Line.mock.calls accumulates every invocation across every past render, not just the current
// one — reading it directly mixes series from earlier renders into the "current" list. Reading
// the last LineChart's own children (mirroring lastChart()) gives exactly the currently-rendered
// series.
const seriesNames = () => React.Children.toArray(lastChart().children)
  .filter((child) => child.type === Line)
  .map((child) => child.props.name);

async function mount(extraProps = {}) {
  let view;
  await act(async () => { view = render(<MemoryRouter><EquipmentTrendsCard {...props} {...extraProps} /></MemoryRouter>); });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(operatorDefinitionsRepository, "fetchTrendStore").mockResolvedValue(store([definition("DA-T", ["DAT"])]));
  vi.spyOn(operatorRepository, "fetchTrendHistorySamples").mockResolvedValue({});
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it("shows configuration navigation without a chart when no enabled trend is assigned", async () => {
  const disabled = store([definition("Disabled", ["DAT"])]);
  disabled.assignments[0].enabled = false;
  operatorDefinitionsRepository.fetchTrendStore.mockResolvedValue(disabled);
  const view = await mount();
  expect(view.queryByTestId("chart")).toBeNull();
  expect(view.getByText("No active trends configured for this equipment.")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Configure Trends" }));
  expect(props.onConfigure).toHaveBeenCalled();
});

it("reports unresolved point mapping instead of silently rendering nothing when the trend's points aren't on this equipment", async () => {
  operatorDefinitionsRepository.fetchTrendStore.mockResolvedValue(store([definition("Ghost", ["NOT-ON-EQUIPMENT"])]));
  const view = await mount();
  await waitFor(() => expect(view.getByText(/were not found on this equipment/)).toBeTruthy());
  expect(view.queryByTestId("chart")).toBeNull();
});

it("shows an honest waiting message — never a fabricated point — when a trend is configured but has no historian samples yet", async () => {
  const view = await mount();
  await waitFor(() => expect(operatorRepository.fetchTrendHistorySamples).toHaveBeenCalledWith("site", ["db-dat"], "1h"));
  expect(view.queryByTestId("chart")).toBeNull();
  expect(view.getByText(/Recording started — waiting for historian samples/)).toBeTruthy();
});

it("renders persisted historian samples chronologically, left-to-right, anchored to the earliest real sample (not stacked at the right edge)", async () => {
  operatorRepository.fetchTrendHistorySamples.mockResolvedValue({
    "db-dat": [
      { timestamp: new Date(now - 120000).toISOString(), value: "58.0", quality: "ONLINE" },
      { timestamp: new Date(now - 60000).toISOString(), value: "59.0", quality: "ONLINE" },
    ],
  });
  const view = await mount();
  await waitFor(() => expect(view.getByTestId("chart")).toBeTruthy());
  expect(lastChart().data).toEqual([
    { timestamp: now - 120000, s0: 58 },
    { timestamp: now - 60000, s0: 59 },
  ]);
  expect(XAxis.mock.calls.slice(-1)[0][0].domain).toEqual([now - 120000, now]);
});

it("loads the correct historical window when the range selector changes", async () => {
  operatorRepository.fetchTrendHistorySamples.mockResolvedValue({ "db-dat": [{ timestamp: new Date(now - 1000).toISOString(), value: "58", quality: "ONLINE" }] });
  const view = await mount();
  await waitFor(() => expect(view.getByTestId("chart")).toBeTruthy());
  await act(async () => { fireEvent.click(view.getByRole("button", { name: "7 Days" })); });
  expect(operatorRepository.fetchTrendHistorySamples).toHaveBeenLastCalledWith("site", ["db-dat"], "7d");
});

it("keeps history visible and labels the series Offline once its last sample is far older than the poll cadence", async () => {
  operatorRepository.fetchTrendHistorySamples.mockResolvedValue({
    "db-dat": [
      { timestamp: new Date(now - 620000).toISOString(), value: "58.0", quality: "ONLINE" },
      { timestamp: new Date(now - 600000).toISOString(), value: "59.0", quality: "ONLINE" },
    ],
  });
  const view = await mount();
  await waitFor(() => expect(view.getByTestId("chart")).toBeTruthy());
  expect(lastChart().data).toEqual([
    { timestamp: now - 620000, s0: 58 },
    { timestamp: now - 600000, s0: 59 },
  ]);
  expect(view.getByText("Offline")).toBeTruthy();
  expect(view.queryByText(/Recording started/)).toBeNull();
});

it("represents a communication gap as a line break instead of a straight line across missing data", async () => {
  operatorRepository.fetchTrendHistorySamples.mockResolvedValue({
    "db-dat": [
      { timestamp: new Date(now - 600000).toISOString(), value: "58.0", quality: "ONLINE" },
      { timestamp: new Date(now - 10000).toISOString(), value: "60.0", quality: "ONLINE" },
    ],
  });
  const view = await mount();
  await waitFor(() => expect(view.getByTestId("chart")).toBeTruthy());
  const data = lastChart().data;
  expect(data[0]).toEqual({ timestamp: now - 600000, s0: 58 });
  expect(data[data.length - 1]).toEqual({ timestamp: now - 10000, s0: 60 });
  expect(data.some((row) => row.s0 === null)).toBe(true);
  expect(Line.mock.calls.slice(-1)[0][0].connectNulls).toBe(false);
});

it("does not clear valid history when a background refresh fails", async () => {
  operatorRepository.fetchTrendHistorySamples.mockResolvedValueOnce({
    "db-dat": [{ timestamp: new Date(now - 1000).toISOString(), value: "58", quality: "ONLINE" }],
  });
  const view = await mount();
  await waitFor(() => expect(view.getByTestId("chart")).toBeTruthy());
  // Fake timers switch in only after the initial mount settles under real timers — testing-library's
  // `waitFor` polls via setTimeout internally, and would hang until the suite's own test timeout if
  // fake timers were already active with nothing to advance them.
  vi.useFakeTimers();
  operatorRepository.fetchTrendHistorySamples.mockRejectedValueOnce(new Error("network blip"));
  await act(async () => { vi.advanceTimersByTime(20000); });
  await act(async () => {});
  expect(view.getByTestId("chart")).toBeTruthy();
  expect(lastChart().data.length).toBeGreaterThan(0);
});

it("switches series with the trend selector without mixing point identities", async () => {
  operatorDefinitionsRepository.fetchTrendStore.mockResolvedValue(store([definition("DA-T", ["DAT"]), definition("Space", ["SPACE"])]));
  operatorRepository.fetchTrendHistorySamples.mockImplementation((site, ids) => Promise.resolve(
    ids[0] === "db-dat"
      ? { "db-dat": [{ timestamp: new Date(now - 1000).toISOString(), value: "58", quality: "ONLINE" }] }
      : { "db-space": [{ timestamp: new Date(now - 1000).toISOString(), value: "72", quality: "ONLINE" }] }
  ));
  const view = await mount();
  await waitFor(() => expect(seriesNames()).toEqual(["Discharge Air Temperature"]));
  await act(async () => { fireEvent.change(view.getByLabelText("Saved trend selector"), { target: { value: "Space" } }); });
  await waitFor(() => expect(seriesNames()).toEqual(["Space Temperature"]));
});
