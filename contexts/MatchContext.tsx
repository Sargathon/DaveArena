import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMatches, League, Match, Combo, generateCombos } from '../services/api';
import { config } from '../constants/config';

interface MatchContextType {
  leagues: League[];
  allMatches: Match[];
  liveMatches: Match[];
  isLoading: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  getMatchById: (id: number) => Match | undefined;
  combos: Combo[];
  comboHistory: Combo[];
  refreshCombos: () => void;
}

const MatchContext = createContext<MatchContextType>({
  leagues: [], allMatches: [], liveMatches: [],
  isLoading: false, lastUpdate: null,
  refresh: async () => {}, getMatchById: () => undefined,
  combos: [], comboHistory: [], refreshCombos: () => {},
});

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [comboHistory, setComboHistory] = useState<Combo[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allMatchesRef = useRef<Match[]>([]);
  const mountedRef = useRef(true);

  const loadMatches = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      setIsLoading(true);
      const data = await fetchMatches();
      if (!mountedRef.current) return;
      setLeagues(data);
      setLastUpdate(new Date());
      const all = data.flatMap(l => l.matches);
      allMatchesRef.current = all;
      try {
        const newCombos = generateCombos(all);
        if (mountedRef.current) setCombos(newCombos);
      } catch (e) {
        // Combo generation failed silently
      }
    } catch (e) {
      // API fetch failed silently
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadMatches();
    loadComboHistory();
    intervalRef.current = setInterval(() => { loadMatches(); }, config.refreshIntervalLive);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadMatches]);

  useEffect(() => {
    if (combos.length > 0) { saveComboHistory(combos); }
  }, [combos]);

  const loadComboHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem('dave_combo_history');
      if (stored && mountedRef.current) setComboHistory(JSON.parse(stored));
    } catch (_e) { /* */ }
  };

  const saveComboHistory = async (newCombos: Combo[]) => {
    try {
      const existing = await AsyncStorage.getItem('dave_combo_history');
      const history: Combo[] = existing ? JSON.parse(existing) : [];
      const existingIds = new Set(history.map(c => c.id));
      const toAdd = newCombos.filter(c => !existingIds.has(c.id));
      const updated = [...toAdd, ...history].slice(0, 100);
      if (mountedRef.current) setComboHistory(updated);
      await AsyncStorage.setItem('dave_combo_history', JSON.stringify(updated));
    } catch (_e) { /* */ }
  };

  const refreshCombos = () => {
    try {
      const newCombos = generateCombos(allMatchesRef.current);
      setCombos(newCombos);
    } catch (e) { /* */ }
  };

  const allMatches = leagues.flatMap(l => l.matches);
  const liveMatches = allMatches.filter(m => m.status === 'live');
  const getMatchById = (id: number) => allMatches.find(m => m.id === id);

  return (
    <MatchContext.Provider value={{ leagues, allMatches, liveMatches, isLoading, lastUpdate, refresh: loadMatches, getMatchById, combos, comboHistory, refreshCombos }}>
      {children}
    </MatchContext.Provider>
  );
}

export const useMatches = () => useContext(MatchContext);
