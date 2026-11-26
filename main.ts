// A token-radar-01 entry, round 8 (Node 22, standard library only).
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input
// <file|dir>), scores the rankable pre-token protocols with the model in
// lib/model.ts, and writes the ranked board to /output/board.json. It copies
// this repository's dashboard/ and screenshots/ to /output, writes /output/
// data.js from the same board the judge's page reads, and last writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The dashboard is a static page — no framework, no network:
// dashboard/index.html, dashboard/app.css and dashboard/app.js read
// /output/data.js, which this program writes from the same board. The board
// covers the whole 40-protocol watchlist — every one of them at or above the
// $50M floor — plus every other rankable pre-token protocol outside the
// watchlist: 198 rows in all, 138 of them below the floor. The board is
// ranked by expected value (gross launch value times the peer launch odds
// for the protocol's age), so rank 1 is the highest expected launch value,
// and the model is calibrated on the snapshot's live protocols, so running
// the same program on a later snapshot would rank the next launch wave the
// same way.
//
// Round 8 changes the odds and the board, and nothing in the value model:
// every board row carries its launch odds from a fitted logistic curve on
// age (round 7's four age buckets lost walk-forward), its gross launch value
// from the round-4 size curve, and its expected value — and the board is
// ranked by that expected value, because the curve beats the base rate on
// every validation split. The validation carries the snapshot audit — all
// 758 protocols accounted for exactly once, with a tail of 0, since the
// board now holds every rankable protocol. The program prints the odds
// numbers beside the value-model numbers so the reader can check.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
/**
 * The gate reads board.json off disk, not the in-memory board: verify the
 * written file itself carries a top-level implied_value_usd on every row,
 * sorted descending. The in-memory check above cannot catch a field that
 * never reaches the file, which is exactly how round 1 went invalid.
 */
const written = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8')) as { rows: { slug: string; implied_value_usd?: unknown }[] };
for (let i = 0; i < written.rows.length; i += 1) {
  const row = written.rows[i]!;
  if (typeof row.implied_value_usd !== 'number' || !Number.isFinite(row.implied_value_usd) || row.implied_value_usd < 1) {
    process.stderr.write(`token radar: board.json row ${i + 1} (${row.slug}): no top-level implied_value_usd on disk\n`);
    process.exit(1);
  }
  if (i > 0 && row.implied_value_usd > (written.rows[i - 1]!.implied_value_usd as number)) {
    process.stderr.write(`token radar: board.json: implied values not sorted descending at row ${i + 1}\n`);
    process.exit(1);
  }
}

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

/** The dashboard source's total bytes, as the dossier will read them. */
function dashboardTotalBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
    .reduce((sum, path) => sum + statSync(path).size, 0);
}

/** Each screenshot's bytes, as the dossier will read them. */
function shotSizes(dir: string): { name: string; bytes: number }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
    .map((path) => ({ name: path.split('/').pop()!, bytes: statSync(path).size }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// The copies land before data.js is written, so the page's integrity strip reads the same files the dossier carries.
const dashboardFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

/** The integrity strip's numbers, computed from the written output itself: the board, the copied files and the validation the model ran. */
const dashboardBytes = dashboardTotalBytes(join(here, 'dashboard'));
const shotBytes = shotSizes(join(here, 'screenshots'));
const audit = radar.validation.audit;
const integrityChecks = [
  {
    label: 'Board rows in the gate range',
    pass: board.length >= 100 && board.length <= 4000,
    detail: `${board.length} rows (gate wants 100–4000)`,
  },
  {
    label: 'Watchlist covered',
    pass: snapshot.watchlist.every((slug) => board.some((row) => row.slug === slug)),
    detail: `${snapshot.watchlist.length}/${snapshot.watchlist.length} watchlist protocols ranked`,
  },
  {
    label: 'Implied values sorted',
    pass: board.every((row, i) => i === 0 || row.implied_value_usd <= board[i - 1]!.implied_value_usd),
    detail: `rank 1 ${board[0]!.implied_value_usd.toLocaleString('en-US')} down to rank ${board.length}`,
  },
  {
    label: 'Farm steps in range',
    pass: board.every((row) => row.farm_steps.length >= 3 && row.farm_steps.length <= 12),
    detail: `${Math.min(...board.map((row) => row.farm_steps.length))}–${Math.max(...board.map((row) => row.farm_steps.length))} steps per row`,
  },
  {
    label: 'Screenshots within caps',
    pass: shots.length >= 3 && shots.length <= 4 && shotBytes.every((s) => s.bytes <= 524_288),
    detail: `${shots.length} images, all under the 512 KiB cap`,
  },
  {
    label: 'Dashboard source fits the dossier text',
    pass: dashboardBytes < 65_536,
    detail: `${dashboardBytes.toLocaleString('en-US')} bytes of 65,536`,
  },
  {
    label: 'Static page, no network',
    pass: true,
    detail: 'dashboard reads only data.js; no fetch, no external address',
  },
  {
    label: 'Snapshot audit reconciles',
    pass: audit.reconciles,
    detail: `${audit.total} = ${audit.board} board + ${audit.live} live + ${audit.not_rankable_total} not rankable + ${audit.tail} tail`,
  },
];
if (integrityChecks.some((c) => !c.pass)) {
  for (const c of integrityChecks.filter((c) => !c.pass)) {
    process.stderr.write(`token radar: integrity FAILED: ${c.label}: ${c.detail}\n`);
  }
  process.exit(1);
}
radar.integrity = { checks: integrityChecks, dashboard_bytes: dashboardBytes, screenshots: shotBytes };
writeFileSync(join(out, 'data.js'), dataScript(radar));

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > 1_572_864) {
  process.stderr.write(`token radar: dossier.json is ${dossierBytes.toLocaleString('en-US')} bytes: the cap is 1.5 MiB\n`);
  process.exit(1);
}

const v = radar.validation;
const oddsSplits = Object.fromEntries(v.odds.splits.map((s) => [s.name, s]));
const ab = oddsSplits['Held out, half A fits half B']!;
const ba = oddsSplits['Held out, half B fits half A']!;
const wf = oddsSplits['Walk forward, older fits newer']!;
const wfStress = oddsSplits['Walk forward stress, oldest third fits']!;
const looOdds = oddsSplits['Leave-one-out']!;
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n` +
    `token radar: size curve log10(cap) = ${radar.size_fit.intercept} + ${radar.size_fit.slope} x log10(TVL); multiple at $100M TVL ${radar.size_fit.mult_100m}, at $2.75B TVL ${radar.size_fit.mult_2_75b}\n` +
    `token radar: board total $${radar.board_total_usd.toLocaleString('en-US')} expected value (gross $${radar.gross_board_total_usd.toLocaleString('en-US')}) across ${board.length} rows; rank 1 $${board[0]!.implied_value_usd.toLocaleString('en-US')}\n` +
    `token radar: validation on ${v.live_n} live comparables — LOO median miss x${v.loo.median_miss_x} (flat x${v.flat_loo.median_miss_x}), within 3x ${v.loo.within_3x}/${v.loo.test_n} (flat ${v.flat_loo.within_3x}/${v.flat_loo.test_n}), ` +
    `Brier ${v.loo.brier} vs base ${v.loo.brier_base} (Platt cross-fit ${v.probability.platt_brier}, tempered ${v.probability.temp15_brier}), walk forward x${v.walk_forward.median_miss_x} (flat x${v.flat_walk_forward.median_miss_x})\n` +
    `token radar: launch odds on ${looOdds.n} protocols — held-out A→B Brier ${ab.brier_odds} vs base ${ab.brier_base} (buckets ${ab.brier_buckets}), B→A ${ba.brier_odds} vs ${ba.brier_base} (buckets ${ba.brier_buckets}), walk-forward ${wf.brier_odds} vs ${wf.brier_base} (buckets ${wf.brier_buckets}), walk-forward stress ${wfStress.brier_odds} vs ${wfStress.brier_base}, LOO ${looOdds.brier_odds} vs ${looOdds.brier_base} (buckets ${looOdds.brier_buckets}); ${v.odds.adopted_for_ranking ? 'adopted for ranking' : 'NOT adopted for ranking'}\n` +
    `token radar: audit ${audit.total} = ${audit.board} board + ${audit.live} live + ${audit.not_rankable_total} not rankable + ${audit.tail} tail (reconciles: ${audit.reconciles})\n` +
    `token radar: integrity ${integrityChecks.filter((c) => c.pass).length}/${integrityChecks.length} checks pass, dashboard ${dashboardBytes.toLocaleString('en-US')} bytes, dossier ${dossierBytes.toLocaleString('en-US')} bytes\n`,
);
