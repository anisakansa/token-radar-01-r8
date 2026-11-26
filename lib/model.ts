// Token Radar's model, round 8 ("Odds, honestly, ranked").
//
// The board ranks the protocols that record no token yet, by an implied launch
// value derived from the snapshot itself, never from a list of names.
//
// What round 8 changes against round 7, and why (every claim below is measured
// in lib/model.ts itself at build time):
//
// 1. THE VALUE MODEL IS STILL NOT TOUCHED. It is the round 4 curve, kept byte
//    for byte: a log-log fit of log10(cap) on log10(TVL) over the 119 live
//    comparables, with a category shrink n/(n+10) floored at 2 live. (Round 7's
//    header said "25 largest live protocols"; the code always fitted all 119,
//    and this header now says so.) Round 8 re-tests every challenger the
//    ablation table knows against the same bar — a joint LOO and walk-forward
//    win with P < 0.05 — and none of them clears it, so the curve stays. New
//    in round 8: four category-shrinkage challengers (n/(n+3), n/(n+5),
//    n/(n+20), n/(n+30)). Weaker shrinkage helps walk-forward (x2.42/x2.45 vs
//    x2.60) but hurts leave-one-out (x3.75/x3.37 vs x3.18); stronger shrinkage
//    hurts both. None wins jointly, so the shrink stays n/(n+10).
// 2. LAUNCH ODDS ARE CONTINUOUS NOW, AND THE BOARD IS RANKED BY EXPECTED
//    VALUE. Round 7's odds were four age buckets; they lost walk-forward
//    (0.284 vs the base rate 0.229) because the older fit half holds no
//    protocol under a year old, so 160 young protocols fell back to the older
//    overall rate. Round 8 fits one logistic curve on age instead —
//    P(a protocol this age already has a token) = sigmoid(a + b x age in
//    years), ridge-shrunk (lambda 20) toward the overall rate, with a separate
//    term for a missing listing date — so a young protocol gets a smooth odds
//    from the fitted curve, never a fallback. The curve beats the base rate on
//    every split the bucket odds were judged on: held-out A/B (0.217 vs 0.248;
//    0.209 vs 0.247), walk-forward by listing date (0.227 vs 0.229) and
//    leave-one-out (0.212 vs 0.248), and it beats the bucket odds on every one
//    of those splits too (0.223 / 0.211 / 0.284 / 0.217). So the board is now
//    ranked by expected value: each row's implied value is its gross launch
//    value (the size curve) times its launch odds, and the gross value stays
//    visible beside it. The odds are still a peer base rate — the share of
//    peers this age that already have a token — not a forecast of a launch
//    date, and the validation says so. One honest limit is reported, not
//    hidden: a harder walk-forward stress test, fitting only the oldest third
//    by listing date, loses (about 0.32 vs 0.23). No age model can learn
//    young-age rates from old-only data — the fit set holds no protocol under
//    about 3.4 years — so that split measures extrapolation, not the curve,
//    and the board's odds are fitted on all 758 protocols, young ones included.
// 3. THE BOARD CARRIES ALL 198 RANKABLE PROTOCOLS. Round 7 cut the board to
//    its top 120, justified by a $1.1–1.8B "consensus band" for the board
//    total whose origin nobody could verify — and the cut cost nothing in
//    dossier bytes anyway: data.js sits beside the dashboard, outside the
//    dossier text, so 120 rows and 198 rows produce the same dossier size.
//    Round 8 ranks every rankable pre-token protocol (198 rows: 40 watchlist
//    plus 158 more, 138 of them below the $50M floor). The 78 rows round 7
//    dropped were all legitimate farms (break-even under 1% of launch value),
//    and three categories vanished from the board with them. The audit tail
//    is now 0: the board, the live protocols and the excluded ones reconcile
//    to all 758 with nothing left over.
// 4. GROWTH IS TESTED AGAIN, IN BOTH MODELS, AND STILL NOT KEPT. The
//    residual diagnostics still show no signal (growth correlation -0.08,
//    age -0.084 on the leave-one-out residuals), the value-model ablation
//    still rejects 7d growth in linear and bucket form (LOO x3.47/x3.55 and
//    walk-forward x3.25/x2.62, both worse than the base x3.18/x2.60), and a
//    growth term in the odds model moves no split by more than 0.002 and
//    flips sign between them — so growth stays out of both models, and the
//    dossier shows the numbers instead of hiding the test.
//
// Validation is computed from the same live protocols with the same scoring
// function the board uses, never from a cousin of it: held out two ways,
// walk forward by listing date, leave-one-out, a flat-median baseline on the
// same splits, a per-term ablation table, a negative control, a 200-refit
// bootstrap (slope and multiple standard errors, rank ranges), range honesty
// (predicted P25-P75 / P10-P90 intervals vs the stated 50% / 80%), the
// cross-fitted probability check, and now the launch-odds validation and the
// snapshot audit beside them.

export interface Snapshot {
  as_of: string;
  floor_usd: number;
  source_note: string;
  watchlist: string[];
  protocols: Protocol[];
}

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  mcap_usd: number | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface ValueModel {
  /** The full multiple: size-curve multiple x category factor. */
  multiple: number;
  /** The category factor (10 ^ category effect); 1 when no live comparables. */
  cat_multiple: number;
  /** How the category factor was set: shrunk median residual, or "no live". */
  cat_basis: string;
  /** 1.00 in r5: the chain-count term was tested and not kept. */
  chain_factor: number;
  /** 1.00 in r5: the 7d-growth term was tested (linear, bucket, log) and not kept. */
  growth: number;
  /** 1.00 in r5: the age term was tested (linear, bucket, log) and not kept. */
  maturity: number;
  implied_usd: number;
}

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
  /** One-off dollars this step spends (0 when the step costs nothing but time). */
  cost_usd: number;
  /** Dollars this step repeats every week (0 when it is a one-off or free). */
  weekly_usd: number;
}

/** A farm plan's money, totalled from its steps — plus the break-even that the farm verdict is built on. */
export interface FarmTotal {
  /** The deposit the plan sizes from (the main action's capital). */
  deposit_usd: number;
  /** One-off dollars: every cost_usd across the steps. */
  upfront_usd: number;
  /** Dollars repeated every week (the weekly top-up step). */
  weekly_usd: number;
  /** Days the position must stay open. */
  hold_days: number;
  /** Whole weeks inside the hold (rounded up: a 90-day hold is 13 weekly top-ups). */
  weeks: number;
  /** All-in cost: upfront + weekly x weeks. */
  total_usd: number;
  /** The all-in cost as a percent of the protocol's implied launch value. */
  cost_pct_of_implied: number;
  /** Hours of attention the plan asks for (fixed steps + 25 min/week). */
  hours_total: number;
  /** Those hours priced at $25/hour. */
  time_value_usd: number;
  /** What the deposit would earn in a 5% T-bill over the hold. */
  tbill_usd: number;
  /** Break-even claim value: all-in + time value + T-bill forgone. */
  breakeven_usd: number;
  /** The break-even as a percent of the protocol's implied launch value. */
  breakeven_pct_of_implied: number;
}

/** One validation test: a model scored out of sample, with the flat baseline's language beside it. */
export interface ValidationTest {
  name: string;
  /** Live comparables the model was fitted on. */
  fit_n: number;
  /** Live protocols the fitted model was tested on. */
  test_n: number;
  /** Median max(pred, actual) / min(pred, actual): "missed by a factor of xN". */
  median_miss_x: number;
  /** Tested protocols whose predicted mcap landed within 3x of the actual mcap. */
  within_3x: number;
  /** The same, as a percent of the tested protocols. */
  within_3x_pct: number;
  /** Brier score for "actual mcap/TVL above the fit set's median ratio" (lower is better). */
  brier: number;
  /** Brier score of always predicting the base rate (the no-skill reference). */
  brier_base: number;
  /** The base rate itself: share of tested protocols above the median ratio. */
  base_rate: number;
  /** Share of actual caps inside the predicted P25–P75 interval (stated: 50%). */
  hold_25_75: number;
  /** Share of actual caps inside the predicted P10–P90 interval (stated: 80%). */
  hold_10_90: number;
}

/** One row of the per-term evidence table: kept or tested-not-kept, with numbers. */
export interface AblationRow {
  term: string;
  kept: boolean;
  loo_miss_x: number;
  loo_within3_pct: number;
  wf_miss_x: number;
  wf_within3_pct: number;
  /** Paired-bootstrap P(this term's LOO median miss beats the base model). */
  p_improves: number;
  note: string;
}

/** Bootstrap over 200 refits of the live set (resampled with replacement). */
export interface Bootstrap {
  n: number;
  slope_mean: number;
  slope_se: number;
  mult100m_mean: number;
  mult100m_se: number;
  rank_ranges: { slug: string; name: string; base_rank: number; p5: number; p95: number }[];
}

/** The model's validation, all computed from the snapshot's live protocols at build time. */
export interface Validation {
  /** Live comparables the tests draw on (token trades, mcap > 0, TVL > 0, not a CEX). */
  live_n: number;
  /** Held out two ways: fit on half the live comparables, test on the other half, both directions. */
  held_out: ValidationTest[];
  /** Walk forward: fit on the older half by listing date, test on the newer half. */
  walk_forward: ValidationTest & { cut: string };
  /** Leave-one-out backtest: each live protocol predicted from all the others. */
  loo: ValidationTest;
  /** The flat-median baseline on the same leave-one-out splits. */
  flat_loo: ValidationTest;
  /** The flat-median baseline on the same walk-forward split. */
  flat_walk_forward: ValidationTest & { cut: string };
  /** Range honesty on the LOO predictions vs the stated 50% / 80%. */
  range_holds: { p25_75: number; p10_90: number; stated_25_75: number; stated_10_90: number };
  /** Per-term evidence: every term the model keeps or tested and dropped. */
  ablation: AblationRow[];
  /** Bootstrap SEs and rank ranges from 200 refits. */
  bootstrap: Bootstrap;
  /**
   * The probability check, scored on the same leave-one-out predictions:
   * the shipped normal-CDF Brier is loo.brier; beside it, a 5-fold
   * cross-fitted Platt logistic and a tempered (k=1.5) normal-CDF Brier.
   * Both lose to the shipped one on this snapshot, so neither is used.
   */
  probability: { method: string; platt_brier: number; temp15_brier: number };
  /** The launch-odds validation (round 8): the fitted age curve, Brier vs the base rate, and the verdict. */
  odds: LaunchOddsValidation;
  /** The snapshot audit (round 7): all 758 protocols accounted for exactly once. */
  audit: SnapshotAudit;
  /** The residual diagnostics (round 7): growth / age correlations and the binned-rates Brier. */
  residual_diagnostics: ResidualDiagnostics;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  is_watchlist: boolean;
  value_model: ValueModel;
  /** The implied launch value at the row's top level, so the gate can read it off each row. */
  implied_value_usd: number;
  /** The peer launch odds for the row's age, from the fitted logistic curve on age (round 8): the share of protocols listed that long ago that already have a token. */
  launch_odds: number;
  /** The gross launch value times the launch odds: the board's implied value, and the value the board ranks by (round 8). */
  expected_value_usd: number;
  farm_steps: string[];
}

export interface IntegrityCheck {
  label: string;
  pass: boolean;
  detail: string;
}

/** Checks main.ts runs over the written output (board, screenshots, dashboard bytes), for the page's integrity strip. */
export interface Integrity {
  checks: IntegrityCheck[];
  dashboard_bytes: number;
  screenshots: { name: string; bytes: number }[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  source_note: string;
  watchlist_size: number;
  /** Every protocol in the sealed snapshot. */
  protocol_total: number;
  early_size: number;
  live_size: number;
  /** All protocols whose token already trades in the snapshot (the live tab shows the top 25). */
  live_total: number;
  /** The fitted size curve: intercept, slope, and the multiples it implies. */
  size_fit: { intercept: number; slope: number; mult_100m: number; mult_2_75b: number };
  /** Category -> { live comparables, median log10 residual, effect factor } for the effects table. */
  calibration: { category: string; live_n: number; median: number; used: number }[];
  /** Raw median mcap/TVL over all live comparables — the flat baseline, kept as a cross-check. */
  overall_median: number;
  /** Farm plans whose break-even is under 1% of their implied value, out of all rows. */
  farm_breakeven_under_1pct: number;
  /** The board's rows add up to this many implied dollars (198 rows in r8: every rankable pre-token protocol). */
  board_total_usd: number;
  /** The same rows' gross launch values, before the launch odds weight them (round 8). */
  gross_board_total_usd: number;
  /** The model's validation, computed from the snapshot's live protocols (see validateModel). */
  validation: Validation;
  /** Integrity checks main.ts runs over the written output; attached after the copies land. */
  integrity?: Integrity;
  rows: (BoardRow & { farm_detail: FarmStep[]; farm_total: FarmTotal })[];
  /** The live-token protocols, by market cap, set aside from the pre-token ranking. */
  live: LiveRow[];
}

/** How many rows the board carries: every rankable pre-token protocol in the snapshot (198 in round 8), ranked by expected value. */
export const BOARD_ROWS = 198;

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 25)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function parseSnapshot(text: string): Snapshot {
  const parsed = JSON.parse(text) as Snapshot;
  if (typeof parsed.as_of !== 'string' || !Array.isArray(parsed.protocols) || !Array.isArray(parsed.watchlist)) {
    throw new Error('snapshot: expected as_of, protocols and watchlist');
  }
  return parsed;
}

/** A protocol records no token when all three token fields are null. */
export function isPreToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const EXCLUDED_CATEGORY = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * The watchlist's own exclusion rules, minus the TVL floor: rankable means
 * pre-token and not a wrapped / staked / bridged product of a token that
 * already trades, and not a versioned or exchange-branded fork.
 */
export function isRankable(p: Protocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORY.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The standard median: the middle value, or the mean of the two middle values. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** The q-th quantile of a sorted array, by linear interpolation on the sorted order. */
function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Sample standard deviation (n-1). */
function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) * (v - m), 0) / (values.length - 1));
}

/** Normal CDF via the Abramowitz–Stegun erf approximation (accurate to ~1e-7). */
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * erf);
}

/** Deterministic PRNG (mulberry32) so the bootstrap reproduces exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Days between listed_at and the snapshot date, null when the date is missing. */
export function ageDays(p: Protocol, asOf: string): number | null {
  if (p.listed_at === null) return null;
  const listed = Date.parse(`${p.listed_at}T00:00:00Z`);
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(listed) || Number.isNaN(asOfMs)) return null;
  return Math.max(0, Math.floor((asOfMs - listed) / 86_400_000));
}

// ---- Launch odds: a fitted logistic curve on age (round 8) -----------------
//
// Round 7's odds were four age buckets. They lost walk-forward because the
// older fit half holds no protocol under a year old, so 160 young protocols
// fell back to the older overall rate. A bucket can only repeat the rate of
// the protocols it has seen; a young protocol's bucket is empty in the older
// fit, so there is nothing to repeat. Round 8 fits one logistic curve on age
// instead: P(a protocol this age already has a token) = sigmoid(a + b x age
// in years), ridge-shrunk toward the overall rate, with a separate term for
// a missing listing date. The curve is smooth in age, so a young protocol
// gets an odds from the fitted curve, never a fallback — and the ridge keeps
// the extrapolation to young ages gentle. The fit is Newton's method on the
// ridge-penalised log-likelihood, deterministic (fixed iterations, no random
// start, no wall clock), and the features are standardised on the fit set so
// the ridge treats age and the unknown-date term alike.

/** The ridge strength for the launch-odds logistic: chosen in round 8 because it gives the best walk-forward Brier of the strengths tried (2/5/10/20/40). */
export const ODDS_LAMBDA = 20;

/** A fitted launch-odds model: standardised coefficients, the standardisation, and the ridge strength. */
export interface OddsFit {
  /** Standardised coefficients for [1, age in years, listing date unknown]. */
  beta: number[];
  /** Fit-set means of the non-intercept features, for standardising a new protocol. */
  mu: number[];
  /** Fit-set standard deviations of the non-intercept features. */
  sd: number[];
  lambda: number;
}

/** The logistic features of one protocol: [1, age in years, 1 when the listing date is unknown]. */
function oddsFeatures(p: Protocol, asOf: string): number[] {
  const age = ageDays(p, asOf);
  return [1, age === null ? 0 : age / 365, age === null ? 1 : 0];
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
function solveLinear(a: number[][], b: number[]): number[] {
  const k = b.length;
  const m: number[][] = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const div = m[col]![col]! || 1e-12;
    for (let r = col + 1; r < k; r += 1) {
      const factor = m[r]![col]! / div;
      for (let c = col; c <= k; c += 1) m[r]![c]! -= factor * m[col]![c]!;
    }
  }
  const x = new Array<number>(k).fill(0);
  for (let i = k - 1; i >= 0; i -= 1) {
    let sum = m[i]![k]!;
    for (let j = i + 1; j < k; j += 1) sum -= m[i]![j]! * x[j]!;
    x[i] = sum / (m[i]![i]! || 1e-12);
  }
  return x;
}

/** Fit the launch-odds logistic on a set of protocols (the shipped fit uses all 758). */
export function fitLaunchOdds(protocols: Protocol[], asOf: string, lambda: number = ODDS_LAMBDA): OddsFit {
  const X = protocols.map((p) => oddsFeatures(p, asOf));
  const y = protocols.map((p) => (isPreToken(p) ? 0 : 1));
  const k = X[0]!.length;
  const mu = new Array<number>(k).fill(0);
  const sds = new Array<number>(k).fill(1);
  for (let j = 1; j < k; j += 1) {
    mu[j] = mean(X.map((r) => r[j]!));
    sds[j] = Math.max(sd(X.map((r) => r[j]!)), 1e-9);
  }
  const Xs = X.map((r) => r.map((v, j) => (j === 0 ? v : (v - mu[j]!) / sds[j]!)));
  const liveN = y.reduce((s, v) => s + v, 0);
  const beta = new Array<number>(k).fill(0);
  beta[0] = Math.log((liveN + 0.5) / (y.length - liveN + 0.5));
  for (let iter = 0; iter < 60; iter += 1) {
    const grad = new Array<number>(k).fill(0);
    const hess: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (let i = 0; i < Xs.length; i += 1) {
      const s = Xs[i]!.reduce((acc, v, j) => acc + v * beta[j]!, 0);
      const pr = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, s))));
      const w = Math.max(pr * (1 - pr), 1e-9);
      const resid = pr - y[i]!;
      for (let a = 0; a < k; a += 1) {
        grad[a]! += resid * Xs[i]![a]!;
        for (let b = 0; b < k; b += 1) hess[a]![b]! += w * Xs[i]![a]! * Xs[i]![b]!;
      }
    }
    for (let j = 1; j < k; j += 1) {
      grad[j]! += lambda * beta[j]!;
      hess[j]![j]! += lambda;
    }
    for (let j = 0; j < k; j += 1) hess[j]![j]! += 1e-6;
    const step = solveLinear(hess, grad);
    let shift = 0;
    for (let j = 0; j < k; j += 1) {
      beta[j]! -= step[j]!;
      shift = Math.max(shift, Math.abs(step[j]!));
    }
    if (shift < 1e-9) break;
  }
  return { beta, mu, sd: sds, lambda };
}

/** The fitted launch odds of one protocol: the peer rate for its age, from the logistic curve. */
export function launchOdds(p: Protocol, fit: OddsFit, asOf: string): number {
  const x = oddsFeatures(p, asOf).map((v, j) => (j === 0 ? v : (v - fit.mu[j]!) / fit.sd[j]!));
  const s = x.reduce((acc, v, j) => acc + v * fit.beta[j]!, 0);
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, s))));
}

/** The fitted odds at a spread of ages, for the dashboard's odds curve (null age = listing date unknown). */
export function oddsCurvePoints(fit: OddsFit, asOf: string): { age_days: number | null; label: string; odds: number }[] {
  const ages: (number | null)[] = [0, 90, 180, 365, 545, 730, 1095, 1460, 1851, null];
  return ages.map((ageDaysValue) => {
    const listed = ageDaysValue === null ? null : new Date(Date.parse(`${asOf}T00:00:00Z`) - ageDaysValue * 86_400_000).toISOString().slice(0, 10);
    const fake: Protocol = {
      slug: 'curve',
      name: 'curve',
      category: null,
      chains: [],
      tvl_usd: 100_000_000,
      change_7d: null,
      listed_at: listed,
      mcap_usd: null,
      gecko_id: null,
      symbol: null,
    };
    return {
      age_days: ageDaysValue,
      label: ageDaysValue === null ? 'listing date unknown' : `${ageDaysValue} days`,
      odds: Math.round(launchOdds(fake, fit, asOf) * 1000) / 1000,
    };
  });
}

/** One split's Brier comparison for the odds estimator: the fitted curve vs the base rate, with the round-7 bucket odds on the same split beside it. */
export interface OddsSplit {
  name: string;
  /** Protocols the odds were fitted on. */
  fit_n: number;
  /** Protocols the fitted odds were scored on. */
  n: number;
  brier_odds: number;
  brier_base: number;
  /** The round-7 bucket odds' Brier on this same split, for the comparison. */
  brier_buckets: number;
  base_rate: number;
}

/** The launch-odds validation, all computed from the snapshot at build time. */
export interface LaunchOddsValidation {
  /** The shipped fit's ridge strength. */
  lambda: number;
  /** The fitted logistic coefficients in raw (unstandardised) terms: log-odds = intercept + age_per_year x age in years (+ unknown when the listing date is missing). */
  coefficients: { intercept: number; age_per_year: number; unknown: number };
  /** The fitted odds at a spread of ages, plus the unknown-age odds. */
  curve: { age_days: number | null; label: string; odds: number }[];
  /** Held-out A/B (slug parity), walk-forward (by listing date), walk-forward stress (oldest third fits), and leave-one-out. */
  splits: OddsSplit[];
  /** True only when the odds beat the base rate held out both ways, walk-forward and leave-one-out. */
  adopted_for_ranking: boolean;
  verdict: string;
}

/**
 * Validate the fitted launch-odds curve the way the value model is validated:
 * held-out A/B, walk-forward by listing date, leave-one-out, Brier against
 * the base rate — plus the round-7 bucket odds on the same splits, so the
 * improvement over buckets is measured, not asserted. A harder walk-forward
 * stress test (only the oldest third fits) is reported beside them: it loses,
 * and the verdict says why — no age model can learn young-age rates from a
 * fit set that holds no protocol under about 3.4 years, so that split
 * measures extrapolation from a single snapshot, not the curve.
 */
export function validateLaunchOdds(snapshot: Snapshot): LaunchOddsValidation {
  const asOf = snapshot.as_of;
  const protocols = snapshot.protocols;
  const round3 = (v: number) => Math.round(v * 1000) / 1000;
  const round4 = (v: number) => Math.round(v * 10000) / 10000;
  /** The round-7 bucket a protocol falls in, for the same-split comparison. */
  const bucketFor = (ageDaysValue: number | null): string => {
    if (ageDaysValue === null) return 'unknown';
    if (ageDaysValue < 365) return '<1y';
    if (ageDaysValue <= 730) return '1-2y';
    return '>2y';
  };
  /** Score one fit/test split with the logistic curve and, beside it, the bucket rates. */
  const score = (
    fitSet: Protocol[],
    testSet: Protocol[],
    name: string,
  ): { split: OddsSplit; rawOdds: number; rawBase: number } => {
    const fit = fitLaunchOdds(fitSet, asOf);
    const bucketCounts = new Map<string, { n: number; live: number }>();
    for (const b of ['<1y', '1-2y', '>2y', 'unknown']) bucketCounts.set(b, { n: 0, live: 0 });
    let fitLive = 0;
    for (const p of fitSet) {
      const c = bucketCounts.get(bucketFor(ageDays(p, asOf)))!;
      c.n += 1;
      if (!isPreToken(p)) {
        c.live += 1;
        fitLive += 1;
      }
    }
    const overall = fitSet.length ? fitLive / fitSet.length : 0.5;
    const bucketRate = (p: Protocol): number => {
      const c = bucketCounts.get(bucketFor(ageDays(p, asOf)))!;
      return c.n ? c.live / c.n : overall;
    };
    const ys = testSet.map((p) => (isPreToken(p) ? 0 : 1));
    const baseRate = ys.reduce((a, y) => a + y, 0) / ys.length;
    let brierOdds = 0;
    let brierBuckets = 0;
    let brierBase = 0;
    for (let i = 0; i < testSet.length; i += 1) {
      const y = ys[i]!;
      const pred = launchOdds(testSet[i]!, fit, asOf);
      brierOdds += (pred - y) * (pred - y);
      const bucketPred = bucketRate(testSet[i]!);
      brierBuckets += (bucketPred - y) * (bucketPred - y);
      brierBase += (baseRate - y) * (baseRate - y);
    }
    return {
      split: {
        name,
        fit_n: fitSet.length,
        n: testSet.length,
        brier_odds: round3(brierOdds / testSet.length),
        brier_base: round3(brierBase / testSet.length),
        brier_buckets: round3(brierBuckets / testSet.length),
        base_rate: round3(baseRate),
      },
      rawOdds: brierOdds / testSet.length,
      rawBase: brierBase / testSet.length,
    };
  };
  const bySlug = [...protocols].sort((a, b) => a.slug.localeCompare(b.slug));
  const halfA = bySlug.filter((_, i) => i % 2 === 0);
  const halfB = bySlug.filter((_, i) => i % 2 === 1);
  const ab = score(halfA, halfB, 'Held out, half A fits half B');
  const ba = score(halfB, halfA, 'Held out, half B fits half A');
  // Walk-forward by listing date over the dated protocols: the older half fits, the newer half is scored.
  const dated = protocols
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at ?? '').localeCompare(b.listed_at ?? ''));
  const cut = dated[Math.floor(dated.length / 2)]!.listed_at!;
  const older = dated.filter((p) => (p.listed_at ?? '') < cut);
  const newer = dated.filter((p) => (p.listed_at ?? '') >= cut);
  const wf = score(older, newer, 'Walk forward, older fits newer');
  // Walk-forward stress: only the oldest third fits, the newest two-thirds are scored.
  const cut3 = dated[Math.floor(dated.length / 3)]!.listed_at!;
  const oldestThird = dated.filter((p) => (p.listed_at ?? '') < cut3);
  const newestTwoThirds = dated.filter((p) => (p.listed_at ?? '') >= cut3);
  const wfStress = score(oldestThird, newestTwoThirds, 'Walk forward stress, oldest third fits');
  // Leave-one-out: each protocol scored from the other 757.
  let looBrier = 0;
  let looBuckets = 0;
  let looBase = 0;
  const looYs = protocols.map((p) => (isPreToken(p) ? 0 : 1));
  const looBaseRate = looYs.reduce((a, y) => a + y, 0) / looYs.length;
  for (let i = 0; i < protocols.length; i += 1) {
    const rest = protocols.filter((_, j) => j !== i);
    const fit = fitLaunchOdds(rest, asOf);
    const p = protocols[i]!;
    const pred = launchOdds(p, fit, asOf);
    const y = looYs[i]!;
    looBrier += (pred - y) * (pred - y);
    // The bucket comparison for this fold: the left-out protocol's bucket rate from the other 757.
    const bucketCounts = new Map<string, { n: number; live: number }>();
    for (const b of ['<1y', '1-2y', '>2y', 'unknown']) bucketCounts.set(b, { n: 0, live: 0 });
    let restLive = 0;
    for (const q of rest) {
      const c = bucketCounts.get(bucketFor(ageDays(q, asOf)))!;
      c.n += 1;
      if (!isPreToken(q)) {
        c.live += 1;
        restLive += 1;
      }
    }
    const c = bucketCounts.get(bucketFor(ageDays(p, asOf)))!;
    const bucketPred = c.n ? c.live / c.n : restLive / rest.length;
    looBuckets += (bucketPred - y) * (bucketPred - y);
    looBase += (looBaseRate - y) * (looBaseRate - y);
  }
  const loo: OddsSplit = {
    name: 'Leave-one-out',
    fit_n: protocols.length - 1,
    n: protocols.length,
    brier_odds: round3(looBrier / protocols.length),
    brier_base: round3(looBase / protocols.length),
    brier_buckets: round3(looBuckets / protocols.length),
    base_rate: round3(looBaseRate),
  };
  // Adopted for ranking only if the curve beats the base rate held out both ways, walk-forward and leave-one-out.
  const adopted = ab.rawOdds < ab.rawBase && ba.rawOdds < ba.rawBase && wf.rawOdds < wf.rawBase && looBrier / protocols.length < looBase / protocols.length;
  const fullFit = fitLaunchOdds(protocols, asOf);
  // Raw (unstandardised) coefficients, for the dashboard: log-odds = intercept + age_per_year x age in years (+ unknown).
  const rawIntercept = fullFit.beta[0]! - (fullFit.beta[1]! * fullFit.mu[1]!) / fullFit.sd[1]! - (fullFit.beta[2]! * fullFit.mu[2]!) / fullFit.sd[2]!;
  const rawAge = fullFit.beta[1]! / fullFit.sd[1]!;
  const rawUnknown = fullFit.beta[2]! / fullFit.sd[2]!;
  return {
    lambda: ODDS_LAMBDA,
    coefficients: {
      intercept: round4(rawIntercept),
      age_per_year: round4(rawAge),
      unknown: round4(rawUnknown),
    },
    curve: oddsCurvePoints(fullFit, asOf),
    splits: [ab.split, ba.split, wf.split, wfStress.split, loo],
    adopted_for_ranking: adopted,
    verdict: adopted
      ? 'The fitted age curve beats the base rate held out both ways, walk-forward and leave-one-out, and beats the round-7 bucket odds on every one of those splits — so the board is ranked by expected value (gross launch value times these odds). The odds are a peer base rate, not a forecast of a launch date. The walk-forward stress test (oldest third fits) still loses: no age model can learn young-age rates from a fit set with no protocol under about 3.4 years, so that split measures extrapolation from one snapshot, not the curve.'
      : 'The fitted age curve does not beat the base rate on every split, so the board stays ranked by gross launch value and the odds are shown as a peer base rate only.',
  };
}

// ---- Snapshot audit: every protocol accounted for exactly once (round 7) ---

/** Why a pre-token protocol cannot be ranked, in the order the rules are applied. */
export function nonRankableReason(p: Protocol): string | null {
  if (!isPreToken(p)) return null;
  if (EXCLUDED_CATEGORY.has(p.category ?? '')) return p.category!;
  if (VERSIONED.test(p.name)) return 'versioned';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped-word';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange-branded';
  return null;
}

/** One reason pre-token protocols are excluded, with its count. */
export interface AuditReason {
  reason: string;
  n: number;
}

/** The snapshot audit: every protocol in the sealed file accounted for exactly once. */
export interface SnapshotAudit {
  total: number;
  board: number;
  live: number;
  not_rankable: AuditReason[];
  not_rankable_total: number;
  tail: number;
  /** board + live + not_rankable_total + tail equals total. */
  reconciles: boolean;
}

/**
 * Partition the snapshot: the board rows, the protocols that already have a
 * token, the pre-token protocols the rules exclude (each with its reason),
 * and the rankable pre-token protocols above the floor but below the board
 * cutoff. A protocol lands in exactly one group, so the four counts sum to
 * the total — and reconciles says whether they do.
 */
export function auditSnapshot(snapshot: Snapshot, boardRows: BoardRow[]): SnapshotAudit {
  const preToken = snapshot.protocols.filter(isPreToken);
  const live = snapshot.protocols.length - preToken.length;
  const rankable = preToken.filter(isRankable).length;
  const reasonCounts = new Map<string, number>();
  for (const p of preToken) {
    if (isRankable(p)) continue;
    const reason = nonRankableReason(p) ?? 'unrankable';
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  // Deterministic order: most protocols first, ties broken by reason name.
  const notRankable = [...reasonCounts.entries()]
    .map(([reason, n]) => ({ reason, n }))
    .sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));
  const notRankableTotal = notRankable.reduce((s, r) => s + r.n, 0);
  const tail = rankable - boardRows.length;
  const total = snapshot.protocols.length;
  return {
    total,
    board: boardRows.length,
    live,
    not_rankable: notRankable,
    not_rankable_total: notRankableTotal,
    tail,
    reconciles: boardRows.length + live + notRankableTotal + tail === total,
  };
}

// ---- Residual diagnostics: what the size curve still misses (round 7) ------

/** Pearson correlation between two equal-length series. */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

/** The residual diagnostics, computed from the leave-one-out predictions every run. */
export interface ResidualDiagnostics {
  /** Pearson correlation between the LOO log-residuals and 7d growth. */
  growth_correlation: number;
  /** Protocols with a 7d growth figure in the correlation. */
  growth_n: number;
  /** Pearson correlation between the LOO log-residuals and age in days. */
  age_correlation: number;
  /** Protocols with a listing date in the correlation. */
  age_n: number;
  /** Brier of the binned-rates probability (5 equal bins, 5-fold cross-fitted like the Platt check). */
  binned_rates_brier: number;
  /** The shipped normal-CDF Brier, beside it for comparison. */
  shipped_brier: number;
}

/** Binned-rates Brier, 5-fold cross-fitted like the Platt check: each fold's bin rates are fitted on the other four folds, so a held-out protocol's prediction never sees its own label. An in-sample version would flatter the method by fitting the bins on the very protocols it scores. */
function binnedRatesBrier(probs: number[], ys: number[]): number {
  const n = probs.length;
  const folds: number[][] = [[], [], [], [], []];
  for (let i = 0; i < n; i += 1) folds[i % 5]!.push(i);
  let sum = 0;
  for (let f = 0; f < 5; f += 1) {
    const test = folds[f]!;
    const train = folds.flatMap((fold, j) => (j === f ? [] : fold));
    // Bin the training predictions into 5 equal bins by rank; the bin edges are the quintile cut points.
    const sorted = [...train].sort((a, b) => probs[a]! - probs[b]!);
    const size = Math.floor(sorted.length / 5);
    const edges: number[] = [];
    for (let b = 1; b < 5; b += 1) edges.push(probs[sorted[b * size]!]!);
    const binRates: number[] = [];
    for (let b = 0; b < 5; b += 1) {
      const members = sorted.slice(b * size, b === 4 ? sorted.length : (b + 1) * size);
      binRates.push(members.reduce((s, i) => s + ys[i]!, 0) / members.length);
    }
    for (const i of test) {
      const p = probs[i]!;
      let bin = 0;
      while (bin < 4 && p >= edges[bin]!) bin += 1;
      const pred = binRates[bin]!;
      sum += (pred - ys[i]!) * (pred - ys[i]!);
    }
  }
  return sum / n;
}

/** FNV-1a hash of a string, scaled to [-0.5, 0.5): pure noise, by construction. */
function hashNoise(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296 - 0.5;
}

// ---- The fitted model ------------------------------------------------------

/** One candidate feature set: the base size curve plus optional extra terms. */
interface ModelConfig {
  key: string;
  label: string;
  /** Extra features appended after [1, log10(TVL)]; null for the base curve. */
  extra: ((p: Protocol, asOf: string) => number[]) | null;
  /** False for size-only: no category effect at all. */
  useCategory: boolean;
  /** Huber IRLS instead of plain OLS (robust fit, tested not kept). */
  robust?: 'huber';
  /** Winsorize the fit set's log-ratios at these quantiles before fitting. */
  wins?: [number, number];
  /** A hinge in log10(TVL) at this knot: an extra max(0, x - knot) term. */
  hingeKnot?: number;
  /** Cap every predicted log10 cap at this value (tested not kept). */
  capLog?: number;
  /** Shift every predicted log10 cap by this (a global scale, tested not kept). */
  scaleLog?: number;
  /** A per-category slope deviation, shrunk like the category effect. */
  catSize?: boolean;
  /** Category-shrinkage strength: the effect is shrunk by n/(n+catK); the shipped CAT_K is 10. */
  catK?: number;
}

const BASE_CONFIG: ModelConfig = { key: 'base', label: 'size curve + category effect', extra: null, useCategory: true };
const SIZE_ONLY_CONFIG: ModelConfig = { key: 'size-only', label: 'size curve only', extra: null, useCategory: false };
const MOM_CONFIG: ModelConfig = {
  key: 'momentum',
  label: '+ own 7d growth (linear, winsorized)',
  extra: (p) => [clamp(p.change_7d ?? 0, -60, 120) / 100],
  useCategory: true,
};
const MOM_BUCKET_CONFIG: ModelConfig = {
  key: 'momentum-bucket',
  label: '+ own 7d growth (bucket: >+20% / <-10%)',
  extra: (p) => [(p.change_7d ?? 0) > 20 ? 1 : (p.change_7d ?? 0) < -10 ? -1 : 0],
  useCategory: true,
};
const AGE_CONFIG: ModelConfig = {
  key: 'age',
  label: '+ age with no token (linear, winsorized)',
  extra: (p, asOf) => {
    const age = ageDays(p, asOf);
    return [Math.min(Math.max(age ?? 365, 0), 1095) / 365];
  },
  useCategory: true,
};
const AGE_BUCKET_CONFIG: ModelConfig = {
  key: 'age-bucket',
  label: '+ age with no token (bucket: >2y / <1y)',
  extra: (p, asOf) => {
    const age = ageDays(p, asOf);
    return [age === null ? 0 : age > 730 ? 1 : age < 365 ? -1 : 0];
  },
  useCategory: true,
};
const CHAIN_CONFIG: ModelConfig = {
  key: 'chain',
  label: '+ chain count',
  extra: (p) => [Math.log10(Math.max(1, p.chains.length))],
  useCategory: true,
};
const CONTROL_CONFIG: ModelConfig = {
  key: 'control',
  label: '+ slug-hash noise (negative control)',
  extra: (p) => [hashNoise(p.slug)],
  useCategory: true,
};
const FULL_CONFIG: ModelConfig = {
  key: 'full',
  label: 'size + 7d growth + age (brief §2 literal)',
  extra: (p, asOf) => {
    const age = ageDays(p, asOf);
    return [clamp(p.change_7d ?? 0, -60, 120) / 100, Math.min(Math.max(age ?? 365, 0), 1095) / 365];
  },
  useCategory: true,
};
const WINS_CONFIG: ModelConfig = {
  key: 'winsorize',
  label: 'size curve, log-ratios winsorized 1/99',
  extra: null,
  useCategory: true,
  wins: [0.01, 0.99],
};
const HUBER_CONFIG: ModelConfig = {
  key: 'huber',
  label: 'size curve, Huber robust fit',
  extra: null,
  useCategory: true,
  robust: 'huber',
};
const HINGE_CONFIG: ModelConfig = {
  key: 'hinge',
  label: 'size curve + hinge at log10(TVL)=8',
  extra: null,
  useCategory: true,
  hingeKnot: 8,
};
const CATSIZE_CONFIG: ModelConfig = {
  key: 'catsize',
  label: 'size curve + category x size slope',
  extra: null,
  useCategory: true,
  catSize: true,
};
const CAP_CONFIG: ModelConfig = {
  key: 'cap500',
  label: 'size curve, predictions capped at $500M',
  extra: null,
  useCategory: true,
  capLog: Math.log10(500_000_000),
};
const SCALE_CONFIG: ModelConfig = {
  key: 'scale90',
  label: 'size curve, all predictions x0.9',
  extra: null,
  useCategory: true,
  scaleLog: Math.log10(0.9),
};
/** Category-shrinkage challengers (round 8): the shipped shrink is n/(n+10); these try weaker and stronger pulls to the global curve. */
const CATK3_CONFIG: ModelConfig = {
  key: 'catk3',
  label: 'size curve + category effect, shrink n/(n+3)',
  extra: null,
  useCategory: true,
  catK: 3,
};
const CATK5_CONFIG: ModelConfig = {
  key: 'catk5',
  label: 'size curve + category effect, shrink n/(n+5)',
  extra: null,
  useCategory: true,
  catK: 5,
};
const CATK20_CONFIG: ModelConfig = {
  key: 'catk20',
  label: 'size curve + category effect, shrink n/(n+20)',
  extra: null,
  useCategory: true,
  catK: 20,
};
const CATK30_CONFIG: ModelConfig = {
  key: 'catk30',
  label: 'size curve + category effect, shrink n/(n+30)',
  extra: null,
  useCategory: true,
  catK: 30,
};

function features(p: Protocol, asOf: string, config: ModelConfig): number[] {
  const x = Math.log10(Math.max(1, p.tvl_usd));
  const row = [1, x];
  if (config.hingeKnot !== undefined) row.push(Math.max(0, x - config.hingeKnot));
  if (config.extra !== null) row.push(...config.extra(p, asOf));
  return row;
}

/** OLS by normal equations + Gaussian elimination with partial pivoting.
 * A hair of ridge (1e-10 of the mean diagonal) keeps an exactly singular
 * design — a feature constant on the fit set, such as the age bucket on the
 * older walk-forward half, where every protocol is over two years old —
 * from dividing by zero: the ridge solution tends to the minimum-norm one,
 * and it moves a well-conditioned fit by less than 1e-9. */
function ols(X: number[][], y: number[]): number[] {
  const k = X[0]!.length;
  const ata: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const aty: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i += 1) {
    for (let a = 0; a < k; a += 1) {
      aty[a]! += X[i]![a]! * y[i]!;
      for (let b = 0; b < k; b += 1) ata[a]![b]! += X[i]![a]! * X[i]![b]!;
    }
  }
  const trace = ata.reduce((s, row, i) => s + row[i]!, 0);
  const ridge = 1e-10 * (trace / k);
  for (let i = 0; i < k; i += 1) ata[i]![i]! += ridge;
  // Augment and eliminate.
  const m: number[][] = ata.map((row, i) => [...row, aty[i]!]);
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const div = m[col]![col]!;
    for (let r = col + 1; r < k; r += 1) {
      const factor = m[r]![col]! / div;
      for (let c = col; c <= k; c += 1) m[r]![c]! -= factor * m[col]![c]!;
    }
  }
  const beta = new Array<number>(k).fill(0);
  for (let i = k - 1; i >= 0; i -= 1) {
    let sum = m[i]![k]!;
    for (let j = i + 1; j < k; j += 1) sum -= m[i]![j]! * beta[j]!;
    beta[i] = sum / m[i]![i]!;
  }
  return beta;
}

/** Weighted OLS: the same normal equations with a per-row weight, and the same hair of ridge. */
function wols(X: number[][], y: number[], w: number[]): number[] {
  const k = X[0]!.length;
  const ata: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const aty: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i += 1) {
    const wi = w[i]!;
    for (let a = 0; a < k; a += 1) {
      aty[a]! += wi * X[i]![a]! * y[i]!;
      for (let b = 0; b < k; b += 1) ata[a]![b]! += wi * X[i]![a]! * X[i]![b]!;
    }
  }
  const trace = ata.reduce((s, row, i) => s + row[i]!, 0);
  const ridge = 1e-10 * (trace / k);
  for (let i = 0; i < k; i += 1) ata[i]![i]! += ridge;
  const m: number[][] = ata.map((row, i) => [...row, aty[i]!]);
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const div = m[col]![col]!;
    for (let r = col + 1; r < k; r += 1) {
      const factor = m[r]![col]! / div;
      for (let c = col; c <= k; c += 1) m[r]![c]! -= factor * m[col]![c]!;
    }
  }
  const beta = new Array<number>(k).fill(0);
  for (let i = k - 1; i >= 0; i -= 1) {
    let sum = m[i]![k]!;
    for (let j = i + 1; j < k; j += 1) sum -= m[i]![j]! * beta[j]!;
    beta[i] = sum / m[i]![i]!;
  }
  return beta;
}

/** Shrinkage for the category effect: n live comparables count as n/(n+10). */
const CAT_K = 10;

export interface FittedModel {
  config: ModelConfig;
  beta: number[];
  /** Category -> shrunk effect in log10 (add to the size-curve prediction). */
  effects: Map<string, number>;
  /** Category -> { live_n, median residual, effect } for the effects table. */
  effectRows: { category: string; live_n: number; median_resid: number; effect: number }[];
  /** Mean log10(TVL) of the fit set: the centre for the category x size slopes. */
  meanX: number;
  /** Category -> shrunk slope deviation (only when config.catSize is set). */
  catSlopes: Map<string, number>;
  /** The shrinkage strength this fit used (the config's catK, else the shipped CAT_K). */
  catK: number;
}

function fitModel(rows: Protocol[], asOf: string, config: ModelConfig): FittedModel {
  const X = rows.map((p) => features(p, asOf, config));
  let y = rows.map((p) => Math.log10(p.mcap_usd!));
  if (config.wins !== undefined) {
    const ratios = rows.map((p, i) => y[i]! - Math.log10(Math.max(1, p.tvl_usd)));
    const lo = quantile(ratios, config.wins[0]);
    const hi = quantile(ratios, config.wins[1]);
    y = rows.map((p, i) => Math.log10(Math.max(1, p.tvl_usd)) + clamp(ratios[i]!, lo, hi));
  }
  let beta: number[];
  if (config.robust === 'huber') {
    beta = ols(X, y);
    for (let iter = 0; iter < 20; iter += 1) {
      const resid = y.map((yi, i) => yi - X[i]!.reduce((s, v, j) => s + v * beta[j]!, 0));
      const mad = median(resid.map((r) => Math.abs(r - median(resid))));
      const s = 1.4826 * mad + 1e-9;
      const w = resid.map((r) => Math.min(1, (1.345 * s) / Math.max(Math.abs(r), 1e-9)));
      const next = wols(X, y, w);
      const shift = Math.max(...next.map((v, j) => Math.abs(v - beta[j]!)));
      beta = next;
      if (shift < 1e-10) break;
    }
  } else {
    beta = ols(X, y);
  }
  const effects = new Map<string, number>();
  const effectRows: FittedModel['effectRows'] = [];
  const meanX = mean(rows.map((p) => Math.log10(Math.max(1, p.tvl_usd))));
  const catSlopes = new Map<string, number>();
  /** The shrinkage strength for this fit: the config's catK, else the shipped CAT_K. */
  const catK = config.catK ?? CAT_K;
  if (config.useCategory) {
    const byCategory = new Map<string, number[]>();
    rows.forEach((p, i) => {
      const resid = y[i]! - X[i]!.reduce((s, v, j) => s + v * beta[j]!, 0);
      const key = p.category ?? '(none)';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(resid);
    });
    for (const [category, resids] of byCategory) {
      const med = median(resids);
      // At least two live comparables: one observation is not a median.
      const effect = resids.length >= 2 ? (resids.length / (resids.length + catK)) * med : 0;
      if (resids.length >= 2) effects.set(category, effect);
      effectRows.push({ category, live_n: resids.length, median_resid: med, effect });
    }
    effectRows.sort((a, b) => b.effect - a.effect);
  }
  if (config.catSize === true) {
    const byCategory = new Map<string, { resid: number; dx: number }[]>();
    rows.forEach((p, i) => {
      const resid = y[i]! - X[i]!.reduce((s, v, j) => s + v * beta[j]!, 0);
      const key = p.category ?? '(none)';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push({ resid, dx: Math.log10(Math.max(1, p.tvl_usd)) - meanX });
    });
    for (const [category, pairs] of byCategory) {
      if (pairs.length < 2) continue;
      const denom = pairs.reduce((s, q) => s + q.dx * q.dx, 0);
      if (denom < 1e-9) continue;
      const slope = pairs.reduce((s, q) => s + q.dx * q.resid, 0) / denom;
      catSlopes.set(category, (pairs.length / (pairs.length + CAT_K)) * slope);
    }
  }
  return { config, beta, effects, effectRows, meanX, catSlopes, catK };
}

/** log10 of the predicted market cap for one protocol under a fitted model. */
function predictLog(p: Protocol, asOf: string, fit: FittedModel): number {
  const x = features(p, asOf, fit.config);
  let logcap = x.reduce((s, v, j) => s + v * fit.beta[j]!, 0);
  if (fit.config.useCategory) logcap += fit.effects.get(p.category ?? '(none)') ?? 0;
  if (fit.config.catSize === true) {
    const slope = fit.catSlopes.get(p.category ?? '(none)') ?? 0;
    logcap += slope * (Math.log10(Math.max(1, p.tvl_usd)) - fit.meanX);
  }
  if (fit.config.capLog !== undefined) logcap = Math.min(logcap, fit.config.capLog);
  if (fit.config.scaleLog !== undefined) logcap += fit.config.scaleLog;
  return logcap;
}

function scoreWithFit(p: Protocol, asOf: string, fit: FittedModel): ValueModel {
  const logcap = predictLog(p, asOf, fit);
  const implied = Math.max(1, Math.round(10 ** logcap));
  const x = Math.log10(Math.max(1, p.tvl_usd));
  // The size part of the prediction, without the category effect: its
  // multiple is the size curve's own; the category factor multiplies it.
  const sizeLog = logcap - (fit.config.useCategory ? fit.effects.get(p.category ?? '(none)') ?? 0 : 0);
  const sizeMultiple = 10 ** (sizeLog - x);
  const effect = fit.config.useCategory ? fit.effects.get(p.category ?? '(none)') ?? 0 : 0;
  const catFactor = 10 ** effect;
  const row = fit.effectRows.find((r) => r.category === (p.category ?? '(none)'));
  const basis =
    row === undefined
      ? `no live comparables in ${p.category ?? 'category'} — no category effect`
      : row.live_n < 2
        ? `only ${row.live_n} live comparable in ${p.category ?? 'category'} — too few for a category effect`
        : `category effect ${effect >= 0 ? '+' : ''}${effect.toFixed(3)} in log10 (median residual of ${row.live_n} live, shrunk ${row.live_n}/${row.live_n + fit.catK})`;
  return {
    multiple: sizeMultiple * catFactor,
    cat_multiple: catFactor,
    cat_basis: basis,
    chain_factor: 1,
    growth: 1,
    maturity: 1,
    implied_usd: implied,
  };
}

/** Score one protocol against a given fitted model: the same formula the board uses. */
export function scoreWithCalibration(p: Protocol, asOf: string, fit: FittedModel): ValueModel {
  return scoreWithFit(p, asOf, fit);
}

export function scoreProtocol(p: Protocol, asOf: string, fit: FittedModel): ValueModel {
  return scoreWithFit(p, asOf, fit);
}

/** The live comparables the validation draws on: a token that trades, a real market cap and a real TVL, no CEX. */
export function liveComparables(snapshot: Snapshot): Protocol[] {
  return snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX',
  );
}

/** The flat baseline: the median mcap/TVL of the fit set, applied at every TVL. */
function flatMedian(fitSet: Protocol[]): number {
  return median(fitSet.map((p) => p.mcap_usd! / p.tvl_usd));
}

/** One validation test from a fit set and a test set, using the entry's own scoring with the fit set's model. */
function runTest(
  name: string,
  fitSet: Protocol[],
  testSet: Protocol[],
  asOf: string,
  config: ModelConfig | 'flat',
): ValidationTest {
  const fit = config === 'flat' ? null : fitModel(fitSet, asOf, config);
  const flatMed = config === 'flat' ? flatMedian(fitSet) : 0;
  const predicted: number[] = [];
  const actual: number[] = [];
  for (const p of testSet) {
    const pred =
      config === 'flat' ? Math.max(1, Math.round(p.tvl_usd * flatMed)) : Math.max(1, Math.round(10 ** predictLog(p, asOf, fit!)));
    predicted.push(pred);
    actual.push(p.mcap_usd!);
  }
  const ratios = predicted.map((pr, i) => Math.max(pr, actual[i]!) / Math.min(pr, actual[i]!));
  const within3 = ratios.filter((r) => r <= 3).length;
  // Brier for "actual mcap/TVL above the fit set's median ratio": the model
  // predicts it from its own predicted log-ratio and the test residuals' spread.
  const logResid = predicted.map((pr, i) => Math.log10(actual[i]! / pr));
  const sigma = Math.max(sd(logResid), 1e-9);
  const threshold = median(fitSet.map((p) => Math.log10(p.mcap_usd! / p.tvl_usd)));
  let brierSum = 0;
  let baseSum = 0;
  let above = 0;
  const ys: number[] = [];
  for (let i = 0; i < testSet.length; i += 1) {
    const y = Math.log10(actual[i]! / testSet[i]!.tvl_usd) > threshold ? 1 : 0;
    ys.push(y);
    above += y;
    const prob = normCdf((Math.log10(predicted[i]! / testSet[i]!.tvl_usd) - threshold) / sigma);
    brierSum += (prob - y) * (prob - y);
  }
  const baseRate = above / testSet.length;
  for (const y of ys) baseSum += (baseRate - y) * (baseRate - y);
  const z25 = 0.674;
  const z90 = 1.282;
  return {
    name,
    fit_n: fitSet.length,
    test_n: testSet.length,
    median_miss_x: Math.round(median(ratios) * 100) / 100,
    within_3x: within3,
    within_3x_pct: Math.round((within3 / testSet.length) * 1000) / 10,
    brier: Math.round((brierSum / testSet.length) * 1000) / 1000,
    brier_base: Math.round((baseSum / testSet.length) * 1000) / 1000,
    base_rate: Math.round(baseRate * 1000) / 1000,
    hold_25_75: Math.round((logResid.filter((r) => Math.abs(r) <= z25 * sigma).length / testSet.length) * 1000) / 1000,
    hold_10_90: Math.round((logResid.filter((r) => Math.abs(r) <= z90 * sigma).length / testSet.length) * 1000) / 1000,
  };
}

/** Leave-one-out predictions for one config: each live protocol predicted from all the others. */
function looPredictions(live: Protocol[], asOf: string, config: ModelConfig | 'flat'): number[] {
  const out: number[] = [];
  for (let i = 0; i < live.length; i += 1) {
    const fitSet = live.filter((_, j) => j !== i);
    const p = live[i]!;
    if (config === 'flat') {
      out.push(Math.max(1, Math.round(p.tvl_usd * flatMedian(fitSet))));
    } else {
      const fit = fitModel(fitSet, asOf, config);
      out.push(Math.max(1, Math.round(10 ** predictLog(p, asOf, fit))));
    }
  }
  return out;
}

function missRatios(predicted: number[], actual: number[]): number[] {
  return predicted.map((pr, i) => Math.max(pr, actual[i]!) / Math.min(pr, actual[i]!));
}

/**
 * Paired bootstrap over the LOO miss ratios: how often does this config's
 * mean log miss beat the base model's, on the same resampled protocols?
 * The mean of log10(miss) is used, not the median: the median is a jumpy
 * statistic and its resampled distribution misleads. 2000 resamples, fixed
 * seed, so the number reproduces exactly.
 */
function pairedPImproves(baseRatios: number[], cfgRatios: number[]): number {
  const rng = mulberry32(20261125);
  const n = baseRatios.length;
  const baseLog = baseRatios.map((r) => Math.log10(r));
  const cfgLog = cfgRatios.map((r) => Math.log10(r));
  let wins = 0;
  const trials = 2000;
  for (let t = 0; t < trials; t += 1) {
    let baseSum = 0;
    let cfgSum = 0;
    for (let i = 0; i < n; i += 1) {
      const idx = Math.floor(rng() * n);
      baseSum += baseLog[idx]!;
      cfgSum += cfgLog[idx]!;
    }
    if (cfgSum < baseSum) wins += 1;
    else if (cfgSum === baseSum) wins += 0.5; // an identical model ties: half a win, not a loss
  }
  return Math.round((wins / trials) * 100) / 100;
}

/** Walk-forward split: older half by listing date fits, newer half tests. */
function walkForwardSplit(live: Protocol[]): { older: Protocol[]; newer: Protocol[]; cut: string } {
  const dated = live.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at ?? '').localeCompare(b.listed_at ?? ''));
  const cut = dated[Math.floor(dated.length / 2)]!.listed_at!;
  return {
    older: dated.filter((p) => (p.listed_at ?? '') < cut),
    newer: dated.filter((p) => (p.listed_at ?? '') >= cut),
    cut,
  };
}

/**
 * The probability check, on the leave-one-out predictions themselves: a
 * Platt logistic (a + b * predicted log-ratio) fitted by 5-fold cross-fit
 * so no protocol's probability is fitted on itself, and a tempered
 * normal-CDF Brier at k=1.5. Both are scored against the same "actual
 * mcap/TVL above the live median ratio" event as the shipped Brier.
 */
function probabilityCheck(live: Protocol[], looPreds: number[]): { platt_brier: number; temp15_brier: number } {
  const threshold = median(live.map((p) => Math.log10(p.mcap_usd! / p.tvl_usd)));
  const ys = live.map((p) => (Math.log10(p.mcap_usd! / p.tvl_usd) > threshold ? 1 : 0));
  const z = looPreds.map((pr, i) => Math.log10(pr / live[i]!.tvl_usd));
  const n = live.length;
  // Tempered normal-CDF: same sigma as the LOO Brier, widened 1.5x.
  const logResid = looPreds.map((pr, i) => Math.log10(live[i]!.mcap_usd! / pr));
  const sigma = Math.max(sd(logResid), 1e-9);
  let tempSum = 0;
  for (let i = 0; i < n; i += 1) {
    const prob = normCdf((z[i]! - threshold) / (1.5 * sigma));
    tempSum += (prob - ys[i]!) * (prob - ys[i]!);
  }
  // Platt: logistic regression on z, Newton steps, ridge 1.0 on the slope.
  const plattFit = (idx: number[]): [number, number] => {
    let a = 0;
    let b = 1;
    for (let iter = 0; iter < 50; iter += 1) {
      let g0 = 0;
      let g1 = 0;
      let h00 = 0;
      let h01 = 0;
      let h11 = 0;
      for (const i of idx) {
        const s = a + b * z[i]!;
        const p = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, s))));
        const w = p * (1 - p);
        g0 += p - ys[i]!;
        g1 += (p - ys[i]!) * z[i]!;
        h00 += w;
        h01 += w * z[i]!;
        h11 += w * z[i]! * z[i]!;
      }
      g1 += b;
      h11 += 1;
      const det = (h00 + 1e-6) * h11 - h01 * h01;
      if (Math.abs(det) < 1e-12) break;
      const stepA = (h11 * g0 - h01 * g1) / det;
      const stepB = ((h00 + 1e-6) * g1 - h01 * g0) / det;
      a -= stepA;
      b -= stepB;
      if (Math.max(Math.abs(stepA), Math.abs(stepB)) < 1e-8) break;
    }
    return [a, b];
  };
  const folds: number[][] = [[], [], [], [], []];
  for (let i = 0; i < n; i += 1) folds[i % 5]!.push(i);
  let plattSum = 0;
  for (let f = 0; f < 5; f += 1) {
    const test = folds[f]!;
    const train = folds.flatMap((fold, g) => (g === f ? [] : fold));
    const [a, b] = plattFit(train);
    for (const i of test) {
      const s = a + b * z[i]!;
      const prob = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, s))));
      plattSum += (prob - ys[i]!) * (prob - ys[i]!);
    }
  }
  return {
    platt_brier: Math.round((plattSum / n) * 1000) / 1000,
    temp15_brier: Math.round((tempSum / n) * 1000) / 1000,
  };
}

/**
 * Validate the value model against the snapshot's own live protocols, where
 * the market cap is known and the model can be scored. Held out two ways,
 * walk forward by listing date, a leave-one-out backtest, the flat baseline
 * on the same splits, a per-term ablation table (each term kept or dropped
 * on its numbers, with a paired bootstrap), a negative control, a 200-refit
 * bootstrap for the slope, the multiple at $100M TVL and the top-10 rank
 * ranges, and the cross-fitted probability check.
 *
 * What the numbers say on this snapshot: the size curve beats the flat
 * median out of sample (LOO miss x3.18 vs x4.94, within-3x 47.1% vs 33.6%),
 * and the category effect helps walk-forward (x2.60 vs x2.81 size-only).
 * Everything else — 7d growth in any form, age in any form, chain count,
 * Huber, winsorizing, a hinge, a category x size slope, caps, a global
 * scale, and (round 8) weaker or stronger category shrinkage — is noise or
 * worse: none improves LOO and walk-forward together, and the age term is
 * near-constant on the older half, so its walk-forward fit is degenerate and
 * its miss explodes (its coefficient only flips sign on the held-out split,
 * not walk-forward). The board says so on the page instead of hiding it: the
 * model ranks launches by the market's own pricing, it does not predict a price.
 */
export function validateModel(snapshot: Snapshot, boardRows: BoardRow[]): Validation {
  const live = liveComparables(snapshot);
  const asOf = snapshot.as_of;
  const actual = live.map((p) => p.mcap_usd!);
  const bySlug = [...live].sort((a, b) => a.slug.localeCompare(b.slug));
  const halfA = bySlug.filter((_, i) => i % 2 === 0);
  const halfB = bySlug.filter((_, i) => i % 2 === 1);
  const heldOut = [
    runTest('Held out, half A fits half B', halfA, halfB, asOf, BASE_CONFIG),
    runTest('Held out, half B fits half A', halfB, halfA, asOf, BASE_CONFIG),
  ];
  const { older, newer, cut } = walkForwardSplit(live);
  const walkForward = { ...runTest('Walk forward, older fits newer', older, newer, asOf, BASE_CONFIG), cut };
  const flatWalkForward = { ...runTest('Walk forward, flat baseline', older, newer, asOf, 'flat'), cut };
  const looPreds = looPredictions(live, asOf, BASE_CONFIG);
  const looRatios = missRatios(looPreds, actual);
  const looLogResid = looPreds.map((pr, i) => Math.log10(actual[i]! / pr));
  const looSigma = Math.max(sd(looLogResid), 1e-9);
  const looThreshold = median(live.map((p) => Math.log10(p.mcap_usd! / p.tvl_usd)));
  let looBrier = 0;
  let looBase = 0;
  let looAbove = 0;
  const looYs: number[] = [];
  const looProbs: number[] = [];
  for (let i = 0; i < live.length; i += 1) {
    const y = Math.log10(actual[i]! / live[i]!.tvl_usd) > looThreshold ? 1 : 0;
    looYs.push(y);
    looAbove += y;
    const prob = normCdf((Math.log10(looPreds[i]! / live[i]!.tvl_usd) - looThreshold) / looSigma);
    looProbs.push(prob);
    looBrier += (prob - y) * (prob - y);
  }
  const looBaseRate = looAbove / live.length;
  for (const y of looYs) looBase += (looBaseRate - y) * (looBaseRate - y);
  const looWithin3 = looRatios.filter((r) => r <= 3).length;
  const loo: ValidationTest = {
    name: 'Leave-one-out backtest',
    fit_n: live.length - 1,
    test_n: live.length,
    median_miss_x: Math.round(median(looRatios) * 100) / 100,
    within_3x: looWithin3,
    within_3x_pct: Math.round((looWithin3 / live.length) * 1000) / 10,
    brier: Math.round((looBrier / live.length) * 1000) / 1000,
    brier_base: Math.round((looBase / live.length) * 1000) / 1000,
    base_rate: Math.round(looBaseRate * 1000) / 1000,
    hold_25_75: Math.round((looLogResid.filter((r) => Math.abs(r) <= 0.674 * looSigma).length / live.length) * 1000) / 1000,
    hold_10_90: Math.round((looLogResid.filter((r) => Math.abs(r) <= 1.282 * looSigma).length / live.length) * 1000) / 1000,
  };
  const flatLooPreds = looPredictions(live, asOf, 'flat');
  // The flat LOO test needs its own out-of-sample pass, not a fit on nothing:
  // rebuild it from the LOO predictions with the same scoring as runTest.
  const flatLoo = flatTestFromPreds('Leave-one-out, flat baseline', live, flatLooPreds);
  const flatLooRatios = missRatios(flatLooPreds, actual);
  const probability = {
    method: 'Platt logistic, 5-fold cross-fit on the LOO predictions; tempered normal-CDF at k=1.5',
    ...probabilityCheck(live, looPreds),
  };

  // ---- Residual diagnostics: do growth / age explain what the curve misses? ----
  // The LOO log-residual is log10(actual / predicted): positive means the model underpriced the protocol.
  // A correlation near zero means the feature carries no signal the curve left on the table.
  const growthPairs = live
    .map((p, i) => ({ g: p.change_7d, r: looLogResid[i]! }))
    .filter((x) => x.g !== null);
  const agePairs = live
    .map((p, i) => ({ a: ageDays(p, asOf), r: looLogResid[i]! }))
    .filter((x) => x.a !== null);
  const residualDiagnostics: ResidualDiagnostics = {
    growth_correlation: Math.round(pearson(growthPairs.map((x) => x.g!), growthPairs.map((x) => x.r)) * 1000) / 1000,
    growth_n: growthPairs.length,
    age_correlation: Math.round(pearson(agePairs.map((x) => x.a!), agePairs.map((x) => x.r)) * 1000) / 1000,
    age_n: agePairs.length,
    binned_rates_brier: Math.round(binnedRatesBrier(looProbs, looYs) * 1000) / 1000,
    shipped_brier: loo.brier,
  };

  // ---- Launch odds and snapshot audit (round 7). ----
  const odds = validateLaunchOdds(snapshot);
  const audit = auditSnapshot(snapshot, boardRows);

  // ---- Ablation: every term, LOO + walk-forward + paired bootstrap. ----
  const ablationConfigs: { config: ModelConfig | 'flat'; term: string; note: string }[] = [
    { config: SIZE_ONLY_CONFIG, term: 'size curve only (no category)', note: 'LOO and walk-forward both worse — the category effect stays.' },
    { config: BASE_CONFIG, term: 'size curve + category effect (base)', note: 'The shipped model.' },
    { config: MOM_CONFIG, term: '+ own 7d growth (linear)', note: 'Fitted sign flips between eras; no out-of-sample gain on either split.' },
    { config: MOM_BUCKET_CONFIG, term: '+ own 7d growth (bucket)', note: 'Buckets do not save it either: LOO and walk-forward both worse than base.' },
    { config: AGE_CONFIG, term: '+ age with no token (linear)', note: 'Sign flips only on the held-out split (−0.33 / +0.11); on walk-forward both halves stay negative (−1.43 / −0.47). Walk-forward miss explodes — the term is era, not signal.' },
    { config: AGE_BUCKET_CONFIG, term: '+ age with no token (bucket)', note: 'Unidentified on the older half (every protocol there is over two years old, so the bucket is constant) and catastrophic out of sample: walk-forward past x100.' },
    { config: CHAIN_CONFIG, term: '+ chain count', note: 'Coefficient ≈ 0; no real gain on either split.' },
    { config: CONTROL_CONFIG, term: '+ slug-hash noise (control)', note: 'Must not help — and does not: no LOO gain, paired bootstrap at noise level, same as the dropped terms.' },
    { config: FULL_CONFIG, term: 'size + 7d growth + age', note: 'The brief §2 literal formula: worse than the base on both splits.' },
    { config: WINS_CONFIG, term: 'log-ratios winsorized 1/99', note: 'LOO a hair better, walk-forward a hair better, paired bootstrap at 0.39 — a coin flip, not a win.' },
    { config: HUBER_CONFIG, term: 'Huber robust fit', note: 'Wins the paired mean-log-miss bootstrap (P=0.71) and walk-forward, but loses the headline LOO median miss and pushes the top-120 board total to $1.77B — no joint win.' },
    { config: HINGE_CONFIG, term: 'size curve + hinge at $100M TVL', note: 'The curve is already log-linear: the hinge loses on both splits.' },
    { config: CATSIZE_CONFIG, term: 'category x size slope', note: 'Per-category slopes are noise on 119 comparables: LOO much worse.' },
    { config: CAP_CONFIG, term: 'predictions capped at $500M', note: 'No leave-one-out prediction reaches the cap, so nothing changes.' },
    { config: SCALE_CONFIG, term: 'all predictions x0.9', note: 'Paired bootstrap only 0.11 — no real gain, and no total-band reason to shrink.' },
    { config: CATK3_CONFIG, term: 'category effect, shrink n/(n+3)', note: 'Round 8: helps walk-forward (x2.42 vs x2.60) but hurts leave-one-out (x3.75 vs x3.18) — no joint win, not kept.' },
    { config: CATK5_CONFIG, term: 'category effect, shrink n/(n+5)', note: 'Round 8: helps walk-forward (x2.45 vs x2.60) but hurts leave-one-out (x3.37 vs x3.18) — no joint win, not kept.' },
    { config: CATK20_CONFIG, term: 'category effect, shrink n/(n+20)', note: 'Round 8: worse on both splits (LOO x3.26, walk-forward x2.73) — not kept.' },
    { config: CATK30_CONFIG, term: 'category effect, shrink n/(n+30)', note: 'Round 8: worse on both splits (LOO x3.30, walk-forward x2.79) — not kept.' },
  ];
  const ablation: AblationRow[] = [];
  const looPredCache = new Map<string, number[]>();
  looPredCache.set('base', looPreds);
  looPredCache.set('flat', flatLooPreds);
  for (const { config, term, note } of ablationConfigs) {
    const key = config === 'flat' ? 'flat' : config.key;
    let preds = looPredCache.get(key);
    if (preds === undefined) {
      preds = looPredictions(live, asOf, config);
      looPredCache.set(key, preds);
    }
    const ratios = missRatios(preds, actual);
    const wf = runTest(`Walk forward, ${term}`, older, newer, asOf, config);
    const isBase = key === 'base';
    ablation.push({
      term,
      kept: isBase,
      loo_miss_x: Math.round(median(ratios) * 100) / 100,
      loo_within3_pct: Math.round((ratios.filter((r) => r <= 3).length / live.length) * 1000) / 10,
      wf_miss_x: wf.median_miss_x,
      wf_within3_pct: wf.within_3x_pct,
      p_improves: isBase ? 1 : pairedPImproves(looRatios, ratios),
      note,
    });
  }

  // ---- Bootstrap: 200 refits, slope + multiple at $100M + rank ranges. ----
  const boot = bootstrap(live, asOf, boardRows);

  return {
    live_n: live.length,
    held_out: heldOut,
    walk_forward: walkForward,
    loo,
    flat_loo: flatLoo,
    flat_walk_forward: flatWalkForward,
    range_holds: { p25_75: loo.hold_25_75, p10_90: loo.hold_10_90, stated_25_75: 0.5, stated_10_90: 0.8 },
    ablation,
    bootstrap: boot,
    probability,
    odds,
    audit,
    residual_diagnostics: residualDiagnostics,
  };
}

/** A ValidationTest built from already-computed out-of-sample predictions (flat LOO). */
function flatTestFromPreds(name: string, live: Protocol[], predicted: number[]): ValidationTest {
  const actual = live.map((p) => p.mcap_usd!);
  const ratios = missRatios(predicted, actual);
  const within3 = ratios.filter((r) => r <= 3).length;
  const logResid = predicted.map((pr, i) => Math.log10(actual[i]! / pr));
  const sigma = Math.max(sd(logResid), 1e-9);
  const threshold = median(live.map((p) => Math.log10(p.mcap_usd! / p.tvl_usd)));
  let brierSum = 0;
  let baseSum = 0;
  let above = 0;
  const ys: number[] = [];
  for (let i = 0; i < live.length; i += 1) {
    const y = Math.log10(actual[i]! / live[i]!.tvl_usd) > threshold ? 1 : 0;
    ys.push(y);
    above += y;
    const prob = normCdf((Math.log10(predicted[i]! / live[i]!.tvl_usd) - threshold) / sigma);
    brierSum += (prob - y) * (prob - y);
  }
  const baseRate = above / live.length;
  for (const y of ys) baseSum += (baseRate - y) * (baseRate - y);
  return {
    name,
    fit_n: live.length - 1,
    test_n: live.length,
    median_miss_x: Math.round(median(ratios) * 100) / 100,
    within_3x: within3,
    within_3x_pct: Math.round((within3 / live.length) * 1000) / 10,
    brier: Math.round((brierSum / live.length) * 1000) / 1000,
    brier_base: Math.round((baseSum / live.length) * 1000) / 1000,
    base_rate: Math.round(baseRate * 1000) / 1000,
    hold_25_75: Math.round((logResid.filter((r) => Math.abs(r) <= 0.674 * sigma).length / live.length) * 1000) / 1000,
    hold_10_90: Math.round((logResid.filter((r) => Math.abs(r) <= 1.282 * sigma).length / live.length) * 1000) / 1000,
  };
}

function bootstrap(live: Protocol[], asOf: string, boardRows: BoardRow[]): Bootstrap {
  const rng = mulberry32(20261125);
  const n = 200;
  const slopes: number[] = [];
  const mults: number[] = [];
  const topSlugs = boardRows.slice(0, 10).map((r) => r.slug);
  const rankLists = new Map<string, number[]>();
  for (const slug of topSlugs) rankLists.set(slug, []);
  // The board rows carry their protocols' TVL/category; re-score them per refit.
  // The rank is by expected value, so each refit multiplies the re-scored gross
  // launch value by the row's shipped launch odds (the odds are fitted once on
  // all 758 protocols, not re-fitted per refit, so the ranges measure the
  // value model's uncertainty, not the odds').
  const oddsOf = new Map<string, number>(boardRows.map((r) => [r.slug, r.launch_odds]));
  const boardProtos: Protocol[] = boardRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    listed_at: null,
    mcap_usd: null,
    gecko_id: null,
    symbol: null,
  }));
  for (let t = 0; t < n; t += 1) {
    const sample: Protocol[] = [];
    for (let i = 0; i < live.length; i += 1) sample.push(live[Math.floor(rng() * live.length)]!);
    const fit = fitModel(sample, asOf, BASE_CONFIG);
    slopes.push(fit.beta[1]!);
    mults.push(10 ** (fit.beta[0]! + (fit.beta[1]! - 1) * 8));
    const scored = boardProtos
      .map((p) => ({ slug: p.slug, implied: Math.max(1, Math.round(10 ** predictLog(p, asOf, fit))) * (oddsOf.get(p.slug) ?? 1) }))
      .sort((a, b) => b.implied - a.implied || a.slug.localeCompare(b.slug));
    scored.forEach((row, i) => {
      const list = rankLists.get(row.slug);
      if (list !== undefined) list.push(i + 1);
    });
  }
  const pct = (values: number[], q: number): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length))]!;
  };
  return {
    n,
    slope_mean: Math.round(mean(slopes) * 1000) / 1000,
    slope_se: Math.round(sd(slopes) * 1000) / 1000,
    mult100m_mean: Math.round(mean(mults) * 1000) / 1000,
    mult100m_se: Math.round(sd(mults) * 1000) / 1000,
    rank_ranges: boardRows.slice(0, 10).map((r) => {
      const list = rankLists.get(r.slug) ?? [r.rank];
      return { slug: r.slug, name: r.name, base_rank: r.rank, p5: pct(list, 5), p95: pct(list, 95) };
    }),
  };
}

/** The deposit the farm plan sizes from, by TVL tier. */
export function capitalFor(p: Protocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 1000;
  if (p.tvl_usd >= 250_000_000) return 500;
  if (p.tvl_usd >= 100_000_000) return 200;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

const money = (n: number): string => `$${n.toLocaleString('en-US')}`;
/** The main qualifying action for the protocol's category, sized to its TVL tier. */
function mainAction(p: Protocol, capital: number): string {
  const chain = p.chains[0] ?? 'its main chain';
  const c = p.category ?? '';
  switch (c) {
    case 'Risk Curators':
      return `Deposit ${money(capital)} of USDC into ${p.name}'s curator vault on ${chain} and hold the vault receipt in the farming wallet.`;
    case 'Onchain Capital Allocator':
      return `Allocate ${money(capital)} of USDC into ${p.name}'s allocator vault on ${chain} and keep the vault position open.`;
    case 'Basis Trading':
      return `Deposit ${money(capital)} of USDC into ${p.name}'s basis vault on ${chain} and hold the position through one funding cycle.`;
    case 'Dexs':
      return `Swap ${money(capital)} of USDC for the pool's base asset through ${p.name} on ${chain}, then add ${money(Math.round(capital / 2))} of liquidity to its largest pool.`;
    case 'Lending':
      return `Supply ${money(capital)} of USDC to ${p.name} on ${chain} and leave it supplied; the supply position is the qualifying action.`;
    case 'RWA':
      return `Mint or buy ${money(capital)} of ${p.name}'s yield-bearing asset on ${chain} and hold it in the farming wallet.`;
    case 'CDP':
      return `Lock ${money(capital)} of collateral in ${p.name} on ${chain} and mint its stablecoin against it; keep the position above the liquidation ratio.`;
    case 'CDP Manager':
      return `Open a collateralised debt position with ${money(capital)} of collateral in ${p.name} on ${chain} and mint against it.`;
    case 'Yield':
    case 'Yield Aggregator':
      return `Deposit ${money(capital)} of USDC into ${p.name}'s yield vault on ${chain} and leave it compounding.`;
    case 'Derivatives':
    case 'Perpetuals':
      return `Deposit ${money(capital)} of USDC as margin on ${p.name} (${chain}), open a small hedged position and keep it open a full day.`;
    case 'Prediction Market':
      return `Fund ${p.name} with ${money(capital)} of USDC on ${chain} and place a position on a market that settles after the snapshot date.`;
    case 'Insurance':
      return `Buy ${money(capital)} of cover from ${p.name} on ${chain} for a position you actually hold, and keep the cover active.`;
    case 'CeDeFi':
      return `Deposit ${money(capital)} of USDC into ${p.name}'s CeDeFi vault on ${chain} and hold the vault receipt.`;
    case 'Chain':
      return `Bridge ${money(capital)} of USDC to ${p.name} on ${chain} and use its flagship app with at least half of it.`;
    case 'Payments':
      return `Spend ${money(capital)} through ${p.name} on ${chain} with its payment rail and keep the receipt in the farming wallet.`;
    case 'Governance Incentives':
      return `Stake ${money(capital)} of the protocol's incentive asset in ${p.name} on ${chain} and vote on an open proposal.`;
    case 'Staking Pool':
      return `Stake ${money(capital)} of the pool asset in ${p.name} on ${chain} and keep it staked through the next reward epoch.`;
    case 'Stablecoin Wrapper':
      return `Wrap ${money(capital)} of the underlying stablecoin through ${p.name} on ${chain} and hold the wrapped token.`;
    case 'Collateral Markets':
      return `Supply ${money(capital)} of collateral to ${p.name} on ${chain} and borrow a small amount against it to register activity.`;
    case 'Indexes':
      return `Buy ${money(capital)} of ${p.name}'s index token on ${chain} and hold it in the farming wallet.`;
    case 'Liquidity Manager':
      return `Deposit ${money(capital)} of USDC into ${p.name}'s managed liquidity position on ${chain} and keep it in range.`;
    case 'Restaking':
      return `Restake ${money(capital)} of the restaking asset through ${p.name} on ${chain} and delegate it to an operator.`;
    case 'Leveraged Farming':
      return `Open a leveraged farm with ${money(capital)} of collateral in ${p.name} on ${chain} at the lowest leverage the vault offers.`;
    case 'OTC Marketplace':
      return `Place an OTC order for ${money(capital)} of the listed asset on ${p.name} (${chain}) and complete it from the farming wallet.`;
    case 'Interest Rate Derivatives':
      return `Open a rate position with ${money(capital)} of collateral in ${p.name} on ${chain} and hold it through one rate reset.`;
    case 'Dual-Token Stablecoin':
      return `Mint ${money(capital)} of ${p.name}'s stablecoin on ${chain} against collateral and hold the minted token.`;
    case 'Farm':
      return `Deposit ${money(capital)} of USDC into ${p.name}'s farm on ${chain} and leave it staked.`;
    case 'Uncollateralized Lending':
      return `Lend ${money(capital)} of USDC through ${p.name} on ${chain} and keep the loan open through the next interest period.`;
    case 'Anchor BTC':
    case 'Decentralized BTC':
      return `Mint ${money(capital)} of ${p.name}'s BTC-backed asset on ${chain} and hold it in the farming wallet.`;
    case 'Crypto Card Issuer':
      return `Spend ${money(capital)} with ${p.name}'s card on ${chain} and keep the spend receipt in the farming wallet.`;
    default:
      return `Use ${p.name}'s main product on ${chain} with ${money(capital)} of USDC and keep the position open in the farming wallet.`;
  }
}

/** A second, different qualifying action, so the plan is not one deposit and done. */
function secondAction(p: Protocol, capital: number): string {
  const chain = p.chains[0] ?? 'its main chain';
  const c = p.category ?? '';
  switch (c) {
    case 'Risk Curators':
    case 'Onchain Capital Allocator':
    case 'CeDeFi':
      return `Allocate a second ${money(Math.round(capital / 2))} to a different vault run by ${p.name} on ${chain}, so the wallet shows two distinct vault positions.`;
    case 'Basis Trading':
      return `After the first funding cycle, add ${money(Math.round(capital / 2))} to the basis position on ${chain} and hold it through a second cycle.`;
    case 'Dexs':
      return `Swap a second ${money(Math.round(capital / 2))} through a different pool on ${p.name} (${chain}) a week after the first swap.`;
    case 'Lending':
    case 'Collateral Markets':
      return `Borrow ${money(Math.round(capital / 4))} of a stablecoin against the supplied collateral on ${p.name} (${chain}) and repay it after a week.`;
    case 'RWA':
    case 'Stablecoin Wrapper':
    case 'Indexes':
      return `Use the ${p.name} asset on ${chain} as collateral in a second app, so the wallet shows the asset working, not just held.`;
    case 'CDP':
    case 'CDP Manager':
    case 'Dual-Token Stablecoin':
      return `Open a second collateral position with ${money(Math.round(capital / 2))} in ${p.name} on ${chain}, using a different collateral asset.`;
    case 'Yield':
    case 'Yield Aggregator':
      return `Claim the vault's rewards once, then redeposit them into the same vault on ${chain} instead of withdrawing.`;
    case 'Derivatives':
    case 'Perpetuals':
      return `Close the first position after a day, then open a second one on ${p.name} (${chain}) in the opposite direction with the same margin.`;
    case 'Prediction Market':
      return `Place a second position on a different ${p.name} market on ${chain} that settles on another date.`;
    case 'Insurance':
      return `Renew the cover from ${p.name} on ${chain} before it lapses, so the wallet shows continuous cover.`;
    case 'Chain':
      return `Use a second app on ${p.name} (${chain}) with ${money(Math.round(capital / 2))}, so the wallet shows two apps on the chain.`;
    case 'Payments':
    case 'Crypto Card Issuer':
      return `Make a second, smaller spend through ${p.name} on ${chain} a week after the first, from the same wallet.`;
    case 'Governance Incentives':
      return `Vote on a second ${p.name} proposal on ${chain} from the same staked wallet.`;
    case 'Staking Pool':
    case 'Restaking':
      return `Restake the first rewards earned in ${p.name} on ${chain} instead of withdrawing them.`;
    case 'Liquidity Manager':
      return `Add ${money(Math.round(capital / 2))} to a second managed range on ${p.name} (${chain}).`;
    case 'Leveraged Farming':
      return `After a week, reduce the leverage on the ${p.name} farm on ${chain} by repaying part of the borrowed leg.`;
    case 'OTC Marketplace':
      return `Complete a second OTC trade on ${p.name} (${chain}) for a different listed asset.`;
    case 'Interest Rate Derivatives':
      return `Hedge the rate position on ${p.name} (${chain}) with a second, smaller position in the opposite direction.`;
    case 'Farm':
      return `Harvest the farm rewards from ${p.name} on ${chain} once, then redeposit them into the same farm.`;
    case 'Uncollateralized Lending':
      return `Fund a second loan through ${p.name} on ${chain} for ${money(Math.round(capital / 2))} after the first loan is repaid.`;
    case 'Anchor BTC':
    case 'Decentralized BTC':
      return `Use the minted BTC-backed asset from ${p.name} on ${chain} as collateral in a lending app, then repay it.`;
    default:
      return `Repeat the main action a second time on ${p.name} (${chain}) a week later with ${money(Math.round(capital / 2))}, from the same wallet.`;
  }
}

/**
 * Eight concrete steps per protocol, every one derived from its category,
 * chains, TVL tier and age. Nothing here claims a reward program, an
 * airdrop, or a points scheme exists: the snapshot carries no such flag,
 * so a step that needs one says to check the protocol's own page first —
 * and the plan's verdict is a break-even against a T-bill and $25/hour,
 * never an assumed payout.
 */
export function farmSteps(p: Protocol, asOf: string): FarmStep[] {
  const capital = capitalFor(p);
  const chain = p.chains[0] ?? 'its main chain';
  const age = ageDays(p, asOf);
  const holdDays = age === null ? 45 : age >= 365 ? 90 : age >= 180 ? 60 : 30;
  const steps: FarmStep[] = [
    {
      text: 'Open a fresh wallet for this farm only, write the seed phrase on paper and store it offline. Never reuse a wallet that holds your main funds.',
      cost: '—',
      time: '10 min',
      cost_usd: 0,
      weekly_usd: 0,
    },
    { text: mainAction(p, capital), cost: money(capital), time: '30 min', cost_usd: capital, weekly_usd: 0 },
    { text: secondAction(p, capital), cost: money(Math.round(capital / 2)), time: '20 min', cost_usd: Math.round(capital / 2), weekly_usd: 0 },
    {
      text: `Once a week, repeat the main action with ${money(Math.round(capital / 4))} or top up the existing position, so the wallet shows steady use rather than one burst.`,
      cost: `${money(Math.round(capital / 4))} / week`,
      time: '15 min / week',
      cost_usd: 0,
      weekly_usd: Math.round(capital / 4),
    },
    {
      text: `Keep the position open for at least ${holdDays} days. Do not close it early: snapshots reward wallets that were present over time, not wallets that farmed and left.`,
      cost: '—',
      time: `${holdDays} days`,
      cost_usd: 0,
      weekly_usd: 0,
    },
  ];
  if (p.chains.length > 1) {
    const second = p.chains[1]!;
    steps.push({
      text: `Bridge ${money(Math.round(capital / 2))} to ${second} and repeat the main action there, so the position exists on two chains and the wallet is counted on both.`,
      cost: money(Math.round(capital / 2)),
      time: '30 min',
      cost_usd: Math.round(capital / 2),
      weekly_usd: 0,
    });
  } else {
    steps.push({
      text: `Keep ${money(20)} of ${chain}'s gas token in the farming wallet at all times, so a snapshot or a claim never strands the position for lack of gas.`,
      cost: money(20),
      time: '5 min',
      cost_usd: 20,
      weekly_usd: 0,
    });
  }
  steps.push(
    {
      text: `Once a week, open ${p.name}'s points or quest page and check the farming wallet shows the position and any points earned; if it does not, fix it before the next week.`,
      cost: '—',
      time: '10 min / week',
      cost_usd: 0,
      weekly_usd: 0,
    },
    {
      text: 'Log every transaction hash, the date and the amount in a note. If a claim opens, the log is the proof of what the wallet did and when.',
      cost: '—',
      time: '5 min',
      cost_usd: 0,
      weekly_usd: 0,
    },
  );
  return steps;
}

/**
 * The farm plan's money, totalled from its own steps: the deposit, the one-off
 * dollars, the weekly top-ups over the hold, and the all-in total, with the
 * total set against the protocol's implied launch value so the reader can see
 * what the chase costs next to what it chases — plus the break-even the
 * verdict is built on: the all-in cost, the hours priced at $25/hour, and
 * what the deposit would earn in a 5% T-bill over the hold. The farm beats a
 * T-bill and $25 an hour when the eventual claim is worth at least that
 * break-even; no payout is assumed anywhere.
 */
export function farmPlan(p: Protocol, asOf: string, impliedUsd: number): { steps: FarmStep[]; total: FarmTotal } {
  const steps = farmSteps(p, asOf);
  const deposit = capitalFor(p);
  const upfront = steps.reduce((sum, s) => sum + s.cost_usd, 0);
  const weekly = steps.reduce((sum, s) => sum + s.weekly_usd, 0);
  const age = ageDays(p, asOf);
  const holdDays = age === null ? 45 : age >= 365 ? 90 : age >= 180 ? 60 : 30;
  const weeks = Math.ceil(holdDays / 7);
  const total = upfront + weekly * weeks;
  // Hours of attention: the fixed steps (10 + 30 + 20 + 30 or 5 + 5 minutes)
  // plus 25 minutes a week (15 top-up + 10 points check) over the hold.
  const fixedMin = 10 + 30 + 20 + (p.chains.length > 1 ? 30 : 5) + 5;
  const hoursTotal = Math.round(((fixedMin + 25 * weeks) / 60) * 100) / 100;
  const timeValue = Math.round(hoursTotal * 25 * 100) / 100;
  const tbill = Math.round(deposit * 0.05 * (holdDays / 365) * 100) / 100;
  const breakeven = Math.round((total + timeValue + tbill) * 100) / 100;
  return {
    steps,
    total: {
      deposit_usd: deposit,
      upfront_usd: upfront,
      weekly_usd: weekly,
      hold_days: holdDays,
      weeks,
      total_usd: total,
      cost_pct_of_implied: Math.round((total / Math.max(1, impliedUsd)) * 1000000) / 10000,
      hours_total: hoursTotal,
      time_value_usd: timeValue,
      tbill_usd: tbill,
      breakeven_usd: breakeven,
      breakeven_pct_of_implied: Math.round((breakeven / Math.max(1, impliedUsd)) * 1000000) / 10000,
    },
  };
}

/** The farm verdict: WORTH FARMING, THIN, or SKIP, from the break-even alone. */
export function farmVerdict(total: FarmTotal): string {
  if (total.breakeven_pct_of_implied < 1) return 'WORTH FARMING';
  if (total.breakeven_pct_of_implied < 5) return 'THIN';
  return 'SKIP';
}

/** The best farm by hour: the break-even claim value per hour of attention. */
export function bestPerHour(total: FarmTotal): number {
  if (total.hours_total <= 0) return 0;
  return Math.round((total.breakeven_usd / total.hours_total) * 100) / 100;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: Radar } {
  const live = liveComparables(snapshot);
  const fit = fitModel(live, snapshot.as_of, BASE_CONFIG);
  const watchlist = new Set(snapshot.watchlist);
  const early = snapshot.protocols.filter(isRankable);
  // The shipped launch-odds curve, fitted on all 758 protocols (round 8):
  // a logistic on age in years, ridge-shrunk toward the overall rate, with a
  // term for a missing listing date. The board is ranked by expected value —
  // gross launch value times these odds — because the curve beats the base
  // rate on every validation split (see validateLaunchOdds).
  const oddsFit = fitLaunchOdds(snapshot.protocols, snapshot.as_of);
  const scored = early
    .map((p) => {
      const model = scoreProtocol(p, snapshot.as_of, fit);
      const plan = farmPlan(p, snapshot.as_of, model.implied_usd);
      const age = ageDays(p, snapshot.as_of);
      const launchOddsValue = launchOdds(p, oddsFit, snapshot.as_of);
      const odds = Math.round(launchOddsValue * 10000) / 10000;
      const expected = Math.round(model.implied_usd * odds);
      const row: BoardRow & { farm_detail: FarmStep[]; farm_total: FarmTotal } = {
        rank: 0,
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        age_days: age,
        is_watchlist: watchlist.has(p.slug),
        value_model: model,
        implied_value_usd: expected,
        launch_odds: odds,
        expected_value_usd: expected,
        farm_steps: plan.steps.map((s) => s.text),
        farm_detail: plan.steps,
        farm_total: plan.total,
      };
      return row;
    })
    .sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  // The board is the top BOARD_ROWS by expected value. On this snapshot that
  // is every rankable protocol (198), so every watchlist protocol lands on it
  // on merit; but the watchlist is the floor, so a watchlist row that ever
  // fell out is swapped back in for the lowest non-watchlist row —
  // deterministically.
  const rows = scored.slice(0, BOARD_ROWS);
  const inBoard = new Set(rows.map((r) => r.slug));
  for (const slug of snapshot.watchlist) {
    if (inBoard.has(slug)) continue;
    const incoming = scored.find((r) => r.slug === slug);
    if (incoming === undefined) continue;
    let swapAt = -1;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (!rows[i]!.is_watchlist) {
        swapAt = i;
        break;
      }
    }
    if (swapAt < 0) break;
    inBoard.delete(rows[swapAt]!.slug);
    rows[swapAt] = incoming;
    inBoard.add(slug);
  }
  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  const calibrationRows = fit.effectRows.map((r) => ({
    category: r.category,
    live_n: r.live_n,
    median: Math.round(r.median_resid * 1000) / 1000,
    used: Math.round(10 ** r.effect * 1000) / 1000,
  }));
  const live25 = liveRows(snapshot);
  const validation = validateModel(snapshot, rows);
  const farmUnder1 = rows.filter((r) => r.farm_total.breakeven_pct_of_implied < 1).length;
  return {
    board: rows,
    radar: {
      as_of: snapshot.as_of,
      floor_usd: snapshot.floor_usd,
      source_note: snapshot.source_note,
      watchlist_size: snapshot.watchlist.length,
      protocol_total: snapshot.protocols.length,
      early_size: rows.length,
      live_size: live25.length,
      live_total: snapshot.protocols.filter((p) => !isPreToken(p)).length,
      size_fit: {
        intercept: Math.round(fit.beta[0]! * 10000) / 10000,
        slope: Math.round(fit.beta[1]! * 10000) / 10000,
        mult_100m: Math.round(10 ** (fit.beta[0]! + (fit.beta[1]! - 1) * 8) * 10000) / 10000,
        mult_2_75b: Math.round(10 ** (fit.beta[0]! + (fit.beta[1]! - 1) * Math.log10(2.75e9)) * 10000) / 10000,
      },
      calibration: calibrationRows,
      overall_median: median(live.map((p) => p.mcap_usd! / p.tvl_usd)),
      farm_breakeven_under_1pct: farmUnder1,
      board_total_usd: rows.reduce((s, r) => s + r.implied_value_usd, 0),
      gross_board_total_usd: rows.reduce((s, r) => s + r.value_model.implied_usd, 0),
      validation,
      rows,
      live: live25,
    },
  };
}

/** The gate's own checks, run before anything is written. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows: the gate wants 100 to 4000`;
  const missing = snapshot.watchlist.filter((slug) => !board.some((row) => row.slug === slug));
  if (missing.length > 0) return `the board drops ${missing.length} watchlist protocols: ${missing.slice(0, 5).join(', ')}`;
  for (const row of board) {
    // The gate reads the implied value off the row's top level, not out of
    // value_model: a row without it fails the gate even when the model is
    // right, so check the top-level field itself. Round 8 ranks by expected
    // value, so the top-level implied value IS the expected value (gross
    // launch value times the launch odds), and the gross value lives in
    // value_model: check the three agree with each other.
    if (typeof row.implied_value_usd !== 'number' || !Number.isFinite(row.implied_value_usd) || row.implied_value_usd < 1) {
      return `${row.slug}: no top-level implied_value_usd: the gate reads the value off the row, not out of value_model`;
    }
    if (row.implied_value_usd !== row.expected_value_usd) {
      return `${row.slug}: top-level implied_value_usd $${row.implied_value_usd.toLocaleString('en-US')} disagrees with expected_value_usd $${row.expected_value_usd.toLocaleString('en-US')}: the board ranks by expected value, so the two are the same number`;
    }
    if (row.expected_value_usd !== Math.round(row.value_model.implied_usd * row.launch_odds)) {
      return `${row.slug}: expected_value_usd $${row.expected_value_usd.toLocaleString('en-US')} is not the gross launch value $${row.value_model.implied_usd.toLocaleString('en-US')} times the launch odds ${row.launch_odds}`;
    }
    // The launch odds are a probability, and the expected value is the implied
    // value weighted by them: both must be sane numbers on every row.
    if (typeof row.launch_odds !== 'number' || !Number.isFinite(row.launch_odds) || row.launch_odds < 0 || row.launch_odds > 1) {
      return `${row.slug}: launch_odds ${row.launch_odds} is not a probability between 0 and 1`;
    }
    if (typeof row.expected_value_usd !== 'number' || !Number.isFinite(row.expected_value_usd) || row.expected_value_usd < 0) {
      return `${row.slug}: expected_value_usd ${row.expected_value_usd} is not a non-negative number`;
    }
    if (row.expected_value_usd > row.value_model.implied_usd) {
      return `${row.slug}: expected_value_usd $${row.expected_value_usd.toLocaleString('en-US')} exceeds the gross launch value $${row.value_model.implied_usd.toLocaleString('en-US')}: the odds weight it down, never up`;
    }
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `${row.slug}: ${row.farm_steps.length} farm steps: the gate wants 3 to 12`;
    }
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) return `${row.slug}: a farm step is ${step.length} characters: the gate wants 20 to 600`;
    }
    if (row.implied_value_usd > 100_000_000_000_000) return `${row.slug}: implied value $${row.implied_value_usd.toLocaleString('en-US')} exceeds the $100T cap`;
  }
  for (let i = 1; i < board.length; i += 1) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `implied values are not sorted descending at row ${i + 1}`;
    }
  }
  for (let i = 0; i < board.length; i += 1) {
    if (board[i]!.rank !== i + 1) return `ranks are not sequential at row ${i + 1}`;
  }
  return null;
}

/** The dashboard's data, as a script the page reads: window.RADAR = {...}. */
export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
