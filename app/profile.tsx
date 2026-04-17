import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { config } from '../constants/config';
import { useAuth } from '../contexts/AuthContext';

let Haptics: any = null;
try { Haptics = require('expo-haptics'); } catch (e) { /* */ }

function safeLink(url: string) { try { Linking.openURL(url); } catch (e) { /* */ } }

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    try { Haptics?.notificationAsync?.(Haptics?.NotificationFeedbackType?.Warning); } catch (e) { /* */ }
    logout();
    router.replace('/login');
  };

  const tierLabel = user?.isAdmin ? 'Administrateur' : user?.tier === 'vip' ? 'VIP Elite' : user?.tier === 'premium' ? 'Premium' : user?.tier === 'basic' ? 'Basic' : 'Gratuit';
  const tierColor = user?.isAdmin ? theme.error : user?.tier === 'vip' ? '#EC4899' : user?.tier === 'premium' ? theme.primary : user?.tier === 'basic' ? theme.accent : theme.textMuted;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Image source={require('../assets/images/logo.png')} style={styles.headerLogo} contentFit="contain" />
        <Text style={styles.headerTitle}>{'DAVE '}<Text style={{ color: theme.primary }}>ARENA 7</Text></Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialIcons name="close" size={22} color={theme.textPrimary} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.userCard}>
          <View style={styles.avatar}><MaterialIcons name="person" size={32} color={theme.textMuted} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userId}>{user?.bookmakerId || 'N/A'}</Text>
            <Text style={styles.userBm}>{user?.bookmaker ? config.bookmakers[user.bookmaker as keyof typeof config.bookmakers]?.name || user.bookmaker : 'N/A'}</Text>
          </View>
          <View style={[styles.tierBadge, { backgroundColor: `${tierColor}15` }]}>
            <Text style={[styles.tierBadgeText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
        </Animated.View>

        {user?.tier === 'free' && !user?.isAdmin ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Pressable style={styles.vipCard} onPress={() => router.push('/vip')}>
              <MaterialIcons name="star" size={24} color={theme.warning} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.vipTitle}>Passer en VIP</Text>
                <Text style={styles.vipSub}>Analyses illimitees + Combines + Support prioritaire</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.primary} />
            </Pressable>
          </Animated.View>
        ) : null}

        {user?.isAdmin ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Pressable style={styles.adminCard} onPress={() => router.push('/admin')}>
              <MaterialIcons name="admin-panel-settings" size={24} color={theme.error} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.vipTitle}>Panel Administrateur</Text>
                <Text style={styles.vipSub}>Gerer les utilisateurs et paiements</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.error} />
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.socialSection}>
          <View style={styles.socialHeader}>
            <MaterialIcons name="send" size={24} color="#0088CC" />
            <Text style={styles.socialTitle}>Telegram</Text>
          </View>
          <Pressable style={styles.socialLink} onPress={() => safeLink(config.telegram)}>
            <View style={{ flex: 1 }}><Text style={styles.linkTitle}>Canal et Support</Text><Text style={styles.linkHandle}>@davecapital07</Text></View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Pressable style={styles.youtubeCard} onPress={() => safeLink(config.youtube)}>
            <MaterialIcons name="play-circle-filled" size={40} color="#FF0000" />
            <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.ytTitle}>Chaine YouTube</Text><Text style={styles.ytHandle}>@smoothydsj</Text></View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.linksSection}>
          <Pressable style={styles.linkRow} onPress={() => { try { Haptics?.selectionAsync(); } catch (e) { /* */ } }}>
            <MaterialIcons name="link" size={20} color={theme.textSecondary} />
            <Text style={styles.linkRowText}>Lier mon compte</Text>
            <View style={{ flex: 1 }} /><MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => { try { Haptics?.selectionAsync(); } catch (e) { /* */ } }}>
            <MaterialIcons name="share" size={20} color={theme.textSecondary} />
            <Text style={styles.linkRowText}>Partager a un ami</Text>
            <View style={{ flex: 1 }} /><MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => { try { Haptics?.selectionAsync(); } catch (e) { /* */ } }}>
            <MaterialIcons name="star" size={20} color={theme.warning} />
            <Text style={styles.linkRowText}>Noter l application</Text>
            <View style={{ flex: 1 }} /><MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color={theme.textMuted} />
            <Text style={styles.logoutText}>Deconnexion</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.footer}>
          <Text style={styles.footerVersion}>{`${config.appName} v${config.version}`}</Text>
          <Text style={styles.footerCredit}>Designed and Copyrighted by Desire CLBY</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  headerLogo: { width: 36, height: 36, borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  userId: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  userBm: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierBadgeText: { fontSize: 11, fontWeight: '800' },
  vipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  adminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  vipTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  vipSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  socialSection: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  socialHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  socialTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  socialLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border },
  linkTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  linkHandle: { fontSize: 12, color: theme.accent, marginTop: 1 },
  youtubeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,0,0,0.06)', borderRadius: theme.radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,0,0,0.15)' },
  ytTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  ytHandle: { fontSize: 12, color: theme.accent, marginTop: 2 },
  linksSection: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  linkRowText: { fontSize: 14, color: theme.textPrimary, fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surface, borderRadius: theme.radius.md, paddingVertical: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 20 },
  logoutText: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  footer: { alignItems: 'center', paddingVertical: 16 },
  footerVersion: { fontSize: 13, color: theme.textMuted },
  footerCredit: { fontSize: 11, color: theme.textMuted, marginTop: 4, opacity: 0.6 },
});
