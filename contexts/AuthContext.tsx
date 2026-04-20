import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../constants/config';

export type UserTier = 'free' | 'basic' | 'premium' | 'vip' | 'admin';

export interface PaymentRequest {
  id: string;
  userId: string;
  username: string;
  plan: string;
  method: string;
  amount: number;
  screenshotUri?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

interface User {
  bookmakerId: string;
  bookmaker: string;
  isAdmin: boolean;
  tier: UserTier;
  analysesUsedToday: number;
  lastAnalysisDate: string;
  tierExpiry?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (bookmakerId: string, bookmaker: string) => Promise<boolean>;
  loginAdmin: (code: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  canAnalyze: () => boolean;
  useAnalysis: () => void;
  remainingAnalyses: number;
  paymentRequests: PaymentRequest[];
  addPaymentRequest: (req: Omit<PaymentRequest, 'id' | 'status' | 'createdAt'>) => void;
  approvePayment: (id: string) => void;
  rejectPayment: (id: string) => void;
  activateUserTier: (userId: string, tier: UserTier) => void;
  registeredUsers: User[];
}

const AuthContext = createContext<AuthContextType>({
  user: null, isLoading: true,
  login: async () => false, loginAdmin: () => false, logout: () => {},
  isAuthenticated: false, canAnalyze: () => false, useAnalysis: () => {},
  remainingAnalyses: 0, paymentRequests: [],
  addPaymentRequest: () => {}, approvePayment: () => {},
  rejectPayment: () => {}, activateUserTier: () => {},
  registeredUsers: [],
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const results = await Promise.all([
        AsyncStorage.getItem('dave_user').catch(() => null),
        AsyncStorage.getItem('dave_payment_requests').catch(() => null),
        AsyncStorage.getItem('dave_registered_users').catch(() => null),
      ]);
      const stored = results[0];
      const reqs = results[1];
      const users = results[2];

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            const today = new Date().toDateString();
            if (parsed.lastAnalysisDate !== today) {
              parsed.analysesUsedToday = 0;
              parsed.lastAnalysisDate = today;
            }
            setUser(parsed);
          }
        } catch (e) { /* invalid stored data */ }
      }
      if (reqs) {
        try {
          const parsed = JSON.parse(reqs);
          if (Array.isArray(parsed)) setPaymentRequests(parsed);
        } catch (e) { /* */ }
      }
      if (users) {
        try {
          const parsed = JSON.parse(users);
          if (Array.isArray(parsed)) setRegisteredUsers(parsed);
        } catch (e) { /* */ }
      }
    } catch (_e) {
      // Storage error
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (u: User) => {
    setUser(u);
    try { await AsyncStorage.setItem('dave_user', JSON.stringify(u)); } catch (e) { /* */ }
  };

  const login = async (bookmakerId: string, bookmaker: string): Promise<boolean> => {
    try {
      if (!bookmakerId || bookmakerId.length < 9 || bookmakerId.length > 10) return false;
      const today = new Date().toDateString();
      const newUser: User = {
        bookmakerId, bookmaker, isAdmin: false,
        tier: 'free', analysesUsedToday: 0, lastAnalysisDate: today,
      };
      const existing = registeredUsers.find(u => u.bookmakerId === bookmakerId);
      if (existing) { newUser.tier = existing.tier; newUser.tierExpiry = existing.tierExpiry; }
      await saveUser(newUser);
      const updated = registeredUsers.filter(u => u.bookmakerId !== bookmakerId);
      updated.push(newUser);
      setRegisteredUsers(updated);
      try { await AsyncStorage.setItem('dave_registered_users', JSON.stringify(updated)); } catch (e) { /* */ }
      return true;
    } catch (e) {
      return false;
    }
  };

  const loginAdmin = (code: string): boolean => {
    try {
      if (code === config.adminCode) {
        const today = new Date().toDateString();
        const adminUser: User = {
          bookmakerId: 'ADMIN', bookmaker: 'admin', isAdmin: true,
          tier: 'admin', analysesUsedToday: 0, lastAnalysisDate: today,
        };
        saveUser(adminUser);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    try { AsyncStorage.removeItem('dave_user'); } catch (e) { /* */ }
  };

  const canAnalyze = useCallback((): boolean => {
    if (!user) return false;
    if (user.isAdmin || user.tier !== 'free') return true;
    const today = new Date().toDateString();
    const used = user.lastAnalysisDate === today ? user.analysesUsedToday : 0;
    return used < config.freeAnalysisPerDay;
  }, [user]);

  const remainingAnalyses = (() => {
    if (!user) return 0;
    if (user.isAdmin || user.tier !== 'free') return -1;
    const today = new Date().toDateString();
    const used = user.lastAnalysisDate === today ? user.analysesUsedToday : 0;
    return Math.max(0, config.freeAnalysisPerDay - used);
  })();

  const useAnalysis = async () => {
    if (!user || user.isAdmin || user.tier !== 'free') return;
    const today = new Date().toDateString();
    const updated = {
      ...user,
      analysesUsedToday: (user.lastAnalysisDate === today ? user.analysesUsedToday : 0) + 1,
      lastAnalysisDate: today,
    };
    await saveUser(updated);
  };

  const addPaymentRequest = async (req: Omit<PaymentRequest, 'id' | 'status' | 'createdAt'>) => {
    try {
      const newReq: PaymentRequest = {
        ...req,
        id: 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        status: 'pending',
        createdAt: Date.now(),
      };
      const updated = [newReq].concat(paymentRequests);
      setPaymentRequests(updated);
      await AsyncStorage.setItem('dave_payment_requests', JSON.stringify(updated));
    } catch (e) { /* */ }
  };

  const approvePayment = async (id: string) => {
    try {
      const updated = paymentRequests.map(r => {
        if (r.id === id) {
          const plan = config.pricing.find(p => p.name === r.plan);
          if (plan) { activateUserTier(r.userId, plan.id as UserTier); }
          return { ...r, status: 'approved' as const };
        }
        return r;
      });
      setPaymentRequests(updated);
      await AsyncStorage.setItem('dave_payment_requests', JSON.stringify(updated));
    } catch (e) { /* */ }
  };

  const rejectPayment = async (id: string) => {
    try {
      const updated = paymentRequests.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r);
      setPaymentRequests(updated);
      await AsyncStorage.setItem('dave_payment_requests', JSON.stringify(updated));
    } catch (e) { /* */ }
  };

  const activateUserTier = async (userId: string, tier: UserTier) => {
    try {
      const updatedUsers = registeredUsers.map(u => {
        if (u.bookmakerId === userId) return { ...u, tier, tierExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000 };
        return u;
      });
      setRegisteredUsers(updatedUsers);
      await AsyncStorage.setItem('dave_registered_users', JSON.stringify(updatedUsers));
      if (user && user.bookmakerId === userId) {
        await saveUser({ ...user, tier, tierExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      }
    } catch (e) { /* */ }
  };

  return (
    <AuthContext.Provider value={{
      user, isLoading, login, loginAdmin, logout,
      isAuthenticated: !!user,
      canAnalyze, useAnalysis, remainingAnalyses,
      paymentRequests, addPaymentRequest, approvePayment, rejectPayment,
      activateUserTier, registeredUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
