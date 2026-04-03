import { describe, expect, it } from "vitest";
import { addMonthsToCompetencyMonth, parseCompetencyMonth } from "./competency-month.js";

describe("competency month", () => {
  it("parse valida formato", () => {
    expect(parseCompetencyMonth("2026-03")).toBe("2026-03");
    expect(() => parseCompetencyMonth("2026-13")).toThrow();
  });

  it("addMonths", () => {
    expect(addMonthsToCompetencyMonth("2026-01", 1)).toBe("2026-02");
    expect(addMonthsToCompetencyMonth("2026-12", 1)).toBe("2027-01");
  });
});
