import type { RiskLevel } from "@/lib/predictions/contracts";

export function predictionRiskFrom(probability: number, confidence: string, edge: number | null): RiskLevel {
  if (probability >= 62 && (edge ?? 0) >= 0.04 && (confidence === "high" || confidence === "very-high")) return "baixo";
  if (probability >= 55 && (edge ?? 0) >= 0.01) return "medio";
  return "alto";
}
