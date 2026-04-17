import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ImageBackground,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../constants/theme';

function safeHaptics(fn: () => void) {
  try { fn(); } catch (e) { /* haptics not available */ }
}

const bookmakers = [
  { id: '1win', name: '1Win', image: require('../assets/images/1win-logo.png') },
  { id: '1xbet', name: '1XBet', image: require('../assets/images/1xbet-logo.png') },
  { id: 'melbet', name: 'Melbet', image: require('../assets/images/melbet-logo.png') },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, loginAdmin } = useAuth();
  const [selectedBookmaker, setSelectedBookmaker] = useState('');
  const [bookmakerId, setBookmakerId] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');

  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));

  const handleLogin = async () => {
    safeHaptics(() => { try { require('expo-haptics').selectionAsync(); } catch (e) { /* */ } });
    buttonScale.value = withSpring(0.95, {}, () => { buttonScale.value = withSpring(1); });

    if (isAdminMode) {
      const success = loginAdmin(adminCode);
      if (success) {
        router.replace('/(tabs)');
      } else {
        setError('Code admin invalide');
      }
      return;
    }

    if (!selectedBookmaker) { setError('Selectionnez une plateforme'); return; }
    if (bookmakerId.length < 9 || bookmakerId.length > 10) { setError('Identifiant: 9 ou 10 chiffres'); return; }

    const success = await login(bookmakerId, selectedBookmaker);
    if (success) {
      router.replace('/(tabs)');
    } else {
      setError('Erreur de connexion');
    }
  };

  return (
    <ImageBackground source={require('../assets/images/stadium-bg.png')} style={[styles.container, { paddingTop: insets.top }]} resizeMode="cover">
      <View style={styles.overlay} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(600)} style={styles.logoSection}>
            <Image source={require('../assets/images/logo.png')} style={styles.logo} contentFit="contain" />
            <Text style={styles.appTitle}>DAVE <Text style={styles.appTitleAccent}>ARENA 7</Text></Text>
            <Text style={styles.tagline}>Predictions et Gains</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Connexion</Text>
              <Text style={styles.cardSubtitle}>
                {isAdminMode ? 'Entrez le code admin' : 'Entrez votre identifiant bookmaker pour acceder aux bots'}
              </Text>
            </View>

            {!isAdminMode ? (
              <>
                <Text style={styles.sectionLabel}>Plateforme</Text>
                <View style={styles.bookmakerRow}>
                  {bookmakers.map(bm => (
                    <Pressable key={bm.id}
                      style={[styles.bookmakerCard, selectedBookmaker === bm.id && styles.bookmakerCardActive]}
                      onPress={() => { setSelectedBookmaker(bm.id); setError(''); }}>
                      <Image source={bm.image} style={styles.bookmakerLogo} contentFit="contain" />
                      <Text style={[styles.bookmakerName, selectedBookmaker === bm.id && styles.bookmakerNameActive]}>{bm.name}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.sectionLabel}>Identifiant Bookmaker</Text>
                <TextInput
                  style={styles.input} placeholder="Ex: 123456789"
                  placeholderTextColor={theme.textMuted} value={bookmakerId}
                  onChangeText={t => { setBookmakerId(t.replace(/[^0-9]/g, '')); setError(''); }}
                  keyboardType="number-pad" maxLength={10}
                />
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Code Admin</Text>
                <TextInput
                  style={styles.input} placeholder="Entrez le code"
                  placeholderTextColor={theme.textMuted} value={adminCode}
                  onChangeText={t => { setAdminCode(t); setError(''); }}
                  keyboardType="number-pad" secureTextEntry maxLength={10}
                />
              </>
            )}

            {error ? <Animated.Text entering={FadeInDown.duration(300)} style={styles.errorText}>{error}</Animated.Text> : null}

            <Animated.View style={animatedButtonStyle}>
              <Pressable style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Acceder aux Predictions</Text>
              </Pressable>
            </Animated.View>

            <Pressable style={styles.adminToggle} onPress={() => { setIsAdminMode(!isAdminMode); setError(''); }}>
              <MaterialIcons name={isAdminMode ? 'person' : 'admin-panel-settings'} size={16} color={theme.textMuted} />
              <Text style={styles.adminToggleText}>{isAdminMode ? 'Connexion utilisateur' : 'Panel Admin'}</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 10, 15, 0.75)' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 100, height: 100, borderRadius: 20, marginBottom: 16 },
  appTitle: { fontSize: 36, fontWeight: '800', color: theme.textPrimary, letterSpacing: 1 },
  appTitleAccent: { color: theme.primary },
  tagline: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
  card: { backgroundColor: 'rgba(26, 26, 46, 0.92)', borderRadius: theme.radius.xl, padding: 24, borderWidth: 1, borderColor: theme.border },
  cardHeader: { backgroundColor: theme.primary, marginHorizontal: -24, marginTop: -24, paddingHorizontal: 24, paddingVertical: 16, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, marginBottom: 20 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  cardSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 10, marginTop: 8 },
  bookmakerRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  bookmakerCard: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, backgroundColor: theme.surfaceLight, borderRadius: theme.radius.md, borderWidth: 2, borderColor: 'transparent' },
  bookmakerCardActive: { borderColor: theme.primary, backgroundColor: 'rgba(249, 115, 22, 0.1)' },
  bookmakerLogo: { width: 48, height: 48, borderRadius: 12, marginBottom: 6 },
  bookmakerName: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  bookmakerNameActive: { color: theme.primary },
  input: { backgroundColor: theme.surfaceLight, borderRadius: theme.radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  errorText: { color: theme.error, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  loginButton: { backgroundColor: theme.primary, borderRadius: theme.radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  loginButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  adminToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 8 },
  adminToggleText: { fontSize: 13, color: theme.textMuted },
});
