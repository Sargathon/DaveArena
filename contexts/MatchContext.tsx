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
  const loadingRef = useRef(false);

  const loadMatches = useCallback(async () => {
    if (!mountedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    try {
      setIsLoading(true);
      const data = await fetchMatches();
      if (!mountedRef.current) return;
      setLeagues(data);
      setLastUpdate(new Date());
      const all: Match[] = [];
      for (let i = 0; i < data.length; i++) {
        const lm = data[i].matches;
        for (let j = 0; j < lm.length; j++) all.push(lm[j]);
      }
      allMatchesRef.current = all;

      // Generate combos with a small delay to avoid blocking UI
      setTimeout(() => {
        try {
          if (!mountedRef.current) return;
          const newCombos = generateCombos(all);
          if (mountedRef.current) setCombos(newCombos);
        } catch (e) {
          // Combo generation failed silently
        }
      }, 100);
    } catch (e) {
      // API fetch failed silently
    } finally {
      if (mountedRef.current) setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Delay initial load to let UI render first
    const initTimeout = setTimeout(() => {
      loadMatches();
      loadComboHistory();
    }, 300);
    intervalRef.current = setInterval(() => { loadMatches(); }, config.refreshIntervalLive);
    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadMatches]);

  useEffect(() => {
    if (combos.length > 0) {
      // Defer save to avoid blocking
      setTimeout(() => { saveComboHistory(combos); }, 200);
    }
  }, [combos]);

  const loadComboHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem('dave_combo_history');
      if (stored && mountedRef.current) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setComboHistory(parsed);
      }
    } catch (_e) { /* */ }
  };

  const saveComboHistory = async (newCombos: Combo[]) => {
    try {
      const existing = await AsyncStorage.getItem('dave_combo_history');
      let history: Combo[] = [];
      if (existing) {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed)) history = parsed;
      }
      const existingIds = new Set<string>();
      for (let i = 0; i < history.length; i++) existingIds.add(history[i].id);
      const toAdd: Combo[] = [];
      for (let i = 0; i < newCombos.length; i++) {
        if (!existingIds.has(newCombos[i].id)) toAdd.push(newCombos[i]);
      }
      const updated = toAdd.concat(history).slice(0, 50);
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

  const allMatches = React.useMemo(() => {
    const result: Match[] = [];
    for (let i = 0; i < leagues.length; i++) {
      const lm = leagues[i].matches;
      for (let j = 0; j < lm.length; j++) result.push(lm[j]);
    }
    return result;
  }, [leagues]);

  const liveMatches = React.useMemo(() => {
    return allMatches.filter(m => m.status === 'live');
  }, [allMatches]);

  const getMatchById = useCallback((id: number) => {
    return allMatchesRef.current.find(m => m.id === id);
  }, []);

  return (
    <MatchContext.Provider value={{ leagues, allMatches, liveMatches, isLoading, lastUpdate, refresh: loadMatches, getMatchById, combos, comboHistory, refreshCombos }}>
      {children}
    </MatchContext.Provider>
  );
}

export const useMatches = () => useContext(MatchContext);
