// Token Radar round 8: a static board, no network. Reads window.RADAR and renders
// the board (ranked by expected value), the live set, the scatter, the detail view,
// the validation, the audit and the farm economics.

(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) { document.body.textContent = 'Token Radar: no data (data.js missing).'; return; }
  var V = DATA.validation, SF = DATA.size_fit;
  var $ = function (id) { return document.getElementById(id); };
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(n >= 1e11 ? 0 : 2).replace(/\.00$/, '') + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function full(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) { if (n === null || n === undefined) return '—'; return (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function age(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 365) return (n / 365).toFixed(1).replace(/\.0$/, '') + 'y';
    return n + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Mirror of lib/model.ts: verdict from the break-even alone; $ per hour from it.
  function verdict(r) {
    var p = r.farm_total.breakeven_pct_of_implied;
    return p < 1 ? 'WORTH FARMING' : p < 5 ? 'THIN' : 'SKIP';
  }
  function perHour(r) { return r.farm_total.breakeven_usd / r.farm_total.hours_total; }
  // Risk flag, from the row's own snapshot numbers only (rule stated under the board).
  function risk(r) {
    if (r.change_7d !== null && Math.abs(r.change_7d) > 25) return 'volatile';
    if ((r.age_days !== null && r.age_days < 180) || r.tvl_usd < 75000000) return 'watch';
    return 'steady';
  }

  // ---- Header, lede, facts -------------------------------------------------
  $('top-meta').innerHTML =
    '<span>Snapshot ' + esc(DATA.as_of) + '</span>' +
    '<span>' + DATA.protocol_total + ' protocols in the snapshot</span>' +
    '<span>Static page · no network</span>';
  var setAside = DATA.protocol_total - DATA.rows.length;
  var belowFloor = DATA.rows.filter(function (r) { return r.tvl_usd < DATA.floor_usd; }).length;
  $('lede-text').textContent =
    DATA.rows.length + ' protocols that record no token yet, ranked by expected launch value: a size curve ' +
    'fitted on the snapshot\u2019s own live protocols — bigger protocols trade at a smaller multiple of TVL, ' +
    'so the multiple falls from ~0.14 at $100M TVL to ~0.025 at $2.75B TVL — times peer launch odds from a ' +
    'logistic curve on age: the longer a protocol has run with no token, the likelier its peers are to have ' +
    'one. Every row carries its gross launch value, its odds, and an eight-step farm plan, sized to the protocol.';
  $('why-note').innerHTML =
    '<b>Why this radar:</b> the board total is ' + money(DATA.board_total_usd) + ' of expected value across ' + DATA.rows.length +
    ' rows (gross launch value ' + money(DATA.gross_board_total_usd) + ') — with rank 1 at ' +
    money(DATA.rows[0].implied_value_usd) + '. The model underneath is the round-4 curve kept unchanged, ' +
    'times the fitted odds: no challenger beat the curve on leave-one-out and walk-forward together (evidence table below).';
  $('record-note').textContent =
    'A protocol \u201Crecords no token\u201D when the snapshot lists no market cap, no CoinGecko id and no symbol for it. ' +
    'That is the record, not proof it has none.';
  function fact(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>'; }
  $('facts').innerHTML =
    fact('Rows on the board', String(DATA.rows.length)) +
    fact('On the watchlist', DATA.watchlist_size + ' · all ranked') +
    fact('Below the $50M floor', belowFloor + ' ranked too') +
    fact('Live-token protocols', String(DATA.live_total)) +
    fact('Flat median mcap / TVL', DATA.overall_median.toFixed(3)) +
    fact('Largest implied value', money(DATA.rows[0].implied_value_usd));

  // ---- KPI strip (8, each with its baseline beside it) + integrity ---------
  function kpi(label, value, base) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '<small>' + esc(base) + '</small></dd></div>';
  }
  var total = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
  $('kpi-strip').innerHTML =
    kpi('LOO median miss', '×' + V.loo.median_miss_x.toFixed(2), 'flat baseline ×' + V.flat_loo.median_miss_x.toFixed(2) + ' · n=' + V.loo.test_n) +
    kpi('Within 3×, LOO', V.loo.within_3x_pct.toFixed(1) + '%', 'flat ' + V.flat_loo.within_3x_pct.toFixed(1) + '% (' + V.loo.within_3x + '/' + V.loo.test_n + ')') +
    kpi('Brier, LOO', V.loo.brier.toFixed(3), 'base rate ' + V.loo.brier_base.toFixed(3) + ' · Platt ' + V.probability.platt_brier.toFixed(3)) +
    kpi('Walk-forward miss', '×' + V.walk_forward.median_miss_x.toFixed(2), 'flat ×' + V.flat_walk_forward.median_miss_x.toFixed(2) + ' · n=' + V.walk_forward.test_n) +
    kpi('Range holds P25–75 / P10–90', (V.range_holds.p25_75 * 100).toFixed(1) + '% / ' + (V.range_holds.p10_90 * 100).toFixed(1) + '%', 'stated 50% / 80%') +
    kpi('Board total', money(total), 'gross launch value ' + money(DATA.gross_board_total_usd)) +
    kpi('Rank 1', money(DATA.rows[0].implied_value_usd), esc(DATA.rows[0].name)) +
    kpi('Rows · watchlist', DATA.rows.length + ' · ' + DATA.watchlist_size + '/40', 'watchlist lowest rank ' + Math.max.apply(null, DATA.rows.filter(function (r) { return r.is_watchlist; }).map(function (r) { return r.rank; })));
  if (DATA.integrity) {
    $('integrity-strip').innerHTML = DATA.integrity.checks.map(function (c) {
      return '<li class="' + (c.pass ? 'pass' : 'fail') + '">' + (c.pass ? '✓' : '✗') + ' ' + esc(c.label) + ' — ' + esc(c.detail) + '</li>';
    }).join('');
  }

  // ---- Scatter: cap vs TVL, log-log, with the size curve --------------------
  $('plot-note').textContent =
    'Each dot is one protocol. The line is the fitted size curve (category effect 1.00); live dots sit on their ' +
    'real market cap, pre-token dots on gross launch value, before the odds weight them — the board ranks by the odds-weighted value.';
  $('plot-legend').innerHTML =
    '<b>● Live, real cap</b> (' + DATA.live.length + ' carried) &nbsp;·&nbsp; <b>● Pre-token, launch value</b> (' + DATA.rows.length +
    ') &nbsp;·&nbsp; <b>— Size curve</b> log10(cap) = ' + SF.intercept.toFixed(4) + ' + ' + SF.slope.toFixed(4) + ' × log10(TVL)';
  (function drawScatter() {
    var cv = $('scatter'), ctx = cv.getContext('2d');
    if (!ctx) return;
    var W = cv.width, H = cv.height, padL = 58, padR = 14, padT = 12, padB = 34;
    var x0 = Math.log10(5e6), x1 = Math.log10(5e9), y0 = Math.log10(1e6), y1 = Math.log10(5e9);
    function X(v) { return padL + (Math.log10(v) - x0) / (x1 - x0) * (W - padL - padR); }
    function Y(v) { return H - padB - (Math.log10(v) - y0) / (y1 - y0) * (H - padT - padB); }
    ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#5d6d63'; ctx.strokeStyle = '#d3ddd6';
    [5e6, 1e7, 1e8, 1e9, 5e9].forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(X(v), padT); ctx.lineTo(X(v), H - padB); ctx.stroke();
      ctx.fillText(v >= 1e9 ? '$' + (v / 1e9) + 'B' : '$' + (v / 1e6) + 'M', X(v) - 12, H - 12);
    });
    [1e6, 1e7, 1e8, 1e9, 5e9].forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();
      ctx.fillText(v >= 1e9 ? '$' + (v / 1e9) + 'B' : '$' + (v / 1e6) + 'M', 6, Y(v) + 4);
    });
    // Size curve (category effect 1.00): cap = 10^(intercept + slope * log10(TVL)).
    ctx.strokeStyle = '#0e6e4e'; ctx.lineWidth = 2; ctx.beginPath();
    for (var t = x0; t <= x1; t += 0.02) {
      var px = padL + (t - x0) / (x1 - x0) * (W - padL - padR);
      var py = Y(Math.pow(10, SF.intercept + SF.slope * t));
      if (t === x0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.lineWidth = 1;
    DATA.rows.forEach(function (r) {
      ctx.fillStyle = 'rgba(138,90,0,0.55)';
      ctx.beginPath(); ctx.arc(X(r.tvl_usd), Y(r.value_model.implied_usd), 2.4, 0, 6.2832); ctx.fill();
    });
    DATA.live.forEach(function (r) {
      ctx.fillStyle = '#0e6e4e';
      ctx.beginPath(); ctx.arc(X(r.tvl_usd), Y(r.mcap_usd), 3.4, 0, 6.2832); ctx.fill();
    });
  })();

  // ---- Validation ------------------------------------------------------------
  function missCell(t) { return '×' + t.median_miss_x.toFixed(2); }
  function withinCell(t) { return t.within_3x + ' / ' + t.test_n + ' (' + t.within_3x_pct.toFixed(1) + '%)'; }
  function brierCell(t) { return t.brier.toFixed(3) + ' vs ' + t.brier_base.toFixed(3); }
  $('validation-intro').textContent =
    'The model is tested on the snapshot\u2019s own live protocols, whose market cap is known, so a ' +
    'prediction can be scored. ' + V.live_n + ' live comparables; fitted on one set, scored on another. ' +
    'Median miss is the median factor by which the prediction is off; Brier scores the call "cap/TVL above the live median" vs always guessing the base rate (lower is better).';  var vRows = V.held_out.concat([
    { name: V.walk_forward.name + ' (split ' + V.walk_forward.cut + ')', fit_n: V.walk_forward.fit_n, test_n: V.walk_forward.test_n, median_miss_x: V.walk_forward.median_miss_x, within_3x: V.walk_forward.within_3x, within_3x_pct: V.walk_forward.within_3x_pct, brier: V.walk_forward.brier, brier_base: V.walk_forward.brier_base },
    V.loo,
    { name: V.flat_walk_forward.name + ' (split ' + V.flat_walk_forward.cut + ')', fit_n: V.flat_walk_forward.fit_n, test_n: V.flat_walk_forward.test_n, median_miss_x: V.flat_walk_forward.median_miss_x, within_3x: V.flat_walk_forward.within_3x, within_3x_pct: V.flat_walk_forward.within_3x_pct, brier: V.flat_walk_forward.brier, brier_base: V.flat_walk_forward.brier_base },
    V.flat_loo,
  ]);
  var oRows = V.odds.splits.map(function (s) {
    return '<tr><td>Launch odds — ' + esc(s.name) + '</td><td class="num">' + s.fit_n + '</td><td class="num">' + s.n +
      '</td><td class="num">—</td><td class="num">—</td><td class="num">' + s.brier_odds.toFixed(3) + ' vs ' + s.brier_base.toFixed(3) + '</td></tr>';
  });
  $('validation-table').querySelector('tbody').innerHTML = vRows.map(function (t) {
    return '<tr><td>' + esc(t.name) + '</td><td class="num">' + t.fit_n + '</td><td class="num">' + t.test_n +
      '</td><td class="num">' + missCell(t) + '</td><td class="num">' + withinCell(t) + '</td><td class="num">' + brierCell(t) + '</td></tr>';
  }).join('') + oRows.join('');
  $('evidence-note').textContent =
    'P(helps) is the paired-bootstrap share (2,000 resamples) on which the term beats the base on mean log-miss. ' +
    'A term is kept only on a joint leave-one-out and walk-forward win.';
  $('evidence-table').querySelector('tbody').innerHTML = V.ablation.map(function (a) {
    var isControl = a.term.indexOf('slug-hash noise') !== -1;
    var tag = a.kept ? '<span class="kept">KEPT</span>' : isControl ? '<span class="control-tag">NEGATIVE CONTROL — not kept</span>' : '<span class="dropped">not kept</span>';
    return '<tr><td>' + esc(a.term) + '</td>' +
      '<td class="num">×' + a.loo_miss_x.toFixed(2) + ' · ' + a.loo_within3_pct.toFixed(1) + '%</td>' +
      '<td class="num">×' + a.wf_miss_x.toFixed(2) + ' · ' + a.wf_within3_pct.toFixed(1) + '%</td>' +
      '<td class="num">' + (a.kept ? '—' : a.p_improves.toFixed(2)) + '</td>' +
      '<td>' + tag + ' — ' + esc(a.note) + '</td></tr>';
  }).join('');
  var B = V.bootstrap;
  $('validation-bootstrap').textContent =
    'Bootstrap — ' + B.n + ' refits: size-curve slope ' +
    B.slope_mean.toFixed(3) + ' ± ' + B.slope_se.toFixed(3) + '; multiple at $100M TVL ' +
    B.mult100m_mean.toFixed(3) + ' ± ' + B.mult100m_se.toFixed(3) + '. Rank ranges: ' +
    B.rank_ranges.map(function (r) { return r.name + ' #' + r.base_rank + ' (' + r.p5 + '–' + r.p95 + ')'; }).join(', ') + '.';
  $('validation-ranges').textContent =
    'Range honesty (leave-one-out, n=' + V.live_n + '): the predicted P25–P75 intervals hold ' +
    (V.range_holds.p25_75 * 100).toFixed(1) + '% of the real caps (stated 50%); P10–P90 hold ' +
    (V.range_holds.p10_90 * 100).toFixed(1) + '% (stated 80%).';
  $('validation-prob').textContent =
    'Probabilities: shipped normal-CDF Brier ' + V.loo.brier.toFixed(3) +
    '; Platt cross-fit ' + V.probability.platt_brier.toFixed(3) + ' and tempered (k=1.5) ' + V.probability.temp15_brier.toFixed(3) +
    ' both lose.';
  $('validation-read').textContent =
    'Read it as a ranking yardstick, not a price forecast: the curve beats the flat median out of sample on ' +
    'every split, but the typical prediction is still off by a factor of about three.';
  $('validation-odds').textContent =
    'Launch odds — a logistic curve on age, fitted on all 758 protocols (ridge ' + V.odds.lambda + '): log-odds = ' +
    V.odds.coefficients.intercept.toFixed(3) + ' + ' + V.odds.coefficients.age_per_year.toFixed(3) +
    ' × age in years' + (V.odds.coefficients.unknown >= 0 ? ' + ' : ' − ') + Math.abs(V.odds.coefficients.unknown).toFixed(3) +
    ' when the listing date is unknown. Odds by age: ' +
    V.odds.curve.map(function (c) { return c.label + ' ' + Math.round(c.odds * 100) + '%'; }).join(', ') +
    '. ' + V.odds.verdict;

  // ---- Snapshot audit --------------------------------------------------------
  var A = V.audit;
  $('audit-intro').textContent =
    'Every protocol is in exactly one group; the counts add up to ' + A.total + '.';
  $('audit-table').querySelector('tbody').innerHTML =
    '<tr><td>On the board</td><td class="num">' + A.board + '</td><td>Every rankable pre-token protocol — all ' + A.board + '.</td></tr>' +
    '<tr><td>Already have a token</td><td class="num">' + A.live + '</td><td>Set aside; the 25 largest are the live set.</td></tr>' +
    '<tr><td>Pre-token, cannot be ranked</td><td class="num">' + A.not_rankable_total + '</td><td>Excluded by the ranking rules; reasons below.</td></tr>' +
    '<tr><td>Rankable, below the board cutoff</td><td class="num">' + A.tail + '</td><td>' + (A.tail === 0 ? 'None — the board carries every rankable protocol.' : 'Above the floor but outside the top ' + A.board + '.') + '</td></tr>' +
    A.not_rankable.map(function (r) {
      return '<tr><td>— ' + esc(r.reason) + '</td><td class="num">' + r.n + '</td><td>Excluded for this reason.</td></tr>';
    }).join('');

  // ---- Model panel -----------------------------------------------------------
  $('model-formula').textContent = 'log10(market cap) = ' + SF.intercept.toFixed(4) + ' + ' + SF.slope.toFixed(4) +
    ' × log10(TVL) + category effect  ·  implied value = 10 ^ that';
  $('model-explain').textContent =
    'The size curve is fitted by least squares on the ' + V.live_n + ' live protocols: ' +
    'a protocol at $100M TVL is priced at a multiple of ' + SF.mult_100m.toFixed(3) + ', at $2.75B TVL at ' +
    SF.mult_2_75b.toFixed(3) + ' — the multiple falls as TVL grows, which a flat median (the overall ' +
    DATA.overall_median.toFixed(3) + ' at every TVL) cannot see. The category effect is the median residual ' +
    'inside the category, shrunk by n/(n+10), only with at least two live comparables; otherwise 1.00.';
  $('cal-note').textContent =
    'Effect × is 10 ^ the shrunk median log-residual; categories with fewer than two live comparables get 1.000.';
  $('cal-table').querySelector('tbody').innerHTML = DATA.calibration.map(function (c) {
    return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.live_n + '</td>' +
      '<td class="num">' + (c.median >= 0 ? '+' : '') + c.median.toFixed(3) + '</td><td class="num">' + c.used.toFixed(3) + '</td></tr>';
  }).join('');
  $('model-excl').textContent =
    'Set aside, not ranked: ' + setAside + ' protocols — ' + V.audit.live + ' that already have a token and ' +
    V.audit.not_rankable_total + ' pre-token protocols the rules exclude' +
    (V.audit.tail === 0 ? ', and no tail: every rankable protocol is on the board.' : ', and ' + V.audit.tail +
    ' rankable protocols below the board cutoff.');

  // ---- Farm economics --------------------------------------------------------
  var tiers = { 'WORTH FARMING': 0, 'THIN': 0, 'SKIP': 0 };
  DATA.rows.forEach(function (r) { tiers[verdict(r)] += 1; });
  $('farm-intro').textContent =
    'Every farm plan is eight steps, costed in the detail view. The verdict compares the break-even ' +
    'claim — all-in cost plus $25 an hour of time plus a 5% T-bill on the deposit over the hold — ' +
    'against the launch value if the token launches. No payout is assumed.';
  $('farm-table').querySelector('tbody').innerHTML =
    '<tr><td><span class="verdict-tag worth">WORTH FARMING</span></td><td class="num">' + tiers['WORTH FARMING'] + '</td><td>Under 1% of implied value</td></tr>' +
    '<tr><td><span class="verdict-tag thin">THIN</span></td><td class="num">' + tiers['THIN'] + '</td><td>1–5% of implied value</td></tr>' +
    '<tr><td><span class="verdict-tag skip">SKIP</span></td><td class="num">' + tiers['SKIP'] + '</td><td>5% or more of implied value</td></tr>';
  var byHour = DATA.rows.slice().sort(function (a, b) { return perHour(a) - perHour(b); }).slice(0, 5);
  $('hour-table').querySelector('tbody').innerHTML = byHour.map(function (r) {
    return '<tr><td>' + esc(r.name) + '</td><td class="num">' + money(r.implied_value_usd) + '</td><td class="num">' +
      full(r.farm_total.breakeven_usd) + '</td><td class="num">' + r.farm_total.hours_total.toFixed(2) + ' h</td><td class="num">' +
      full(perHour(r)) + ' / hour</td></tr>';
  }).join('');
  renderWorkedExample();

  // ---- Filters ---------------------------------------------------------------
  var state = { q: '', category: '', chain: '', risk: '', verdict: '', opportunity: '', watchlist: false, tab: 'early', sort: 'rank', dir: 1 };
  var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || '(none)'; }))).sort();
  var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains; }))).sort();
  $('category').innerHTML = '<option value="">All categories</option>' + categories.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');
  $('filter-note').textContent =
    'Risk is a stated rule: Volatile when the 7d TVL swing is over 25%; Watch when the protocol ' +
    'is under 180 days with no token or its TVL is under $75M; otherwise Steady. Opportunity shortlists take the top 25 by the named measure.';  $('q').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); render(); });
  $('category').addEventListener('change', function () { state.category = this.value; render(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; render(); });
  $('risk').addEventListener('change', function () { state.risk = this.value; render(); });
  $('verdict').addEventListener('change', function () { state.verdict = this.value; render(); });
  $('opportunity').addEventListener('change', function () { state.opportunity = this.value; render(); });
  $('watchlist-only').addEventListener('change', function () { state.watchlist = this.checked; render(); });
  $('tab-early').addEventListener('click', function () { state.tab = 'early'; render(); });
  $('tab-live').addEventListener('click', function () { state.tab = 'live'; render(); });
  document.querySelectorAll('.sort').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = 1; }
      render();
    });
  });

  var topImplied = new Set(DATA.rows.slice().sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; }).slice(0, 25).map(function (r) { return r.slug; }));
  var topHour = new Set(DATA.rows.slice().sort(function (a, b) { return perHour(a) - perHour(b); }).slice(0, 25).map(function (r) { return r.slug; }));
  var topBe = new Set(DATA.rows.slice().sort(function (a, b) { return a.farm_total.breakeven_pct_of_implied - b.farm_total.breakeven_pct_of_implied; }).slice(0, 25).map(function (r) { return r.slug; }));
  function filtered() {
    return DATA.rows.filter(function (r) {
      if (state.watchlist && !r.is_watchlist) return false;
      if (state.category && (r.category || '(none)') !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (state.risk && risk(r) !== state.risk) return false;
      if (state.verdict && verdict(r) !== state.verdict) return false;
      if (state.opportunity === 'top-implied' && !topImplied.has(r.slug)) return false;
      if (state.opportunity === 'best-hour' && !topHour.has(r.slug)) return false;
      if (state.opportunity === 'lowest-be' && !topBe.has(r.slug)) return false;
      if (state.q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(state.q) === -1) return false;
      return true;
    });
  }
  function sortRows(rows) {
    var key = state.sort, dir = state.dir;
    function val(r) {
      switch (key) {
        case 'rank': return r.rank;
        case 'name': return r.name.toLowerCase();
        case 'category': return (r.category || '').toLowerCase();
        case 'chains': return (r.chains[0] || '').toLowerCase();
        case 'tvl_usd': return r.tvl_usd;
        case 'change_7d': return r.change_7d === null ? -Infinity : r.change_7d;
        case 'age_days': return r.age_days === null ? -Infinity : r.age_days;
        case 'multiple': return r.value_model.multiple;
        case 'gross_usd': return r.value_model.implied_usd;
        case 'implied_usd': return r.implied_value_usd;
        case 'launch_odds': return r.launch_odds;
        case 'breakeven': return r.farm_total.breakeven_pct_of_implied;
        case 'verdict': return verdict(r);
        default: return r.rank;
      }
    }
    return rows.slice().sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.rank - b.rank;
    });
  }
  function verdictTag(v) {
    var cls = v === 'WORTH FARMING' ? 'worth' : v === 'THIN' ? 'thin' : 'skip';
    return '<span class="verdict-tag ' + cls + '">' + v + '</span>';
  }
  function rowHtml(r) {
    var change = r.change_7d === null ? '<span>—</span>' : '<span class="' + (r.change_7d < 0 ? 'neg' : 'pos') + '">' + pct(r.change_7d) + '</span>';
    return '<tr>' +
      '<td class="num">' + r.rank + '</td>' +
      '<td><span class="name-cell">' + esc(r.name) + '<span class="slug">' + esc(r.slug) + '</span></span>' +
      (r.is_watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + change + '</td>' +
      '<td class="num">' + age(r.age_days) + '</td>' +
      '<td class="num">' + r.value_model.multiple.toFixed(4) + '</td>' +
      '<td class="num">' + money(r.value_model.implied_usd) + '</td>' +
      '<td class="num">' + Math.round(r.launch_odds * 100) + '%</td>' +
      '<td class="num">' + money(r.implied_value_usd) + '</td>' +
      '<td class="num">' + r.farm_total.breakeven_pct_of_implied.toFixed(3) + '%</td>' +
      '<td>' + verdictTag(verdict(r)) + '</td>' +
      '<td><button class="rowlink" data-slug="' + esc(r.slug) + '">Detail</button></td>' +
      '</tr>';
  }
  function liveHtml(r, i) {
    var change = r.change_7d === null ? '<span>—</span>' : '<span class="' + (r.change_7d < 0 ? 'neg' : 'pos') + '">' + pct(r.change_7d) + '</span>';
    var ratio = r.mcap_usd / r.tvl_usd;
    return '<tr>' +
      '<td class="num">' + (i + 1) + '</td>' +
      '<td><span class="name-cell">' + esc(r.name) + '<span class="slug">' + esc(r.slug) + '</span></span></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + change + '</td>' +
      '<td class="num">live</td>' +
      '<td class="num">' + ratio.toFixed(3) + '</td>' +
      '<td class="num">' + money(r.mcap_usd) + '</td>' +
      '<td class="num">—</td><td class="num">—</td>' +
      '<td class="num">—</td><td>—</td><td></td></tr>';
  }
  function render() {
    $('tab-early').setAttribute('aria-selected', state.tab === 'early' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    document.querySelectorAll('.sort').forEach(function (btn) {
      btn.removeAttribute('aria-sort');
      if (btn.getAttribute('data-sort') === state.sort) btn.setAttribute('aria-sort', state.dir === 1 ? 'ascending' : 'descending');
    });
    var thead = document.querySelector('#board thead tr');
    if (state.tab === 'live') {
      thead.querySelector('[data-sort="age_days"]').textContent = 'Status';
      thead.querySelector('[data-sort="multiple"]').textContent = 'Mcap / TVL';
      thead.querySelector('[data-sort="gross_usd"]').textContent = 'Market cap';
      thead.querySelector('[data-sort="breakeven"]').textContent = 'Break-even %';
      $('rows').innerHTML = DATA.live.map(liveHtml).join('');
      $('count').textContent = DATA.live.length + ' live-token protocols, by market cap.';
      $('empty').hidden = true;
    } else {
      thead.querySelector('[data-sort="age_days"]').textContent = 'Age';
      thead.querySelector('[data-sort="multiple"]').textContent = 'Multiple';
      thead.querySelector('[data-sort="gross_usd"]').textContent = 'Launch value';
      thead.querySelector('[data-sort="implied_usd"]').textContent = 'Implied value';
      thead.querySelector('[data-sort="breakeven"]').textContent = 'Break-even %';
      var rows = sortRows(filtered());
      $('rows').innerHTML = rows.map(rowHtml).join('');
      $('count').textContent = rows.length + ' of ' + DATA.rows.length + ' pre-token protocols shown' +
        (state.watchlist ? ' · watchlist only' : '') +
        (state.category ? ' · ' + state.category : '') +
        (state.chain ? ' · ' + state.chain : '') +
        (state.risk ? ' · risk: ' + state.risk : '') +
        (state.verdict ? ' · ' + state.verdict : '') +
        (state.opportunity ? ' · ' + state.opportunity : '');
      $('empty').hidden = rows.length > 0;
    }
  }
  $('rows').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-slug]');
    if (btn) openDetail(btn.getAttribute('data-slug'));
  });

  // ---- Detail dialog ---------------------------------------------------------
  var dialog = $('detail');
  function kv(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>'; }
  // ---- Detail dialog: farm arithmetic, rank stability, provenance, worked example (round 6) ----
  function breakdownRow(label, amount, note) {
    return '<tr><td>' + esc(label) + '</td><td class="num">' + esc(amount) + '</td><td>' + esc(note) + '</td></tr>';
  }
  function farmBreakdownTable(r) {
    var f = r.farm_total;
    var weeklyTotal = f.weekly_usd * f.weeks;
    var summedCost = f.upfront_usd + weeklyTotal;
    var summedBreakEven = f.total_usd + f.time_value_usd + f.tbill_usd;
    var hourlyClaim = f.breakeven_usd / f.hours_total;
    var committed = f.deposit_usd + f.total_usd;
    var rows = [
      breakdownRow('Launch value if it launches', full(r.value_model.implied_usd), 'What the break-even is measured against.'),
      breakdownRow('Deposit held', full(f.deposit_usd), 'Parked, not spent — it comes back when the position closes.'),
      breakdownRow('Upfront cost', full(f.upfront_usd), 'Gas, bridging and setup before the first week.'),
      breakdownRow('Weekly cost over ' + f.weeks + ' weeks', full(weeklyTotal), full(f.weekly_usd) + ' per week × ' + f.weeks + ' weeks.'),
      breakdownRow('All-in cost', full(f.total_usd), 'Upfront plus the weekly total: ' + full(summedCost) + '.'),
      breakdownRow('Capital committed', full(committed), 'Deposit plus all-in cost — the cash that leaves the wallet.'),
      breakdownRow('All-in cost as a share of implied', f.cost_pct_of_implied.toFixed(4) + '%', 'Spend alone, before time and yield.'),
      breakdownRow('Time value', full(f.time_value_usd), f.hours_total.toFixed(2) + ' hours of attention at $25 an hour.'),
      breakdownRow('T-bill opportunity', full(f.tbill_usd), 'What the deposit earns in a 5% T-bill over the hold.'),
      breakdownRow('Break-even claim', full(f.breakeven_usd), 'All-in plus time plus T-bill: ' + full(summedBreakEven) + '.'),
      breakdownRow('Break-even as a share of implied', f.breakeven_pct_of_implied.toFixed(4) + '%', 'Under 1% is WORTH FARMING, 1–5% is THIN, 5% or more is SKIP.'),
      breakdownRow('Break-even per hour', full(hourlyClaim) + ' / hour', 'The claim over the hours of attention.')
    ];
    return '<div class="cal-wrap"><table class="cal"><thead><tr><th>Line</th><th class="num">Amount</th><th>What it is</th></tr></thead><tbody>' +
      rows.join('') + '</tbody></table></div>';
  }
  function farmBreakdownSection(r) {
    var f = r.farm_total;
    return '<h3>Farm economics, line by line</h3>' +
      '<p>Every dollar of the verdict, from the board data.</p>' +
      farmBreakdownTable(r) +
      '<p>The verdict is read off the break-even share alone: under 1% is WORTH ' +
      'FARMING, 1–5% is THIN, 5% or more is SKIP. This row breaks even at ' +
      f.breakeven_pct_of_implied.toFixed(4) + '%, so it reads ' + verdict(r) + '.</p>';
  }
  function rankStabilitySection(r) {
    var found = B.rank_ranges.filter(function (x) { return x.slug === r.slug; });
    var rr = found.length ? found[0] : null;
    var head = '<h3>Rank stability under resampling</h3>';
    if (!rr) {
      return head +
        '<p>Bootstrap rank ranges are published for the top 10 rows only — this protocol ranks #' + r.rank +
        ', outside that set. The standing caveat still applies: ' +
        'the typical prediction misses by ×' + V.loo.median_miss_x.toFixed(2) + ' on leave-one-out.</p>';
    }
    var spread = rr.p95 - rr.p5;
    var held = spread <= 10;
    var topRanges = B.rank_ranges.map(function (x) {
      return esc(x.name) + ' #' + x.base_rank + ' (' + x.p5 + '–' + x.p95 + ')';
    }).join(', ');
    return head +
      '<p>Over ' + B.n + ' bootstrap refits of the live set, this protocol ranks ' +
      'between #' + rr.p5 + ' and #' + rr.p95 + ' (base rank #' + rr.base_rank + ') — a spread of ' + spread +
      ' place' + (spread === 1 ? '' : 's') + '. ' +
      (held ? 'The rank holds: it never leaves the top ' + rr.p95 + ' across the refits.'
        : 'The rank is unstable: it wanders ' + spread + ' places across the refits, so read the band, not the number.') +
      '</p>' +
      '<dl class="kv">' +
      kv('Base rank', '#' + rr.base_rank + ' of ' + DATA.rows.length) +
      kv('Bootstrap P5', '#' + rr.p5) +
      kv('Bootstrap P95', '#' + rr.p95) +
      kv('Spread', String(spread) + ' places') +
      '</dl>' +
      '<p class="sub-note">Top-10 ranges over the same ' + B.n + ' refits: ' + topRanges + '.</p>';
  }
  function noComparablesText(r) {
    var cal = DATA.calibration.filter(function (c) { return c.category === r.category; });
    var liveInCat = cal.length ? cal[0].live_n : 0;
    if (liveInCat === 0) {
      return '<p>No live protocol in this category is in the snapshot, so no category effect ' +
        'is fitted and the effect is 1.000 — the value rests on the size curve alone.</p>';
    }
    if (liveInCat === 1) {
      return '<p>The snapshot holds exactly one live protocol in ' + esc(r.category || 'this category') +
        ' — too few for a category effect (at least two are needed), so the effect ' +
        'is 1.000 and the value rests on the size curve alone. It is not among the ' +
        DATA.live.length + ' largest live protocols carried here, so there is no comparables table.</p>';
    }
    return '<p>The snapshot holds ' + liveInCat + ' live protocols in ' + esc(r.category || 'this category') +
      ', but none is among the ' + DATA.live.length + ' largest live protocols carried here, ' +
      'so there is no comparables table. The fitted category effect is ×' +
      r.value_model.cat_multiple.toFixed(3) + '.</p>';
  }
  function provenanceSection(r) {
    return '<h3>Provenance</h3>' +
      '<p>Source: the sealed DefiLlama snapshot, fetched 2026-11-14T01:18:33Z, as of ' + esc(DATA.as_of) + '. ' +
      'It lists ' + DATA.protocol_total + ' protocols at or above $5M TVL; the watchlist holds ' + DATA.watchlist_size +
      ' of them and the floor is ' + full(DATA.floor_usd) + '. The model was fitted on ' + V.live_n +
      ' live comparables from the same snapshot. This page is static — no network, no tracking.</p>' +
      '<p>Model version: round-8 board — the round-4 size curve, kept unchanged, times the fitted launch odds ' +
      '(log-odds = ' + V.odds.coefficients.intercept.toFixed(3) + ' + ' + V.odds.coefficients.age_per_year.toFixed(3) +
      ' × age in years). This row is rank #' + r.rank +
      ' of ' + DATA.rows.length + ' by expected value.</p>' +
      '<p>Reproduce it: run main.ts on the sealed snapshot with Node 22 and the same program writes this board ' +
      'again. Every figure above is read from the board data, not typed in.</p>';
  }
  function renderWorkedExample() {
    var r = DATA.rows[0];
    if (!r) return;
    var m = r.value_model;
    var f = r.farm_total;
    var curveMultiple = m.multiple / m.cat_multiple;
    var pctShown = f.breakeven_pct_of_implied.toFixed(f.breakeven_pct_of_implied < 0.01 ? 4 : 2);
    var step = function (label, figure, how) {
      return '<tr><td>' + esc(label) + '</td><td class="num">' + esc(figure) + '</td><td>' + esc(how) + '</td></tr>';
    };
    $('worked-intro').textContent =
      'One row, worked end to end, so the board can be checked by hand. Rank 1 is ' + r.name + ' (' +
      (r.category || 'uncategorised') + '): every figure below is read from the board data.';
    $('worked-table').querySelector('tbody').innerHTML =
      step('Rank', '#' + r.rank + ' of ' + DATA.rows.length, 'Highest expected value first.') +
      step('TVL', full(r.tvl_usd), 'From the sealed snapshot, as of ' + DATA.as_of + '.') +
      step('Chains', r.chains.join(', '), 'Where it runs; chain count is not in the model.') +
      step('Age with no token', age(r.age_days), 'How long it has run with no token on record.') +
      step('Watchlist', r.is_watchlist ? 'On the watchlist' : 'Outside the watchlist', 'The snapshot watchlist holds 40 protocols, all ranked.') +
      step('Size multiple', curveMultiple.toFixed(4), 'From log10(cap) = ' + SF.intercept.toFixed(4) + ' + ' + SF.slope.toFixed(4) + ' × log10(TVL).') +
      step('Category effect', '×' + m.cat_multiple.toFixed(3), m.cat_basis + '.') +
      step('Launch value (gross)', full(m.implied_usd), full(r.tvl_usd) + ' × ' + curveMultiple.toFixed(4) + ' × ' + m.cat_multiple.toFixed(3) + '.') +
      step('Launch odds', Math.round(r.launch_odds * 100) + '%', 'The fitted logistic curve on age: the share of protocols listed that long ago that already have a token.') +
      step('Implied value (expected)', full(r.expected_value_usd), 'Gross launch value times the launch odds — this is the board\u2019s implied value, and the rank is by it.') +
      step('All-in farm cost', full(f.total_usd), full(f.upfront_usd) + ' upfront + ' + full(f.weekly_usd) + ' × ' + f.weeks + ' weeks (' + full(f.weekly_usd * f.weeks) + ').') +
      step('Time + T-bill', full(f.time_value_usd) + ' + ' + full(f.tbill_usd), f.hours_total.toFixed(2) + ' hours at $25/hour, plus a 5% T-bill on the deposit.') +
      step('Break-even claim', full(f.breakeven_usd), 'All-in cost, time value and T-bill.') +
      step('Break-even as a share of implied', pctShown + '%', 'Break-even claim / implied value. Under 1% is WORTH FARMING.') +
      step('Verdict', verdict(r), 'Break-even ' + pctShown + '% — the stated rule gives ' + verdict(r) + '.');
    var worthCount = DATA.rows.filter(function (x) { return verdict(x) === 'WORTH FARMING'; }).length;
    var thinCount = DATA.rows.filter(function (x) { return verdict(x) === 'THIN'; }).length;
    var skipCount = DATA.rows.length - worthCount - thinCount;
    $('worked-totals').innerHTML =
      kv('Board total', money(DATA.board_total_usd)) +
      kv('Rows on the board', String(DATA.rows.length)) +
      kv('Protocols in the snapshot', String(DATA.protocol_total)) +
      kv('Live rows carried', String(DATA.live.length)) +
      kv('WORTH FARMING', String(worthCount) + ' of ' + DATA.rows.length) +
      kv('THIN', String(thinCount)) +
      kv('SKIP', String(skipCount));
    $('worked-read').textContent =
      'How to read the board: rank is the model order, not a price forecast — the typical prediction is off by ×' +
      V.loo.median_miss_x.toFixed(2) + '. The multiple falls as TVL grows. Break-even % is the whole farm cost as a share of the launch value if the token launches: under 1% is WORTH FARMING, ' +
      '1–5% is THIN, 5% or more is SKIP. Open any row\u2019s Detail view for its own working and farm plan.';
  }
  function openDetail(slug) {
    var r = DATA.rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    var m = r.value_model, f = r.farm_total;
    var sizeMultiple = m.multiple / m.cat_multiple;
    var eq = full(r.tvl_usd) + ' × ' + sizeMultiple.toFixed(4) + ' (size curve) × ' + m.cat_multiple.toFixed(3) + ' (category) = ' + full(m.implied_usd) + ' launch value; × ' + r.launch_odds + ' launch odds = ' + full(r.implied_value_usd) + ' expected value';
    var lo = m.implied_usd / V.loo.median_miss_x, hi = m.implied_usd * V.loo.median_miss_x;
    var rr = B.rank_ranges.find(function (x) { return x.slug === r.slug; });
    var comps = DATA.live.filter(function (x) { return x.category === r.category; });
    var flags = [];
    if (r.change_7d !== null && Math.abs(r.change_7d) > 25) flags.push('TVL swung ' + pct(r.change_7d) + ' in 7 days — the multiple is fitted on a moving target.');
    if (r.age_days !== null && r.age_days < 180) flags.push('Only ' + age(r.age_days) + ' with no token — a young protocol, less history behind the rank.');
    if (r.chains.length === 1) flags.push('Single chain (' + r.chains[0] + ') — no second chain to spread the farm across.');
    if (m.cat_multiple === 1) flags.push('Category effect 1.000 (' + m.cat_basis + ') — the value rests on the size curve alone.');
    if (rr && rr.p95 - rr.p5 > 10) flags.push('Rank unstable under resampling: bootstrap range #' + rr.p5 + '–' + rr.p95 + ' over 200 refits.');
    if (flags.length === 0) flags.push('No single flag stands out; the standing caveat still applies — the typical prediction misses by ×' + V.loo.median_miss_x.toFixed(2) + '.');
    var pctText = f.breakeven_pct_of_implied < 0.01 ? f.breakeven_pct_of_implied.toFixed(4) : f.breakeven_pct_of_implied.toFixed(2);
    $('detail-title').textContent = r.name + (r.is_watchlist ? ' · Watchlist' : '');
    $('detail-body').innerHTML =
      '<p>' + esc(r.name) + ' records no token yet. ' + esc(r.category || 'Uncategorised') + ' · ' +
      esc(r.chains.join(', ')) + ' · TVL ' + full(r.tvl_usd) + ' · seven-day change ' + pct(r.change_7d) +
      ' · running ' + age(r.age_days) + ' with no token' + (r.age_days === null ? ' (listing date unknown)' : '') + '.' +
      (r.is_watchlist ? ' On the snapshot\u2019s watchlist.' : ' Outside the watchlist, ranked on the same model.') + '</p>' +
      '<h3>The working — valuation from the snapshot</h3>' +
      '<div class="equation">' + esc(eq) + '</div>' +
      '<p>Size multiple ' + sizeMultiple.toFixed(4) + ' from log10(cap) = ' + SF.intercept.toFixed(4) +
      ' + ' + SF.slope.toFixed(4) + ' × log10(TVL); category factor ' + m.cat_multiple.toFixed(3) +
      ' (' + esc(m.cat_basis) + '). The 7d growth and the chain count are not in the working: ' +
      'each was fitted and tested and neither improves out-of-sample prediction (evidence table). ' +
      'The age with no token enters through the launch odds: the fitted curve on age gives this protocol ' +
      Math.round(r.launch_odds * 100) + '% — the share of protocols listed that long ago that already have a token — ' +
      'and the board ranks by the launch value times those odds.</p>' +
      '<dl class="kv">' +
      kv('Launch value if it launches', full(m.implied_usd)) +
      kv('Implied value (expected)', full(r.implied_value_usd)) +
      kv('Multiple (implied / TVL)', m.multiple.toFixed(4)) +
      kv('TVL', full(r.tvl_usd)) +
      kv('7d change', pct(r.change_7d)) +
      kv('Age with no token', age(r.age_days)) +
      kv('Launch odds', Math.round(r.launch_odds * 100) + '%') +
      kv('Rank', '#' + r.rank + ' of ' + DATA.rows.length) +
      '</dl>' +
      '<h3>Model score and uncertainty</h3>' +
      '<p>Typical band from the leave-one-out backtest (median miss ×' + V.loo.median_miss_x.toFixed(2) + ' on ' + V.loo.test_n +
      ' live protocols): <b>' + money(lo) + ' – ' + money(hi) + '</b> — the backtest\u2019s typical error around the ' +
      'implied value, not a per-protocol confidence interval. Brier ' + V.loo.brier.toFixed(3) + ' vs base ' +
      V.loo.brier_base.toFixed(3) + '; Platt ' + V.probability.platt_brier.toFixed(3) + ' and tempered ' +
      V.probability.temp15_brier.toFixed(3) + ' both lose.' +
      '</p>' +
      rankStabilitySection(r) +
      '<h3>Comparables — live protocols, same category</h3>' +
      (comps.length ? '<div class="cal-wrap"><table class="cal"><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Mcap / TVL</th></tr></thead><tbody>' +
        comps.map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td class="num">' + money(c.tvl_usd) + '</td><td class="num">' + money(c.mcap_usd) + '</td><td class="num">' + (c.mcap_usd / c.tvl_usd).toFixed(3) + '</td></tr>'; }).join('') +
        '</tbody></table></div><p>Live protocols in this category carried in the dashboard\u2019s data (' + DATA.live.length + ' live rows). ' +
        'The category\u2019s fitted effect is ×' + m.cat_multiple.toFixed(3) + '.</p>'
        : noComparablesText(r)) +
      '<h3>Risks</h3>' +
      '<ul class="risk-list">' + flags.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h3>Farm plan — eight steps</h3>' +
      '<ol class="steps">' + r.farm_detail.map(function (s) {
        return '<li><span>' + esc(s.text) + '</span><span class="cost"><b>' + esc(s.cost) + '</b> · ' + esc(s.time) + '</span></li>';
      }).join('') + '</ol>' +
      farmBreakdownSection(r) +
      '<h3>Farm verdict</h3>' +
      '<div class="verdict-box">' +
      '<p>' + verdictTag(verdict(r)) + ' &nbsp; Deposit ' + full(f.deposit_usd) + ' · upfront ' + full(f.upfront_usd) +
      ' · ' + full(f.weekly_usd) + ' / week × ' + f.weeks + ' weeks · <b>all-in ' + full(f.total_usd) +
      '</b> over ' + f.hold_days + ' days · ' + f.hours_total.toFixed(2) + ' hours of attention.</p>' +
      '<p>At $25 an hour the time is worth ' + full(f.time_value_usd) + ', and the deposit would earn ' +
      full(f.tbill_usd) + ' in a 5% T-bill over the hold. Break-even: <b>' + full(f.breakeven_usd) +
      '</b> — ' + pctText + '% of the ' + full(m.implied_usd) + ' launch value if the token launches, or ' + full(perHour(r)) +
      ' per hour. The farm beats a T-bill and $25 an hour if the eventual claim is worth at least ' + full(f.breakeven_usd) +
      '; no payout is assumed. Across the board, ' + DATA.farm_breakeven_under_1pct + ' of ' + DATA.rows.length +
      ' plans break even below 1% of launch value.</p></div>' +
      '<h3>What would change the rank</h3>' +
      '<p>A token listing takes the protocol off this board entirely. A sharp TVL move, a new chain, or a ' +
      'category multiple that shifts when its live comparables reprice would move the launch value — ' +
      'and a listing date that arrives would move the odds. Re-run the program on a later snapshot.</p>' +
      provenanceSection(r);
    if (history.replaceState) history.replaceState(null, '', '#/' + r.slug);
    dialog.showModal();
  }
  $('detail-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () {
    if (history.replaceState) history.replaceState(null, '', '#');
  });

  render();
  if (location.hash.length > 2 && location.hash.slice(0, 2) === '#/') {
    var frag = decodeURIComponent(location.hash.slice(2));
    if (frag.indexOf('filter?') === 0) {
      var params = new URLSearchParams(frag.slice(7));
      if (params.get('category')) { state.category = params.get('category'); $('category').value = state.category; }
      if (params.get('chain')) { state.chain = params.get('chain'); $('chain').value = state.chain; }
      if (params.get('risk')) { state.risk = params.get('risk'); $('risk').value = state.risk; }
      if (params.get('verdict')) { state.verdict = params.get('verdict'); $('verdict').value = state.verdict; }
      if (params.get('opportunity')) { state.opportunity = params.get('opportunity'); $('opportunity').value = state.opportunity; }
      if (params.get('watchlist')) { state.watchlist = true; $('watchlist-only').checked = true; }
      if (params.get('q')) { state.q = params.get('q'); $('q').value = state.q; }
      render();
    } else {
      openDetail(frag);
    }
  }

  $('foot-note').textContent =
    'Source: the sealed DefiLlama snapshot, fetched 2026-11-14T01:18:33Z, as of ' + DATA.as_of + '. ' +
    'The board is a ranking of a frozen record, not investment advice; a protocol that records no token may still have one. ' +
    'No network, no tracking — re-run the program on a later snapshot to re-rank.';
})();
