import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking, TextInput,
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
import { useAuth } from '../contexts/AuthContext';

export default function VipScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user, addPaymentRequest } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [screenshotSent, setScreenshotSent] = useState(false);

  const handleSubscribe = () => {
    if (!selectedPlan) {
      showAlert('Erreur', 'Veuillez choisir un plan');
      return;
    }
    if (!selectedPayment) {
      showAlert('Erreur', 'Veuillez choisir un moyen de paiement');
      return;
    }

    const plan = config.pricing.find(p => p.id === selectedPlan);
    if (!plan) return;

    if (selectedPayment === 'wave') {
      showAlert(
        'Paiement Wave',
        `Envoyez ${plan.price} FCFA au ${config.payments.wave.number}\n\nAprès paiement, envoyez la capture sur Telegram ${config.telegramAdmin} ou cliquez "Confirmer" ci-dessous.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer envoi',
            onPress: () => submitPaymentRequest(plan.name, 'Wave', plan.price),
          },
        ]
      );
    } else if (selectedPayment === 'chariow') {
      Linking.openURL(config.payments.chariow.url);
      setTimeout(() => {
        showAlert(
          'Confirmation',
          'Avez-vous effectué le paiement sur Chariow ?',
          [
            { text: 'Non', style: 'cancel' },
            {
              text: 'Oui, confirmer',
              onPress: () => submitPaymentRequest(plan.name, 'Chariow', plan.price),
            },
          ]
        );
      }, 2000);
    } else if (selectedPayment === 'mastercard') {
      showAlert(
        'MasterCard',
        'Le paiement MasterCard sera bientôt disponible. Utilisez Wave ou Chariow en attendant.',
        [{ text: 'OK' }]
      );
    }
  };

  const submitPaymentRequest = (planName: string, method: string, amount: number) => {
    addPaymentRequest({
      userId: user?.bookmakerId || 'unknown',
      username: user?.bookmakerId || 'unknown',
      plan: planName,
      method,
      amount,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScreenshotSent(true);
    showAlert(
      'Demande envoyée',
      `Votre demande pour le plan ${planName} a été envoyée. L'admin va valider votre accès sous peu.\n\nVous pouvez aussi envoyer la capture sur Telegram: ${config.telegramAdmin}`
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
              {user?.tier === 'free' ? `${5 - (user?.analysesUsedToday || 0)} analyses restantes aujourd'hui` : 'Accès illimité'}
            </Text>
          </View>
        </Animated.View>

        {/* Plans */}
        {config.pricing.map((plan, index) => (
          <Animated.View key={plan.id} entering={FadeInDown.delay(100 + index * 80).duration(400)}>
            <Pressable
              style={[styles.planCard, selectedPlan === plan.id && styles.planCardActive]}
              onPress={() => { Haptics.selectionAsync(); setSelectedPlan(plan.id); }}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planName, selectedPlan === plan.id && { color: theme.primary }]}>{plan.name}</Text>
                <View style={styles.priceBox}>
                  <Text style={styles.priceValue}>{plan.price.toLocaleString()}</Text>
                  <Text style={styles.priceCurrency}>FCFA</Text>
                </View>
              </View>
              <Text style={styles.priceEur}>{plan.priceEur.toFixed(2)} EUR · {plan.duration}</Text>
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
            <Text style={styles.paymentDetail}>Boutique en ligne</Text>
          </Pressable>

          <Pressable
            style={[styles.paymentCard, selectedPayment === 'mastercard' && styles.paymentCardActive]}
            onPress={() => { Haptics.selectionAsync(); setSelectedPayment('mastercard'); }}
          >
            <Image source={require('../assets/images/mastercard-logo.png')} style={styles.paymentLogo} contentFit="contain" />
            <Text style={styles.paymentName}>MasterCard</Text>
            <Text style={styles.paymentDetail}>Bientôt</Text>
          </Pressable>
        </Animated.View>

        {/* Subscribe Button */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Pressable
            style={[styles.subscribeBtn, (!selectedPlan || !selectedPayment) && styles.subscribeBtnDisabled]}
            onPress={handleSubscribe}
          >
            <MaterialIcons name="lock-open" size={18} color="#FFF" />
            <Text style={styles.subscribeBtnText}>
              {screenshotSent ? 'Demande envoyée - En attente' : 'Souscrire maintenant'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Info */}
        <Animated.View entering={FadeInDown.delay(550).duration(400)} style={styles.infoBox}>
          <MaterialIcons name="info" size={16} color={theme.accent} />
          <Text style={styles.infoText}>
            Après paiement, envoyez la capture sur Telegram {config.telegramAdmin}. L'activation se fait sous 5 minutes.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.08)',
    borderRadius: theme.radius.md, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  statusTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statusSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  planCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.lg, padding: 16,
    marginBottom: 10, borderWidth: 2, borderColor: theme.border,
  },
  planCardActive: { borderColor: theme.primary, backgroundColor: 'rgba(249,115,22,0.05)' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  planName: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  priceBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceValue: { fontSize: 22, fontWeight: '900', color: theme.primary },
  priceCurrency: { fontSize: 12, fontWeight: '600', color: theme.primary },
  priceEur: { fontSize: 12, color: theme.textMuted, marginBottom: 10 },
  featureList: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: theme.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginTop: 12, marginBottom: 10 },
  paymentGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  paymentCard: {
    flex: 1, alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.radius.md, padding: 14, borderWidth: 2, borderColor: theme.border,
  },
  paymentCardActive: { borderColor: theme.primary, backgroundColor: 'rgba(249,115,22,0.05)' },
  paymentLogo: { width: 44, height: 44, borderRadius: 10, marginBottom: 6 },
  paymentName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  paymentDetail: { fontSize: 10, color: theme.textMuted, marginTop: 2, textAlign: 'center' },
  subscribeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.md, paddingVertical: 16,
    marginBottom: 12,
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  infoBox: {
    flexDirection: 'row', gap: 8, backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: theme.radius.sm, padding: 12, alignItems: 'flex-start',
  },
  infoText: { fontSize: 12, color: theme.textSecondary, flex: 1, lineHeight: 18 },
});
