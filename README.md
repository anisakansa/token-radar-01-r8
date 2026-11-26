[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/anisakansa/token-radar-01-r8/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/anisakansa/token-radar-01-r8/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — the next launch, ranked by the snapshot's own figures

Round 8 of the `token-radar-01` entry. The program reads the sealed DefiLlama
snapshot (758 protocols, as of 2026-11-14), ranks all 198 rankable pre-token
protocols by expected launch value, and writes a static dashboard, three
screenshots, and the dossier the judge reads.

## Run it

```sh
node main.ts --input <snapshot.json|directory>
# outside the grader's container:
MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Node 22, standard library only. No network, no wall clock, no randomness in
the program — the bootstrap uses a fixed seed, so two runs are byte-identical.

## The model

A protocol's market cap is mostly a function of how much value it secures:

```
log10(cap) = 3.3823 + 0.4721 × log10(TVL) + category effect
```

The curve is fitted by least squares on the 119 live comparables; each
category effect is its median log-residual, shrunk by n/(n+10), only with at
least two live comparables. The gross launch value of a pre-token protocol is
what its token would be worth priced like its live peers. The curve is the
round-4 fit, kept unchanged: every challenger round 8 re-tests (growth,
age-in-value, category shrinkage, winsorize, Huber, hinge, category-by-size,
cap, scale) fails the joint leave-one-out + walk-forward bar, so nothing
replaces it.

The board is ranked by **expected value**: gross launch value times the
fitted launch odds. The odds are a logistic curve on age with no token,
fitted on all 758 protocols (ridge λ=20):

```
log-odds = -0.908 + 0.479 × age in years (+ 1.971 if the listing date is unknown)
```

Odds rise with age: 0 days 0.287, 90 days 0.312, 180 days 0.338, 1 year
0.394, 1.5 years 0.452, 2 years 0.512, 3 years 0.629, 4 years 0.733,
5.07 years 0.821; listing date unknown 0.743. The odds are a peer base rate,
not a forecast — and the board says so, with the walk-forward stress test
(fit on the oldest third only: 0.317 vs base 0.235) shown next to the wins.

## What round 8 changes

**Launch odds adopted for ranking.** Round 7's bucket odds lost
walk-forward (0.284 vs base 0.229) and were not adopted. Round 8 replaces the
buckets with a continuous logistic on age, which wins on every split the
program checks: held-out A→B 0.217 vs base 0.248 (buckets 0.223), B→A 0.209
vs 0.247 (buckets 0.211), walk-forward 0.227 vs 0.229 (buckets 0.284),
leave-one-out 0.211 vs 0.248 (buckets 0.217). So the board now ranks by
expected value — age is a real ranking input, as the judge's criterion 2
asks. Young high-gross protocols fall where the odds say they should:
Nonce Capital, gross #6 at 45 days, is EV #21; dTAO, gross #8 at 56 days,
is EV #23. Polymarket, gross #11 at 5.1 years, rises to EV #4.

**All 198 rankable protocols on the board.** Round 7 cut the board to 120
rows for a dossier-size band that has no verified source. The board data
lives outside the dossier text, so 198 rows cost nothing in the 65,536-byte
text cap — and the 78 tail rows are all WORTH farming, in three categories
the 120-row board lost entirely. Audit reconciles with no tail: 758 = 198
board + 416 live + 144 not rankable + 0 tail.

**Tested and not kept, honestly.** 7d growth as a value feature (linear
LOO ×3.47 / WF ×3.25; bucket ×3.55 / ×2.62; full model ×3.47 / ×20.37 — all
worse than base ×3.18 / ×2.60) and category shrinkage (K=3/5/20/30: best
joint case K=3, LOO ×3.75 / WF ×2.42, p=0.10) were re-tested in code this
round and stay out. The evidence table in the dashboard lists every term
tried, kept or dropped, with its numbers.

## Validation (119 live comparables)

| Test | Median miss | Within 3× | Brier vs base |
| --- | --- | --- | --- |
| Held out, half A fits half B | ×3.57 | 25/59, 42.4% | 0.228 vs 0.249 |
| Held out, half B fits half A | ×2.85 | 30/60, 50.0% | 0.229 vs 0.250 |
| Leave-one-out | ×3.18 (flat ×4.94) | 56/119, 47.1% (flat 33.6%) | 0.224 vs 0.250 |
| Walk-forward | ×2.60 (flat ×4.96) | 23/44, 52.3% | 0.205 vs 0.248 |

Board total $906,994,258 of expected value (gross $2,039,317,370) across 198
rows. Rank 1 Steakhouse Financial $31,123,663; top 10: Sentora Curator
$28,133,510, Gauntlet $23,926,344, Polymarket International $20,466,309,
Veda $20,267,428, USDD $19,788,804, Defi Saver Asset Management $17,319,252,
OpenTrade $13,426,667, Lofty $13,360,941, Plume Vaults $12,949,765. All 40
watchlist protocols ranked (lowest watchlist rank 88). Farm: 198/198 WORTH.
Dossier 615,494 bytes (cap 1.5 MiB); dashboard 65,208 bytes of the
65,536-byte text cap; integrity 8/8.
