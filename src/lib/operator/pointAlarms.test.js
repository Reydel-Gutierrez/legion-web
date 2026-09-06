import {
  alarmStateLabel,
  resolvePointAlarmState,
  annotateFacilityTreeAlarms,
  countActiveAlarmsForEquipment,
} from "./pointAlarms";

const point = {
  id: "row-1",
  equipmentId: "eq-1",
  databasePointId: "pt-1",
  pointKey: "SPACE_TEMP",
  pointName: "Space Temperature",
};

describe("pointAlarms", () => {
  it("labels high and low alarms from the definition operator", () => {
    expect(alarmStateLabel({ operator: "GT" })).toBe("High Alarm");
    expect(alarmStateLabel({ operator: "LT" })).toBe("Low Alarm");
    expect(alarmStateLabel({ operator: "IS_ON" })).toBe("Alarm");
    expect(alarmStateLabel({ message: "High limit" })).toBe("High Alarm");
  });

  it("matches an active alarm onto the workspace point", () => {
    const alarms = [
      { state: "Active", equipmentId: "eq-1", pointId: "pt-1", operator: "GT" },
    ];
    expect(resolvePointAlarmState(point, alarms).label).toBe("High Alarm");
    expect(resolvePointAlarmState(point, [{ ...alarms[0], state: "History" }]).active).toBe(false);
  });

  it("rolls alarm counts from equipment up to floor, building, and site", () => {
    const tree = {
      id: "site",
      kind: "site",
      children: [
        {
          id: "b1",
          kind: "building",
          children: [
            {
              id: "f1",
              kind: "floor",
              children: [
                { id: "eq-1", kind: "equipment", children: [] },
                { id: "eq-2", kind: "equipment", children: [] },
              ],
            },
          ],
        },
      ],
    };
    const alarms = [
      { state: "Active", equipmentId: "eq-1" },
      { state: "Active", equipmentId: "eq-1" },
      { state: "History", equipmentId: "eq-2" },
    ];
    const annotated = annotateFacilityTreeAlarms(tree, alarms);
    expect(countActiveAlarmsForEquipment(alarms, "eq-1")).toBe(2);
    expect(annotated.children[0].children[0].children[0].alarmCount).toBe(2);
    expect(annotated.children[0].children[0].alarmCount).toBe(2);
    expect(annotated.children[0].alarmCount).toBe(2);
    expect(annotated.alarmCount).toBe(2);
  });
});
