import { locationForFacilityNode, parseOperatorSelection, isOperatorHierarchyPath } from "./operatorSelection";

describe("parseOperatorSelection", () => {
  it("reads equipment deep links", () => {
    expect(parseOperatorSelection("/legion/equipment/ahu-1")).toEqual({
      kind: "equipment",
      id: "ahu-1",
    });
  });

  it("reads floor/site node query", () => {
    expect(parseOperatorSelection("/legion/site", "?node=f3")).toEqual({
      kind: null,
      id: "f3",
    });
  });

  it("treats bare site path as site", () => {
    expect(parseOperatorSelection("/legion/site", "")).toEqual({
      kind: "site",
      id: null,
    });
  });
});

describe("locationForFacilityNode", () => {
  it("builds equipment URLs", () => {
    expect(locationForFacilityNode({ kind: "equipment", id: "ahu-1" })).toEqual({
      pathname: "/legion/equipment/ahu-1",
    });
  });

  it("builds floor URLs with node query", () => {
    expect(locationForFacilityNode({ kind: "floor", id: "f3" })).toEqual({
      pathname: "/legion/site",
      search: "?node=f3",
    });
  });
});

describe("isOperatorHierarchyPath", () => {
  it("is true for site and equipment detail, false for alarms", () => {
    expect(isOperatorHierarchyPath("/legion/site")).toBe(true);
    expect(isOperatorHierarchyPath("/legion/equipment/ahu-1")).toBe(true);
    expect(isOperatorHierarchyPath("/legion/equipment")).toBe(false);
    expect(isOperatorHierarchyPath("/legion/alarms")).toBe(false);
  });
});
