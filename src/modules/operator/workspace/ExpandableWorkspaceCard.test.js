import React from "react";
import { render, fireEvent } from "@testing-library/react";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";

describe("ExpandableWorkspaceCard", () => {
  it("toggles expand and collapse", () => {
    const onToggle = jest.fn();
    const { getByLabelText, rerender } = render(
      <ExpandableWorkspaceCard title="Trends" cardId="trends" expandedId={null} onToggleExpand={onToggle}>
        chart
      </ExpandableWorkspaceCard>
    );
    fireEvent.click(getByLabelText("Expand Trends"));
    expect(onToggle).toHaveBeenCalledWith("trends");

    rerender(
      <ExpandableWorkspaceCard title="Trends" cardId="trends" expandedId="trends" onToggleExpand={onToggle}>
        chart
      </ExpandableWorkspaceCard>
    );
    fireEvent.click(getByLabelText("Collapse Trends"));
    expect(onToggle).toHaveBeenCalledWith(null);
  });
});
