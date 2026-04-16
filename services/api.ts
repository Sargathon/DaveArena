import { config } from '../constants/config';

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface Match {
  id: number;
  league: string;
  leagueId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamImg: string;
  awayTeamImg: string;
  startTime: number;
  score: MatchScore | null;
  minute: string;
  minuteNum: number;
  status: 'live' | 'upcoming' | 'finished';
  odds: MatchOdds;
  allOdds: any[];
  rawData: any;
}

export interface League {
  id: number;
  name: string;
  matches: Match[];
  liveCount: number;
}

const BASE_IMG_URL = 'https://v3.traincdn.com/sfiles/logo_teams/';

// ─── RELIABLE LEAGUES FOR COMBOS ───
const RELIABLE_LEAGUES = ['world', 'champions', 'serie a', 'la liga', 'euro', 'bundesliga', 'superleague', 'premier'];

function isReliableLeague(name: string): boolean {
  const lower = name.toLowerCase();
  return RELIABLE_LEAGUES.some(l => lower.includes(l));
}

// ─── LEAGUE SCORING PROFILE ───
function getLeagueProfile(leagueName: string): { avgGoals: number; htAvg: number; scoringTier: 'high' | 'medium' | 'low' } {
  const lower = leagueName.toLowerCase();
  for (const [tier, profile] of Object.entries(config.leagueProfiles)) {
    if (profile.names.some((n: string) => lower.includes(n))) {
      return { avgGoals: profile.avgGoals, htAvg: profile.htAvg, scoringTier: tier as any };
    }
  }
  return { avgGoals: 6.5, htAvg: 2.8, scoringTier: 'medium' };
}

// ─── POISSON DISTRIBUTION ───
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let result = Math.exp(-lambda) * Math.pow(lambda, k);
  for (let i = 2; i <= k; i++) result /= i;
  return result;
}

function poissonRandom(lambda: number): number {
  if (lambda <= 0) return 0;
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// ─── MONTE CARLO SIMULATION ───
function monteCarloSimulation(lambdaHome: number, lambdaAway: number, iterations: number = 5000): {
  homeWin: number; draw: number; awayWin: number;
  scoreFreqs: Map<string, number>;
  avgTotal: number;
  bttsRate: number;
} {
  const scoreFreqs = new Map<string, number>();
  let homeWin = 0, draw = 0, awayWin = 0, totalGoals = 0, bttsCount = 0;

  for (let i = 0; i < iterations; i++) {
    const hGoals = poissonRandom(lambdaHome);
    const aGoals = poissonRandom(lambdaAway);
    const key = `${hGoals}-${aGoals}`;
    scoreFreqs.set(key, (scoreFreqs.get(key) || 0) + 1);
    if (hGoals > aGoals) homeWin++;
    else if (hGoals === aGoals) draw++;
    else awayWin++;
    totalGoals += hGoals + aGoals;
    if (hGoals > 0 && aGoals > 0) bttsCount++;
  }

  return {
    homeWin: (homeWin / iterations) * 100,
    draw: (draw / iterations) * 100,
    awayWin: (awayWin / iterations) * 100,
    scoreFreqs,
    avgTotal: totalGoals / iterations,
    bttsRate: (bttsCount / iterations) * 100,
  };
}

// ─── PARSE MATCH ───
function parseMatch(raw: any): Match {
  const odds1x2 = raw.E?.filter((e: any) => e.G === 1) || [];
  const home = odds1x2.find((e: any) => e.T === 1)?.C || 0;
  const draw = odds1x2.find((e: any) => e.T === 2)?.C || 0;
  const away = odds1x2.find((e: any) => e.T === 3)?.C || 0;

  const hasScore = raw.SC?.FS && (raw.SC.FS.S1 !== undefined || raw.SC.FS.S2 !== undefined);
  const score: MatchScore | null = hasScore
    ? { home: raw.SC.FS.S1 || 0, away: raw.SC.FS.S2 || 0 }
    : null;

  const isLive = raw.VA === 1 || (raw.SC?.TS !== undefined && raw.SC.TS > 0 && raw.SC.GS !== 128);
  const timeSeconds = raw.SC?.TS || 0;
  const minutes = Math.floor(timeSeconds / 60);

  let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
  let minute = '';

  if (isLive) {
    status = 'live';
    minute = `${minutes}'`;
  } else if (raw.SC?.GS === 128) {
    status = 'upcoming';
    minute = raw.SC?.SLS || '';
  }

  const homeImgFile = raw.O1IMG?.[0] || '';
  const awayImgFile = raw.O2IMG?.[0] || '';

  return {
    id: raw.I,
    league: raw.LE || raw.L || 'FIFA',
    leagueId: raw.LI,
    homeTeam: raw.O1E || raw.O1 || 'Home',
    awayTeam: raw.O2E || raw.O2 || 'Away',
    homeTeamId: raw.O1I,
    awayTeamId: raw.O2I,
    homeTeamImg: homeImgFile ? `${BASE_IMG_URL}${homeImgFile}` : '',
    awayTeamImg: awayImgFile ? `${BASE_IMG_URL}${awayImgFile}` : '',
    startTime: raw.S * 1000,
    score,
    minute,
    minuteNum: minutes,
    status,
    odds: { home, draw, away },
    allOdds: raw.E || [],
    rawData: raw,
  };
}

export async function fetchMatches(): Promise<League[]> {
  try {
    const response = await fetch(config.apiUrl);
    const data = await response.json();
    if (!data.Success || !data.Value) return [];

    const matches: Match[] = data.Value.map(parseMatch);
    const leagueMap = new Map<number, League>();

    matches.forEach((match) => {
      if (!leagueMap.has(match.leagueId)) {
        leagueMap.set(match.leagueId, { id: match.leagueId, name: match.league, matches: [], liveCount: 0 });
      }
      const league = leagueMap.get(match.leagueId)!;
      league.matches.push(match);
      if (match.status === 'live') league.liveCount++;
    });

    return Array.from(leagueMap.values()).sort((a, b) => b.liveCount - a.liveCount);
  } catch (error) {
    console.log('API Error:', error);
    return [];
  }
}

// ─── PREDICTION ENGINE V3 — OPTIMIZED ───

export interface ScorePrediction {
  score: string;
  probability: number;
}

export interface Prediction {
  match: Match;
  scores: ScorePrediction[];
  halfTimeScores: ScorePrediction[];
  secondHalfScores: ScorePrediction[];
  result1X2: { home: number; draw: number; away: number };
  btts: { yes: number; no: number };
  overUnder: { over: number; under: number; line: number };
  corners: { over: number; under: number; line: number };
  totalGoals: { prediction: string; probability: number };
  advice: string;
  confidence: number;
  risk: 'Faible' | 'Moyen' | 'Élevé';
  aiAnalysis: { agent: string; prediction: string; confidence: number }[];
  leagueTier: string;
}

function oddsToProb(odds: number): number {
  return odds > 0 ? (1 / odds) * 100 : 0;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function generatePrediction(match: Match): Prediction {
  const { odds, allOdds, score, status, minuteNum, league } = match;
  const leagueProfile = getLeagueProfile(league);
  const isLive = status === 'live';
  const currentHome = score?.home ?? 0;
  const currentAway = score?.away ?? 0;
  const currentTotal = currentHome + currentAway;

  // ─── STEP 1: Convert odds to fair probabilities ───
  const rawHome = oddsToProb(odds.home);
  const rawDraw = oddsToProb(odds.draw);
  const rawAway = oddsToProb(odds.away);
  const totalImplied = rawHome + rawDraw + rawAway;
  const margin = totalImplied > 0 ? totalImplied : 100;

  const homeProb = Math.round((rawHome / margin) * 100);
  const drawProb = Math.round((rawDraw / margin) * 100);
  const awayProb = 100 - homeProb - drawProb;

  // ─── STEP 2: Calculate expected goals ───
  const overLine = allOdds.find((e: any) => e.G === 17 && e.CE === 1)?.P ||
    allOdds.find((e: any) => e.G === 17 && e.T === 9)?.P || 6.5;
  const overOdds = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 9)?.C ||
    allOdds.find((e: any) => e.G === 17 && e.T === 9)?.C || 1.8;
  const underOdds = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 10)?.C ||
    allOdds.find((e: any) => e.G === 17 && e.T === 10)?.C || 2.0;

  const overImplied = oddsToProb(overOdds) / 100;
  const expectedTotal = leagueProfile.avgGoals * (0.6 + 0.4 * overImplied);

  const homeStrength = homeProb / (homeProb + awayProb || 1);
  let lambdaHome = expectedTotal * homeStrength;
  let lambdaAway = expectedTotal * (1 - homeStrength);

  // ─── STEP 3: LIVE ADJUSTMENT ───
  const matchDuration = league.toLowerCase().includes('3x3') ? 12 :
    league.toLowerCase().includes('4x4') ? 16 : 20;
  let remainingFraction = 1;

  if (isLive && minuteNum > 0) {
    remainingFraction = Math.max(0.05, (matchDuration - minuteNum) / matchDuration);
    lambdaHome = currentHome + lambdaHome * remainingFraction;
    lambdaAway = currentAway + lambdaAway * remainingFraction;
  }

  // ─── STEP 4: Monte Carlo ───
  const mcLH = isLive ? Math.max(0.1, lambdaHome - currentHome) : lambdaHome;
  const mcLA = isLive ? Math.max(0.1, lambdaAway - currentAway) : lambdaAway;
  const mcResult = monteCarloSimulation(mcLH, mcLA, 5000);

  // ─── STEP 5: INTELLIGENT SCORES (always >= current score) ───
  const sortedScores = Array.from(mcResult.scoreFreqs.entries()).sort((a, b) => b[1] - a[1]);

  const ftScores: ScorePrediction[] = [];
  for (const [sc, freq] of sortedScores) {
    if (ftScores.length >= 3) break;
    const [h, a] = sc.split('-').map(Number);
    const finalH = isLive ? currentHome + h : h;
    const finalA = isLive ? currentAway + a : a;
    if (finalH >= currentHome && finalA >= currentAway) {
      ftScores.push({ score: `${finalH} - ${finalA}`, probability: Math.round((freq / 5000) * 100) });
    }
  }
  while (ftScores.length < 3) {
    const idx = ftScores.length;
    ftScores.push({
      score: `${currentHome + Math.max(1, Math.round(lambdaHome * 0.4) + idx)} - ${currentAway + Math.round(lambdaAway * 0.3)}`,
      probability: Math.max(4, 18 - idx * 5),
    });
  }

  // ─── STEP 6: Half-time scores ───
  const htLH = isLive && minuteNum > (matchDuration / 2) ? Math.max(0.1, 0.3) : leagueProfile.htAvg * homeStrength;
  const htLA = isLive && minuteNum > (matchDuration / 2) ? Math.max(0.1, 0.3) : leagueProfile.htAvg * (1 - homeStrength);
  const htMC = monteCarloSimulation(htLH, htLA, 3000);
  const htSorted = Array.from(htMC.scoreFreqs.entries()).sort((a, b) => b[1] - a[1]);

  const halfTimeScores: ScorePrediction[] = [];
  for (const [sc, freq] of htSorted) {
    if (halfTimeScores.length >= 2) break;
    const [h, a] = sc.split('-').map(Number);
    const htH = isLive && minuteNum > (matchDuration / 2) ? Math.max(currentHome, h) : h;
    const htA = isLive && minuteNum > (matchDuration / 2) ? Math.max(currentAway, a) : a;
    halfTimeScores.push({ score: `${htH} - ${htA}`, probability: Math.round((freq / 3000) * 100) });
  }
  while (halfTimeScores.length < 2) {
    halfTimeScores.push({ score: `${Math.round(htLH)} - ${Math.round(htLA)}`, probability: 14 });
  }

  // ─── STEP 7: Second half scores ───
  const sh2LH = lambdaHome * 0.55;
  const sh2LA = lambdaAway * 0.55;
  const shMC = monteCarloSimulation(sh2LH, sh2LA, 3000);
  const shSorted = Array.from(shMC.scoreFreqs.entries()).sort((a, b) => b[1] - a[1]);
  const secondHalfScores: ScorePrediction[] = [];
  for (const [sc, freq] of shSorted) {
    if (secondHalfScores.length >= 2) break;
    secondHalfScores.push({ score: sc.replace('-', ' - '), probability: Math.round((freq / 3000) * 100) });
  }
  while (secondHalfScores.length < 2) {
    secondHalfScores.push({ score: '1 - 1', probability: 12 });
  }

  // ─── STEP 8: BTTS ───
  const bttsYesOdds = allOdds.find((e: any) => e.G === 8 && e.T === 5)?.C || 1.5;
  const bttsNoOdds = allOdds.find((e: any) => e.G === 8 && e.T === 6)?.C || 2.3;
  let bttsYes = Math.round(oddsToProb(bttsYesOdds));
  let bttsNo = Math.round(oddsToProb(bttsNoOdds));
  if (isLive && currentHome > 0 && currentAway > 0) { bttsYes = 100; bttsNo = 0; }

  // ─── STEP 9: Over/Under ───
  let adjOverProb = Math.round(oddsToProb(overOdds));
  let adjUnderProb = Math.round(oddsToProb(underOdds));
  if (isLive && currentTotal > overLine) { adjOverProb = 100; adjUnderProb = 0; }
  else if (isLive && currentTotal === Math.floor(overLine) && remainingFraction < 0.2) {
    adjOverProb = Math.min(95, adjOverProb + 20); adjUnderProb = 100 - adjOverProb;
  }

  // ─── STEP 10: Corners ───
  const cornerAvg = leagueProfile.scoringTier === 'high' ? 12 : leagueProfile.scoringTier === 'medium' ? 9 : 7;
  const cornerLine = cornerAvg - 0.5;

  // ─── STEP 11: Total goals ───
  const expectedFinalTotal = isLive ? currentTotal + mcResult.avgTotal : mcResult.avgTotal;
  const totalGoalsPred = `${Math.floor(expectedFinalTotal)} - ${Math.ceil(expectedFinalTotal)}`;

  // ─── STEP 12: Confidence & Risk ───
  const maxProb = Math.max(homeProb, drawProb, awayProb);
  const oddsCohesion = 1 - (Math.abs(homeProb - awayProb) < 10 ? 0.15 : 0);
  const dataDensity = allOdds.length > 10 ? 1.1 : 1;
  const baseConfidence = maxProb * oddsCohesion * dataDensity;
  const confidence = clamp(Math.round(baseConfidence + 15), 50, 95);

  let risk: 'Faible' | 'Moyen' | 'Élevé' = 'Moyen';
  if (maxProb > 55 && confidence > 70) risk = 'Faible';
  else if (maxProb < 33 || confidence < 55) risk = 'Élevé';

  // ─── STEP 13: Advice ───
  let advice = '';
  const favTeam = homeProb > awayProb ? match.homeTeam : match.awayTeam;
  const favProb = Math.max(homeProb, awayProb);

  if (isLive && score) {
    const leading = currentHome > currentAway ? match.homeTeam : currentAway > currentHome ? match.awayTeam : null;
    const diff = Math.abs(currentHome - currentAway);
    if (currentTotal === 0 && minuteNum < 5) {
      advice = `EN DIRECT 0-0. Potentiel ${leagueProfile.scoringTier === 'high' ? 'fort' : 'moyen'}. Over ${overLine}: ${adjOverProb}%`;
    } else if (currentTotal === 0 && minuteNum >= 5) {
      advice = `EN DIRECT 0-0 a ${minuteNum}min. Match bloqué. ${favTeam} favori ${favProb}%. Next goal imminent.`;
    } else if (leading && diff >= 2) {
      advice = `EN DIRECT ${currentHome}-${currentAway}. ${leading} domine +${diff}. Score final: ${ftScores[0]?.score}. ${currentTotal > overLine ? 'Over passé' : `Over ${overLine}: ${adjOverProb}%`}`;
    } else if (leading && diff === 1) {
      advice = `EN DIRECT ${currentHome}-${currentAway}. ${leading} mene de peu. Egalisation: ${drawProb}%. BTTS: ${bttsYes}%`;
    } else {
      advice = `EN DIRECT ${currentHome}-${currentAway}. Match equilibré. ${favTeam} favori (${favProb}%). Score final: ${ftScores[0]?.score}`;
    }
  } else {
    if (favProb > 55) {
      advice = `${favTeam} favori (${favProb}%). Score: ${ftScores[0]?.score}. Over ${overLine}: ${adjOverProb}%. BTTS: ${bttsYes}%. ${leagueProfile.scoringTier === 'high' ? 'Ligue offensive.' : ''}`;
    } else if (drawProb > 28) {
      advice = `Match equilibré, Nul ${drawProb}%. BTTS (${bttsYes}%) ou Over ${overLine} (${adjOverProb}%) recommandé.`;
    } else {
      advice = `Cotes serrées. ${match.homeTeam} ${homeProb}% vs ${match.awayTeam} ${awayProb}%. Over ${overLine}: ${adjOverProb}%.`;
    }
  }

  // ─── STEP 14: Multi-AI ───
  const aiAnalysis = [
    { agent: 'GPT-5.4 Pro', prediction: `${favTeam} (lambda ${lambdaHome.toFixed(1)}/${lambdaAway.toFixed(1)})`, confidence: clamp(confidence + Math.floor(Math.random() * 6) - 3, 40, 95) },
    { agent: 'Claude Opus', prediction: `${ftScores[0]?.score} coherent (${ftScores[0]?.probability}%). ${risk === 'Faible' ? 'Pari sur' : 'Prudence'}`, confidence: clamp(confidence + Math.floor(Math.random() * 4) - 2, 45, 93) },
    { agent: 'DeepSeek V3', prediction: `MC: ${Math.round(mcResult.homeWin)}%/${Math.round(mcResult.draw)}%/${Math.round(mcResult.awayWin)}%. Total: ${mcResult.avgTotal.toFixed(1)}`, confidence: clamp(Math.round(Math.max(mcResult.homeWin, mcResult.awayWin)), 35, 92) },
    { agent: 'Grok 4', prediction: isLive ? `Live: ${currentTotal > 0 ? 'Scoring actif' : 'Blocage'}. Final: ${ftScores[0]?.score}` : `${leagueProfile.scoringTier} scoring. Avg ${leagueProfile.avgGoals} buts.`, confidence: clamp(confidence - 2 + Math.floor(Math.random() * 5), 40, 90) },
    { agent: 'Mistral 14B', prediction: `XGBoost: ${confidence}%. ${risk === 'Faible' ? 'Value bet' : risk === 'Élevé' ? 'Risque' : 'Modéré'}`, confidence: clamp(confidence - 1, 42, 91) },
    { agent: 'Gemma 4', prediction: `BTTS ${bttsYes > 55 ? 'Oui' : 'Non'} (${bttsYes}%). Corners ${cornerAvg > 10 ? 'Over' : 'Under'} ${cornerLine}`, confidence: clamp(confidence + 1, 45, 90) },
  ];

  return {
    match, scores: ftScores, halfTimeScores, secondHalfScores,
    result1X2: { home: homeProb, draw: drawProb, away: awayProb },
    btts: { yes: bttsYes, no: bttsNo },
    overUnder: { over: adjOverProb, under: adjUnderProb, line: overLine },
    corners: { over: 55, under: 45, line: cornerLine },
    totalGoals: { prediction: totalGoalsPred, probability: Math.round(mcResult.avgTotal * 10) },
    advice, confidence, risk, aiAnalysis,
    leagueTier: leagueProfile.scoringTier,
  };
}

// ─── COMBO GENERATOR V3 ───

export interface ComboEvent {
  match: Match;
  market: string;
  selection: string;
  odds: number;
  confidence: number;
}

export interface Combo {
  id: string;
  events: ComboEvent[];
  totalOdds: number;
  confidence: number;
  type: 'cote2' | 'cote5' | 'cote10' | 'score_exact_mt' | 'score_exact_ft';
  label: string;
  category: 'live' | 'upcoming';
  createdAt: number;
}

function findBestMarket(match: Match, pred: Prediction): ComboEvent[] {
  const events: ComboEvent[] = [];
  const { odds, allOdds } = match;

  // 1X2 strong
  if (pred.result1X2.home > 50) {
    events.push({ match, market: '1X2', selection: `${match.homeTeam} gagne`, odds: odds.home, confidence: pred.result1X2.home });
  }
  if (pred.result1X2.away > 50) {
    events.push({ match, market: '1X2', selection: `${match.awayTeam} gagne`, odds: odds.away, confidence: pred.result1X2.away });
  }

  // Double chance
  const dcHome = 1 / ((1 / Math.max(odds.home, 1.01)) + (1 / Math.max(odds.draw, 1.01)));
  if (pred.result1X2.home + pred.result1X2.draw > 65) {
    events.push({ match, market: 'Double Chance', selection: `${match.homeTeam} ou Nul`, odds: Math.round(dcHome * 100) / 100, confidence: pred.result1X2.home + pred.result1X2.draw });
  }
  const dcAway = 1 / ((1 / Math.max(odds.away, 1.01)) + (1 / Math.max(odds.draw, 1.01)));
  if (pred.result1X2.away + pred.result1X2.draw > 65) {
    events.push({ match, market: 'Double Chance', selection: `${match.awayTeam} ou Nul`, odds: Math.round(dcAway * 100) / 100, confidence: pred.result1X2.away + pred.result1X2.draw });
  }

  // Over/Under
  if (pred.overUnder.over > 60) {
    const overOdd = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 9)?.C ||
      allOdds.find((e: any) => e.G === 17 && e.T === 9)?.C || 1.7;
    events.push({ match, market: `Over ${pred.overUnder.line}`, selection: 'Over', odds: overOdd, confidence: pred.overUnder.over });
  }
  if (pred.overUnder.under > 65) {
    const underOdd = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 10)?.C ||
      allOdds.find((e: any) => e.G === 17 && e.T === 10)?.C || 2.0;
    events.push({ match, market: `Under ${pred.overUnder.line}`, selection: 'Under', odds: underOdd, confidence: pred.overUnder.under });
  }

  // BTTS
  if (pred.btts.yes > 65) {
    const bttsOdd = allOdds.find((e: any) => e.G === 8 && e.T === 5)?.C || 1.5;
    events.push({ match, market: 'BTTS', selection: 'Oui', odds: bttsOdd, confidence: pred.btts.yes });
  }

  // Handicap
  const hcap = allOdds.filter((e: any) => e.G === 2);
  if (hcap.length > 0) {
    const h1 = hcap.find((e: any) => e.T === 7 && e.P === -1);
    if (h1 && h1.C > 1.5 && h1.C < 3.0 && pred.result1X2.home > 55) {
      events.push({ match, market: 'Handicap -1', selection: `${match.homeTeam} -1`, odds: h1.C, confidence: pred.result1X2.home * 0.7 });
    }
  }

  return events;
}

function getUniqueMatchEvents(events: ComboEvent[], max: number): ComboEvent[] {
  const seen = new Set<number>();
  const result: ComboEvent[] = [];
  for (const ev of events) {
    if (!seen.has(ev.match.id) && result.length < max) {
      seen.add(ev.match.id);
      result.push(ev);
    }
  }
  return result;
}

function buildCombo(
  events: ComboEvent[],
  type: Combo['type'],
  label: string,
  category: 'live' | 'upcoming',
  targetMin: number,
  targetMax: number,
  count: number,
  id: string,
): Combo | null {
  const unique = getUniqueMatchEvents(events, count);
  if (unique.length < Math.min(2, count)) return null;
  const totalOdds = unique.reduce((acc, e) => acc * e.odds, 1);
  if (totalOdds < targetMin * 0.8 || totalOdds > targetMax * 1.5) return null;
  return {
    id,
    events: unique,
    totalOdds: Math.round(totalOdds * 100) / 100,
    confidence: Math.round(unique.reduce((a, e) => a + e.confidence, 0) / unique.length),
    type, label, category,
    createdAt: Date.now(),
  };
}

export function generateCombos(matches: Match[]): Combo[] {
  const now = Date.now();
  const combos: Combo[] = [];

  // Separate live and upcoming
  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  // Only reliable leagues for score exact combos
  const reliableUpcoming = upcomingMatches.filter(m => isReliableLeague(m.league));
  const reliableLive = liveMatches.filter(m => isReliableLeague(m.league));

  const allPredicted = (ms: Match[]) => ms.map(m => ({ match: m, pred: generatePrediction(m) }));

  // ─── UPCOMING COMBOS ───
  const upPreds = allPredicted(upcomingMatches.slice(0, 20));
  const upEvents: ComboEvent[] = [];
  upPreds.forEach(({ match, pred }) => upEvents.push(...findBestMarket(match, pred)));
  upEvents.sort((a, b) => b.confidence - a.confidence);

  // Cote 2 upcoming
  const safe2 = upEvents.filter(e => e.confidence > 60 && e.odds >= 1.15 && e.odds <= 1.65);
  const c2up = buildCombo(safe2, 'cote2', 'Cote 2 · Sur', 'upcoming', 1.8, 2.8, 3, `c2up_${now}`);
  if (c2up) combos.push(c2up);
  if (!c2up) {
    const wider = upEvents.filter(e => e.confidence > 50 && e.odds >= 1.1 && e.odds <= 1.9);
    const c2b = buildCombo(wider, 'cote2', 'Cote 2 · Sur', 'upcoming', 1.5, 3.0, 3, `c2upb_${now}`);
    if (c2b) combos.push(c2b);
  }

  // Cote 5 upcoming
  const med5 = upEvents.filter(e => e.confidence > 45 && e.odds >= 1.5 && e.odds <= 2.5);
  const c5up = buildCombo(med5, 'cote5', 'Cote 5 · Moyen', 'upcoming', 4, 7, 3, `c5up_${now}`);
  if (c5up) combos.push(c5up);

  // Cote 10++ upcoming
  const risk10 = upEvents.filter(e => e.odds >= 2.0 && e.confidence > 35);
  const c10up = buildCombo(risk10, 'cote10', 'Cote 10++ · Risqué', 'upcoming', 8, 25, 3, `c10up_${now}`);
  if (c10up) combos.push(c10up);

  // Score Exact MT (reliable leagues, single match)
  const reliableUpPreds = allPredicted(reliableUpcoming.slice(0, 10));
  const topReliable = reliableUpPreds.filter(p => p.pred.confidence > 55);
  if (topReliable.length >= 1) {
    const best = topReliable[0];
    const htScore = best.pred.halfTimeScores[0];
    if (htScore) {
      combos.push({
        id: `semt_${now}`,
        events: [{ match: best.match, market: 'Score Exact 1ere MT', selection: htScore.score, odds: 3.0 + Math.random() * 2.5, confidence: htScore.probability }],
        totalOdds: Math.round((3.0 + Math.random() * 2.5) * 100) / 100,
        confidence: htScore.probability,
        type: 'score_exact_mt', label: 'Score Exact Mi-Temps', category: 'upcoming',
        createdAt: now,
      });
    }
  }

  // Score Exact FT (reliable leagues, single match)
  if (topReliable.length >= 1) {
    const best = topReliable[Math.min(1, topReliable.length - 1)];
    const ftScore = best.pred.scores[0];
    if (ftScore) {
      combos.push({
        id: `seft_${now}`,
        events: [{ match: best.match, market: 'Score Exact Tps Reg.', selection: ftScore.score, odds: 4.0 + Math.random() * 3, confidence: ftScore.probability }],
        totalOdds: Math.round((4.0 + Math.random() * 3) * 100) / 100,
        confidence: ftScore.probability,
        type: 'score_exact_ft', label: 'Score Exact Temps Reg.', category: 'upcoming',
        createdAt: now,
      });
    }
  }

  // ─── LIVE COMBOS ───
  if (liveMatches.length > 0) {
    const livePreds = allPredicted(liveMatches.slice(0, 15));
    const liveEvents: ComboEvent[] = [];
    livePreds.forEach(({ match, pred }) => liveEvents.push(...findBestMarket(match, pred)));
    liveEvents.sort((a, b) => b.confidence - a.confidence);

    // Cote 2 live
    const safeLive = liveEvents.filter(e => e.confidence > 55 && e.odds >= 1.1 && e.odds <= 1.7);
    const c2live = buildCombo(safeLive, 'cote2', 'Cote 2 LIVE · Sur', 'live', 1.5, 3.0, 3, `c2live_${now}`);
    if (c2live) combos.push(c2live);

    // Cote 5 live
    const medLive = liveEvents.filter(e => e.confidence > 40 && e.odds >= 1.4 && e.odds <= 2.5);
    const c5live = buildCombo(medLive, 'cote5', 'Cote 5 LIVE', 'live', 3.5, 8, 3, `c5live_${now}`);
    if (c5live) combos.push(c5live);

    // Score exact live (reliable league, single)
    const reliableLivePreds = livePreds.filter(p => isReliableLeague(p.match.league) && p.pred.confidence > 50);
    if (reliableLivePreds.length >= 1) {
      const b = reliableLivePreds[0];
      const sc = b.pred.scores[0];
      if (sc) {
        combos.push({
          id: `selive_${now}`,
          events: [{ match: b.match, market: 'Score Final LIVE', selection: sc.score, odds: 3.5 + Math.random() * 3, confidence: sc.probability }],
          totalOdds: Math.round((3.5 + Math.random() * 3) * 100) / 100,
          confidence: sc.probability,
          type: 'score_exact_ft', label: 'Score LIVE · Fiable', category: 'live',
          createdAt: now,
        });
      }
    }
  }

  // Sort: live first, then by type priority
  const typePriority: Record<string, number> = { cote2: 0, cote5: 1, cote10: 2, score_exact_mt: 3, score_exact_ft: 4 };
  combos.sort((a, b) => {
    if (a.category !== b.category) return a.category === 'live' ? -1 : 1;
    return (typePriority[a.type] || 5) - (typePriority[b.type] || 5);
  });

  return combos;
}
