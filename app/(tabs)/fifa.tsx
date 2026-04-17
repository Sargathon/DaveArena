import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch (e) { /* haptics not available */ }
import { theme } from '../../constants/theme';
import { useMatches } from '../../contexts/MatchContext';
import { useAuth } from '../../contexts/AuthContext';
import { Combo } from '../../services/api';

const TABS = ['FIFA', 'Combines', 'Historique'] as const;

const LEAGUE_FLAGS: Record<string, string> = {
  'bundesliga': '\uD83C\uDDE9\uD83C\uDDEA', 'la liga': '\uD83C\uDDEA\uD83C\uDDF8', 'serie a': '\uD83C\uDDEE\uD83C\uDDF9',
  'euro': '\uD83C\uDDEA\uD83C\uDDFA', 'champions': '\uD83C\uDFC6', 'world': '\uD83C\uDF0D',
  'premier': '\uD83C\uDFF4', 'ligue 1': '\uD83C\uDDEB\uD83C\uDDF7',
  '3x3': '\u26A1', '4x4': '\uD83D\uDD25', '5x5': '\uD83C\uDFAE', 'conference': '\uD83C\uDFDF\uFE0F',
};

function getLeagueFlag(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, flag] of Object.entries(LEAGUE_FLAGS)) {
    if (lower.includes(key)) return flag;
  }
  return '\u26BD';
}

const COMBO_META: Record<string, { label: string; color: string; icon: string }> = {
  cote2: { label: 'Cote 2 \u00B7 Sur', color: '#10B981', icon: 'verified' },
  cote3_safe: { label: 'Cote 3 \u00B7 Analyse', color: '#06B6D4', icon: 'shield' },
  cote5: { label: 'Cote 5 \u00B7 Moyen', color: '#F59E0B', icon: 'trending-up' },
  cote10: { label: 'Cote 10++ \u00B7 Risque', color: '#EF4444', icon: 'local-fire-department' },
  score_exact_mt: { label: 'Score Exact MT', color: '#8B5CF6', icon: 'sports-score' },
  score_exact_ft: { label: 'Score Exact Tps Reg.', color: '#EC4899', icon: 'sports-score' },
};

function ComboCard({ combo, isVip, onPress }: { combo: Combo; isVip: boolean; onPress: () => void }) {
  const meta = COMBO_META[combo.type] || COMBO_META.cote2;
  const locked = !isVip && combo.type !== 'cote2';
  return (
    <Pressable style={[styles.comboCard, combo.category === 'live' && styles.comboCardLive]} onPress={onPress}>
      <View style={styles.comboHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[styles.comboTypeBadge, { backgroundColor: `${meta.color}15` }]}>
            <MaterialIcons name={meta.icon as any} size={14} color={meta.color} />
            <Text style={[styles.comboTypeText, { color: meta.color }]}>{combo.label || meta.label}</Text>
          </View>
          {combo.category === 'live' && (
            <View style={styles.comboLiveBadge}>
              <View style={styles.comboLiveDot} />
              <Text style={styles.comboLiveText}>LIVE</Text>
            </View>
          )}
        </View>
        <View style={styles.comboOddsBox}>
          <Text style={styles.comboOddsLabel}>Cote totale</Text>
          <Text style={styles.comboOddsValue}>{combo.totalOdds.toFixed(2)}</Text>
        </View>
      </View>

      {combo.events.map((ev, i) => (
        <View key={i} style={styles.comboEvent}>
          <View style={[styles.comboEventDot, { backgroundColor: meta.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.comboMatchName} numberOfLines={1}>{ev.match.homeTeam} vs {ev.match.awayTeam}</Text>
            <Text style={styles.comboLeague} numberOfLines={1}>{ev.match.league}</Text>
            <Text style={styles.comboMarket}>{ev.market}: <Text style={{ color: theme.primary, fontWeight: '700' }}>{ev.selection}</Text></Text>
          </View>
          <View style={styles.comboEventOddBox}>
            <Text style={styles.comboEventOdd}>{ev.odds.toFixed(2)}</Text>
          </View>
        </View>
      ))}

      <View style={styles.comboFooter}>
        <View style={styles.confidencePill}>
          <MaterialIcons name="verified" size={12} color={theme.accent} />
          <Text style={styles.confidenceText}>{combo.confidence}%</Text>
        </View>
        <View style={[styles.comboEvCount, { backgroundColor: `${meta.color}10` }]}>
          <Text style={[styles.comboEvCountText, { color: meta.color }]}>{combo.events.length} events</Text>
        </View>
        {locked && (
          <View style={styles.vipLock}>
            <MaterialIcons name="lock" size={12} color={theme.warning} />
            <Text style={styles.vipLockText}>VIP</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function FifaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { leagues, liveMatches, isLoading, lastUpdate, refresh, combos, comboHistory } = useMatches();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('FIFA');
  const [expandedLeagues, setExpandedLeagues] = useState<Set<number>>(new Set());
  const [comboFilter, setComboFilter] = useState<string>('all');
  const isVip = user?.isAdmin || (user?.tier !== undefined && user.tier !== 'free') || false;

  const toggleLeague = (id: number) => {
    try { Haptics?.selectionAsync(); } catch (e) { /* */ }
    setExpandedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredCombos = comboFilter === 'all' ? combos :
    comboFilter === 'live' ? combos.filter(c => c.category === 'live') :
    combos.filter(c => c.type === comboFilter);

  const comboFilters = [
    { id: 'all', label: 'Tous' },
    { id: 'live', label: 'Live' },
    { id: 'cote2', label: 'Cote 2' },
    { id: 'cote3_safe', label: 'Cote 3 Sur' },
    { id: 'cote5', label: 'Cote 5' },
    { id: 'cote10', label: 'Cote 10+' },
    { id: 'score_exact_mt', label: 'Score MT' },
    { id: 'score_exact_ft', label: 'Score FT' },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="sports-esports" size={28} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>FIFA Virtual</Text>
          <View style={styles.headerMeta}>
            {liveMatches.length > 0 && (
              <View style={styles.liveCountBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveCountText}>{liveMatches.length} EN DIRECT</Text>
              </View>
            )}
            <Text style={styles.updateText}>MAJ {formatTime(lastUpdate)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {TABS.map(t => (
            <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]}
              onPress={() => { try { Haptics?.selectionAsync(); } catch (e) { /* */ } setActiveTab(t); }}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={theme.primary} />}
      >
        {isLoading && leagues.length === 0 && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Chargement des matchs...</Text>
          </View>
        )}

        {/* FIFA TAB */}
        {activeTab === 'FIFA' && leagues.map((league, idx) => (
          <Animated.View key={league.id} entering={FadeInDown.delay(idx * 60).duration(400)}>
            <Pressable style={styles.leagueCard} onPress={() => toggleLeague(league.id)}>
              <Text style={styles.leagueFlag}>{getLeagueFlag(league.name)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.leagueName} numberOfLines={1}>FIFA {league.name.replace(/FC 26\. /i, '').replace(/Superleague/i, 'League')}</Text>
              </View>
              {league.liveCount > 0 && (
                <View style={styles.leagueLive}>
                  <View style={styles.liveDotSmall} />
                  <Text style={styles.leagueLiveText}>{league.liveCount} LIVE</Text>
                </View>
              )}
              <Text style={styles.matchCount}>{league.matches.length} matchs</Text>
              <MaterialIcons name={expandedLeagues.has(league.id) ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
            </Pressable>

            {expandedLeagues.has(league.id) && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.matchList}>
                {league.matches.map(match => (
                  <Pressable key={match.id} style={styles.matchRow}
                    onPress={() => { try { Haptics?.selectionAsync(); } catch (e) { /* */ } router.push(`/match/${match.id}`); }}>
                    <View style={styles.matchTeams}>
                      <View style={styles.matchTeamRow}>
                        {match.homeTeamImg ? (
                          <Image source={{ uri: match.homeTeamImg }} style={styles.matchLogo} contentFit="contain" />
                        ) : (
                          <View style={styles.matchLogoPlaceholder}><MaterialIcons name="shield" size={14} color={theme.textMuted} /></View>
                        )}
                        <Text style={styles.matchTeamName} numberOfLines={1}>{match.homeTeam}</Text>
                      </View>
                      <View style={styles.matchTeamRow}>
                        {match.awayTeamImg ? (
                          <Image source={{ uri: match.awayTeamImg }} style={styles.matchLogo} contentFit="contain" />
                        ) : (
                          <View style={styles.matchLogoPlaceholder}><MaterialIcons name="shield" size={14} color={theme.textMuted} /></View>
                        )}
                        <Text style={styles.matchTeamName} numberOfLines={1}>{match.awayTeam}</Text>
                      </View>
                    </View>
                    <View style={styles.matchCenter}>
                      {match.status === 'live' ? (
                        <View style={styles.matchScoreBox}>
                          <Text style={styles.matchScore}>{match.score?.home ?? 0}</Text>
                          <Text style={styles.matchScoreSep}>-</Text>
                          <Text style={styles.matchScore}>{match.score?.away ?? 0}</Text>
                        </View>
                      ) : (
                        <View style={styles.matchTimeBox}>
                          <MaterialIcons name="schedule" size={12} color={theme.textMuted} />
                          <Text style={styles.matchTime}>{match.minute || 'A venir'}</Text>
                        </View>
                      )}
                      {match.status === 'live' && <Text style={styles.matchMinute}>{match.minute}</Text>}
                    </View>
                    <View style={styles.matchOdds}>
                      <Text style={styles.oddValue}>{match.odds.home.toFixed(2)}</Text>
                      <Text style={styles.oddValue}>{match.odds.draw.toFixed(2)}</Text>
                      <Text style={styles.oddValue}>{match.odds.away.toFixed(2)}</Text>
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            )}
          </Animated.View>
        ))}

        {/* COMBINES TAB */}
        {activeTab === 'Combines' && (
          <>
            {/* Combo Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
              {comboFilters.map(f => (
                <Pressable key={f.id}
                  style={[styles.filterPill, comboFilter === f.id && styles.filterPillActive]}
                  onPress={() => { try { Haptics?.selectionAsync(); } catch (e) { /* */ } setComboFilter(f.id); }}>
                  <Text style={[styles.filterPillText, comboFilter === f.id && styles.filterPillTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.comboInfo}>
              <MaterialIcons name="auto-awesome" size={16} color={theme.primary} />
              <Text style={styles.comboInfoText}>
                Combines generes par Poisson, Monte Carlo (5000 sim.) et XGBoost en temps reel. Combo Sur = cote max 3 bien analyse. Scores exacts sur ligues fiables.
              </Text>
            </View>

            {filteredCombos.length === 0 && (
              <View style={styles.emptyTab}>
                <MaterialIcons name="layers" size={48} color={theme.textMuted} />
                <Text style={styles.emptyTabTitle}>Aucun combine disponible</Text>
                <Text style={styles.emptyTabSub}>
                  {comboFilter !== 'all' ? 'Changez le filtre ou attendez de nouveaux matchs' : 'Les combines sont generes avec les matchs disponibles'}
                </Text>
              </View>
            )}

            {filteredCombos.map((combo, i) => (
              <Animated.View key={combo.id} entering={FadeInDown.delay(i * 60).duration(400)}>
                <ComboCard combo={combo} isVip={isVip} onPress={() => {
                  if (!isVip && combo.type !== 'cote2') router.push('/vip');
                }} />
              </Animated.View>
            ))}

            {!isVip && (
              <Pressable style={styles.unlockBtn} onPress={() => router.push('/vip')}>
                <MaterialIcons name="lock-open" size={16} color="#FFF" />
                <Text style={styles.unlockBtnText}>Debloquer tous les combines</Text>
              </Pressable>
            )}
          </>
        )}

        {/* HISTORIQUE TAB */}
        {activeTab === 'Historique' && (
          <>
            {comboHistory.length === 0 && (
              <View style={styles.emptyTab}>
                <MaterialIcons name="history" size={48} color={theme.textMuted} />
                <Text style={styles.emptyTabTitle}>Aucun historique</Text>
                <Text style={styles.emptyTabSub}>Les combines passes apparaitront ici</Text>
              </View>
            )}
            {comboHistory.map((combo, i) => (
              <Animated.View key={combo.id + '_h' + i} entering={FadeInDown.delay(i * 50).duration(300)}>
                <View style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>
                      {new Date(combo.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                    <View style={[styles.comboTypeBadge, { backgroundColor: `${(COMBO_META[combo.type]?.color || '#999')}15` }]}>
                      <Text style={[styles.comboTypeText, { color: COMBO_META[combo.type]?.color || '#999' }]}>
                        {COMBO_META[combo.type]?.label || combo.type}
                      </Text>
                    </View>
                    {combo.category === 'live' && (
                      <View style={styles.comboLiveBadge}>
                        <Text style={styles.comboLiveText}>LIVE</Text>
                      </View>
                    )}
                    <Text style={styles.historyOdds}>Cote {combo.totalOdds.toFixed(2)}</Text>
                  </View>
                  {combo.events.map((ev, j) => (
                    <Text key={j} style={styles.historyEvent}>
                      {ev.match.homeTeam} vs {ev.match.awayTeam} - {ev.market}: {ev.selection} ({ev.odds.toFixed(2)})
                    </Text>
                  ))}
                  <View style={styles.historyFooter}>
                    <Text style={styles.historyConf}>Confiance: {combo.confidence}%</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  liveCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.live },
  liveCountText: { fontSize: 11, color: theme.live, fontWeight: '700' },
  updateText: { fontSize: 11, color: theme.textMuted },
  tabRow: { marginBottom: 4 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: theme.surface, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.border },
  tabActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  tabText: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  loadingState: { alignItems: 'center', paddingTop: 60 },
  loadingText: { color: theme.textMuted, marginTop: 12, fontSize: 14 },
  // Leagues
  leagueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 14, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: theme.border },
  leagueFlag: { fontSize: 24 },
  leagueName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  leagueLive: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveDotSmall: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.live },
  leagueLiveText: { fontSize: 10, color: theme.live, fontWeight: '700' },
  matchCount: { fontSize: 12, color: theme.textMuted },
  matchList: { backgroundColor: theme.surface, borderRadius: theme.radius.md, marginBottom: 8, marginTop: -4, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  matchTeams: { flex: 1.3, gap: 4 },
  matchTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchLogo: { width: 20, height: 20 },
  matchLogoPlaceholder: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  matchTeamName: { fontSize: 12, color: theme.textPrimary, fontWeight: '500', flex: 1 },
  matchCenter: { flex: 0.6, alignItems: 'center' },
  matchScoreBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchScore: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
  matchScoreSep: { fontSize: 14, color: theme.textMuted },
  matchTimeBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchTime: { fontSize: 11, color: theme.textMuted },
  matchMinute: { fontSize: 10, color: theme.live, fontWeight: '700', marginTop: 2 },
  matchOdds: { flex: 0.8, flexDirection: 'row', justifyContent: 'space-around' },
  oddValue: { fontSize: 11, color: theme.primary, fontWeight: '700' },
  // Combo filter
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: theme.surface, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.border },
  filterPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterPillText: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },
  filterPillTextActive: { color: '#FFF' },
  // Combo cards
  comboInfo: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: theme.radius.md, padding: 12, marginBottom: 14, alignItems: 'center' },
  comboInfoText: { fontSize: 12, color: theme.textSecondary, flex: 1, lineHeight: 18 },
  comboCard: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  comboCardLive: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.03)' },
  comboHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  comboTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  comboTypeText: { fontSize: 12, fontWeight: '700' },
  comboLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  comboLiveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.live },
  comboLiveText: { fontSize: 10, color: theme.live, fontWeight: '700' },
  comboOddsBox: { alignItems: 'flex-end' },
  comboOddsLabel: { fontSize: 10, color: theme.textMuted },
  comboOddsValue: { fontSize: 22, fontWeight: '900', color: theme.primary },
  comboEvent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border },
  comboEventDot: { width: 6, height: 6, borderRadius: 3 },
  comboMatchName: { fontSize: 13, color: theme.textPrimary, fontWeight: '600' },
  comboLeague: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  comboMarket: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  comboEventOddBox: { backgroundColor: theme.surfaceLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  comboEventOdd: { fontSize: 14, fontWeight: '800', color: theme.primary },
  comboFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
  confidencePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  confidenceText: { fontSize: 12, color: theme.accent, fontWeight: '700' },
  comboEvCount: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  comboEvCountText: { fontSize: 11, fontWeight: '600' },
  vipLock: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 'auto' },
  vipLockText: { fontSize: 11, color: theme.warning, fontWeight: '700' },
  unlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: theme.radius.md, paddingVertical: 14, marginTop: 8 },
  unlockBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  emptyTab: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTabTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 12 },
  emptyTabSub: { fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 6 },
  // History
  historyCard: { backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  historyDate: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },
  historyOdds: { fontSize: 13, fontWeight: '800', color: theme.primary, marginLeft: 'auto' },
  historyEvent: { fontSize: 12, color: theme.textSecondary, paddingVertical: 2, lineHeight: 18 },
  historyFooter: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border },
  historyConf: { fontSize: 11, color: theme.accent, fontWeight: '600' },
});
