import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { config } from '../../constants/config';

const tools = [
  { id: 'converter', icon: 'calculate', title: 'Convertisseur de cotes', desc: 'Décimales, fractionnaires, américaines', color: theme.accent },
  { id: 'calculator', icon: 'functions', title: 'Calculateur de gains', desc: 'Simulez vos gains potentiels', color: theme.success },
  { id: 'value', icon: 'trending-up', title: 'Détecteur Value Bet', desc: 'Identifiez les cotes surévaluées', color: theme.primary },
  { id: 'bankroll', icon: 'account-balance-wallet', title: 'Gestion Bankroll', desc: 'Suivez votre capital', color: '#8B5CF6' },
];

export default function OutilsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Outils</Text>
        <Text style={styles.subtitle}>Utilitaires pour vos paris</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {tools.map((tool, index) => (
          <Animated.View key={tool.id} entering={FadeInDown.delay(index * 80).duration(400)}>
            <Pressable
              style={styles.toolCard}
              onPress={() => {
                Haptics.selectionAsync();
              }}
            >
              <View style={[styles.toolIcon, { backgroundColor: `${tool.color}20` }]}>
                <MaterialIcons name={tool.icon as any} size={24} color={tool.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toolTitle}>{tool.title}</Text>
                <Text style={styles.toolDesc}>{tool.desc}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          </Animated.View>
        ))}

        {/* Bookmaker Links */}
        <Text style={styles.sectionTitle}>Inscriptions Bookmakers</Text>
        {Object.entries(config.bookmakers).map(([key, bm], index) => (
          <Animated.View key={key} entering={FadeInDown.delay(400 + index * 80).duration(400)}>
            <Pressable
              style={styles.bmCard}
              onPress={() => {
                Haptics.selectionAsync();
                Linking.openURL(bm.url);
              }}
            >
              <View style={[styles.bmIcon, { backgroundColor: `${theme.primary}20` }]}>
                <MaterialIcons name="open-in-new" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bmName}>{bm.name}</Text>
                <Text style={styles.bmUrl}>Inscription rapide →</Text>
              </View>
              <View style={styles.bmBadge}>
                <Text style={styles.bmBadgeText}>Bonus</Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}

        {/* Social */}
        <Text style={styles.sectionTitle}>Liens Utiles</Text>
        <Animated.View entering={FadeInDown.delay(700).duration(400)}>
          <Pressable style={styles.socialRow} onPress={() => Linking.openURL(config.youtube)}>
            <MaterialIcons name="play-circle-filled" size={28} color="#FF0000" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.socialName}>Chaîne YouTube</Text>
              <Text style={styles.socialHandle}>@smoothydsj</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(750).duration(400)}>
          <Pressable style={styles.socialRow} onPress={() => Linking.openURL(config.telegram)}>
            <MaterialIcons name="send" size={24} color="#0088CC" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.socialName}>Canal Telegram</Text>
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
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  subtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toolTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  toolDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 20,
    marginBottom: 10,
  },
  bmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bmIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bmName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  bmUrl: { fontSize: 12, color: theme.primary, marginTop: 2 },
  bmBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bmBadgeText: { fontSize: 11, color: theme.success, fontWeight: '700' },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  socialName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  socialHandle: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
});
