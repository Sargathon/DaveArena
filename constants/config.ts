export const config = {
  appName: 'DAVE ARENA 7',
  tagline: 'Predictions & Gains',
  version: '2.0.0',
  adminCode: '1844',
  
  // API
  apiUrl: 'https://two2bet.onrender.com/odds',
  refreshIntervalLive: 30000,
  refreshIntervalPre: 120000,
  
  // Free user limits
  freeAnalysisPerDay: 5,
  
  // VIP Pricing
  pricing: [
    { id: 'basic', name: 'Basic', price: 5000, priceEur: 7.63, currency: 'FCFA', features: ['Analyses illimitées', 'Combinés cote 2', 'Alertes live'], duration: '30 jours' },
    { id: 'premium', name: 'Premium', price: 10000, priceEur: 15.24, currency: 'FCFA', features: ['Tout Basic', 'Combinés cote 5', 'Scores exacts combinés', 'Accès prioritaire'], duration: '30 jours' },
    { id: 'vip', name: 'VIP Elite', price: 15000, priceEur: 22.87, currency: 'FCFA', features: ['Tout Premium', 'Combinés grosses cotes', 'Multi-agents avancés', 'Support prioritaire'], duration: '30 jours' },
  ],
  
  // Payment methods
  payments: {
    wave: { name: 'Wave', number: '+225 05 55753213', icon: 'wave' },
    chariow: { name: 'Chariow', url: 'https://didoeywh.mychariow.shop', icon: 'chariow' },
    mastercard: { name: 'MasterCard', icon: 'mastercard' },
  },
  
  // Affiliate Links
  bookmakers: {
    '1win': { name: '1Win', url: 'https://1wrrzr.com/?p=mm2g', color: '#1E3A5F' },
    '1xbet': { name: '1XBet', url: 'https://refpa58144.com/L?tag=d_4653745m_1599c_&site=4653745&ad=1599', color: '#1A3A6B' },
    melbet: { name: 'Melbet', url: 'https://mlbt.cc/SARGATHON', color: '#1A1A1A' },
  },
  
  // Social
  youtube: 'https://www.youtube.com/@Smoothydsj',
  telegram: 'https://t.me/davecapital07',
  telegramAdmin: '@davecapitale',
  
  // League scoring profiles
  leagueProfiles: {
    high: { names: ['3x3', 'conference', '4x4', 'premier', '5x5 rush', 'england'], avgGoals: 8.5, htAvg: 3.8 },
    medium: { names: ['superleague', 'champions', 'bundesliga', 'la liga', 'serie a'], avgGoals: 6.5, htAvg: 2.8 },
    low: { names: ['euro', 'world', 'friendly'], avgGoals: 4.5, htAvg: 1.8 },
  },
  
  // AI Agents
  aiAgents: [
    { id: 'gpt', name: 'GPT-5.4 Pro', role: 'Raisonnement global & stratégie', color: '#10B981', icon: 'psychology' },
    { id: 'claude', name: 'Claude Opus', role: 'Cohérence & validation croisée', color: '#8B5CF6', icon: 'auto-awesome' },
    { id: 'deepseek', name: 'DeepSeek V3', role: 'Modèle Poisson & Monte Carlo', color: '#3B82F6', icon: 'analytics' },
    { id: 'grok', name: 'Grok 4', role: 'Analyse live & détection patterns', color: '#EF4444', icon: 'flash-on' },
    { id: 'mistral', name: 'Mistral 14B', role: 'Régression & XGBoost rapide', color: '#F59E0B', icon: 'speed' },
    { id: 'gemma', name: 'Gemma 4', role: 'Optimisation combinés', color: '#EC4899', icon: 'tune' },
  ],
};
