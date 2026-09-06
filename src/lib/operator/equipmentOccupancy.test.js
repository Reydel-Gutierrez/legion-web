import { resolveEquipmentOccupancy, occupancyLabelFromValue, getNextOccupancyChange, getTodayScheduleWindows } from "./equipmentOccupancy";

const fcu = { id: "eq-1", displayLabel: "FCU-1", name: "FCU-1" };

const weekdayOccupied = {
  id: "sch-1",
  equipment: "FCU-1",
  enabled: true,
  action: "Occupied",
  startTime: "07:00",
  endTime: "18:30",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

describe("equipmentOccupancy", () => {
  it("reads occupied/unoccupied from point values", () => {
    expect(occupancyLabelFromValue("Occupied")).toBe("Occupied");
    expect(occupancyLabelFromValue("active")).toBe("Occupied");
    expect(occupancyLabelFromValue("Unoccupied")).toBe("Unoccupied");
    expect(occupancyLabelFromValue("0")).toBe("Unoccupied");
    expect(occupancyLabelFromValue("—")).toBeNull();
  });

  it("uses the unit schedule window", () => {
    const during = new Date("2026-09-07T12:00:00"); // Monday
    const after = new Date("2026-09-07T20:00:00");
    const weekend = new Date("2026-09-05T12:00:00"); // Saturday

    expect(resolveEquipmentOccupancy({ schedules: [weekdayOccupied], equipment: fcu, now: during })).toEqual({
      occupied: true,
      label: "Occupied",
      source: "schedule",
    });
    expect(resolveEquipmentOccupancy({ schedules: [weekdayOccupied], equipment: fcu, now: after }).label).toBe(
      "Unoccupied"
    );
    expect(resolveEquipmentOccupancy({ schedules: [weekdayOccupied], equipment: fcu, now: weekend }).label).toBe(
      "Unoccupied"
    );
  });

  it("handles overnight windows across midnight", () => {
    const overnight = {
      ...weekdayOccupied,
      startTime: "22:00",
      endTime: "06:00",
      days: ["Fri"],
    };
    const fridayNight = new Date("2026-09-04T23:15:00");
    const saturdayMorning = new Date("2026-09-05T01:15:00");
    const saturdayEvening = new Date("2026-09-05T21:00:00");

    expect(resolveEquipmentOccupancy({ schedules: [overnight], equipment: fcu, now: fridayNight }).label).toBe(
      "Occupied"
    );
    expect(resolveEquipmentOccupancy({ schedules: [overnight], equipment: fcu, now: saturdayMorning }).label).toBe(
      "Occupied"
    );
    expect(resolveEquipmentOccupancy({ schedules: [overnight], equipment: fcu, now: saturdayEvening }).label).toBe(
      "Unoccupied"
    );
  });

  it("falls back to an occupancy point when no schedule matches", () => {
    expect(
      resolveEquipmentOccupancy({
        schedules: [],
        equipment: fcu,
        occupancyPointValue: "Occupied",
      })
    ).toEqual({ occupied: true, label: "Occupied", source: "point" });
  });

  it("ignores other equipment schedules", () => {
    expect(
      resolveEquipmentOccupancy({
        schedules: [{ ...weekdayOccupied, equipment: "AHU-1" }],
        equipment: fcu,
        now: new Date("2026-09-07T12:00:00"),
        occupancyPointValue: "Unoccupied",
      }).source
    ).toBe("point");
  });

  it("honors a temporary occupancy override", () => {
    const during = new Date("2026-09-07T12:00:00");
    const until = new Date(during.getTime() + 60 * 60 * 1000).toISOString();
    expect(
      resolveEquipmentOccupancy({
        schedules: [weekdayOccupied],
        equipment: fcu,
        now: during,
        override: { occupied: false, until },
      })
    ).toEqual({
      occupied: false,
      label: "Unoccupied",
      source: "override",
      until,
    });
  });

  it("reports today's window and the next occupancy change", () => {
    const during = new Date("2026-09-07T12:00:00");
    const today = getTodayScheduleWindows([weekdayOccupied], fcu, during);
    expect(today[0].startTime).toBe("07:00");
    const next = getNextOccupancyChange([weekdayOccupied], fcu, during);
    expect(next.label).toBe("Unoccupied");
    expect(next.at.getHours()).toBe(18);
    expect(next.at.getMinutes()).toBe(30);
  });
});
