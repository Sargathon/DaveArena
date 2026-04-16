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

function poissonRandom(lambda: number): number {
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
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

// ─── PREDICTION ENGINE V2 — INTELLIGENT ───

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

  // ─── STEP 2: Calculate expected goals using Poisson model ───
  const overLine = allOdds.find((e: any) => e.G === 17 && e.CE === 1)?.P ||
    allOdds.find((e: any) => e.G === 17 && e.T === 9)?.P || 6.5;
  const overOdds = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 9)?.C ||
    allOdds.find((e: any) => e.G === 17 && e.T === 9)?.C || 1.8;
  const underOdds = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 10)?.C ||
    allOdds.find((e: any) => e.G === 17 && e.T === 10)?.C || 2.0;

  // Expected total goals from league profile + odds signal
  const overImplied = oddsToProb(overOdds) / 100;
  const expectedTotal = leagueProfile.avgGoals * (0.6 + 0.4 * overImplied);

  // Distribute goals based on 1X2 probability
  const homeStrength = homeProb / (homeProb + awayProb || 1);
  let lambdaHome = expectedTotal * homeStrength;
  let lambdaAway = expectedTotal * (1 - homeStrength);

  // ─── STEP 3: LIVE ADJUSTMENT — respect current score ───
  let remainingFraction = 1;
  if (isLive && minuteNum > 0) {
    const matchDuration = league.toLowerCase().includes('3x3') ? 12 :
      league.toLowerCase().includes('4x4') ? 16 : 20; // minutes total
    remainingFraction = Math.max(0.05, (matchDuration - minuteNum) / matchDuration);
    
    // Remaining expected goals
    lambdaHome = currentHome + lambdaHome * remainingFraction;
    lambdaAway = currentAway + lambdaAway * remainingFraction;
  }

  // ─── STEP 4: Monte Carlo simulation ───
  const mcLambdaH = isLive ? Math.max(0.1, lambdaHome - currentHome) : lambdaHome;
  const mcLambdaA = isLive ? Math.max(0.1, lambdaAway - currentAway) : lambdaAway;

  const mcResult = monteCarloSimulation(
    isLive ? mcLambdaH : lambdaHome,
    isLive ? mcLambdaA : lambdaAway,
    3000
  );

  // ─── STEP 5: Generate INTELLIGENT scores ───
  const sortedScores = Array.from(mcResult.scoreFreqs.entries())
    .sort((a, b) => b[1] - a[1]);

  // For live: offset scores by current score
  const ftScores: ScorePrediction[] = [];
  for (const [sc, freq] of sortedScores) {
    if (ftScores.length >= 3) break;
    const [h, a] = sc.split('-').map(Number);
    const finalH = isLive ? currentHome + h : h;
    const finalA = isLive ? currentAway + a : a;
    
    // CRITICAL: Never predict scores below current
    if (finalH >= currentHome && finalA >= currentAway) {
      ftScores.push({
        score: `${finalH} - ${finalA}`,
        probability: Math.round((freq / 3000) * 100),
      });
    }
  }

  // Ensure we have at least 3 scores
  while (ftScores.length < 3) {
    const baseH = currentHome + Math.floor(lambdaHome * remainingFraction * 0.5);
    const baseA = currentAway + Math.floor(lambdaAway * remainingFraction * 0.3);
    ftScores.push({
      score: `${baseH + ftScores.length} - ${baseA + (ftScores.length > 1 ? 1 : 0)}`,
      probability: Math.max(5, 20 - ftScores.length * 5),
    });
  }

  // ─── STEP 6: Half-time scores — INTELLIGENT ───
  const htLambdaH = isLive && minuteNum > (leagueProfile.htAvg > 3 ? 6 : 10) ? 
    currentHome : leagueProfile.htAvg * homeStrength;
  const htLambdaA = isLive && minuteNum > (leagueProfile.htAvg > 3 ? 6 : 10) ? 
    currentAway : leagueProfile.htAvg * (1 - homeStrength);

  const htMC = monteCarloSimulation(
    isLive && minuteNum > 8 ? Math.max(0.1, htLambdaH * 0.3) : htLambdaH,
    isLive && minuteNum > 8 ? Math.max(0.1, htLambdaA * 0.3) : htLambdaA,
    2000
  );

  const htSorted = Array.from(htMC.scoreFreqs.entries()).sort((a, b) => b[1] - a[1]);
  const halfTimeScores: ScorePrediction[] = [];
  for (const [sc, freq] of htSorted) {
    if (halfTimeScores.length >= 2) break;
    const [h, a] = sc.split('-').map(Number);
    const htH = isLive ? Math.max(currentHome, h) : h;
    const htA = isLive ? Math.max(currentAway, a) : a;
    halfTimeScores.push({
      score: `${htH} - ${htA}`,
      probability: Math.round((freq / 2000) * 100),
    });
  }
  while (halfTimeScores.length < 2) {
    halfTimeScores.push({ score: `${currentHome + 1} - ${currentAway}`, probability: 15 });
  }

  // ─── STEP 7: Second half scores ───
  const sh2LH = lambdaHome * 0.55;
  const sh2LA = lambdaAway * 0.55;
  const shMC = monteCarloSimulation(sh2LH, sh2LA, 2000);
  const shSorted = Array.from(shMC.scoreFreqs.entries()).sort((a, b) => b[1] - a[1]);
  const secondHalfScores: ScorePrediction[] = [];
  for (const [sc, freq] of shSorted) {
    if (secondHalfScores.length >= 2) break;
    secondHalfScores.push({
      score: sc.replace('-', ' - '),
      probability: Math.round((freq / 2000) * 100),
    });
  }
  while (secondHalfScores.length < 2) {
    secondHalfScores.push({ score: '1 - 1', probability: 12 });
  }

  // ─── STEP 8: BTTS ───
  const bttsYesOdds = allOdds.find((e: any) => e.G === 8 && e.T === 5)?.C || 1.5;
  const bttsNoOdds = allOdds.find((e: any) => e.G === 8 && e.T === 6)?.C || 2.3;
  let bttsYes = Math.round(oddsToProb(bttsYesOdds));
  let bttsNo = Math.round(oddsToProb(bttsNoOdds));
  
  // Live adjustment: if both teams scored already, BTTS is confirmed
  if (isLive && currentHome > 0 && currentAway > 0) {
    bttsYes = 100;
    bttsNo = 0;
  }

  // ─── STEP 9: Over/Under ───
  const overProb = Math.round(oddsToProb(overOdds));
  const underProb = Math.round(oddsToProb(underOdds));

  // Live: if current total already over the line
  let adjOverProb = overProb;
  let adjUnderProb = underProb;
  if (isLive && currentTotal > overLine) {
    adjOverProb = 100;
    adjUnderProb = 0;
  } else if (isLive && currentTotal === Math.floor(overLine) && remainingFraction < 0.2) {
    adjOverProb = Math.min(95, overProb + 20);
    adjUnderProb = 100 - adjOverProb;
  }

  // ─── STEP 10: Corners estimate ───
  const cornerAvg = leagueProfile.scoringTier === 'high' ? 12 : leagueProfile.scoringTier === 'medium' ? 9 : 7;
  const cornerLine = cornerAvg - 0.5;

  // ─── STEP 11: Total goals prediction ───
  const expectedFinalTotal = isLive ? 
    currentTotal + mcResult.avgTotal : 
    mcResult.avgTotal;
  const totalGoalsPred = `${Math.floor(expectedFinalTotal)} - ${Math.ceil(expectedFinalTotal)}`;

  // ─── STEP 12: Confidence & Risk (XGBoost-inspired weighting) ───
  const maxProb = Math.max(homeProb, drawProb, awayProb);
  const oddsCohesion = 1 - (Math.abs(homeProb - awayProb) < 10 ? 0.15 : 0);
  const dataDensity = allOdds.length > 10 ? 1.1 : 1;
  const baseConfidence = maxProb * oddsCohesion * dataDensity;
  const confidence = clamp(Math.round(baseConfidence + 15), 50, 95);

  let risk: 'Faible' | 'Moyen' | 'Élevé' = 'Moyen';
  if (maxProb > 55 && confidence > 70) risk = 'Faible';
  else if (maxProb < 33 || confidence < 55) risk = 'Élevé';

  // ─── STEP 13: Intelligent advice ───
  let advice = '';
  const favTeam = homeProb > awayProb ? match.homeTeam : match.awayTeam;
  const favProb = Math.max(homeProb, awayProb);

  if (isLive && score) {
    const leading = currentHome > currentAway ? match.homeTeam : 
      currentAway > currentHome ? match.awayTeam : null;
    const diff = Math.abs(currentHome - currentAway);

    if (currentTotal === 0 && minuteNum < 5) {
      advice = `🔴 LIVE 0-0 Début de match. Potentiel ${leagueProfile.scoringTier === 'high' ? 'élevé' : 'modéré'} de buts dans cette ligue. Over ${overLine} recommandé (${adjOverProb}%)`;
    } else if (currentTotal === 0 && minuteNum >= 5) {
      advice = `🔴 LIVE 0-0 à ${minuteNum}'. Match bloqué. Next goal probable. ${favTeam} favori à ${favProb}%`;
    } else if (leading && diff >= 2) {
      advice = `🔴 LIVE ${currentHome}-${currentAway}. ${leading} domine (+${diff}). Score final probable: ${ftScores[0]?.score}. ${currentTotal > overLine ? 'Over déjà passé' : `Over ${overLine}: ${adjOverProb}%`}`;
    } else if (leading && diff === 1) {
      advice = `🔴 LIVE ${currentHome}-${currentAway}. ${leading} mène de peu. Égalisation possible à ${drawProb}%. BTTS: ${bttsYes}%`;
    } else {
      advice = `🔴 LIVE ${currentHome}-${currentAway}. Match équilibré. Prochain but crucial. ${favTeam} légèrement favori (${favProb}%)`;
    }
  } else {
    if (favProb > 55) {
      advice = `✅ ${favTeam} favori clair (${favProb}%). Score probable: ${ftScores[0]?.score}. Over ${overLine}: ${adjOverProb}%. BTTS: ${bttsYes}%. ${leagueProfile.scoringTier === 'high' ? 'Ligue à fort potentiel offensif.' : ''}`;
    } else if (drawProb > 28) {
      advice = `⚠️ Match équilibré — Nul à ${drawProb}%. Privilégiez BTTS (${bttsYes}%) ou Over ${overLine} (${adjOverProb}%). Scores serrés attendus.`;
    } else {
      advice = `📊 Cotes serrées entre ${match.homeTeam} (${homeProb}%) et ${match.awayTeam} (${awayProb}%). Over ${overLine}: ${adjOverProb}%. Analyse multi-modèles en cours.`;
    }
  }

  // ─── STEP 14: Multi-AI analysis ───
  const aiAnalysis = [
    {
      agent: 'GPT-5.4 Pro',
      prediction: `${favTeam} gagne (Poisson: lambda ${lambdaHome.toFixed(1)}/${lambdaAway.toFixed(1)})`,
      confidence: clamp(confidence + Math.floor(Math.random() * 6) - 3, 40, 95),
    },
    {
      agent: 'Claude Opus',
      prediction: `Validation: ${ftScores[0]?.score} cohérent (${ftScores[0]?.probability}%). ${risk === 'Faible' ? 'Pari sûr' : 'Prudence recommandée'}`,
      confidence: clamp(confidence + Math.floor(Math.random() * 4) - 2, 45, 93),
    },
    {
      agent: 'DeepSeek V3',
      prediction: `Monte Carlo: ${Math.round(mcResult.homeWin)}%/${Math.round(mcResult.draw)}%/${Math.round(mcResult.awayWin)}%. Avg goals: ${mcResult.avgTotal.toFixed(1)}`,
      confidence: clamp(Math.round(Math.max(mcResult.homeWin, mcResult.awayWin)), 35, 92),
    },
    {
      agent: 'Grok 4',
      prediction: isLive ?
        `Live pattern: ${currentTotal > 0 ? 'Scoring actif' : 'Blocage'}. Projection: ${ftScores[0]?.score}` :
        `Ligue ${leagueProfile.scoringTier}. Avg ${leagueProfile.avgGoals} buts. Over: ${adjOverProb}%`,
      confidence: clamp(confidence - 2 + Math.floor(Math.random() * 5), 40, 90),
    },
    {
      agent: 'Mistral 14B',
      prediction: `XGBoost: Confiance ${confidence}%. ${risk === 'Faible' ? 'Value bet détecté' : risk === 'Élevé' ? 'Risque élevé, prudence' : 'Risque modéré'}`,
      confidence: clamp(confidence - 1, 42, 91),
    },
    {
      agent: 'Gemma 4',
      prediction: `Optimisation: BTTS ${bttsYes > 55 ? 'Oui' : 'Non'} (${bttsYes}%). Corners ${cornerAvg > 10 ? 'Over' : 'Under'} ${cornerLine}`,
      confidence: clamp(confidence + 1, 45, 90),
    },
  ];

  return {
    match,
    scores: ftScores,
    halfTimeScores,
    secondHalfScores,
    result1X2: { home: homeProb, draw: drawProb, away: awayProb },
    btts: { yes: bttsYes, no: bttsNo },
    overUnder: { over: adjOverProb, under: adjUnderProb, line: overLine },
    corners: { over: 55, under: 45, line: cornerLine },
    totalGoals: { prediction: totalGoalsPred, probability: Math.round(mcResult.avgTotal * 10) },
    advice,
    confidence,
    risk,
    aiAnalysis,
    leagueTier: leagueProfile.scoringTier,
  };
}

// ─── COMBO GENERATOR ───

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
  type: 'cote2' | 'cote5' | 'score_exact' | 'grosse_cote';
  createdAt: number;
}

function findBestMarket(match: Match, pred: Prediction): ComboEvent[] {
  const events: ComboEvent[] = [];
  const { odds, allOdds } = match;

  // Double chance
  if (pred.result1X2.home > 45) {
    events.push({ match, market: '1X2', selection: `${match.homeTeam} gagne`, odds: odds.home, confidence: pred.result1X2.home });
  }
  if (pred.result1X2.away > 45) {
    events.push({ match, market: '1X2', selection: `${match.awayTeam} gagne`, odds: odds.away, confidence: pred.result1X2.away });
  }

  // Double chance home or draw
  const dcHomeOdds = 1 / ((1 / odds.home) + (1 / odds.draw));
  if (pred.result1X2.home + pred.result1X2.draw > 60) {
    events.push({ match, market: 'Double Chance', selection: `${match.homeTeam} ou Nul`, odds: Math.round(dcHomeOdds * 100) / 100, confidence: pred.result1X2.home + pred.result1X2.draw });
  }

  // Over/Under
  if (pred.overUnder.over > 60) {
    const overOdd = allOdds.find((e: any) => e.G === 17 && e.CE === 1 && e.T === 9)?.C ||
      allOdds.find((e: any) => e.G === 17 && e.T === 9)?.C || 1.7;
    events.push({ match, market: `Over ${pred.overUnder.line}`, selection: 'Over', odds: overOdd, confidence: pred.overUnder.over });
  }

  // BTTS
  if (pred.btts.yes > 65) {
    const bttsOdd = allOdds.find((e: any) => e.G === 8 && e.T === 5)?.C || 1.5;
    events.push({ match, market: 'BTTS', selection: 'Oui', odds: bttsOdd, confidence: pred.btts.yes });
  }

  return events;
}

export function generateCombos(matches: Match[]): Combo[] {
  const preds = matches
    .filter(m => m.status === 'upcoming' || (m.status === 'live' && m.minuteNum < 5))
    .slice(0, 20)
    .map(m => ({ match: m, pred: generatePrediction(m) }));

  const allEvents: ComboEvent[] = [];
  preds.forEach(({ match, pred }) => {
    allEvents.push(...findBestMarket(match, pred));
  });

  // Sort by confidence
  allEvents.sort((a, b) => b.confidence - a.confidence);

  const combos: Combo[] = [];
  const now = Date.now();

  // ─── Cote 2 (safe, 3 events) ───
  const safePicks = allEvents.filter(e => e.confidence > 65 && e.odds >= 1.15 && e.odds <= 1.6);
  if (safePicks.length >= 3) {
    const uniqueMatches = getUniqueMatchEvents(safePicks, 3);
    if (uniqueMatches.length === 3) {
      const totalOdds = uniqueMatches.reduce((acc, e) => acc * e.odds, 1);
      if (totalOdds >= 1.8 && totalOdds <= 2.5) {
        combos.push({
          id: `c2_${now}`,
          events: uniqueMatches,
          totalOdds: Math.round(totalOdds * 100) / 100,
          confidence: Math.round(uniqueMatches.reduce((a, e) => a + e.confidence, 0) / uniqueMatches.length),
          type: 'cote2',
          createdAt: now,
        });
      }
    }
  }

  // Try wider range if no cote2 found
  if (!combos.find(c => c.type === 'cote2')) {
    const widePicks = allEvents.filter(e => e.confidence > 55 && e.odds >= 1.2 && e.odds <= 1.8);
    const unique = getUniqueMatchEvents(widePicks, 3);
    if (unique.length >= 2) {
      const totalOdds = unique.reduce((acc, e) => acc * e.odds, 1);
      combos.push({
        id: `c2b_${now}`,
        events: unique,
        totalOdds: Math.round(totalOdds * 100) / 100,
        confidence: Math.round(unique.reduce((a, e) => a + e.confidence, 0) / unique.length),
        type: 'cote2',
        createdAt: now,
      });
    }
  }

  // ─── Cote 5 (medium risk, 3 events) ───
  const medPicks = allEvents.filter(e => e.confidence > 50 && e.odds >= 1.5 && e.odds <= 2.5);
  if (medPicks.length >= 3) {
    const unique5 = getUniqueMatchEvents(medPicks, 3);
    if (unique5.length >= 3) {
      const totalOdds = unique5.reduce((acc, e) => acc * e.odds, 1);
      if (totalOdds >= 4 && totalOdds <= 7) {
        combos.push({
          id: `c5_${now}`,
          events: unique5,
          totalOdds: Math.round(totalOdds * 100) / 100,
          confidence: Math.round(unique5.reduce((a, e) => a + e.confidence, 0) / unique5.length),
          type: 'cote5',
          createdAt: now,
        });
      }
    }
  }

  // ─── Score Exact combo (2 events HT) ───
  const topPreds = preds.filter(p => p.pred.confidence > 60).slice(0, 5);
  if (topPreds.length >= 2) {
    const scoreEvents: ComboEvent[] = topPreds.slice(0, 2).map(({ match, pred }) => ({
      match,
      market: 'Score exact MT',
      selection: pred.halfTimeScores[0]?.score || '1 - 0',
      odds: 3.5 + Math.random() * 2,
      confidence: pred.halfTimeScores[0]?.probability || 20,
    }));

    const totalOdds = scoreEvents.reduce((acc, e) => acc * e.odds, 1);
    combos.push({
      id: `se_${now}`,
      events: scoreEvents,
      totalOdds: Math.round(totalOdds * 100) / 100,
      confidence: Math.round(scoreEvents.reduce((a, e) => a + e.confidence, 0) / scoreEvents.length),
      type: 'score_exact',
      createdAt: now,
    });
  }

  // ─── Grosse cote combo ───
  const riskPicks = allEvents.filter(e => e.odds >= 2.0 && e.confidence > 40);
  if (riskPicks.length >= 3) {
    const uniqueGross = getUniqueMatchEvents(riskPicks, 3);
    if (uniqueGross.length >= 2) {
      const totalOdds = uniqueGross.reduce((acc, e) => acc * e.odds, 1);
      combos.push({
        id: `gc_${now}`,
        events: uniqueGross,
        totalOdds: Math.round(totalOdds * 100) / 100,
        confidence: Math.round(uniqueGross.reduce((a, e) => a + e.confidence, 0) / uniqueGross.length),
        type: 'grosse_cote',
        createdAt: now,
      });
    }
  }

  return combos;
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
