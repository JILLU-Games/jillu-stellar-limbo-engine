/**
 * Casino Platform & Game Module Configuration
 *
 * Configures platform branding, betting parameters, RTP rules,
 * currency formatting, and platform feature toggles.
 */

export const CASINO_CONFIG = {
  gameId: "limbo-rocket-v1",
  gameName: "Casino Limbo",
  version: "2.4.0",
  provider: "Senior Casino Gaming Studio",
  
  // Mathematical Parameters
  houseEdge: 2.0, // 2.0% House Edge => 98.0% RTP (Standard for top-tier crypto/online casinos)
  minBet: 10,
  maxBet: 1000,
  defaultBet: 10,
  minMultiplier: 1.01,
  maxMultiplier: 10000.0,
  defaultTargetMultiplier: 2.0,

  // Currency & Locale
  currency: {
    symbol: "₹",
    code: "INR",
    name: "Indian Rupee",
    position: "prefix", // "prefix" | "suffix"
  },

  // Audio FX Settings
  audio: {
    enabledByDefault: true,
    masterVolume: 0.7,
  },

  // Quick Bet Presets
  betPresets: [10, 25, 50, 100, 250, 500],

  // Quick Multiplier Presets
  multiplierPresets: [1.2, 1.5, 2.0, 5.0, 10.0, 50.0, 100.0],

  // Platform Integration Mode: "standalone" (uses internal PRNG) | "platform" (server-authoritative)
  mode: "standalone",

  // Feature Toggles
  features: {
    soundEffects: true,
    turboMode: true,
    fullscreen: true,
    provablyFair: true,
    liveStats: true,
    autoBet: true,
    hotkeys: true,
  },
};

export default CASINO_CONFIG;
