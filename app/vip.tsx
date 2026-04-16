import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '@/template';
import { theme } from '../constants/theme';
import { config } from '../constants/config';
import { useAuth } from '../contexts/AuthContext';

export default function VipScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user, addPaymentRequest } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [screenshotUri, setScreenshotUri] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const pickScreenshot = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission requise', 'Autorisez l\'acces a la galerie pour envoyer la capture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        setScreenshotUri(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      showAlert('Erreur', 'Impossible de selectionner l\'image');
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permission requise', 'Autorisez la camera pour prendre une photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        setScreenshotUri(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      showAlert('Erreur', 'Impossible de prendre la photo');
    }
  };

  const handleSubscribe = () => {
    if (!selectedPlan) { showAlert('Erreur', 'Choisissez un plan'); return; }
    if (!selectedPayment) { showAlert('Erreur', 'Choisissez un moyen de paiement'); return; }

    const plan = config.pricing.find(p => p.id === selectedPlan);
    if (!plan) return;

    if (selectedPayment === 'wave') {
      showAlert(
        'Paiement Wave',
        `Envoyez ${plan.price.toLocaleString()} FCFA (${plan.priceEur.toFixed(2)} EUR) au ${config.payments.wave.number}\n\nApres paiement, joignez la capture ci-dessous puis confirmez.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Confirmer', onPress: () => submitRequest(plan.name, 'Wave', plan.price) },
        ]
      );
    } else if (selectedPayment === 'chariow') {
      Linking.openURL(config.payments.chariow.url);
      setTimeout(() => {
        showAlert('Confirmation Chariow', 'Avez-vous effectue le paiement ?', [
          { text: 'Non', style: 'cancel' },
          { text: 'Oui', onPress: () => submitRequest(plan.name, 'Chariow', plan.price) },
        ]);
      }, 2000);
    } else if (selectedPayment === 'mastercard') {
      showAlert('MasterCard', 'Le paiement MasterCard sera bientot disponible. Utilisez Wave ou Chariow.', [{ text: 'OK' }]);
    }
  };

  const submitRequest = (planName: string, method: string, amount: number) => {
    addPaymentRequest({
      userId: user?.bookmakerId || 'unknown',
      username: user?.bookmakerId || 'unknown',
      plan: planName,
      method,
      amount,
      screenshotUri: screenshotUri || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    showAlert(
      'Demande envoyee!',
      `Plan ${planName} demande. L\'admin va valider sous peu.\n\nTelegram: ${config.telegramAdmin}`
    );
  };

  const tierLabel = user?.tier === 'free' ? 'Gratuit' : user?.tier === 'basic' ? 'Basic' : user?.tier === 'premium' ? 'Premium' : user?.tier === 'vip' ? 'VIP Elite' : 'Admin';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Plans VIP</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Status */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.statusCard}>
          <MaterialIcons name="verified-user" size={24} color={theme.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.statusTitle}>Votre plan: {tierLabel}</Text>
            <Text style={styles.statusSub}>
              {user?.tier === 'free' ? `${Math.max(0, 5 - (user?.analysesUsedToday || 0))} analyses restantes` : 'Acces illimite'}
            </Text>
          </View>
        </Animated.View>

        {/* VIP Features Banner */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.featBanner}>
          <Text style={styles.featBannerTitle}>Pourquoi passer VIP ?</Text>
          <View style={styles.featRow}>
            <MaterialIcons name="all-inclusive" size={16} color={theme.success} />
            <Text style={styles.featText}>Analyses illimitees</Text>
          </View>
          <View style={styles.featRow}>
            <MaterialIcons name="layers" size={16} color={theme.accent} />
            <Text style={styles.featText}>Tous les combines (cote 2, 5, 10+, scores exacts)</Text>
          </View>
          <View style={styles.featRow}>
            <MaterialIcons name="flash-on" size={16} color={theme.warning} />
            <Text style={styles.featText}>Predictions live en temps reel</Text>
          </View>
          <View style={styles.featRow}>
            <MaterialIcons name="support-agent" size={16} color="#EC4899" />
            <Text style={styles.featText}>Support prioritaire Telegram</Text>
          </View>
        </Animated.View>

        {/* Plans */}
        {config.pricing.map((plan, index) => (
          <Animated.View key={plan.id} entering={FadeInDown.delay(100 + index * 80).duration(400)}>
            <Pressable
              style={[styles.planCard, selectedPlan === plan.id && styles.planCardActive]}
              onPress={() => { Haptics.selectionAsync(); setSelectedPlan(plan.id); }}
            >
              {plan.id === 'premium' && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>POPULAIRE</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, selectedPlan === plan.id && { color: theme.primary }]}>{plan.name}</Text>
                  <Text style={styles.planDuration}>{plan.duration}</Text>
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.priceValue}>{plan.price.toLocaleString()}</Text>
                  <Text style={styles.priceCurrency}>FCFA</Text>
                  <Text style={styles.priceEur}>{plan.priceEur.toFixed(2)} EUR</Text>
                </View>
              </View>
              <View style={styles.featureList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <MaterialIcons name="check-circle" size={16} color={theme.success} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          </Animated.View>
        ))}

        {/* Payment Methods */}
        <Text style={styles.sectionTitle}>Moyen de paiement</Text>
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.paymentGrid}>
          <Pressable
            style={[styles.paymentCard, selectedPayment === 'wave' && styles.paymentCardActive]}
            onPress={() => { Haptics.selectionAsync(); setSelectedPayment('wave'); }}
          >
            <Image source={require('../assets/images/wave-logo.png')} style={styles.paymentLogo} contentFit="contain" />
            <Text style={styles.paymentName}>Wave</Text>
            <Text style={styles.paymentDetail}>{config.payments.wave.number}</Text>
          </Pressable>
          <Pressable
            style={[styles.paymentCard, selectedPayment === 'chariow' && styles.paymentCardActive]}
            onPress={() => { Haptics.selectionAsync(); setSelectedPayment('chariow'); }}
          >
            <Image source={require('../assets/images/chariow-logo.png')} style={styles.paymentLogo} contentFit="contain" />
            <Text style={styles.paymentName}>Chariow</Text>
            <Text style={styles.paymentDetail}>Boutique</Text>
          </Pressable>
          <Pressable
            style={[styles.paymentCard, selectedPayment === 'mastercard' && styles.paymentCardActive]}
            onPress={() => { Haptics.selectionAsync(); setSelectedPayment('mastercard'); }}
          >
            <Image source={require('../assets/images/mastercard-logo.png')} style={styles.paymentLogo} contentFit="contain" />
            <Text style={styles.paymentName}>MasterCard</Text>
            <Text style={styles.paymentDetail}>Bientot</Text>
          </Pressable>
        </Animated.View>

        {/* Screenshot Upload */}
        <Text style={styles.sectionTitle}>Capture de paiement</Text>
        <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.screenshotSection}>
          <Text style={styles.screenshotInfo}>
            Joignez la capture de votre paiement pour une validation rapide
          </Text>
          <View style={styles.screenshotButtons}>
            <Pressable style={styles.screenshotBtn} onPress={pickScreenshot}>
              <MaterialIcons name="photo-library" size={20} color={theme.accent} />
              <Text style={styles.screenshotBtnText}>Galerie</Text>
            </Pressable>
            <Pressable style={styles.screenshotBtn} onPress={takePhoto}>
              <MaterialIcons name="camera-alt" size={20} color={theme.primary} />
              <Text style={styles.screenshotBtnText}>Camera</Text>
            </Pressable>
          </View>
          {screenshotUri ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: screenshotUri }} style={styles.previewImage} contentFit="contain" />
              <Pressable style={styles.removePreview} onPress={() => setScreenshotUri('')}>
                <MaterialIcons name="close" size={18} color="#FFF" />
              </Pressable>
              <View style={styles.previewCheck}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <Text style={styles.previewCheckText}>Capture ajoutee</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noPreview}>
              <MaterialIcons name="image" size={40} color={theme.textMuted} />
              <Text style={styles.noPreviewText}>Aucune capture selectionnee</Text>
            </View>
          )}
        </Animated.View>

        {/* Subscribe Button */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Pressable
            style={[styles.subscribeBtn, (!selectedPlan || !selectedPayment) && styles.subscribeBtnDisabled]}
            onPress={handleSubscribe}
          >
            <MaterialIcons name={submitted ? 'check' : 'lock-open'} size={18} color="#FFF" />
            <Text style={styles.subscribeBtnText}>
              {submitted ? 'Demande envoyee - En attente' : 'Souscrire maintenant'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Info */}
        <Animated.View entering={FadeInDown.delay(550).duration(400)} style={styles.infoBox}>
          <MaterialIcons name="info" size={16} color={theme.accent} />
          <Text style={styles.infoText}>
            Apres paiement, joignez la capture ici puis confirmez. Vous pouvez aussi envoyer sur Telegram: {config.telegramAdmin}. Activation sous 5 minutes.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: theme.radius.md, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  statusTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statusSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  featBanner: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  featBannerTitle: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginBottom: 12 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  featText: { fontSize: 13, color: theme.textSecondary },
  planCard: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: theme.border, overflow: 'hidden' },
  planCardActive: { borderColor: theme.primary, backgroundColor: 'rgba(249,115,22,0.05)' },
  popularBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 10 },
  popularText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  planName: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  planDuration: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  priceValue: { fontSize: 22, fontWeight: '900', color: theme.primary },
  priceCurrency: { fontSize: 11, fontWeight: '600', color: theme.primary },
  priceEur: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  featureList: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: theme.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginTop: 12, marginBottom: 10 },
  paymentGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  paymentCard: { flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.md, padding: 14, borderWidth: 2, borderColor: theme.border },
  paymentCardActive: { borderColor: theme.primary, backgroundColor: 'rgba(249,115,22,0.05)' },
  paymentLogo: { width: 44, height: 44, borderRadius: 10, marginBottom: 6 },
  paymentName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  paymentDetail: { fontSize: 10, color: theme.textMuted, marginTop: 2, textAlign: 'center' },
  screenshotSection: { backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  screenshotInfo: { fontSize: 13, color: theme.textSecondary, marginBottom: 12 },
  screenshotButtons: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  screenshotBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surfaceLight, borderRadius: theme.radius.md, paddingVertical: 12, borderWidth: 1, borderColor: theme.border },
  screenshotBtnText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  previewBox: { position: 'relative', borderRadius: theme.radius.md, overflow: 'hidden', backgroundColor: theme.surfaceLight },
  previewImage: { width: '100%', height: 280, borderRadius: theme.radius.md },
  removePreview: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  previewCheck: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  previewCheckText: { fontSize: 13, fontWeight: '600', color: theme.success },
  noPreview: { alignItems: 'center', paddingVertical: 24, backgroundColor: theme.surfaceLight, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' },
  noPreviewText: { fontSize: 12, color: theme.textMuted, marginTop: 6 },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: theme.radius.md, paddingVertical: 16, marginBottom: 12 },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: theme.radius.sm, padding: 12, alignItems: 'flex-start' },
  infoText: { fontSize: 12, color: theme.textSecondary, flex: 1, lineHeight: 18 },
});
