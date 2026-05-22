export type RiskBand = "favourable" | "market" | "aggressive" | "off-market";

export interface BenchmarkEntry {
  clauseType: string;
  description: string;
  unit: "months" | "percent" | "days" | "years" | "qualitative";
  jurisdiction: string;
  dealSizeBand: string;
  distribution: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  bands: {
    favourable: [number, number];
    market: [number, number];
    aggressive: [number, number];
  };
  sampleSize: number;
  source: string;
  recommendations: Record<RiskBand, string>;
}

export const BENCHMARKS: BenchmarkEntry[] = [
  {
    clauseType: "liability-cap-multiple",
    description:
      "Aggregate liability cap expressed as a multiple of trailing 12 months fees. Lower = more vendor-friendly.",
    unit: "qualitative",
    jurisdiction: "US",
    dealSizeBand: "mid-market SaaS (USD 25k-500k ACV)",
    distribution: { p10: 0.5, p25: 1.0, p50: 1.0, p75: 2.0, p90: 3.0 },
    bands: {
      favourable: [0, 1.0],
      market: [1.0, 2.0],
      aggressive: [2.0, 5.0],
    },
    sampleSize: 120,
    source: "Composite of publicly-filed SaaS MSAs (2023-2025)",
    recommendations: {
      favourable: "Cap at 1x annual fees or less is vendor-favourable; expect customer pushback above $250k ACV.",
      market: "1x-2x annual fees is the market norm for mid-market US SaaS. Stand firm.",
      aggressive: "2x+ caps are aggressive on customer side; consider trading for shorter survival or wider carve-outs.",
      "off-market": "Uncapped or super-cap liability is off-market for mid-market SaaS. Push back hard or accept material risk.",
    },
  },
  {
    clauseType: "indemnity-basket-percent",
    description:
      "Indemnification basket (deductible or tipping) as a percentage of deal value. Lower = more buyer-friendly.",
    unit: "percent",
    jurisdiction: "US",
    dealSizeBand: "mid-market M&A (USD 25-500m)",
    distribution: { p10: 0.25, p25: 0.5, p50: 0.75, p75: 1.0, p90: 1.5 },
    bands: {
      favourable: [0, 0.5],
      market: [0.5, 1.0],
      aggressive: [1.0, 3.0],
    },
    sampleSize: 85,
    source: "ABA Private Target Deal Points Study (2024 edition)",
    recommendations: {
      favourable: "Sub-0.5% basket is buyer-favourable. Common in competitive auctions.",
      market: "0.5%-1.0% is the mid-market US norm. Tipping basket more common than true deductible.",
      aggressive: "1.0%-3.0% baskets favour seller. Push for tipping rather than deductible structure.",
      "off-market": "Basket above 3% effectively neuters general indemnity. Expect to renegotiate indemnity cap upward in trade.",
    },
  },
  {
    clauseType: "indemnity-cap-percent",
    description:
      "Indemnification cap (general) as a percentage of deal value. Lower = more seller-friendly.",
    unit: "percent",
    jurisdiction: "US",
    dealSizeBand: "mid-market M&A (USD 25-500m)",
    distribution: { p10: 5, p25: 10, p50: 12.5, p75: 15, p90: 20 },
    bands: {
      favourable: [0, 10],
      market: [10, 15],
      aggressive: [15, 100],
    },
    sampleSize: 85,
    source: "ABA Private Target Deal Points Study (2024 edition)",
    recommendations: {
      favourable: "Sub-10% cap is seller-favourable. Common where seller has strong negotiating leverage.",
      market: "10%-15% of deal value is the mid-market US norm for general indemnity cap.",
      aggressive: "15%+ caps push toward buyer. Carve fundamentals and fraud separately (uncapped) to keep general cap reasonable.",
      "off-market": "Uncapped general indemnity is off-market for arms-length M&A. Reserve for buyer-friendly distressed scenarios.",
    },
  },
  {
    clauseType: "termination-cure-period-days",
    description: "Cure period for material breach before termination. Higher = more breaching-party-friendly.",
    unit: "days",
    jurisdiction: "US",
    dealSizeBand: "commercial contracts (general)",
    distribution: { p10: 10, p25: 15, p50: 30, p75: 30, p90: 60 },
    bands: {
      favourable: [0, 15],
      market: [15, 45],
      aggressive: [45, 120],
    },
    sampleSize: 200,
    source: "Standard commercial contract precedent corpus",
    recommendations: {
      favourable: "<15 days favours the non-breaching party. Common in mission-critical services.",
      market: "30 days is the market norm. 60 days for complex/multi-jurisdiction performance.",
      aggressive: "45+ days favours the breaching party. Carve immediate termination rights for insolvency, IP infringement, security breach.",
      "off-market": ">120 day cure periods are off-market. Effectively grants the breaching party a long free option.",
    },
  },
  {
    clauseType: "reps-survival-months",
    description: "General representations survival period post-closing, in months.",
    unit: "months",
    jurisdiction: "US",
    dealSizeBand: "mid-market M&A (USD 25-500m)",
    distribution: { p10: 12, p25: 12, p50: 15, p75: 18, p90: 24 },
    bands: {
      favourable: [0, 12],
      market: [12, 18],
      aggressive: [18, 36],
    },
    sampleSize: 95,
    source: "ABA Private Target Deal Points Study (2024 edition)",
    recommendations: {
      favourable: "12 months or less is seller-favourable. Common where rep & warranty insurance is in place.",
      market: "12-18 months is the mid-market US norm. 18 months trending up post-2022.",
      aggressive: "18-24 months favours buyer. Often combined with reduced indemnity cap as a trade.",
      "off-market": "24+ months is rare outside of strategic deals with significant compliance risk; consider scope-limiting to specific reps.",
    },
  },
  {
    clauseType: "non-compete-duration-months",
    description: "Restrictive-covenant non-compete duration, in months.",
    unit: "months",
    jurisdiction: "US",
    dealSizeBand: "M&A founder/key-employee covenants",
    distribution: { p10: 12, p25: 18, p50: 24, p75: 36, p90: 60 },
    bands: {
      favourable: [0, 18],
      market: [18, 36],
      aggressive: [36, 84],
    },
    sampleSize: 60,
    source: "Mid-market M&A non-compete precedent corpus",
    recommendations: {
      favourable: "<18 months is enforceable in most US states for sale-of-business covenants.",
      market: "24-36 months is mid-market norm for sale-of-business non-competes. Some states (CA) won't enforce regardless.",
      aggressive: "36+ months invites enforceability challenge in most jurisdictions; combine with garden leave / consideration.",
      "off-market": ">7 years is presumptively unreasonable in most US jurisdictions; expect court reduction.",
    },
  },
];
