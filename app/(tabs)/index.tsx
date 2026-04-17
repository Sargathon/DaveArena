import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { config } from '../../constants/config';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../contexts/MatchContext';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated, remainingAnalyses } = useAuth();
  const { liveMatches, allMatches, isLoading, lastUpdate, refresh, combos } = useMatches();
  const [screenWidth, setScreenWidth] = useState(375);

  useEffect(() => {
    try {
      const { Dimensions } = require('react-native');
      const dims = Dimensions.get('window');
      setScreenWidth(Math.max(320, dims.width));
      const sub = Dimensions.addEventListener('change', ({ window }: any) => {
        setScreenWidth(Math.max(320, window.width));
      });
      return () => { try { sub?.remove(); } catch (e) { /* */ } };
    } catch (e) { /* */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); }
  }, [isAuthenticated]);

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--';
    try {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '--:--';
    }
  };

  const isFree = user?.tier === 'free' && !user?.isAdmin;
  const tierLabel = user?.isAdmin ? 'ADMIN' : user?.tier === 'vip' ? 'VIP' : user?.tier === 'premium' ? 'PREMIUM' : user?.tier === 'basic' ? 'BASIC' : 'FREE';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View>
            <Text style={styles.brandName}>{'DAVE '}<Text style={{ color: theme.primary }}>ARENA 7</Text></Text>
            <Text style={styles.headerSub}>FIFA Predictions Pro</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.tierPill, user?.isAdmin ? { backgroundColor: 'rgba(239,68,68,0.15)' } : undefined]}>
              <Text style={[styles.tierPillText, user?.isAdmin ? { color: theme.error } : undefined]}>{tierLabel}</Text>
            </View>
            <Pressable onPress={() => router.push('/profile')} style={styles.profileBtn}>
              <MaterialIcons name="person" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Free user quota banner */}
        {isFree ? (
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <Pressable style={styles.quotaBanner} onPress={() => router.push('/vip')}>
              <MaterialIcons name="info" size={16} color={theme.warning} />
              <Text style={styles.quotaText}>
                {`${remainingAnalyses} analyse${remainingAnalyses > 1 ? 's' : ''} restante${remainingAnalyses > 1 ? 's' : ''} aujourd'hui`}
              </Text>
              <Text style={styles.quotaUpgrade}>{"Upgrade \u2192"}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Live Banner */}
        {liveMatches.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Pressable style={styles.liveBanner} onPress={() => router.push('/(tabs)/fifa')}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN DIRECT</Text>
              <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>{`${liveMatches.length} match${liveMatches.length > 1 ? 's' : ''}`}</Text></View>
              <View style={{ flex: 1 }} />
              <Text style={styles.liveUpdate}>{`MAJ ${formatTime(lastUpdate)}`}</Text>
              <MaterialIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Live Match Cards */}
        {liveMatches.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} style={{ marginBottom: 20 }}>
              {liveMatches.slice(0, 5).map((match) => (
                <Pressable key={match.id} style={[styles.liveCard, { width: Math.max(260, screenWidth * 0.75) }]} onPress={() => router.push(`/match/${match.id}`)}>
                  <View style={styles.liveCardHeader}>
                    <Text style={styles.liveCardLeague} numberOfLines={1}>{match.league}</Text>
                    <View style={styles.minuteBadge}><Text style={styles.minuteText}>{match.minute}</Text></View>
                  </View>
                  <View style={styles.liveCardTeams}>
                    <View style={styles.teamCol}>
                      {match.homeTeamImg ? (
                        <Image source={{ uri: match.homeTeamImg }} style={styles.teamLogo} contentFit="contain" />
                      ) : (
                        <View style={styles.teamLogoPlaceholder}><MaterialIcons name="shield" size={20} color={theme.textMuted} /></View>
                      )}
                      <Text style={styles.teamName} numberOfLines={1}>{match.homeTeam}</Text>
                    </View>
                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreText}>{match.score ? `${match.score.home} - ${match.score.away}` : 'vs'}</Text>
                    </View>
                    <View style={styles.teamCol}>
                      {match.awayTeamImg ? (
                        <Image source={{ uri: match.awayTeamImg }} style={styles.teamLogo} contentFit="contain" />
                      ) : (
                        <View style={styles.teamLogoPlaceholder}><MaterialIcons name="shield" size={20} color={theme.textMuted} /></View>
                      )}
                      <Text style={styles.teamName} numberOfLines={1}>{match.awayTeam}</Text>
                    </View>
                  </View>
                  <Pressable style={styles.predBtn} onPress={() => router.push(`/match/${match.id}`)}>
                    <MaterialIcons name="visibility" size={14} color={theme.primary} />
                    <Text style={styles.predBtnText}>Voir les predictions</Text>
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}

        {/* Stats Row */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialIcons name="sports-esports" size={24} color={theme.primary} />
            <Text style={styles.statValue}>{allMatches.length}</Text>
            <Text style={styles.statLabel}>Matchs</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="fiber-manual-record" size={24} color={theme.live} />
            <Text style={styles.statValue}>{liveMatches.length}</Text>
            <Text style={styles.statLabel}>En Direct</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="layers" size={24} color={theme.accent} />
            <Text style={styles.statValue}>{combos.length}</Text>
            <Text style={styles.statLabel}>Combines</Text>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Acces Rapide</Text>
          <View style={styles.quickGrid}>
            <Pressable style={styles.quickCard} onPress={() => router.push('/(tabs)/fifa')}>
              <MaterialIcons name="sports-esports" size={28} color={theme.accent} />
              <Text style={styles.quickText}>FIFA</Text>
            </Pressable>
            <Pressable style={styles.quickCard} onPress={() => router.push('/vip')}>
              <MaterialIcons name="star" size={28} color={theme.warning} />
              <Text style={styles.quickText}>VIP</Text>
            </Pressable>
            {user?.isAdmin ? (
              <Pressable style={styles.quickCard} onPress={() => router.push('/admin')}>
                <MaterialIcons name="admin-panel-settings" size={28} color={theme.error} />
                <Text style={styles.quickText}>Admin</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.quickCard} onPress={() => { try { Linking.openURL(config.telegram); } catch (e) { /* */ } }}>
              <MaterialIcons name="send" size={28} color="#0088CC" />
              <Text style={styles.quickText}>Telegram</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Bookmaker Section */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Bookmakers Partenaires</Text>
          <View style={styles.bookmakerGrid}>
            {Object.entries(config.bookmakers).map(([key, bm]) => (
              <Pressable key={key} style={styles.bookmakerItem} onPress={() => { try { Linking.openURL(bm.url); } catch (e) { /* */ } }}>
                <Image
                  source={key === '1win' ? require('../../assets/images/1win-logo.png') : key === '1xbet' ? require('../../assets/images/1xbet-logo.png') : require('../../assets/images/melbet-logo.png')}
                  style={styles.bmLogo} contentFit="contain"
                />
                <Text style={styles.bmName}>{bm.name}</Text>
                <MaterialIcons name="open-in-new" size={14} color={theme.primary} />
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Social */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Communaute</Text>
          <Pressable style={[styles.socialCard, { backgroundColor: 'rgba(255,0,0,0.1)' }]} onPress={() => { try { Linking.openURL(config.youtube); } catch (e) { /* */ } }}>
            <MaterialIcons name="play-circle-filled" size={32} color="#FF0000" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.socialTitle}>YouTube</Text>
              <Text style={styles.socialHandle}>@smoothydsj</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
          <Pressable style={[styles.socialCard, { backgroundColor: 'rgba(0,136,204,0.1)', marginTop: 10 }]} onPress={() => { try { Linking.openURL(config.telegram); } catch (e) { /* */ } }}>
            <MaterialIcons name="send" size={28} color="#0088CC" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.socialTitle}>Telegram</Text>
              <Text style={styles.socialHandle}>@davecapital07</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  brandName: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  headerSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierPill: { backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierPillText: { fontSize: 10, fontWeight: '800', color: theme.primary },
  profileBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  quotaBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: theme.radius.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  quotaText: { fontSize: 12, color: theme.warning, fontWeight: '600', flex: 1 },
  quotaUpgrade: { fontSize: 12, color: theme.primary, fontWeight: '700' },
  liveBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: theme.radius.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.live, marginRight: 8 },
  liveText: { fontSize: 13, fontWeight: '700', color: theme.live },
  liveBadge: { marginLeft: 8, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  liveBadgeText: { fontSize: 11, color: theme.live, fontWeight: '600' },
  liveUpdate: { fontSize: 11, color: theme.textMuted, marginRight: 4 },
  liveCard: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  liveCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  liveCardLeague: { fontSize: 12, color: theme.textMuted, flex: 1 },
  minuteBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  minuteText: { fontSize: 12, color: theme.live, fontWeight: '700' },
  liveCardTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  teamCol: { alignItems: 'center', width: 80 },
  teamLogo: { width: 40, height: 40, marginBottom: 6 },
  teamLogoPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  teamName: { fontSize: 12, color: theme.textPrimary, fontWeight: '600', textAlign: 'center' },
  scoreBox: { backgroundColor: theme.surfaceLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.radius.sm },
  scoreText: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },
  predBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: theme.radius.sm },
  predBtnText: { fontSize: 13, color: theme.primary, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  statValue: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginTop: 6 },
  statLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.md, paddingVertical: 16, borderWidth: 1, borderColor: theme.border },
  quickText: { fontSize: 12, color: theme.textPrimary, fontWeight: '600', marginTop: 6 },
  bookmakerGrid: { gap: 8 },
  bookmakerItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.border },
  bmLogo: { width: 36, height: 36, borderRadius: 8, marginRight: 12 },
  bmName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  socialCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: theme.radius.md },
  socialTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  socialHandle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
});
