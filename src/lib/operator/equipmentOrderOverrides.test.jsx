import { buildFacilityTree, findFacilityNode } from "./facilityTree";
import {
  applyEquipmentOrderOverrides,
  loadEquipmentOrderOverrides,
  moveEquipmentIdWithinFloor,
  saveEquipmentOrderOverrides,
} from "./equipmentOrderOverrides";

const release = {
  site: {
    id: "site-1",
    name: "Main Hospital",
    buildings: [
      {
        id: "b1",
        name: "Tower",
        floors: [{ id: "f3", name: "Floor 3", sortOrder: 1 }],
      },
    ],
  },
  equipment: [
    { id: "ahu-1", name: "AHU-1", floorId: "f3", sortOrder: 0 },
    { id: "vav-1", displayLabel: "VAV-3-1", floorId: "f3", sortOrder: 1 },
    { id: "vav-2", displayLabel: "VAV-3-2", floorId: "f3", sortOrder: 2 },
  ],
};

describe("moveEquipmentIdWithinFloor", () => {
  const tree = buildFacilityTree(release);
  const floor = findFacilityNode(tree, "f3");

  it("swaps with the previous sibling when moving up", () => {
    expect(moveEquipmentIdWithinFloor(floor.children, "vav-1", -1)).toEqual([
      "vav-1",
      "ahu-1",
      "vav-2",
    ]);
  });

  it("swaps with the next sibling when moving down", () => {
    expect(moveEquipmentIdWithinFloor(floor.children, "vav-1", 1)).toEqual([
      "ahu-1",
      "vav-2",
      "vav-1",
    ]);
  });

  it("refuses to move the first item up (can't leave the floor)", () => {
    expect(moveEquipmentIdWithinFloor(floor.children, "ahu-1", -1)).toBeNull();
  });

  it("refuses to move the last item down (can't leave the floor)", () => {
    expect(moveEquipmentIdWithinFloor(floor.children, "vav-2", 1)).toBeNull();
  });

  it("returns null for an id that isn't on this floor", () => {
    expect(moveEquipmentIdWithinFloor(floor.children, "not-here", 1)).toBeNull();
  });
});

describe("applyEquipmentOrderOverrides", () => {
  const tree = buildFacilityTree(release);

  it("reorders a floor's equipment per the stored id order", () => {
    const next = applyEquipmentOrderOverrides(tree, { f3: ["vav-2", "ahu-1", "vav-1"] });
    const floor = findFacilityNode(next, "f3");
    expect(floor.children.map((c) => c.id)).toEqual(["vav-2", "ahu-1", "vav-1"]);
  });

  it("appends ids missing from the override (newly deployed equipment) at the end", () => {
    const next = applyEquipmentOrderOverrides(tree, { f3: ["vav-1"] });
    const floor = findFacilityNode(next, "f3");
    expect(floor.children.map((c) => c.id)).toEqual(["vav-1", "ahu-1", "vav-2"]);
  });

  it("drops ids no longer present on the floor", () => {
    const next = applyEquipmentOrderOverrides(tree, { f3: ["gone", "vav-1", "ahu-1", "vav-2"] });
    const floor = findFacilityNode(next, "f3");
    expect(floor.children.map((c) => c.id)).toEqual(["vav-1", "ahu-1", "vav-2"]);
  });

  it("never moves equipment to a different floor", () => {
    const next = applyEquipmentOrderOverrides(tree, { f3: ["vav-2", "vav-1", "ahu-1"] });
    const floor = findFacilityNode(next, "f3");
    expect(floor.children.every((c) => c.floorId === "f3")).toBe(true);
  });

  it("leaves the tree untouched when there are no overrides", () => {
    expect(applyEquipmentOrderOverrides(tree, {})).toBe(tree);
    expect(applyEquipmentOrderOverrides(tree, null)).toBe(tree);
  });
});

describe("equipment order persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips overrides through localStorage per site", () => {
    saveEquipmentOrderOverrides("site-1", { f3: ["vav-1", "ahu-1"] });
    expect(loadEquipmentOrderOverrides("site-1")).toEqual({ f3: ["vav-1", "ahu-1"] });
    expect(loadEquipmentOrderOverrides("site-2")).toEqual({});
  });

  it("defaults to an empty object when nothing is stored", () => {
    expect(loadEquipmentOrderOverrides("unknown-site")).toEqual({});
  });
});
