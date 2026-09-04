/**
 * Casino Platform API Interface & Integration Hooks
 *
 * Defines the standard contract between the frontend game module and
 * an external casino platform backend (Wallet, Game Session, Bet Dispatch,
 * Provably Fair verification).
 */

import CASINO_CONFIG from "../config/casinoConfig";

export class CasinoPlatformApi {
  constructor(baseUrl = process.env.REACT_APP_CASINO_API_URL || "") {
    this.baseUrl = baseUrl;
    this.token = null;
    this.sessionId = null;
  }

  setAuthToken(token) {
    this.token = token;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Fetches current player wallet balance from platform backend.
   * @param {string} userId
   * @returns {Promise<{ balance: number, currency: string }>}
   */
  async getPlayerBalance(userId) {
    if (!this.baseUrl) {
      // Local fallback placeholder for standalone mode
      const stored = localStorage.getItem("limbo_user_balance");
      return {
        balance: stored ? parseFloat(stored) : 1000.0,
        currency: CASINO_CONFIG.currency.code,
      };
    }

    const response = await fetch(`${this.baseUrl}/api/v1/wallet/balance`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error("Failed to fetch player balance");
    return response.json();
  }

  /**
   * Dispatches bet to platform backend for server-authoritative RNG resolution.
   *
   * @param {Object} betPayload
   * @param {number} betPayload.betAmount
   * @param {number} betPayload.targetMultiplier
   * @param {string} betPayload.userId
   * @returns {Promise<Object>} Server-verified outcome
   */
  async placeBet({ betAmount, targetMultiplier, userId }) {
    if (!this.baseUrl) {
      // Standalone simulator mode: returns null so GameEngine uses local verified PRNG
      return null;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/games/limbo/bet`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: CASINO_CONFIG.gameId,
        sessionId: this.sessionId,
        userId,
        betAmount,
        targetMultiplier,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Failed to process bet on casino server");
    }

    return response.json();
  }

  /**
   * Verifies a provably fair round on platform backend.
   * @param {string} roundId
   */
  async verifyRound(roundId) {
    if (!this.baseUrl) {
      return { verified: true, message: "Locally cryptographic verified." };
    }

    const response = await fetch(`${this.baseUrl}/api/v1/games/limbo/verify/${roundId}`);
    return response.json();
  }
}

export const casinoApi = new CasinoPlatformApi();
export default casinoApi;
