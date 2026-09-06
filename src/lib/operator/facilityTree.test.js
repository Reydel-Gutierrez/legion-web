import {
  buildFacilityTree,
  countFacilityBuildings,
  countFacilityEquipment,
  countFacilityFloors,
  findFacilityNode,
  getFacilityAncestorIds,
  getFacilityBreadcrumb,
  pickDefaultFacilityNode,
} from "./facilityTree";

const release = {
  site: {
    id: "site-1",
    name: "Main Hospital",
    buildings: [
      {
        id: "b1",
        name: "Tower",
        floors: [
          { id: "f5", name: "Floor 5", sortOrder: 2 },
          { id: "f3", name: "Floor 3", sortOrder: 1 },
        ],
      },
    ],
  },
  equipment: [
    { id: "ahu-1", name: "AHU-1", floorId: "f3", type: "AHU" },
    { id: "vav-1", displayLabel: "VAV-3-1", floorId: "f3" },
    { id: "ahu-2", name: "AHU-2", floorId: "f5" },
  ],
  siteLayoutGraphics: {
    f3: { objects: [{ id: "o1" }] },
  },
};

describe("buildFacilityTree", () => {
  it("nests Site → Building → Floor → Equipment and labels the root Site", () => {
    const tree = buildFacilityTree(release);
    expect(tree.kind).toBe("site");
    expect(tree.label).toBe("Site");
    expect(tree.name).toBe("Main Hospital");
    expect(tree.children.map((c) => c.kind)).toEqual(["building"]);
    expect(tree.children[0].label).toBe("Tower");
    expect(tree.children[0].children.map((c) => c.label)).toEqual(["Floor 3", "Floor 5"]);
    expect(tree.children[0].children[0].children.map((c) => c.label)).toEqual(["AHU-1", "VAV-3-1"]);
  });

  it("keeps every building under the single Site", () => {
    const multi = {
      ...release,
      site: {
        ...release.site,
        buildings: [
          ...release.site.buildings,
          { id: "b2", name: "Annex", floors: [{ id: "fa", name: "Ground" }] },
        ],
      },
    };
    const tree = buildFacilityTree(multi);
    expect(tree.children.map((c) => c.kind)).toEqual(["building", "building"]);
    expect(tree.children.map((c) => c.label).sort()).toEqual(["Annex", "Tower"]);
  });
});

describe("facility tree selection helpers", () => {
  const tree = buildFacilityTree(release);

  it("finds equipment and ancestors for deep links", () => {
    const node = findFacilityNode(tree, "ahu-1");
    expect(node.label).toBe("AHU-1");
    expect(getFacilityAncestorIds(tree, "ahu-1")).toEqual(["site-1", "b1", "f3"]);
    expect(getFacilityBreadcrumb(tree, "ahu-1").map((c) => c.label)).toEqual([
      "Site",
      "Tower",
      "Floor 3",
      "AHU-1",
    ]);
  });

  it("defaults to the first floor that has a layout graphic", () => {
    const def = pickDefaultFacilityNode(tree, release);
    expect(def.id).toBe("f3");
    expect(def.kind).toBe("floor");
  });

  it("stamps siteId onto buildings, floors, and equipment", () => {
    expect(tree.siteId).toBe("site-1");
    expect(tree.children[0].kind).toBe("building");
    expect(tree.children[0].siteId).toBe("site-1");
    expect(tree.children[0].children[0].siteId).toBe("site-1");
    expect(tree.children[0].children[0].children[0].siteId).toBe("site-1");
  });

  it("counts buildings, floors, and equipment under the Site", () => {
    expect(countFacilityBuildings(tree)).toBe(1);
    expect(countFacilityFloors(tree)).toBe(2);
    expect(countFacilityEquipment(tree)).toBe(3);
  });
});
