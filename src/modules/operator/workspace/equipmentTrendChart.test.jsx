import { buildEquipmentTrendChart, resolveTrendSeriesTargets } from "./equipmentTrendChart";

const now = Date.parse("2026-09-07T16:00:00Z");

describe("resolveTrendSeriesTargets", () => {
  it("resolves a local (non-template) trend by matching logical pointKey identity on live points", () => {
    const selectedTrend = { definition: { pointIds: ["DAT"] }, assignment: { resolvedMappings: {} } };
    const livePoints = [{ pointKey: "DAT", databasePointId: "db-dat", pointName: "Discharge Air Temp", unit: "°F" }];
    const targets = resolveTrendSeriesTargets(selectedTrend, livePoints);
    expect(targets).toEqual([{ dbPointId: "db-dat", pointKey: "DAT", name: "Discharge Air Temp", kind: "analog", unit: "°F" }]);
  });

  it("resolves a template-assigned trend via assignment.resolvedMappings (logical key -> real Point.id)", () => {
    const selectedTrend = { definition: { pointIds: ["dischargeAirTemp"] }, assignment: { resolvedMappings: { dischargeAirTemp: "db-real-id" } } };
    const livePoints = [{ pointKey: "dischargeAirTemp", databasePointId: "db-real-id", pointName: "DAT" }];
    const targets = resolveTrendSeriesTargets(selectedTrend, livePoints);
    expect(targets).toHaveLength(1);
    expect(targets[0].dbPointId).toBe("db-real-id");
  });

  it("never invents a target for a point that isn't present on this equipment", () => {
    const selectedTrend = { definition: { pointIds: ["NOT-HERE"] }, assignment: { resolvedMappings: {} } };
    expect(resolveTrendSeriesTargets(selectedTrend, [{ pointKey: "OTHER", databasePointId: "x" }])).toEqual([]);
  });
});

describe("buildEquipmentTrendChart", () => {
  const target = { dbPointId: "db-dat", pointKey: "DAT", name: "DAT", kind: "analog", unit: "°F" };

  it("never fabricates data: a target with no persisted samples yields an empty, honest series", () => {
    const model = buildEquipmentTrendChart([target], {}, now, { pollRateMs: 20000 });
    expect(model.hasAnyData).toBe(false);
    expect(model.chart).toEqual([]);
    expect(model.series[0].lastValue).toBeNull();
  });

  it("orders real samples chronologically left-to-right regardless of API ordering", () => {
    const samples = {
      "db-dat": [
        { timestamp: new Date(now - 10000).toISOString(), value: "60", quality: "ONLINE" },
        { timestamp: new Date(now - 30000).toISOString(), value: "58", quality: "ONLINE" },
        { timestamp: new Date(now - 20000).toISOString(), value: "59", quality: "ONLINE" },
      ],
    };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    expect(model.chart.map((row) => row.timestamp)).toEqual([now - 30000, now - 20000, now - 10000]);
    expect(model.chart.map((row) => row.s0)).toEqual([58, 59, 60]);
  });

  it("accumulates without resetting: adding newer samples to an existing series only extends the chart", () => {
    const first = buildEquipmentTrendChart([target], { "db-dat": [{ timestamp: new Date(now - 20000).toISOString(), value: "58", quality: "ONLINE" }] }, now, { pollRateMs: 20000 });
    const second = buildEquipmentTrendChart([target], {
      "db-dat": [
        { timestamp: new Date(now - 20000).toISOString(), value: "58", quality: "ONLINE" },
        { timestamp: new Date(now).toISOString(), value: "59", quality: "ONLINE" },
      ],
    }, now, { pollRateMs: 20000 });
    expect(second.chart.slice(0, first.chart.length)).toEqual(first.chart);
    expect(second.chart).toHaveLength(first.chart.length + 1);
  });

  it("breaks the line across a communication gap instead of interpolating a straight segment", () => {
    const samples = {
      "db-dat": [
        { timestamp: new Date(now - 600000).toISOString(), value: "58", quality: "ONLINE" },
        { timestamp: new Date(now - 10000).toISOString(), value: "60", quality: "ONLINE" },
      ],
    };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    expect(model.chart[0]).toEqual({ timestamp: now - 600000, s0: 58 });
    expect(model.chart[model.chart.length - 1]).toEqual({ timestamp: now - 10000, s0: 60 });
    expect(model.chart.some((row) => row.s0 === null)).toBe(true);
  });

  it("does not insert a break for normal poll-to-poll cadence", () => {
    const samples = {
      "db-dat": [
        { timestamp: new Date(now - 20000).toISOString(), value: "58", quality: "ONLINE" },
        { timestamp: new Date(now).toISOString(), value: "59", quality: "ONLINE" },
      ],
    };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    expect(model.chart).toEqual([{ timestamp: now - 20000, s0: 58 }, { timestamp: now, s0: 59 }]);
  });

  it("classifies a series as OFFLINE once its last sample is far older than the poll cadence, without discarding it", () => {
    const samples = { "db-dat": [{ timestamp: new Date(now - 10 * 60000).toISOString(), value: "58", quality: "ONLINE" }] };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    expect(model.series[0].commStatus).toBe("OFFLINE");
    expect(model.series[0].lastValue).toBe(58);
    expect(model.hasAnyData).toBe(true);
  });

  it("treats an explicit OFFLINE transition marker as authoritative, even when it is recent enough that age alone would read as live", () => {
    const markerT = now - 5000; // only 5s old — an age-based heuristic alone would call this LIVE
    const samples = {
      "db-dat": [
        { timestamp: new Date(now - 60000).toISOString(), value: "58", quality: "ONLINE" },
        { timestamp: new Date(markerT).toISOString(), value: null, quality: "OFFLINE" },
      ],
    };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    expect(model.series[0].commStatus).toBe("OFFLINE");
    expect(model.series[0].lossTimestamp).toBe(markerT);
  });

  it("never lets an OFFLINE marker overwrite the last valid value/timestamp shown for the point", () => {
    const validT = now - 60000;
    const markerT = now - 5000;
    const samples = {
      "db-dat": [
        { timestamp: new Date(validT).toISOString(), value: "58.4", quality: "ONLINE" },
        { timestamp: new Date(markerT).toISOString(), value: null, quality: "OFFLINE" },
      ],
    };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    expect(model.series[0].lastValue).toBe(58.4);
    expect(model.series[0].lastTimestamp).toBe(validT);
  });

  it("does not set lossTimestamp when the last sample is a normal reading", () => {
    const samples = { "db-dat": [{ timestamp: new Date(now - 20000).toISOString(), value: "58", quality: "ONLINE" }] };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    expect(model.series[0].lossTimestamp).toBeNull();
  });

  it("renders the OFFLINE marker itself as a line-breaking null chart entry, never a fabricated value", () => {
    const samples = {
      "db-dat": [
        { timestamp: new Date(now - 60000).toISOString(), value: "58", quality: "ONLINE" },
        { timestamp: new Date(now - 5000).toISOString(), value: null, quality: "OFFLINE" },
      ],
    };
    const model = buildEquipmentTrendChart([target], samples, now, { pollRateMs: 20000 });
    const markerRow = model.chart.find((row) => row.timestamp === now - 5000);
    expect(markerRow.s0).toBeNull();
  });

  it("presents binary points as discrete 0/1 state values rather than fabricated numeric interpolation", () => {
    const binaryTarget = { ...target, kind: "binary" };
    const samples = { "db-dat": [{ timestamp: new Date(now - 1000).toISOString(), value: "true", quality: "ONLINE" }, { timestamp: new Date(now).toISOString(), value: "off", quality: "ONLINE" }] };
    const model = buildEquipmentTrendChart([binaryTarget], samples, now, { pollRateMs: 20000 });
    expect(model.chart.map((row) => row.s0)).toEqual([1, 0]);
  });
});
