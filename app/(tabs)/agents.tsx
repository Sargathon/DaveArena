import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { config } from '../../constants/config';

export default function AgentsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agents IA</Text>
        <Text style={styles.subtitle}>Système multi-agents de prédiction</Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Tous les agents sont actifs</Text>
          </View>
          <Text style={styles.statusSub}>
            6 modèles IA analysent les cotes en temps réel pour générer des prédictions optimales
          </Text>
        </Animated.View>

        {/* Agent Cards */}
        {config.aiAgents.map((agent, index) => (
          <Animated.View
            key={agent.id}
            entering={FadeInDown.delay(100 + index * 80).duration(400)}
            style={styles.agentCard}
          >
            <View style={[styles.agentIcon, { backgroundColor: `${agent.color}20` }]}>
              <MaterialIcons name={agent.icon as any} size={24} color={agent.color} />
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>{agent.name}</Text>
              <Text style={styles.agentRole}>{agent.role}</Text>
            </View>
            <View style={[styles.agentStatus, { backgroundColor: `${theme.success}15` }]}>
              <View style={[styles.agentStatusDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.agentStatusText, { color: theme.success }]}>Actif</Text>
            </View>
          </Animated.View>
        ))}

        {/* How it works */}
        <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.infoCard}>
          <Text style={styles.infoTitle}>Comment ça marche ?</Text>
          <View style={styles.infoStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Collecte des cotes</Text>
              <Text style={styles.stepDesc}>Les cotes bookmaker sont récupérées en temps réel</Text>
            </View>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Analyse multi-IA</Text>
              <Text style={styles.stepDesc}>Chaque agent analyse selon sa spécialité</Text>
            </View>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Fusion intelligente</Text>
              <Text style={styles.stepDesc}>Les résultats sont combinés pour une prédiction finale</Text>
            </View>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>4</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Score de confiance</Text>
              <Text style={styles.stepDesc}>Chaque prédiction reçoit un indice de fiabilité</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  subtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  statusCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success },
  statusText: { fontSize: 14, fontWeight: '700', color: theme.success },
  statusSub: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  agentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInfo: { flex: 1, marginLeft: 12 },
  agentName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  agentRole: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  agentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  agentStatusDot: { width: 6, height: 6, borderRadius: 3 },
  agentStatusText: { fontSize: 11, fontWeight: '600' },
  infoCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumText: { fontSize: 13, fontWeight: '700', color: theme.primary },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  stepDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
});
