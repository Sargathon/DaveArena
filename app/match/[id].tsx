import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAlert } from '@/template';
import { theme } from '../../constants/theme';
import { config } from '../../constants/config';
import { useMatches } from '../../contexts/MatchContext';
import { useAuth } from '../../contexts/AuthContext';
import { generatePrediction, Prediction } from '../../services/api';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { getMatchById } = useMatches();
  const { canAnalyze, useAnalysis, remainingAnalyses, user } = useAuth();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const match = getMatchById(Number(id));
    if (match) {
      if (!canAnalyze()) { setLocked(true); return; }
      useAnalysis();
      setPrediction(generatePrediction(match));
    }
  }, [id]);

  const match = prediction?.match;

  if (locked) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <MaterialIcons name="lock" size={56} color={theme.warning} />
        <Text style={styles.lockedTitle}>Limite atteinte</Text>
        <Text style={styles.lockedSub}>
          Vous avez utilise vos {config.freeAnalysisPerDay} analyses gratuites. Passez en VIP pour des analyses illimitees.
        </Text>
        <Pressable style={styles.vipBtn} onPress={() => router.push('/vip')}>
          <MaterialIcons name="star" size={16} color="#FFF" />
          <Text style={styles.vipBtnText}>Voir les plans VIP</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={{ color: theme.textMuted, fontSize: 14 }}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!match || !prediction) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const getRiskColor = (risk: string) => {
    switch (risk) { case 'Faible': return theme.success; case 'Moyen': return theme.warning; default: return theme.error; }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Prediction IA</Text>
        {remainingAnalyses >= 0 ? (
          <View style={styles.remainBadge}><Text style={styles.remainText}>{remainingAnalyses} restants</Text></View>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* Match Card */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.matchCard}>
          <View style={styles.leagueRow}>
            <Text style={styles.league}>{match.league}</Text>
            <View style={[styles.tierBadge, { backgroundColor: `${prediction.leagueTier === 'high' ? theme.error : prediction.leagueTier === 'medium' ? theme.warning : theme.accent}15` }]}>
              <Text style={[styles.tierText, { color: prediction.leagueTier === 'high' ? theme.error : prediction.leagueTier === 'medium' ? theme.warning : theme.accent }]}>
                {prediction.leagueTier === 'high' ? 'Fort scoring' : prediction.leagueTier === 'medium' ? 'Scoring moyen' : 'Faible scoring'}
              </Text>
            </View>
          </View>
          {match.status === 'live' && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDotAnim} />
              <Text style={styles.liveText}>EN DIRECT - {match.minute}</Text>
            </View>
          )}
          <View style={styles.teamsRow}>
            <View style={styles.teamCol}>
              {match.homeTeamImg ? (
                <Image source={{ uri: match.homeTeamImg }} style={styles.teamLogo} contentFit="contain" />
              ) : (
                <View style={styles.teamLogoPlaceholder}><MaterialIcons name="shield" size={28} color={theme.textMuted} /></View>
              )}
              <Text style={styles.teamName} numberOfLines={2}>{match.homeTeam}</Text>
            </View>
            <View style={styles.scoreSection}>
              {match.score ? (
                <Text style={styles.bigScore}>{match.score.home} - {match.score.away}</Text>
              ) : (
                <Text style={styles.vsText}>VS</Text>
              )}
              {match.status !== 'live' && <Text style={styles.startTime}>{match.minute || 'A venir'}</Text>}
            </View>
            <View style={styles.teamCol}>
              {match.awayTeamImg ? (
                <Image source={{ uri: match.awayTeamImg }} style={styles.teamLogo} contentFit="contain" />
              ) : (
                <View style={styles.teamLogoPlaceholder}><MaterialIcons name="shield" size={28} color={theme.textMuted} /></View>
              )}
              <Text style={styles.teamName} numberOfLines={2}>{match.awayTeam}</Text>
            </View>
          </View>
          <View style={styles.oddsRow}>
            <View style={styles.oddBox}><Text style={styles.oddLabel}>1</Text><Text style={styles.oddVal}>{match.odds.home.toFixed(2)}</Text></View>
            <View style={styles.oddBox}><Text style={styles.oddLabel}>X</Text><Text style={styles.oddVal}>{match.odds.draw.toFixed(2)}</Text></View>
            <View style={styles.oddBox}><Text style={styles.oddLabel}>2</Text><Text style={styles.oddVal}>{match.odds.away.toFixed(2)}</Text></View>
          </View>
        </Animated.View>

        {/* Advice */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.adviceCard}>
          <MaterialIcons name="lightbulb" size={20} color={theme.warning} />
          <Text style={styles.adviceText}>{prediction.advice}</Text>
        </Animated.View>

        {/* Confidence & Risk */}
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CONFIANCE</Text>
            <Text style={[styles.metricValue, { color: theme.accent }]}>{prediction.confidence}%</Text>
            <View style={styles.metricBar}>
              <View style={[styles.metricBarFill, { width: `${prediction.confidence}%`, backgroundColor: theme.accent }]} />
            </View>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>RISQUE</Text>
            <Text style={[styles.metricValue, { color: getRiskColor(prediction.risk) }]}>{prediction.risk}</Text>
            <View style={[styles.riskIndicator, { backgroundColor: `${getRiskColor(prediction.risk)}20` }]}>
              <MaterialIcons name="warning" size={14} color={getRiskColor(prediction.risk)} />
            </View>
          </View>
        </Animated.View>

        {/* 1X2 */}
        <Animated.View entering={FadeInDown.delay(160).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Probabilites 1X2</Text>
          {[
            { label: match.homeTeam, value: prediction.result1X2.home, color: theme.primary },
            { label: 'Nul', value: prediction.result1X2.draw, color: theme.textMuted },
            { label: match.awayTeam, value: prediction.result1X2.away, color: theme.accent },
          ].map((item, i) => (
            <View key={i} style={styles.probItem}>
              <Text style={styles.probTeam} numberOfLines={1}>{item.label}</Text>
              <Text style={[styles.probPercent, item.value === Math.max(prediction.result1X2.home, prediction.result1X2.draw, prediction.result1X2.away) && { color: item.color }]}>{item.value}%</Text>
              <View style={styles.probBar}>
                <View style={[styles.probBarFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Scores FT */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Scores Probables (Temps reglementaire)</Text>
          <View style={styles.scoresGrid}>
            {prediction.scores.map((s, i) => (
              <View key={i} style={[styles.scoreCard, i === 0 && styles.scoreCardPrimary]}>
                <Text style={[styles.scoreValue, i === 0 && { color: theme.primary }]}>{s.score}</Text>
                <Text style={styles.scoreProbability}>{s.probability}%</Text>
                {i === 0 ? <View style={styles.scoreBest}><Text style={styles.scoreBestText}>BEST</Text></View> : null}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Half Time */}
        <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Scores Mi-Temps</Text>
          <View style={styles.halfGrid}>
            <View style={styles.halfSection}>
              <Text style={styles.halfLabel}>1ERE MI-TEMPS</Text>
              {prediction.halfTimeScores.map((s, i) => (
                <View key={i} style={styles.halfScoreRow}>
                  <Text style={styles.halfScore}>{s.score}</Text>
                  <Text style={styles.halfPct}>{s.probability}%</Text>
                </View>
              ))}
            </View>
            <View style={styles.halfDivider} />
            <View style={styles.halfSection}>
              <Text style={styles.halfLabel}>2EME MI-TEMPS</Text>
              {prediction.secondHalfScores.map((s, i) => (
                <View key={i} style={styles.halfScoreRow}>
                  <Text style={styles.halfScore}>{s.score}</Text>
                  <Text style={styles.halfPct}>{s.probability}%</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Markets */}
        <Animated.View entering={FadeInDown.delay(280).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Marches Avances</Text>
          <View style={styles.marketsGrid}>
            <View style={styles.marketCard}>
              <Text style={styles.marketTitle}>BTTS</Text>
              <View style={styles.marketRow}>
                <View style={styles.marketItem}>
                  <Text style={styles.marketLabel}>Oui</Text>
                  <Text style={[styles.marketValue, prediction.btts.yes > prediction.btts.no && { color: theme.success }]}>{prediction.btts.yes}%</Text>
                </View>
                <View style={styles.marketItem}>
                  <Text style={styles.marketLabel}>Non</Text>
                  <Text style={[styles.marketValue, prediction.btts.no > prediction.btts.yes && { color: theme.error }]}>{prediction.btts.no}%</Text>
                </View>
              </View>
            </View>
            <View style={styles.marketCard}>
              <Text style={styles.marketTitle}>Over/Under {prediction.overUnder.line}</Text>
              <View style={styles.marketRow}>
                <View style={styles.marketItem}>
                  <Text style={styles.marketLabel}>Over</Text>
                  <Text style={[styles.marketValue, prediction.overUnder.over > prediction.overUnder.under && { color: theme.success }]}>{prediction.overUnder.over}%</Text>
                </View>
                <View style={styles.marketItem}>
                  <Text style={styles.marketLabel}>Under</Text>
                  <Text style={[styles.marketValue, prediction.overUnder.under > prediction.overUnder.over && { color: theme.error }]}>{prediction.overUnder.under}%</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.marketsGrid}>
            <View style={styles.marketCard}>
              <Text style={styles.marketTitle}>Corners {prediction.corners.line}</Text>
              <View style={styles.marketRow}>
                <View style={styles.marketItem}><Text style={styles.marketLabel}>Over</Text><Text style={styles.marketValue}>{prediction.corners.over}%</Text></View>
                <View style={styles.marketItem}><Text style={styles.marketLabel}>Under</Text><Text style={styles.marketValue}>{prediction.corners.under}%</Text></View>
              </View>
            </View>
            <View style={styles.marketCard}>
              <Text style={styles.marketTitle}>Total Buts</Text>
              <Text style={[styles.marketValue, { textAlign: 'center', marginTop: 6 }]}>{prediction.totalGoals.prediction} buts</Text>
            </View>
          </View>
        </Animated.View>

        {/* AI Analysis */}
        <Animated.View entering={FadeInDown.delay(320).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Analyse Multi-IA</Text>
          {prediction.aiAnalysis.map((ai, i) => {
            const agentConfig = config.aiAgents.find(a => a.name === ai.agent);
            return (
              <View key={i} style={styles.aiRow}>
                <View style={[styles.aiDot, { backgroundColor: agentConfig?.color || theme.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiName}>{ai.agent}</Text>
                  <Text style={styles.aiPred}>{ai.prediction}</Text>
                </View>
                <View style={styles.aiConf}>
                  <Text style={[styles.aiConfText, { color: ai.confidence > 60 ? theme.success : theme.warning }]}>{ai.confidence}%</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>

        {/* Models */}
        <Animated.View entering={FadeInDown.delay(360).duration(500)} style={styles.section}>
          <View style={styles.modelsBox}>
            <MaterialIcons name="science" size={16} color={theme.textMuted} />
            <Text style={styles.modelsText}>Modeles: Poisson - Monte Carlo (5000 sim.) - Regression - XGBoost - Bayesien</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  remainBadge: { backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  remainText: { fontSize: 11, color: theme.primary, fontWeight: '700' },
  lockedTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginTop: 16 },
  lockedSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  vipBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: theme.radius.md, paddingHorizontal: 24, paddingVertical: 14, marginTop: 20 },
  vipBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  backLink: { marginTop: 16, padding: 12 },
  matchCard: { backgroundColor: theme.surface, marginHorizontal: 16, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  leagueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  league: { fontSize: 12, color: theme.textMuted },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tierText: { fontSize: 10, fontWeight: '700' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
  liveDotAnim: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.live },
  liveText: { fontSize: 12, color: theme.live, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  teamCol: { flex: 1, alignItems: 'center' },
  teamLogo: { width: 52, height: 52, marginBottom: 8 },
  teamLogoPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  teamName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  scoreSection: { alignItems: 'center', paddingHorizontal: 12 },
  bigScore: { fontSize: 28, fontWeight: '900', color: theme.textPrimary },
  vsText: { fontSize: 20, fontWeight: '700', color: theme.textMuted },
  startTime: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  oddsRow: { flexDirection: 'row', gap: 8 },
  oddBox: { flex: 1, alignItems: 'center', backgroundColor: theme.surfaceLight, paddingVertical: 8, borderRadius: theme.radius.sm },
  oddLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  oddVal: { fontSize: 15, color: theme.primary, fontWeight: '700', marginTop: 2 },
  adviceCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(245,158,11,0.08)', marginHorizontal: 16, borderRadius: theme.radius.md, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  adviceText: { fontSize: 13, color: theme.textPrimary, flex: 1, lineHeight: 20 },
  metricsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.border },
  metricLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { fontSize: 24, fontWeight: '800', marginTop: 4, marginBottom: 6 },
  metricBar: { height: 4, backgroundColor: theme.surfaceLight, borderRadius: 2, overflow: 'hidden' },
  metricBarFill: { height: 4, borderRadius: 2 },
  riskIndicator: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 },
  probItem: { backgroundColor: theme.surface, borderRadius: theme.radius.sm, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, borderWidth: 1, borderColor: theme.border },
  probTeam: { fontSize: 13, color: theme.textPrimary, fontWeight: '600', width: 90 },
  probPercent: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, width: 50, textAlign: 'right' },
  probBar: { flex: 1, height: 6, backgroundColor: theme.surfaceLight, borderRadius: 3, overflow: 'hidden' },
  probBarFill: { height: 6, borderRadius: 3 },
  scoresGrid: { flexDirection: 'row', gap: 8 },
  scoreCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  scoreCardPrimary: { borderColor: theme.primary, backgroundColor: 'rgba(249,115,22,0.05)' },
  scoreValue: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  scoreProbability: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  scoreBest: { backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
  scoreBestText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  halfGrid: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  halfSection: { flex: 1, padding: 12 },
  halfDivider: { width: 1, backgroundColor: theme.border },
  halfLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  halfScoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  halfScore: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  halfPct: { fontSize: 13, color: theme.primary, fontWeight: '600' },
  marketsGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  marketCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 12, borderWidth: 1, borderColor: theme.border },
  marketTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  marketRow: { flexDirection: 'row', gap: 8 },
  marketItem: { flex: 1, alignItems: 'center' },
  marketLabel: { fontSize: 11, color: theme.textMuted },
  marketValue: { fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginTop: 2 },
  aiRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.sm, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: theme.border, gap: 10 },
  aiDot: { width: 10, height: 10, borderRadius: 5 },
  aiName: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  aiPred: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  aiConf: { backgroundColor: theme.surfaceLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  aiConfText: { fontSize: 12, fontWeight: '700' },
  modelsBox: { flexDirection: 'row', gap: 8, backgroundColor: theme.surface, borderRadius: theme.radius.sm, padding: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  modelsText: { fontSize: 11, color: theme.textMuted, flex: 1, lineHeight: 16 },
});
