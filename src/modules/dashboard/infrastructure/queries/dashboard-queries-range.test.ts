import { describe, expect, it } from "vitest";
import { expandCompetencyMonthRange } from "./dashboard-queries.js";

describe("expandCompetencyMonthRange", () => {
  it("returns single month when from equals to", () => {
    expect(expandCompetencyMonthRange("2026-03", "2026-03")).toEqual(["2026-03"]);
  });

  it("expands inclusive range", () => {
    expect(expandCompetencyMonthRange("2026-01", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("rejects inverted range", () => {
    expect(() => expandCompetencyMonthRange("2026-04", "2026-03")).toThrow();
  });
});
