import { describe, expect, it } from "vitest";
import { predictionRiskFrom } from "@/lib/predictions/risk";

describe("prediction risk mapping", () => {
  it("classifies high probability, high confidence and strong edge as low risk", () => {
    expect(predictionRiskFrom(64, "high", 0.05)).toBe("baixo");
    expect(predictionRiskFrom(62, "very-high", 0.04)).toBe("baixo");
  });

  it("classifies acceptable probability and edge as medium risk", () => {
    expect(predictionRiskFrom(57, "medium", 0.02)).toBe("medio");
  });

  it("classifies weak probability or missing edge as high risk", () => {
    expect(predictionRiskFrom(54, "high", 0.08)).toBe("alto");
    expect(predictionRiskFrom(65, "high", null)).toBe("alto");
  });
});
