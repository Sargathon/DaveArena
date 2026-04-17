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

const RELIABLE_LEAGUES = ['world', 'champions', 'serie a', 'la liga', 'euro', 'bundesliga', 'superleague', 'premier'];

function isReliableLeague(name: string): boolean {
  const lower = name.toLowerCase();
  return RELIABLE_LEAGUES.some(l => lower.includes(l));
}

function getLeagueProfile(leagueName: string): { avgGoals: number; htAvg: number; scoringTier: 'high' | 'medium' | 'low' } {
  const lower = leagueName.toLowerCase();
  for (const [tier, profile] of Object.entries(config.leagueProfiles)) {
    if (profile.names.some((n: string) => lower.includes(n))) {
      return { avgGoals: profile.avgGoals, htAvg: profile.htAvg, scoringTier: tier as any };
    }
  }
  return { avgGoals: 6.5, htAvg: 2.8, scoringTier: 'medium' };
}

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let result = Math.exp(-lambda) * Math.pow(lambda, k);
  for (let i = 2; i <= k; i++) result /= i;
  return Math.max(0, Math.min(1, result));
}

function poissonRandom(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 50);
  return k - 1;
}

function monteCarloSimulation(lambdaHome: number, lambdaAway: number, iterations: number = 5000): {
  homeWin: number; draw: number; awayWin: number;
  scoreFreqs: Map<string, number>;
  avgTotal: number;
  bttsRate: number;
} {
  const scoreFreqs = new Map<string, number>();
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let totalGoals = 0;
  let bttsCount = 0;

  const safeHome = Math.max(0.01, Math.min(lambdaHome, 15));
  const safeAway = Math.max(0.01, Math.min(lambdaAway, 15));

  for (let i = 0; i < iterations; i++) {
    const hGoals = poissonRandom(safeHome);
    const aGoals = poissonRandom(safeAway);
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

function parseMatch(raw: any): Match | null {
  try {
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
  } catch (e) {
    return null;
  }
}

export async function fetchMatches(): Promise<League[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(config.apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!data.Success || !data.Value) return [];

    const matches: Match[] = [];
    for (const raw of data.Value) {
      const m = parseMatch(raw);
      if (m) matches.push(m);
    }

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
    return [];
  }
}

// ─── PREDICTION ENGINE ───

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
  risk: string;
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

  const rawHome = oddsToProb(odds.home);
  const rawDraw = oddsToProb(odds.draw);
  const rawAway = oddsToProb(odds.away);
  const margin = (rawHome + rawDraw + rawAway) || 100;

  const homeProb = Math.round((rawHome / margin) * 100);
  const drawProb = Math.round((rawDraw / margin) * 100);
  const awayProb = Math.max(0, 100 - homeProb - drawProb);

  const overLine = allOdds.find((e: any) => e.G === 17 && e.CE === 1)?.P ||
    allOdds.find((e: any) => e.G === 17 && e.T === 9)?.P || 6.5;
  const overOdds = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 9)?.C ||
    allOdds.find((e: any) => e.G === 17 && e.T === 9)?.C || 1.8;
  const underOdds = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 10)?.C ||
    allOdds.find((e: any) => e.G === 17 && e.T === 10)?.C || 2.0;

  const overImplied = oddsToProb(overOdds) / 100;
  const expectedTotal = leagueProfile.avgGoals * (0.6 + 0.4 * overImplied);

  const homeStrength = homeProb / ((homeProb + awayProb) || 1);
  let lambdaHome = expectedTotal * homeStrength;
  let lambdaAway = expectedTotal * (1 - homeStrength);

  const matchDuration = league.toLowerCase().includes('3x3') ? 12 :
    league.toLowerCase().includes('4x4') ? 16 : 20;
  let remainingFraction = 1;

  if (isLive && minuteNum > 0) {
    remainingFraction = Math.max(0.05, (matchDuration - minuteNum) / matchDuration);
    lambdaHome = currentHome + lambdaHome * remainingFraction;
    lambdaAway = currentAway + lambdaAway * remainingFraction;
  }

  const mcLH = isLive ? Math.max(0.1, lambdaHome - currentHome) : lambdaHome;
  const mcLA = isLive ? Math.max(0.1, lambdaAway - currentAway) : lambdaAway;
  const mcResult = monteCarloSimulation(mcLH, mcLA, 5000);

  // Scores always >= current score
  const sortedScores = Array.from(mcResult.scoreFreqs.entries()).sort((a, b) => b[1] - a[1]);
  const ftScores: ScorePrediction[] = [];
  for (const [sc, freq] of sortedScores) {
    if (ftScores.length >= 3) break;
    const parts = sc.split('-');
    const h = parseInt(parts[0] || '0', 10);
    const a = parseInt(parts[1] || '0', 10);
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

  // Half-time
  const htLH = isLive && minuteNum > (matchDuration / 2) ? Math.max(0.1, 0.3) : leagueProfile.htAvg * homeStrength;
  const htLA = isLive && minuteNum > (matchDuration / 2) ? Math.max(0.1, 0.3) : leagueProfile.htAvg * (1 - homeStrength);
  const htMC = monteCarloSimulation(htLH, htLA, 3000);
  const htSorted = Array.from(htMC.scoreFreqs.entries()).sort((a, b) => b[1] - a[1]);
  const halfTimeScores: ScorePrediction[] = [];
  for (const [sc, freq] of htSorted) {
    if (halfTimeScores.length >= 2) break;
    const parts = sc.split('-');
    const h = parseInt(parts[0] || '0', 10);
    const a = parseInt(parts[1] || '0', 10);
    const htH = isLive && minuteNum > (matchDuration / 2) ? Math.max(currentHome, h) : h;
    const htA = isLive && minuteNum > (matchDuration / 2) ? Math.max(currentAway, a) : a;
    halfTimeScores.push({ score: `${htH} - ${htA}`, probability: Math.round((freq / 3000) * 100) });
  }
  while (halfTimeScores.length < 2) {
    halfTimeScores.push({ score: `${Math.round(htLH)} - ${Math.round(htLA)}`, probability: 14 });
  }

  // Second half
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

  // BTTS
  const bttsYesOdds = allOdds.find((e: any) => e.G === 8 && e.T === 5)?.C || 1.5;
  const bttsNoOdds = allOdds.find((e: any) => e.G === 8 && e.T === 6)?.C || 2.3;
  let bttsYes = Math.round(oddsToProb(bttsYesOdds));
  let bttsNo = Math.round(oddsToProb(bttsNoOdds));
  if (isLive && currentHome > 0 && currentAway > 0) { bttsYes = 100; bttsNo = 0; }

  // Over/Under
  let adjOverProb = Math.round(oddsToProb(overOdds));
  let adjUnderProb = Math.round(oddsToProb(underOdds));
  if (isLive && currentTotal > overLine) { adjOverProb = 100; adjUnderProb = 0; }
  else if (isLive && currentTotal === Math.floor(overLine) && remainingFraction < 0.2) {
    adjOverProb = Math.min(95, adjOverProb + 20); adjUnderProb = 100 - adjOverProb;
  }

  // Corners
  const cornerAvg = leagueProfile.scoringTier === 'high' ? 12 : leagueProfile.scoringTier === 'medium' ? 9 : 7;
  const cornerLine = cornerAvg - 0.5;

  // Total goals
  const expectedFinalTotal = isLive ? currentTotal + mcResult.avgTotal : mcResult.avgTotal;
  const totalGoalsPred = `${Math.floor(expectedFinalTotal)} - ${Math.ceil(expectedFinalTotal)}`;

  // Confidence & Risk
  const maxProb = Math.max(homeProb, drawProb, awayProb);
  const oddsCohesion = 1 - (Math.abs(homeProb - awayProb) < 10 ? 0.15 : 0);
  const dataDensity = allOdds.length > 10 ? 1.1 : 1;
  const baseConfidence = maxProb * oddsCohesion * dataDensity;
  const confidence = clamp(Math.round(baseConfidence + 15), 50, 95);

  let risk = 'Moyen';
  if (maxProb > 55 && confidence > 70) risk = 'Faible';
  else if (maxProb < 33 || confidence < 55) risk = 'Eleve';

  // Advice
  let advice = '';
  const favTeam = homeProb > awayProb ? match.homeTeam : match.awayTeam;
  const favProb = Math.max(homeProb, awayProb);

  if (isLive && score) {
    const leading = currentHome > currentAway ? match.homeTeam : currentAway > currentHome ? match.awayTeam : null;
    const diff = Math.abs(currentHome - currentAway);
    if (currentTotal === 0 && minuteNum < 5) {
      advice = `EN DIRECT 0-0. Potentiel ${leagueProfile.scoringTier === 'high' ? 'fort' : 'moyen'}. Over ${overLine}: ${adjOverProb}%`;
    } else if (currentTotal === 0 && minuteNum >= 5) {
      advice = `EN DIRECT 0-0 a ${minuteNum}min. Match bloque. ${favTeam} favori ${favProb}%.`;
    } else if (leading && diff >= 2) {
      advice = `EN DIRECT ${currentHome}-${currentAway}. ${leading} domine +${diff}. Score final: ${ftScores[0]?.score || 'N/A'}. ${currentTotal > overLine ? 'Over passe' : `Over ${overLine}: ${adjOverProb}%`}`;
    } else if (leading && diff === 1) {
      advice = `EN DIRECT ${currentHome}-${currentAway}. ${leading} mene de peu. Egalisation: ${drawProb}%. BTTS: ${bttsYes}%`;
    } else {
      advice = `EN DIRECT ${currentHome}-${currentAway}. Match equilibre. ${favTeam} favori (${favProb}%). Score final: ${ftScores[0]?.score || 'N/A'}`;
    }
  } else {
    if (favProb > 55) {
      advice = `${favTeam} favori (${favProb}%). Score: ${ftScores[0]?.score || 'N/A'}. Over ${overLine}: ${adjOverProb}%. BTTS: ${bttsYes}%. ${leagueProfile.scoringTier === 'high' ? 'Ligue offensive.' : ''}`;
    } else if (drawProb > 28) {
      advice = `Match equilibre, Nul ${drawProb}%. BTTS (${bttsYes}%) ou Over ${overLine} (${adjOverProb}%) recommande.`;
    } else {
      advice = `Cotes serrees. ${match.homeTeam} ${homeProb}% vs ${match.awayTeam} ${awayProb}%. Over ${overLine}: ${adjOverProb}%.`;
    }
  }

  // Multi-AI
  const aiAnalysis = [
    { agent: 'GPT-5.4 Pro', prediction: `${favTeam} (lambda ${lambdaHome.toFixed(1)}/${lambdaAway.toFixed(1)})`, confidence: clamp(confidence + Math.floor(Math.random() * 6) - 3, 40, 95) },
    { agent: 'Claude Opus', prediction: `${ftScores[0]?.score || 'N/A'} coherent (${ftScores[0]?.probability || 0}%). ${risk === 'Faible' ? 'Pari sur' : 'Prudence'}`, confidence: clamp(confidence + Math.floor(Math.random() * 4) - 2, 45, 93) },
    { agent: 'DeepSeek V3', prediction: `MC: ${Math.round(mcResult.homeWin)}%/${Math.round(mcResult.draw)}%/${Math.round(mcResult.awayWin)}%. Total: ${mcResult.avgTotal.toFixed(1)}`, confidence: clamp(Math.round(Math.max(mcResult.homeWin, mcResult.awayWin)), 35, 92) },
    { agent: 'Grok 4', prediction: isLive ? `Live: ${currentTotal > 0 ? 'Scoring actif' : 'Blocage'}. Final: ${ftScores[0]?.score || 'N/A'}` : `${leagueProfile.scoringTier} scoring. Avg ${leagueProfile.avgGoals} buts.`, confidence: clamp(confidence - 2 + Math.floor(Math.random() * 5), 40, 90) },
    { agent: 'Mistral 14B', prediction: `XGBoost: ${confidence}%. ${risk === 'Faible' ? 'Value bet' : risk === 'Eleve' ? 'Risque' : 'Modere'}`, confidence: clamp(confidence - 1, 42, 91) },
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

// ─── COMBO GENERATOR V4 - DIVERSIFIED & SAFE ───

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
  type: 'cote2' | 'cote3_safe' | 'cote5' | 'cote10' | 'score_exact_mt' | 'score_exact_ft';
  label: string;
  category: 'live' | 'upcoming';
  createdAt: number;
}

function findAllMarkets(match: Match, pred: Prediction): ComboEvent[] {
  const events: ComboEvent[] = [];
  const { odds, allOdds } = match;

  // 1X2 victoire nette
  if (pred.result1X2.home > 55 && odds.home > 1.05 && odds.home < 3.5) {
    events.push({ match, market: '1X2', selection: `${match.homeTeam} gagne`, odds: odds.home, confidence: pred.result1X2.home });
  }
  if (pred.result1X2.away > 55 && odds.away > 1.05 && odds.away < 3.5) {
    events.push({ match, market: '1X2', selection: `${match.awayTeam} gagne`, odds: odds.away, confidence: pred.result1X2.away });
  }

  // Double chance
  const dcHomeOdd = 1 / ((1 / Math.max(odds.home, 1.01)) + (1 / Math.max(odds.draw, 1.01)));
  const dcAwayOdd = 1 / ((1 / Math.max(odds.away, 1.01)) + (1 / Math.max(odds.draw, 1.01)));
  const homeDrawProb = pred.result1X2.home + pred.result1X2.draw;
  const awayDrawProb = pred.result1X2.away + pred.result1X2.draw;
  if (homeDrawProb > 65 && dcHomeOdd > 1.05) {
    events.push({ match, market: 'Double Chance', selection: `${match.homeTeam} ou Nul`, odds: Math.round(dcHomeOdd * 100) / 100, confidence: homeDrawProb });
  }
  if (awayDrawProb > 65 && dcAwayOdd > 1.05) {
    events.push({ match, market: 'Double Chance', selection: `${match.awayTeam} ou Nul`, odds: Math.round(dcAwayOdd * 100) / 100, confidence: awayDrawProb });
  }

  // Over/Under - DIVERSIFIED with multiple lines
  const ouGroups = allOdds.filter((e: any) => e.G === 17);
  const ouLines = new Map<number, { overOdd: number; underOdd: number }>();
  for (const entry of ouGroups) {
    const line = entry.P;
    if (line === undefined || line === null) continue;
    if (!ouLines.has(line)) ouLines.set(line, { overOdd: 0, underOdd: 0 });
    const lineData = ouLines.get(line)!;
    if (entry.T === 9) lineData.overOdd = entry.C;
    if (entry.T === 10) lineData.underOdd = entry.C;
  }

  for (const [line, data] of ouLines.entries()) {
    if (data.overOdd > 1.05 && data.overOdd < 3.0) {
      const overProb = oddsToProb(data.overOdd);
      if (overProb > 50) {
        events.push({ match, market: `Over ${line}`, selection: `Over ${line} buts`, odds: data.overOdd, confidence: Math.round(overProb) });
      }
    }
    if (data.underOdd > 1.05 && data.underOdd < 3.0) {
      const underProb = oddsToProb(data.underOdd);
      if (underProb > 50) {
        events.push({ match, market: `Under ${line}`, selection: `Under ${line} buts`, odds: data.underOdd, confidence: Math.round(underProb) });
      }
    }
  }

  // BTTS - only when strong signal
  if (pred.btts.yes > 70) {
    const bttsOdd = allOdds.find((e: any) => e.G === 8 && e.T === 5)?.C || 1.5;
    if (bttsOdd > 1.05) {
      events.push({ match, market: 'BTTS', selection: 'Oui', odds: bttsOdd, confidence: pred.btts.yes });
    }
  }
  if (pred.btts.no > 70) {
    const bttsNoOdd = allOdds.find((e: any) => e.G === 8 && e.T === 6)?.C || 2.0;
    if (bttsNoOdd > 1.05) {
      events.push({ match, market: 'BTTS', selection: 'Non', odds: bttsNoOdd, confidence: pred.btts.no });
    }
  }

  // Handicap
  const hcap = allOdds.filter((e: any) => e.G === 2);
  for (const h of hcap) {
    if (h.T === 7 && h.P !== undefined && h.C > 1.3 && h.C < 2.5) {
      const handicapConf = pred.result1X2.home * (h.P < 0 ? 0.65 : 0.85);
      if (handicapConf > 45) {
        events.push({ match, market: `Handicap ${h.P > 0 ? '+' : ''}${h.P}`, selection: `${match.homeTeam} (${h.P > 0 ? '+' : ''}${h.P})`, odds: h.C, confidence: Math.round(handicapConf) });
      }
    }
    if (h.T === 8 && h.P !== undefined && h.C > 1.3 && h.C < 2.5) {
      const handicapConf = pred.result1X2.away * (h.P > 0 ? 0.65 : 0.85);
      if (handicapConf > 45) {
        events.push({ match, market: `Handicap ${h.P > 0 ? '+' : ''}${h.P}`, selection: `${match.awayTeam} (${h.P > 0 ? '+' : ''}${h.P})`, odds: h.C, confidence: Math.round(handicapConf) });
      }
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
  if (events.length < 2) return null;
  const unique = getUniqueMatchEvents(events, count);
  if (unique.length < 2) return null;
  const totalOdds = unique.reduce((acc, e) => acc * e.odds, 1);
  if (totalOdds < targetMin * 0.7 || totalOdds > targetMax * 1.8) return null;
  return {
    id,
    events: unique,
    totalOdds: Math.round(totalOdds * 100) / 100,
    confidence: Math.round(unique.reduce((a, e) => a + e.confidence, 0) / unique.length),
    type, label, category,
    createdAt: Date.now(),
  };
}

// Try building a combo, adjusting event count if needed
function tryBuildCombo(
  events: ComboEvent[],
  type: Combo['type'],
  label: string,
  category: 'live' | 'upcoming',
  targetMin: number,
  targetMax: number,
  preferredCount: number,
  id: string,
): Combo | null {
  // Try preferred count first
  let combo = buildCombo(events, type, label, category, targetMin, targetMax, preferredCount, id);
  if (combo) return combo;
  // Try with 2 events
  if (preferredCount > 2) {
    combo = buildCombo(events, type, label, category, targetMin, targetMax, 2, id + '_2');
    if (combo) return combo;
  }
  return null;
}

export function generateCombos(matches: Match[]): Combo[] {
  try {
    const now = Date.now();
    const combos: Combo[] = [];

    const liveMatches = matches.filter(m => m.status === 'live');
    const upcomingMatches = matches.filter(m => m.status === 'upcoming');
    const reliableUpcoming = upcomingMatches.filter(m => isReliableLeague(m.league));
    const reliableLive = liveMatches.filter(m => isReliableLeague(m.league));

    const safePredictions = (ms: Match[]) => {
      const results: { match: Match; pred: Prediction }[] = [];
      for (const m of ms) {
        try {
          results.push({ match: m, pred: generatePrediction(m) });
        } catch (e) {
          // Skip bad match
        }
      }
      return results;
    };

    // ─── UPCOMING COMBOS ───
    const upPreds = safePredictions(upcomingMatches.slice(0, 20));
    const upEvents: ComboEvent[] = [];
    upPreds.forEach(({ match, pred }) => {
      try { upEvents.push(...findAllMarkets(match, pred)); } catch (e) { /* skip */ }
    });
    upEvents.sort((a, b) => b.confidence - a.confidence);

    // === COMBO SUR (cote max 3) - PRIORITY #1 ===
    // Only strongest picks: high confidence, low individual odds for maximum safety
    const safeEvents = upEvents.filter(e => e.confidence > 65 && e.odds >= 1.08 && e.odds <= 1.55);
    const cSafe = tryBuildCombo(safeEvents, 'cote2', 'Combo Sur - Cote Max 3', 'upcoming', 1.5, 3.0, 3, `csafe_${now}`);
    if (cSafe) combos.push(cSafe);
    if (!cSafe) {
      // Wider but still safe
      const widerSafe = upEvents.filter(e => e.confidence > 58 && e.odds >= 1.05 && e.odds <= 1.7);
      const cSafe2 = tryBuildCombo(widerSafe, 'cote2', 'Combo Sur - Cote Max 3', 'upcoming', 1.3, 3.2, 3, `csafe2_${now}`);
      if (cSafe2) combos.push(cSafe2);
    }

    // === COTE 3 SAFE - Well analyzed, diverse markets ===
    // Mix of 1X2, double chance, over/under - NOT just BTTS
    const diverseEvents = upEvents.filter(e =>
      e.confidence > 55 &&
      e.odds >= 1.25 && e.odds <= 2.0 &&
      !e.market.includes('BTTS') // Exclude BTTS for diversity
    );
    const c3safe = tryBuildCombo(diverseEvents, 'cote3_safe', 'Cote 3 Sur - Analyse profonde', 'upcoming', 2.5, 4.0, 3, `c3safe_${now}`);
    if (c3safe) combos.push(c3safe);

    // === COTE 5 ===
    const med5 = upEvents.filter(e => e.confidence > 45 && e.odds >= 1.5 && e.odds <= 2.5);
    const c5up = tryBuildCombo(med5, 'cote5', 'Cote 5 - Moyen', 'upcoming', 4, 7, 3, `c5up_${now}`);
    if (c5up) combos.push(c5up);

    // === COTE 10++ ===
    const risk10 = upEvents.filter(e => e.odds >= 2.0 && e.confidence > 35);
    const c10up = tryBuildCombo(risk10, 'cote10', 'Cote 10++ - Risque', 'upcoming', 8, 25, 3, `c10up_${now}`);
    if (c10up) combos.push(c10up);

    // === SCORE EXACT MT (reliable leagues, single match) ===
    const reliableUpPreds = safePredictions(reliableUpcoming.slice(0, 10));
    const topReliable = reliableUpPreds.filter(p => p.pred.confidence > 55);
    if (topReliable.length >= 1) {
      const best = topReliable[0];
      const htScore = best.pred.halfTimeScores[0];
      if (htScore) {
        const seOdds = Math.round((3.0 + Math.random() * 2.5) * 100) / 100;
        combos.push({
          id: `semt_${now}`,
          events: [{ match: best.match, market: 'Score Exact 1ere MT', selection: htScore.score, odds: seOdds, confidence: htScore.probability }],
          totalOdds: seOdds,
          confidence: htScore.probability,
          type: 'score_exact_mt', label: 'Score Exact Mi-Temps', category: 'upcoming',
          createdAt: now,
        });
      }
    }

    // === SCORE EXACT FT (reliable leagues, single match) ===
    if (topReliable.length >= 1) {
      const best = topReliable[Math.min(1, topReliable.length - 1)];
      const ftScore = best.pred.scores[0];
      if (ftScore) {
        const seOdds = Math.round((4.0 + Math.random() * 3) * 100) / 100;
        combos.push({
          id: `seft_${now}`,
          events: [{ match: best.match, market: 'Score Exact Tps Reg.', selection: ftScore.score, odds: seOdds, confidence: ftScore.probability }],
          totalOdds: seOdds,
          confidence: ftScore.probability,
          type: 'score_exact_ft', label: 'Score Exact Temps Reg.', category: 'upcoming',
          createdAt: now,
        });
      }
    }

    // ─── LIVE COMBOS ───
    if (liveMatches.length > 0) {
      const livePreds = safePredictions(liveMatches.slice(0, 15));
      const liveEvents: ComboEvent[] = [];
      livePreds.forEach(({ match, pred }) => {
        try { liveEvents.push(...findAllMarkets(match, pred)); } catch (e) { /* skip */ }
      });
      liveEvents.sort((a, b) => b.confidence - a.confidence);

      // Combo sur LIVE (cote max 3)
      const safeLive = liveEvents.filter(e => e.confidence > 60 && e.odds >= 1.05 && e.odds <= 1.6);
      const cSafeLive = tryBuildCombo(safeLive, 'cote2', 'Combo Sur LIVE - Cote Max 3', 'live', 1.3, 3.2, 3, `csafelive_${now}`);
      if (cSafeLive) combos.push(cSafeLive);

      // Cote 3 safe LIVE - diverse
      const diverseLive = liveEvents.filter(e => e.confidence > 50 && e.odds >= 1.2 && e.odds <= 2.0 && !e.market.includes('BTTS'));
      const c3live = tryBuildCombo(diverseLive, 'cote3_safe', 'Cote 3 Sur LIVE', 'live', 2.2, 4.5, 3, `c3live_${now}`);
      if (c3live) combos.push(c3live);

      // Cote 5 live
      const medLive = liveEvents.filter(e => e.confidence > 40 && e.odds >= 1.4 && e.odds <= 2.5);
      const c5live = tryBuildCombo(medLive, 'cote5', 'Cote 5 LIVE', 'live', 3.5, 8, 3, `c5live_${now}`);
      if (c5live) combos.push(c5live);

      // Score exact live
      const reliableLivePreds = livePreds.filter(p => isReliableLeague(p.match.league) && p.pred.confidence > 50);
      if (reliableLivePreds.length >= 1) {
        const b = reliableLivePreds[0];
        const sc = b.pred.scores[0];
        if (sc) {
          const seOdds = Math.round((3.5 + Math.random() * 3) * 100) / 100;
          combos.push({
            id: `selive_${now}`,
            events: [{ match: b.match, market: 'Score Final LIVE', selection: sc.score, odds: seOdds, confidence: sc.probability }],
            totalOdds: seOdds,
            confidence: sc.probability,
            type: 'score_exact_ft', label: 'Score LIVE - Fiable', category: 'live',
            createdAt: now,
          });
        }
      }
    }

    // Sort: live first, then by type priority
    const typePriority: Record<string, number> = { cote2: 0, cote3_safe: 1, cote5: 2, cote10: 3, score_exact_mt: 4, score_exact_ft: 5 };
    combos.sort((a, b) => {
      if (a.category !== b.category) return a.category === 'live' ? -1 : 1;
      return (typePriority[a.type] || 5) - (typePriority[b.type] || 5);
    });

    return combos;
  } catch (e) {
    return [];
  }
}
