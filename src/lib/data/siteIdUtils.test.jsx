import { isBackendSiteId } from "./siteIdUtils";

describe("isBackendSiteId", () => {
  it("accepts a normal Prisma-generated UUID", () => {
    expect(isBackendSiteId("56c464d5-a783-4492-96b8-b3be5a5c295d")).toBe(true);
    expect(isBackendSiteId("cafe0000-0000-4000-8000-00000000babe")).toBe(true);
  });

  it("accepts the existing Strip Plaza reference-site id format", () => {
    expect(isBackendSiteId("strip0000-0000-4000-8000-000000000001")).toBe(true);
    // Same seed family — building/floor/equipment/alarm/trend ids share this shape.
    expect(isBackendSiteId("strip0000-0000-4000-8000-000000000002")).toBe(true);
    expect(isBackendSiteId("strip0000-0000-4000-8000-000000000007")).toBe(true);
  });

  it("rejects clearly invalid ids", () => {
    expect(isBackendSiteId("Miami HQ")).toBe(false);
    expect(isBackendSiteId("Brightline Trains")).toBe(false);
    expect(isBackendSiteId("New Site")).toBe(false);
    expect(isBackendSiteId("New Building")).toBe(false);
    expect(isBackendSiteId("")).toBe(false);
    expect(isBackendSiteId("not-a-uuid")).toBe(false);
    expect(isBackendSiteId("abc-def-ghi")).toBe(false);
    expect(isBackendSiteId("strip 0000-0000-4000-8000-000000000001")).toBe(false);
    expect(isBackendSiteId(null)).toBe(false);
    expect(isBackendSiteId(undefined)).toBe(false);
    expect(isBackendSiteId(12345)).toBe(false);
  });
});
