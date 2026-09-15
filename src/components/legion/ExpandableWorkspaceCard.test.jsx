import React from "react";
import { render } from "@testing-library/react";
import ExpandableWorkspaceCard from "./ExpandableWorkspaceCard";

function Boom() {
  throw new Error("render failure");
}

describe("ExpandableWorkspaceCard error boundary", () => {
  let consoleError;
  beforeEach(() => { consoleError = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { consoleError.mockRestore(); });

  it("contains a render failure to the failing card's body instead of crashing the page", () => {
    const view = render(<ExpandableWorkspaceCard title="Trends" cardId="trends" expandedId={null} onToggleExpand={() => {}}><Boom /></ExpandableWorkspaceCard>);
    expect(view.getByText(/could not be displayed/i)).toBeTruthy();
  });

  it("keeps a sibling card (e.g. the equipment graphic) rendering normally when another card's body throws", () => {
    const view = render(
      <div>
        <ExpandableWorkspaceCard title="Equipment Graphic" cardId="graphic" expandedId={null} onToggleExpand={() => {}}>
          <div data-testid="graphic-content">Graphic still visible</div>
        </ExpandableWorkspaceCard>
        <ExpandableWorkspaceCard title="Trends" cardId="trends" expandedId={null} onToggleExpand={() => {}}>
          <Boom />
        </ExpandableWorkspaceCard>
      </div>
    );
    expect(view.getByTestId("graphic-content")).toBeTruthy();
    expect(view.getByText("Graphic still visible")).toBeTruthy();
    expect(view.getByText(/could not be displayed/i)).toBeTruthy();
  });
});
