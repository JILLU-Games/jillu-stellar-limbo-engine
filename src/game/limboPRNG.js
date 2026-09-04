/**
 * Pseudo-Random Number Generator (PRNG) and Game Outcome Engine for Limbo.
 *
 * Implements:
 * 1. Mulberry32 PRNG (32-bit stateful deterministic pseudo-random generator).
 * 2. Cryptographic PRNG using window.crypto.getRandomValues when available.
 * 3. Standard Limbo Crash algorithm with configurable House Edge (default 2%, 98% RTP).
 * 4. Win chance and payout/profit calculation helpers.
 */

// 32-bit Mulberry32 PRNG
export function createMulberry32(seed = Date.now()) {
  let state = seed >>> 0;
  return function nextFloat() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a high-quality uniform random float in [0, 1).
 * Uses window.crypto if available, falling back to Math.random.
 */
export function getRandomFloat() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0] / (0xffffffff + 1);
  }
  return Math.random();
}

/**
 * House edge in percentage (2.0% -> 98% Return To Player)
 */
export const DEFAULT_HOUSE_EDGE = 2.0;
export const MIN_MULTIPLIER = 1.01;
export const MAX_MULTIPLIER = 10000.0;
export const MIN_BET = 10;
export const MAX_BET = 1000;

/**
 * Calculates win probability percentage for a given target multiplier.
 * Formula: winChance = (100 - houseEdge) / targetMultiplier
 */
export function calculateWinChance(targetMultiplier, houseEdge = DEFAULT_HOUSE_EDGE) {
  const mult = Math.max(MIN_MULTIPLIER, Number(targetMultiplier) || MIN_MULTIPLIER);
  const chance = (100 - houseEdge) / mult;
  return Math.min(99.0, Math.max(0.01, parseFloat(chance.toFixed(2))));
}

/**
 * Calculates the target multiplier needed for a desired win chance percentage.
 * Formula: targetMultiplier = (100 - houseEdge) / winChance
 */
export function calculateTargetMultiplier(winChance, houseEdge = DEFAULT_HOUSE_EDGE) {
  const chance = Math.max(0.01, Math.min(99.0, Number(winChance) || 49.0));
  const mult = (100 - houseEdge) / chance;
  return Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, parseFloat(mult.toFixed(2))));
}

/**
 * Core Limbo PRNG outcome generator.
 *
 * In Limbo, the outcome multiplier is derived inversely from a uniform random float:
 * outcome = (100 - houseEdge) / (100 * (1 - U))
 *
 * This produces the exact continuous distribution where:
 * P(outcome >= T) = (100 - houseEdge) / (100 * T)
 *
 * @param {Object} options
 * @param {number} options.betAmount - Amount wagered
 * @param {number} options.targetMultiplier - Player's target multiplier (cash out)
 * @param {number} [options.houseEdge=2.0] - House edge percentage
 * @param {Function} [options.customRng] - Optional PRNG function returning [0, 1)
 * @returns {Object} Full game outcome record
 */
export function generateLimboOutcome({
  betAmount,
  targetMultiplier,
  houseEdge = DEFAULT_HOUSE_EDGE,
  customRng = null,
}) {
  const wager = Math.max(MIN_BET, Math.min(MAX_BET, Number(betAmount) || MIN_BET));
  const target = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, Number(targetMultiplier) || 2.0));

  // Obtain uniform float in [0, 1)
  const randFloat = customRng ? customRng() : getRandomFloat();

  // Standard crash/limbo outcome formula
  // Safeguard against division by zero if randFloat is 1.0 (infinitesimal probability)
  const safeFloat = Math.min(randFloat, 0.99999999);
  const rtp = (100 - houseEdge) / 100; // e.g. 0.98
  const rawMultiplier = rtp / (1 - safeFloat);

  // Truncate/clamp to 2 decimal places between 1.00x and 10,000.00x
  const outcomeMultiplier = Math.max(
    1.0,
    Math.min(MAX_MULTIPLIER, Math.floor(rawMultiplier * 100) / 100)
  );

  const win = outcomeMultiplier >= target;
  const payout = win ? parseFloat((wager * target).toFixed(2)) : 0;
  const netProfit = win ? parseFloat((payout - wager).toFixed(2)) : -wager;
  const winChance = calculateWinChance(target, houseEdge);

  return {
    id: `bet_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    time: new Date().toISOString(),
    betAmount: wager,
    targetMultiplier: target,
    cashOut: target,
    multiplier: outcomeMultiplier,
    flag: win,
    win: win,
    payout: payout,
    netProfit: netProfit,
    winChance: winChance,
    randFloat: parseFloat(safeFloat.toFixed(6)),
  };
}
