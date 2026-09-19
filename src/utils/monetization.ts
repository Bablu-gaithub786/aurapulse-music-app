// Monetization, Ads simulation, Premium VIP Pass and AdMob integration manager

export interface MonetizationState {
  isPremium: boolean;
  premiumExpiryDate: number | null; // timestamp
  unlockedEffects: string[]; // preset ids like 'dynamic-rainbow', 'clockwise-rgb', 'toxic-aurora'
  unlockedWaveModes: string[];
}

const STORAGE_KEY = 'aurapulse_monetization_v1';

export const getMonetizationState = (): MonetizationState => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed: MonetizationState = JSON.parse(data);
      // Check if premium is expired
      if (parsed.isPremium && parsed.premiumExpiryDate && Date.now() > parsed.premiumExpiryDate) {
        parsed.isPremium = false;
        saveMonetizationState(parsed);
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load monetization state', e);
  }

  return {
    isPremium: false,
    premiumExpiryDate: null,
    unlockedEffects: ['vivo-soundwave', 'vivo-aurora'], // default free
    unlockedWaveModes: ['spikes', 'circular-spikes', 'dj-wings', 'ring-waves'], // default free
  };
};

export const saveMonetizationState = (state: MonetizationState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save monetization state', e);
  }
};

export const unlockLifetimeEffect = (effectId: string): MonetizationState => {
  const current = getMonetizationState();
  if (!current.unlockedEffects.includes(effectId)) {
    current.unlockedEffects.push(effectId);
    saveMonetizationState(current);
  }
  return current;
};

export const activatePremiumMonthly = (): MonetizationState => {
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const current: MonetizationState = {
    isPremium: true,
    premiumExpiryDate: Date.now() + oneMonthMs,
    unlockedEffects: [
      'vivo-soundwave',
      'vivo-rgb-spectrum',
      'vivo-aurora',
      'dynamic-rainbow',
      'clockwise-rgb',
      'toxic-aurora',
      'sunset-glow',
    ],
    unlockedWaveModes: [
      'spikes',
      'circular-spikes',
      'dj-wings',
      'ring-waves',
      'horizon-weave',
      'liquid-waves',
      'matrix-stream',
      'laser-cross',
      'strobe-pulse',
      'particle-nebula',
    ],
  };
  saveMonetizationState(current);
  return current;
};
