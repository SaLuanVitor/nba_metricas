import { describe, expect, it } from "vitest";
import {
  americanOddsToImpliedProb,
  calculateEdge,
  expectedValuePerUnit,
  toPercent,
} from "@/lib/odds/market-utils";

describe("odds market math", () => {
  it("converts positive American odds to implied probability", () => {
    expect(americanOddsToImpliedProb(150)).toBeCloseTo(0.4, 6);
  });

  it("converts negative American odds to implied probability", () => {
    expect(americanOddsToImpliedProb(-110)).toBeCloseTo(110 / 210, 6);
  });

  it("returns zero for invalid American odds", () => {
    expect(americanOddsToImpliedProb(0)).toBe(0);
    expect(americanOddsToImpliedProb(Number.NaN)).toBe(0);
  });

  it("calculates model edge against market implied probability", () => {
    expect(calculateEdge(0.58, 0.52)).toBeCloseTo(0.06, 6);
  });

  it("calculates expected value per unit for positive and negative odds", () => {
    expect(expectedValuePerUnit(0.5, 150)).toBeCloseTo(0.25, 6);
    expect(expectedValuePerUnit(0.55, -110)).toBeCloseTo(0.05, 2);
  });

  it("formats decimal probability as percent points", () => {
    expect(toPercent(0.57891)).toBe(57.89);
  });
});
