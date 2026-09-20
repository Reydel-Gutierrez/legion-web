import { classifyOperatorPointKind } from "./pointKind";

describe("classifyOperatorPointKind", () => {
  it("classifies analog, binary, and multi-state rows", () => {
    expect(classifyOperatorPointKind({ commandType: "numeric" })).toBe("analog");
    expect(classifyOperatorPointKind({ commandType: "boolean" })).toBe("binary");
    expect(classifyOperatorPointKind({ commandType: "enum" })).toBe("multistate");
    expect(classifyOperatorPointKind({ expectedType: "AI" })).toBe("analog");
  });
});
