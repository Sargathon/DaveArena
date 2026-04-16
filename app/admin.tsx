import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAlert } from '@/template';
import { theme } from '../constants/theme';
import { config } from '../constants/config';
import { useAuth, UserTier } from '../contexts/AuthContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const TIER_OPTIONS: { id: UserTier; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'premium', label: 'Premium' },
  { id: 'vip', label: 'VIP Elite' },
];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user, paymentRequests, registeredUsers, approvePayment, rejectPayment, activateUserTier } = useAuth();
  const [tab, setTab] = useState<'requests' | 'users'>('requests');
  const [imageModal, setImageModal] = useState<string>('');

  if (!user?.isAdmin) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialIcons name="lock" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 16 }}>Acces admin requis</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnCenter}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pendingCount = paymentRequests.filter(r => r.status === 'pending').length;

  const handleApprove = (id: string) => {
    showAlert('Confirmer', 'Approuver ce paiement et activer l\'acces ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Approuver', onPress: () => { approvePayment(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  const handleReject = (id: string) => {
    showAlert('Refuser', 'Refuser ce paiement ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: () => { rejectPayment(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  const handleManualActivate = (userId: string) => {
    showAlert('Activer un plan', `Choisir le plan pour ${userId}`, [
      ...TIER_OPTIONS.map(opt => ({
        text: opt.label,
        onPress: () => {
          activateUserTier(userId, opt.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showAlert('Active', `${userId} est maintenant ${opt.label}`);
        },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Image Preview Modal */}
      <Modal visible={!!imageModal} transparent animationType="fade" onRequestClose={() => setImageModal('')}>
        <Pressable style={styles.modalOverlay} onPress={() => setImageModal('')}>
          <View style={styles.modalContent}>
            <Pressable style={styles.modalClose} onPress={() => setImageModal('')}>
              <MaterialIcons name="close" size={24} color="#FFF" />
            </Pressable>
            {imageModal ? (
              <Image source={{ uri: imageModal }} style={styles.modalImage} contentFit="contain" />
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Panel Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{registeredUsers.length}</Text>
          <Text style={styles.statLabel}>Utilisateurs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.warning }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.success }]}>{paymentRequests.filter(r => r.status === 'approved').length}</Text>
          <Text style={styles.statLabel}>Approuves</Text>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'requests' && styles.tabActive]} onPress={() => setTab('requests')}>
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            Demandes {pendingCount > 0 ? `(${pendingCount})` : ''}
          </Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'users' && styles.tabActive]} onPress={() => setTab('users')}>
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>Utilisateurs</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'requests' && (
          <>
            {paymentRequests.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="inbox" size={48} color={theme.textMuted} />
                <Text style={styles.emptyText}>Aucune demande</Text>
              </View>
            )}
            {paymentRequests.map((req, index) => (
              <Animated.View key={req.id} entering={FadeInDown.delay(index * 50).duration(300)} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestUser}>
                    <MaterialIcons name="person" size={18} color={theme.accent} />
                    <Text style={styles.requestUserId}>{req.username}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    req.status === 'pending' && { backgroundColor: 'rgba(245,158,11,0.15)' },
                    req.status === 'approved' && { backgroundColor: 'rgba(16,185,129,0.15)' },
                    req.status === 'rejected' && { backgroundColor: 'rgba(239,68,68,0.15)' },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      req.status === 'pending' && { color: theme.warning },
                      req.status === 'approved' && { color: theme.success },
                      req.status === 'rejected' && { color: theme.error },
                    ]}>
                      {req.status === 'pending' ? 'En attente' : req.status === 'approved' ? 'Approuve' : 'Refuse'}
                    </Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <Text style={styles.requestDetail}>Plan: <Text style={{ color: theme.primary, fontWeight: '700' }}>{req.plan}</Text></Text>
                  <Text style={styles.requestDetail}>Moyen: {req.method}</Text>
                  <Text style={styles.requestDetail}>Montant: {req.amount.toLocaleString()} FCFA</Text>
                  <Text style={styles.requestDetail}>{formatDate(req.createdAt)}</Text>
                </View>

                {/* Screenshot Preview - LARGE */}
                {req.screenshotUri ? (
                  <Pressable onPress={() => setImageModal(req.screenshotUri || '')} style={styles.screenshotContainer}>
                    <Image source={{ uri: req.screenshotUri }} style={styles.screenshotPreview} contentFit="contain" />
                    <View style={styles.screenshotOverlay}>
                      <MaterialIcons name="zoom-in" size={24} color="#FFF" />
                      <Text style={styles.screenshotOverlayText}>Voir en grand</Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.noScreenshot}>
                    <MaterialIcons name="image-not-supported" size={20} color={theme.textMuted} />
                    <Text style={styles.noScreenshotText}>Pas de capture jointe</Text>
                  </View>
                )}

                {req.status === 'pending' && (
                  <View style={styles.requestActions}>
                    <Pressable style={styles.approveBtn} onPress={() => handleApprove(req.id)}>
                      <MaterialIcons name="check" size={16} color="#FFF" />
                      <Text style={styles.approveBtnText}>Approuver</Text>
                    </Pressable>
                    <Pressable style={styles.rejectBtn} onPress={() => handleReject(req.id)}>
                      <MaterialIcons name="close" size={16} color={theme.error} />
                      <Text style={styles.rejectBtnText}>Refuser</Text>
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            ))}
          </>
        )}

        {tab === 'users' && (
          <>
            {registeredUsers.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="people" size={48} color={theme.textMuted} />
                <Text style={styles.emptyText}>Aucun utilisateur</Text>
              </View>
            )}
            {registeredUsers.map((u, index) => (
              <Animated.View key={u.bookmakerId} entering={FadeInDown.delay(index * 50).duration(300)}>
                <Pressable style={styles.userCard} onPress={() => handleManualActivate(u.bookmakerId)}>
                  <View style={styles.userAvatar}>
                    <MaterialIcons name="person" size={20} color={theme.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.bookmakerId}</Text>
                    <Text style={styles.userBm}>{u.bookmaker}</Text>
                  </View>
                  <View style={[
                    styles.tierBadge,
                    u.tier === 'free' && { backgroundColor: 'rgba(107,114,128,0.15)' },
                    u.tier === 'basic' && { backgroundColor: 'rgba(59,130,246,0.15)' },
                    u.tier === 'premium' && { backgroundColor: 'rgba(249,115,22,0.15)' },
                    u.tier === 'vip' && { backgroundColor: 'rgba(236,72,153,0.15)' },
                  ]}>
                    <Text style={[
                      styles.tierText,
                      u.tier === 'free' && { color: theme.textMuted },
                      u.tier === 'basic' && { color: theme.accent },
                      u.tier === 'premium' && { color: theme.primary },
                      u.tier === 'vip' && { color: '#EC4899' },
                    ]}>
                      {u.tier === 'free' ? 'Free' : u.tier === 'basic' ? 'Basic' : u.tier === 'premium' ? 'Premium' : 'VIP'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  backBtnCenter: { marginTop: 16, padding: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  statValue: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  statLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.border },
  tabActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
  tabTextActive: { color: '#FFF' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: theme.textMuted, marginTop: 10 },
  requestCard: { backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestUser: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestUserId: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  requestDetails: { gap: 3, marginBottom: 10 },
  requestDetail: { fontSize: 12, color: theme.textSecondary },
  // Screenshot styles - LARGE
  screenshotContainer: { position: 'relative', borderRadius: theme.radius.md, overflow: 'hidden', marginBottom: 12, backgroundColor: theme.surfaceLight },
  screenshotPreview: { width: '100%', height: 300, borderRadius: theme.radius.md },
  screenshotOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  screenshotOverlayText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  noScreenshot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: theme.surfaceLight, borderRadius: theme.radius.sm, marginBottom: 12 },
  noScreenshotText: { fontSize: 12, color: theme.textMuted },
  requestActions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.success, borderRadius: theme.radius.sm, paddingVertical: 12 },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: theme.radius.sm, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  rejectBtnText: { fontSize: 13, fontWeight: '600', color: theme.error },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  userName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  userBm: { fontSize: 11, color: theme.textMuted },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 6 },
  tierText: { fontSize: 11, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: SCREEN_W - 32, height: SCREEN_H * 0.75, position: 'relative' },
  modalClose: { position: 'absolute', top: -40, right: 0, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  modalImage: { width: '100%', height: '100%', borderRadius: 12 },
});
