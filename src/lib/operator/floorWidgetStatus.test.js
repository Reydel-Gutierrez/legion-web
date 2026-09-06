import {
  equipmentWidgetAccent,
  floorWidgetLegendStatus,
  floorWidgetStatusLabel,
} from "./floorWidgetStatus";

describe("floorWidgetLegendStatus", () => {
  it("maps comm and runtime into legend buckets", () => {
    expect(floorWidgetLegendStatus({ runtimeState: "normal", comms: "Online" })).toBe("normal");
    expect(floorWidgetLegendStatus({ runtimeState: "cooling", zoneStatus: "LIVE" })).toBe("normal");
    expect(floorWidgetLegendStatus({ runtimeState: "alarm" })).toBe("fault");
    expect(floorWidgetLegendStatus({ comms: "Stale" })).toBe("fault");
    expect(floorWidgetLegendStatus({ comms: "Offline" })).toBe("offline");
    expect(floorWidgetLegendStatus({})).toBe("unknown");
  });
});

describe("equipmentWidgetAccent", () => {
  it("classifies common BAS types", () => {
    expect(equipmentWidgetAccent("VAV")).toBe("vav");
    expect(equipmentWidgetAccent("AHU-1")).toBe("ahu");
    expect(equipmentWidgetAccent("Pump-3-1")).toBe("pump");
    expect(equipmentWidgetAccent("FCU")).toBe("fcu");
  });
});

describe("floorWidgetStatusLabel", () => {
  it("prefers operating mode when healthy", () => {
    expect(floorWidgetStatusLabel("normal", "cooling")).toBe("Cooling");
    expect(floorWidgetStatusLabel("offline", "normal")).toBe("Offline");
  });
});
