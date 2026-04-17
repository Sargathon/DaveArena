import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch (e) { /* */ }
import { theme } from '../../constants/theme';
import { useMatches } from '../../contexts/MatchContext';
import { useAuth } from '../../contexts/AuthContext';
import { generatePrediction, Prediction, Match } from '../../services/api';

export default function PronosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { allMatches, isLoading, refresh } = useMatches();
  const { canAnalyze, remainingAnalyses, user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  useEffect(() => {
    const preds = allMatches.slice(0, 10).map((m) => generatePrediction(m));
    setPredictions(preds);
  }, [allMatches]);

  const getRiskColor = (risk: string) => {
    if (risk === 'Faible') return theme.success;
    if (risk === 'Moyen') return theme.warning;
    if (risk === 'Eleve') return theme.error;
    return theme.textMuted;
  };

  const isFree = user?.tier === 'free' && !user?.isAdmin;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pronostics IA</Text>
        <View style={styles.headerRight}>
          {isFree && (
            <View style={styles.quotaPill}>
              <Text style={styles.quotaText}>{remainingAnalyses}/{5}</Text>
            </View>
          )}
          <View style={styles.headerBadge}>
            <MaterialIcons name="auto-awesome" size={14} color={theme.primary} />
            <Text style={styles.headerBadgeText}>Multi-IA</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={theme.primary} />}
      >
        {/* Model info */}
        <View style={styles.modelInfo}>
          <MaterialIcons name="science" size={14} color={theme.accent} />
          <Text style={styles.modelInfoText}>Poisson · Monte Carlo · Régression · XGBoost</Text>
        </View>

        {predictions.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <MaterialIcons name="sports-soccer" size={48} color={theme.textMuted} />
            <Text style={styles.emptyText}>Aucun pronostic disponible</Text>
          </View>
        )}

        {predictions.map((pred, index) => (
          <Animated.View key={pred.match.id} entering={FadeInDown.delay(index * 60).duration(400)}>
            <Pressable
              style={styles.predCard}
              onPress={() => { try { Haptics?.selectionAsync(); } catch (e) { /* */ } router.push(`/match/${pred.match.id}`); }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.leagueName} numberOfLines={1}>{pred.match.league}</Text>
                <View style={[styles.tierChip, { backgroundColor: `${pred.leagueTier === 'high' ? theme.error : pred.leagueTier === 'medium' ? theme.warning : theme.accent}12` }]}>
                  <Text style={[styles.tierChipText, { color: pred.leagueTier === 'high' ? theme.error : pred.leagueTier === 'medium' ? theme.warning : theme.accent }]}>
                    {pred.leagueTier === 'high' ? '🔥' : pred.leagueTier === 'medium' ? '⚡' : '📊'}
                  </Text>
                </View>
                {pred.match.status === 'live' && (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDotSmall} />
                    <Text style={styles.liveSmallText}>LIVE {pred.match.minute}</Text>
                  </View>
                )}
              </View>

              <View style={styles.teamsRow}>
                <View style={styles.teamInfo}>
                  {pred.match.homeTeamImg ? (
                    <Image source={{ uri: pred.match.homeTeamImg }} style={styles.logo} contentFit="contain" />
                  ) : (
                    <View style={styles.logoPlaceholder}><MaterialIcons name="shield" size={16} color={theme.textMuted} /></View>
                  )}
                  <Text style={styles.teamName} numberOfLines={1}>{pred.match.homeTeam}</Text>
                </View>
                <View style={styles.vsBox}>
                  {pred.match.score ? (
                    <Text style={styles.vsScore}>{pred.match.score.home} - {pred.match.score.away}</Text>
                  ) : (
                    <Text style={styles.vsText}>VS</Text>
                  )}
                </View>
                <View style={[styles.teamInfo, { alignItems: 'flex-end' }]}>
                  {pred.match.awayTeamImg ? (
                    <Image source={{ uri: pred.match.awayTeamImg }} style={styles.logo} contentFit="contain" />
                  ) : (
                    <View style={styles.logoPlaceholder}><MaterialIcons name="shield" size={16} color={theme.textMuted} /></View>
                  )}
                  <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>{pred.match.awayTeam}</Text>
                </View>
              </View>

              <View style={styles.predSummary}>
                <View style={styles.predItem}>
                  <Text style={styles.predLabel}>1</Text>
                  <Text style={styles.predValue}>{pred.result1X2.home}%</Text>
                </View>
                <View style={styles.predItem}>
                  <Text style={styles.predLabel}>X</Text>
                  <Text style={styles.predValue}>{pred.result1X2.draw}%</Text>
                </View>
                <View style={styles.predItem}>
                  <Text style={styles.predLabel}>2</Text>
                  <Text style={styles.predValue}>{pred.result1X2.away}%</Text>
                </View>
                <View style={[styles.predItem, { borderRightWidth: 0 }]}>
                  <Text style={styles.predLabel}>Score</Text>
                  <Text style={[styles.predValue, { color: theme.primary }]}>{pred.scores[0]?.score}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.confidencePill}>
                  <MaterialIcons name="verified" size={14} color={theme.accent} />
                  <Text style={styles.confidenceText}>{pred.confidence}%</Text>
                </View>
                <View style={[styles.riskPill, { backgroundColor: `${getRiskColor(pred.risk)}15` }]}>
                  <Text style={[styles.riskText, { color: getRiskColor(pred.risk) }]}>Risque {pred.risk}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <MaterialIcons name="arrow-forward-ios" size={14} color={theme.textMuted} />
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotaPill: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  quotaText: { fontSize: 11, color: theme.warning, fontWeight: '700' },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  headerBadgeText: { fontSize: 12, color: theme.primary, fontWeight: '600' },
  modelInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: theme.radius.sm, padding: 10, marginBottom: 12 },
  modelInfoText: { fontSize: 11, color: theme.textMuted },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: theme.textSecondary, marginTop: 12, fontWeight: '600' },
  predCard: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  leagueName: { fontSize: 12, color: theme.textMuted, fontWeight: '500', flex: 1 },
  tierChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tierChipText: { fontSize: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.live },
  liveSmallText: { fontSize: 10, color: theme.live, fontWeight: '700' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  teamInfo: { flex: 1, alignItems: 'flex-start', gap: 4 },
  logo: { width: 32, height: 32 },
  logoPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 13, color: theme.textPrimary, fontWeight: '600' },
  vsBox: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: theme.surfaceLight, borderRadius: theme.radius.sm, marginHorizontal: 8 },
  vsText: { fontSize: 14, color: theme.textMuted, fontWeight: '700' },
  vsScore: { fontSize: 16, color: theme.textPrimary, fontWeight: '800' },
  predSummary: { flexDirection: 'row', backgroundColor: theme.surfaceLight, borderRadius: theme.radius.sm, overflow: 'hidden', marginBottom: 10 },
  predItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: 1, borderRightColor: theme.border },
  predLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  predValue: { fontSize: 14, color: theme.textPrimary, fontWeight: '700', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confidencePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  confidenceText: { fontSize: 12, color: theme.accent, fontWeight: '700' },
  riskPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 11, fontWeight: '600' },
});
