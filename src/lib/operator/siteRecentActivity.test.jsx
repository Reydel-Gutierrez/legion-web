import { LOG_CATEGORY } from "../app-activity/types";
import { collectSiteRecentActivity } from "./siteRecentActivity";

describe("collectSiteRecentActivity", () => {
  const tree = {
    id: "site-1",
    kind: "site",
    label: "Site",
    children: [{ id: "ahu-1", kind: "equipment", label: "AHU-1", children: [] }],
  };

  it("maps real events and alarms and skips empty or API log noise", () => {
    const rows = collectSiteRecentActivity({
      tree,
      events: [
        { id: "e1", occurredAt: "2026-09-05T13:08:00.000Z", equipName: "AHU-1", message: "Point value updated" },
        { id: "e2", occurredAt: "2026-09-05T13:00:00.000Z", message: "" },
      ],
      alarms: [{ id: "a1", occurredAt: "2026-09-05T12:55:00.000Z", equipmentName: "AHU-1", message: "High temp" }],
      logs: [
        { id: "l1", timestamp: Date.parse("2026-09-05T12:42:00.000Z"), category: LOG_CATEGORY.INFO, message: "Runtime sync completed", meta: { area: "System" } },
        { id: "l2", timestamp: Date.parse("2026-09-05T12:40:00.000Z"), category: LOG_CATEGORY.API, message: "GET /api/runtime", meta: { area: "API" } },
      ],
    });
    expect(rows.map((r) => r.message)).toEqual([
      "Point value updated",
      "High temp",
      "Runtime sync completed",
    ]);
    expect(rows[0].object).toBe("AHU-1");
    expect(rows[0].node.id).toBe("ahu-1");
  });

  it("returns an empty list when there is no real activity", () => {
    expect(collectSiteRecentActivity({})).toEqual([]);
  });
});
