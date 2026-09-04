/**
 * Casino Game Engine Architecture & Platform Bridge
 *
 * Implements standard casino platform lifecycle hooks:
 * - GameEngine.initialize(config, callbacks)
 * - GameEngine.start(betData)
 * - GameEngine.receiveResult(resultData)
 * - GameEngine.playAnimation(onTick, onComplete)
 * - GameEngine.showWin(payout)
 * - GameEngine.reset()
 *
 * Supports dual-mode operation:
 * 1. "platform": Server-authoritative mode where outcome is supplied via external API.
 * 2. "standalone": Embedded client simulator mode using cryptographic PRNG.
 */

import CASINO_CONFIG from "../config/casinoConfig";
import { generateLimboOutcome } from "../game/limboPRNG";
import { soundEngine } from "./soundEngine";
import { provablyFairManager } from "./provablyFair";

class CasinoGameEngine {
  constructor() {
    this.status = "uninitialized"; // "uninitialized" | "ready" | "running" | "completed"
    this.config = { ...CASINO_CONFIG };
    this.callbacks = {};
    this.currentBet = null;
    this.currentResult = null;
    this.animationFrameId = null;
    this.isTurbo = false;
  }

  /**
   * Initializes the game engine with configuration and event listeners.
   * @param {Object} customConfig
   * @param {Object} eventCallbacks - { onStateChange, onResult, onWin, onLoss, onBalanceUpdate }
   */
  initialize(customConfig = {}, eventCallbacks = {}) {
    this.config = { ...CASINO_CONFIG, ...customConfig };
    this.callbacks = { ...eventCallbacks };
    this.status = "ready";

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.status);
    }
    return this;
  }

  setTurbo(enabled) {
    this.isTurbo = !!enabled;
  }

  /**
   * Starts a game round.
   * In standalone mode, synchronously or asynchronously derives outcome.
   * In platform mode, emits bet request and waits for server outcome via receiveResult().
   *
   * @param {Object} betParams
   * @param {number} betParams.betAmount
   * @param {number} betParams.targetMultiplier
   * @returns {Promise<Object>} The determined game outcome
   */
  async start({ betAmount, targetMultiplier }) {
    if (this.status === "running") {
      throw new Error("GameEngine is already executing a round.");
    }

    this.status = "running";
    this.currentBet = { betAmount, targetMultiplier };

    soundEngine.playClick();
    soundEngine.playLaunch();

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange("running");
    }

    // If platform mode and an external request handler is provided:
    if (this.config.mode === "platform" && typeof this.callbacks.onRequestServerOutcome === "function") {
      const serverOutcome = await this.callbacks.onRequestServerOutcome({
        gameId: this.config.gameId,
        betAmount,
        targetMultiplier,
      });
      return this.receiveResult(serverOutcome);
    }

    // Standalone client simulator mode (default for preview & standalone play)
    const provablyMeta = provablyFairManager.getNextBetMeta();
    const outcome = generateLimboOutcome({
      betAmount,
      targetMultiplier,
      houseEdge: this.config.houseEdge,
    });

    const fullResult = {
      ...outcome,
      provablyFair: provablyMeta,
    };

    return this.receiveResult(fullResult);
  }

  /**
   * Receives server-authoritative or engine-generated game result.
   * @param {Object} resultData
   */
  receiveResult(resultData) {
    this.currentResult = resultData;
    if (this.callbacks.onResult) {
      this.callbacks.onResult(resultData);
    }
    return resultData;
  }

  /**
   * Drives the visual counter animation from 1.00x up to the result multiplier.
   *
   * @param {Object} options
   * @param {number} options.targetResultMultiplier - The final crash multiplier
   * @param {Function} options.onTick - Callback receiving (currentMultiplier)
   * @param {Function} options.onComplete - Callback called when animation finishes
   */
  playAnimation({ targetResultMultiplier, onTick, onComplete }) {
    if (this.isTurbo) {
      if (onTick) onTick(targetResultMultiplier);
      if (onComplete) onComplete(this.currentResult);
      this.status = "completed";
      return;
    }

    const startTime = performance.now();
    const duration = Math.min(900, Math.max(300, Math.log10(Math.max(1.1, targetResultMultiplier)) * 400));
    const startVal = 1.0;
    const endVal = targetResultMultiplier;

    let lastTickVal = 1.0;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Ease-out cubic animation
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = parseFloat((startVal + (endVal - startVal) * eased).toFixed(2));

      if (current !== lastTickVal) {
        lastTickVal = current;
        if (onTick) onTick(current);
        soundEngine.playTick(current);
      }

      if (progress < 1.0) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.status = "completed";
        if (onTick) onTick(endVal);
        if (onComplete) onComplete(this.currentResult);
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Triggers the win celebration audio and visual feedback.
   * @param {number} payout
   */
  showWin(payout) {
    soundEngine.playWin();
    if (this.callbacks.onWin) {
      this.callbacks.onWin(payout, this.currentResult);
    }
  }

  /**
   * Triggers the loss audio and visual feedback.
   */
  showLoss() {
    soundEngine.playLoss();
    if (this.callbacks.onLoss) {
      this.callbacks.onLoss(this.currentResult);
    }
  }

  /**
   * Resets engine state for next round.
   */
  reset() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.status = "ready";
    this.currentBet = null;
    this.currentResult = null;

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange("ready");
    }
  }
}

export const GameEngine = new CasinoGameEngine();
export default GameEngine;
