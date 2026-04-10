export function americanOddsToImpliedProb(americanOdds: number): number {
  if (!Number.isFinite(americanOdds) || americanOdds === 0) return 0;
  if (americanOdds > 0) return 100 / (americanOdds + 100);
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

export function calculateEdge(modelProb: number, impliedProb: number): number {
  if (!Number.isFinite(modelProb) || !Number.isFinite(impliedProb)) return 0;
  return modelProb - impliedProb;
}

export function expectedValuePerUnit(modelProb: number, americanOdds: number): number {
  if (!Number.isFinite(modelProb) || !Number.isFinite(americanOdds) || americanOdds === 0) return 0;
  const winReturn = americanOdds > 0 ? americanOdds / 100 : 100 / Math.abs(americanOdds);
  const loseReturn = -1;
  return modelProb * winReturn + (1 - modelProb) * loseReturn;
}

export function toPercent(probDecimal: number): number {
  return Number((probDecimal * 100).toFixed(2));
}

