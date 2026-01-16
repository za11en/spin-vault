
export type ProfileColor = 'emerald' | 'purple' | 'blue' | 'pink' | 'red' | 'orange';
export type BonusResetType = 'fixed' | 'rolling';

export interface BonusConfig {
  type: BonusResetType;
  resetTime?: string; // HH:mm format for fixed (e.g., "19:00")
  cooldownHours?: number; // Hours for rolling (e.g., 24)
}

export interface Casino {
  id: string;
  name: string;
  url: string;
  isSignedUp: boolean;
  hasDailyBonus: boolean | null;
  hasReferral: boolean | null;
  login?: string;
  password?: string;
  bonusConfig?: BonusConfig;
  lastDailyClaim?: number; // Timestamp
  isCustom?: boolean; // Flag for user-added casinos
  userReferralLink?: string; // User's personal referral link
}

export interface ProfileData {
  login?: string;
  password?: string;
  isSignedUp: boolean;
  lastDailyClaim?: number;
  userReferralLink?: string;
}

export interface Profile {
  id: string;
  name: string;
  colorScheme: ProfileColor;
  avatar: string; // Emoji avatar
  casinoData: Record<string, ProfileData>; // keyed by casino.id
  customCasinos?: Casino[]; // List of user-added casinos
  isSecure: boolean; // Whether this profile requires a PIN/Password
  hashedPin?: string; // For verification
  encryptedVault?: string; // Encrypted JSON string of casinoData
  isOnboarded?: boolean; // Whether the user has seen the initial setup screen
}

export interface GlobalCasinoSettings {
  hasDailyBonus: boolean | null;
  hasReferral: boolean | null;
  bonusConfig?: BonusConfig;
}

export type FilterType = 'focus' | 'all' | 'signed-up' | 'daily' | 'referral';
