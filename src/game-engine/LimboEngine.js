/**
 * LimboEngine - Core Headless Game Engine for Casino Limbo
 *
 * Architecture Highlights:
 * 1. Completely separated from UI / DOM / React:
 *    - Zero React hooks, zero DOM dependencies, zero UI imports.
 *    - Pure JavaScript / TypeScript class capable of running in Node, Web Workers, or any UI framework.
 * 2. Robust Event-Driven Architecture:
 *    - Full EventEmitter pattern with `on`, `off`, `once`, `emit`, and automatic unsubscribe callbacks.
 * 3. State Management:
 *    - Balance, Bet Amount, Target Multiplier, Win Chance, Potential Payout/Profit.
 *    - Session Statistics (win rate, streaks, high multiplier, net profit).
 *    - Round History (capped ring buffer).
 * 4. Comprehensive Game Loop:
 *    - State machine: IDLE -> ROLLING -> ANIMATING -> SETTLED.
 *    - Provably fair outcome generation integration.
 *    - Dynamic multiplier animation ticker with cubic ease-out.
 *    - Turbo mode for instant settlement.
 * 5. Full-featured Auto-Betting Engine:
 *    - Multi-round execution loop.
 *    - Dynamic stake adjustments (on-win / on-loss percentage increases or resets).
 *    - Stop-Profit and Stop-Loss limits.
 *    - Clean cancellation handling without memory leaks or stray timers.
 */

import {
  generateLimboOutcome,
  calculateWinChance,
  calculateTargetMultiplier,
  DEFAULT_HOUSE_EDGE,
  MIN_BET,
  MAX_BET,
  MIN_MULTIPLIER,
  MAX_MULTIPLIER,
} from "../game/limboPRNG";
import { provablyFairManager } from "./provablyFair";

// ==========================================
// Constants & Enumerations
// ==========================================

export const LimboStatus = Object.freeze({
  IDLE: "IDLE",
  WAITING_FOR_BET: "WAITING_FOR_BET",
  COUNTDOWN: "COUNTDOWN",
  FLYING: "FLYING",
  CRASHED: "CRASHED",
  // Backward-compatibility aliases
  READY: "WAITING_FOR_BET",
  ROLLING: "FLYING",
  ANIMATING: "FLYING",
  SETTLED: "CRASHED",
  ERROR: "ERROR",
});

export const AutoBetStopReason = Object.freeze({
  MANUAL: "MANUAL",
  COMPLETED: "COMPLETED",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  STOP_PROFIT_REACHED: "STOP_PROFIT_REACHED",
  STOP_LOSS_REACHED: "STOP_LOSS_REACHED",
  INVALID_BET: "INVALID_BET",
  ERROR: "ERROR",
});

// ==========================================
// Lightweight UI-Independent Event Emitter
// ==========================================

class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Subscribes a listener function to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (typeof handler !== "function") {
      throw new TypeError("Event handler must be a function");
    }
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);

    // Return unbind function for convenient cleanup in UI components
    return () => this.off(event, handler);
  }

  /**
   * Subscribes a one-time listener to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler.apply(this, args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Removes a specific listener from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const bucket = this._listeners.get(event);
    if (bucket) {
      bucket.delete(handler);
      if (bucket.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Emits an event with optional arguments to all subscribers.
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    const bucket = this._listeners.get(event);
    if (bucket && bucket.size > 0) {
      // Clone set to prevent issues if listeners modify the set during iteration
      const listeners = Array.from(bucket);
      for (let i = 0; i < listeners.length; i++) {
        try {
          listeners[i].apply(this, args);
        } catch (err) {
          console.error(`[LimboEngine] Error in listener for event "${event}":`, err);
        }
      }
    }
  }

  /**
   * Clears all listeners for an event or all events entirely.
   * @param {string} [event]
   */
  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }
}

// ==========================================
// Core Limbo Engine Class
// ==========================================

export class LimboEngine extends EventEmitter {
  constructor(initialOptions = {}) {
    super();

    // 1. Engine Configuration
    this.config = {
      houseEdge: initialOptions.houseEdge ?? DEFAULT_HOUSE_EDGE,
      minBet: initialOptions.minBet ?? MIN_BET,
      maxBet: initialOptions.maxBet ?? MAX_BET,
      minMultiplier: initialOptions.minMultiplier ?? MIN_MULTIPLIER,
      maxMultiplier: initialOptions.maxMultiplier ?? MAX_MULTIPLIER,
      defaultBet: initialOptions.defaultBet ?? 10,
      defaultTargetMultiplier: initialOptions.defaultTargetMultiplier ?? 2.0,
      maxHistorySize: initialOptions.maxHistorySize ?? 50,
      ...initialOptions.config,
    };

    // 2. Playable Balance & Funds
    this._balance = initialOptions.initialBalance ?? 1000.0;

    // 3. User Bet & Target Multiplier State
    this._betAmount = this.config.defaultBet;
    this._targetMultiplier = this.config.defaultTargetMultiplier;

    // 4. Engine Lifecycle Status
    this._status = LimboStatus.WAITING_FOR_BET;
    this._currentRound = null;
    this._lastResult = null;
    this._displayMultiplier = 1.0;

    // 5. Settings
    this.settings = {
      turbo: !!initialOptions.turbo,
      animationDuration: initialOptions.animationDuration ?? 750, // ms
    };

    // 6. Round History Buffer
    this._history = [];

    // 7. Session Statistics
    this._stats = {
      totalRounds: 0,
      wins: 0,
      losses: 0,
      totalWagered: 0,
      totalPayout: 0,
      netProfit: 0,
      currentStreak: 0,
      bestStreak: 0,
      worstStreak: 0,
      highestMultiplier: 1.0,
      winRate: 0.0,
    };

    // 8. Auto-Bet Engine State & Internals
    this._autoBet = {
      isActive: false,
      totalRounds: 0,
      roundsRemaining: 0,
      startingBalance: 0,
      baseBet: 0,
      currentBet: 0,
      stopProfit: 0,
      stopLoss: 0,
      onWinAction: "reset", // 'reset' | 'increase'
      onWinPercent: 0,
      onLossAction: "reset", // 'reset' | 'increase'
      onLossPercent: 0,
      maxBetLimit: 0,
    };

    this._autoBetTimer = null;
    this._animationFrameId = null;
    this._isDestroyed = false;
  }

  // ==========================================
  // Public State Getters & Helpers
  // ==========================================

  get status() {
    return this._status;
  }

  get isWaitingForBet() {
    return this._status === LimboStatus.WAITING_FOR_BET;
  }

  get isIdle() {
    return this._status === LimboStatus.IDLE || this._status === LimboStatus.WAITING_FOR_BET;
  }

  get isCountdown() {
    return this._status === LimboStatus.COUNTDOWN;
  }

  get isFlying() {
    return this._status === LimboStatus.FLYING;
  }

  get isCrashed() {
    return this._status === LimboStatus.CRASHED;
  }

  get isRolling() {
    return this._status === LimboStatus.COUNTDOWN || this._status === LimboStatus.FLYING;
  }

  /**
   * Registers a listener for when the engine enters the WAITING_FOR_BET state.
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  onWaitingForBet(handler) {
    return this.on("status:WAITING_FOR_BET", handler);
  }

  /**
   * Registers a listener for when the engine enters the IDLE state.
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  onIdle(handler) {
    return this.on("state:idle", handler);
  }

  /**
   * Registers a listener for when the engine enters the COUNTDOWN state.
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  onCountdown(handler) {
    return this.on("state:countdown", handler);
  }

  /**
   * Registers a listener for when the engine enters the FLYING state.
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  onFlying(handler) {
    return this.on("state:flying", handler);
  }

  /**
   * Registers a listener for when the engine enters the CRASHED state.
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  onCrashed(handler) {
    return this.on("state:crashed", handler);
  }

  /**
   * Resets engine state back to IDLE if not actively in flight.
   */
  resetToIdle() {
    if (!this.isRolling) {
      this._setStatus(LimboStatus.IDLE);
    }
    return this._status;
  }

  get balance() {
    return this._balance;
  }

  get betAmount() {
    return this._betAmount;
  }

  get targetMultiplier() {
    return this._targetMultiplier;
  }

  get displayMultiplier() {
    return this._displayMultiplier;
  }

  get currentRound() {
    return this._currentRound;
  }

  get lastResult() {
    return this._lastResult;
  }

  get history() {
    return [...this._history];
  }

  get stats() {
    return { ...this._stats };
  }

  get isAutoBetting() {
    return this._autoBet.isActive;
  }

  get autoBetState() {
    return { ...this._autoBet };
  }

  /**
   * Returns calculated win chance based on current target multiplier.
   */
  get winChance() {
    return calculateWinChance(this._targetMultiplier, this.config.houseEdge);
  }

  /**
   * Returns potential gross payout for current bet and target.
   */
  get potentialPayout() {
    return parseFloat((this._betAmount * this._targetMultiplier).toFixed(2));
  }

  /**
   * Returns potential net profit if current bet hits target.
   */
  get potentialProfit() {
    return parseFloat((this.potentialPayout - this._betAmount).toFixed(2));
  }

  /**
   * Returns an immutable full snapshot of engine state for reactive UI bindings.
   */
  getStateSnapshot() {
    return {
      status: this._status,
      isRolling: this.isRolling,
      balance: this._balance,
      betAmount: this._betAmount,
      targetMultiplier: this._targetMultiplier,
      winChance: this.winChance,
      potentialPayout: this.potentialPayout,
      potentialProfit: this.potentialProfit,
      displayMultiplier: this._displayMultiplier,
      currentRound: this._currentRound ? { ...this._currentRound } : null,
      lastResult: this._lastResult ? { ...this._lastResult } : null,
      stats: { ...this._stats },
      history: [...this._history],
      isAutoBetting: this._autoBet.isActive,
      autoBet: { ...this._autoBet },
      settings: { ...this.settings },
      config: { ...this.config },
    };
  }

  // ==========================================
  // Balance Management
  // ==========================================

  /**
   * Directly sets the balance with validation and event notification.
   * @param {number} amount
   * @param {string} [reason='manual']
   */
  setBalance(amount, reason = "manual") {
    const num = Number(amount);
    if (isNaN(num) || num < 0) {
      this._emitError("INVALID_BALANCE", "Balance must be a positive number.");
      return this._balance;
    }
    const prev = this._balance;
    this._balance = parseFloat(num.toFixed(2));

    this.emit("balance:change", {
      balance: this._balance,
      previousBalance: prev,
      delta: parseFloat((this._balance - prev).toFixed(2)),
      reason,
    });

    return this._balance;
  }

  /**
   * Credits the balance (e.g. reload or deposit).
   * @param {number} amount
   * @returns {number} Updated balance
   */
  deposit(amount) {
    const add = Number(amount);
    if (isNaN(add) || add <= 0) {
      this._emitError("INVALID_DEPOSIT", "Deposit amount must be greater than zero.");
      return this._balance;
    }
    return this.setBalance(this._balance + add, "deposit");
  }

  /**
   * Debits the balance (e.g. bet deduction or withdrawal).
   * @param {number} amount
   * @returns {boolean} Success flag
   */
  withdraw(amount) {
    const sub = Number(amount);
    if (isNaN(sub) || sub <= 0 || sub > this._balance) {
      this._emitError("INSUFFICIENT_FUNDS", "Withdrawal amount exceeds available balance.");
      return false;
    }
    this.setBalance(this._balance - sub, "withdraw");
    return true;
  }

  /**
   * Convenience reset to a default balance (e.g. 1000).
   * @param {number} [amount=1000]
   */
  resetBalance(amount = 1000) {
    return this.setBalance(amount, "reset");
  }

  // ==========================================
  // Bet & Target Multiplier Controls
  // ==========================================

  /**
   * Validates a bet amount against min/max configuration and balance.
   * @param {number} amount
   * @returns {string|null} Error string or null if valid
   */
  validateBet(amount) {
    const num = Number(amount);
    if (amount === "" || isNaN(num)) return "Enter a valid bet amount";
    if (num < this.config.minBet) return `Minimum bet is ${this.config.minBet}`;
    if (num > this.config.maxBet) return `Maximum bet is ${this.config.maxBet}`;
    if (this._balance <= 0) return "Balance is zero. Please reload credits.";
    if (num > this._balance) return `Bet exceeds balance (${this._balance.toFixed(2)})`;
    return null;
  }

  /**
   * Validates a target cash out multiplier.
   * @param {number} mult
   * @returns {string|null} Error string or null if valid
   */
  validateTarget(mult) {
    const num = Number(mult);
    if (mult === "" || isNaN(num)) return "Enter a valid target multiplier";
    if (num < this.config.minMultiplier) return `Target must be at least ${this.config.minMultiplier.toFixed(2)}x`;
    if (num > this.config.maxMultiplier) return `Target cannot exceed ${this.config.maxMultiplier.toFixed(2)}x`;
    return null;
  }

  /**
   * Sets the current bet amount.
   * @param {number} amount
   */
  setBetAmount(amount) {
    const num = Number(amount);
    if (isNaN(num)) return;
    const clamped = Math.max(this.config.minBet, Math.min(this.config.maxBet, parseFloat(num.toFixed(2))));
    this._betAmount = clamped;

    const error = this.validateBet(this._betAmount);
    this.emit("bet:change", {
      betAmount: this._betAmount,
      isValid: !error,
      error,
    });
  }

  /**
   * Halves the current bet amount (floored to minBet).
   */
  halveBet() {
    const half = parseFloat((this._betAmount / 2).toFixed(2));
    this.setBetAmount(Math.max(this.config.minBet, half));
    return this._betAmount;
  }

  /**
   * Doubles the current bet amount (capped by maxBet and balance).
   */
  doubleBet() {
    const maxAllowed = Math.min(this.config.maxBet, this._balance > 0 ? this._balance : this.config.maxBet);
    const doubled = parseFloat((this._betAmount * 2).toFixed(2));
    this.setBetAmount(Math.min(maxAllowed, doubled));
    return this._betAmount;
  }

  /**
   * Sets bet to minimum allowed bet.
   */
  setMinBet() {
    this.setBetAmount(this.config.minBet);
    return this._betAmount;
  }

  /**
   * Sets bet to maximum allowed bet or current balance.
   */
  setMaxBet() {
    const maxVal = Math.min(this.config.maxBet, Math.max(this.config.minBet, this._balance));
    this.setBetAmount(maxVal);
    return this._betAmount;
  }

  /**
   * Increments the bet by a delta amount.
   * @param {number} delta
   */
  addBet(delta) {
    const next = parseFloat((this._betAmount + delta).toFixed(2));
    this.setBetAmount(next);
    return this._betAmount;
  }

  /**
   * Sets the target cash out multiplier.
   * @param {number} mult
   */
  setTargetMultiplier(mult) {
    const num = Number(mult);
    if (isNaN(num)) return;
    const clamped = Math.max(
      this.config.minMultiplier,
      Math.min(this.config.maxMultiplier, parseFloat(num.toFixed(2)))
    );
    this._targetMultiplier = clamped;

    const error = this.validateTarget(this._targetMultiplier);
    this.emit("target:change", {
      targetMultiplier: this._targetMultiplier,
      winChance: this.winChance,
      potentialPayout: this.potentialPayout,
      potentialProfit: this.potentialProfit,
      isValid: !error,
      error,
    });
  }

  /**
   * Increments the target multiplier by step.
   * @param {number} [step=1.0]
   */
  incrementTarget(step = 1.0) {
    this.setTargetMultiplier(this._targetMultiplier + step);
    return this._targetMultiplier;
  }

  /**
   * Decrements the target multiplier by step.
   * @param {number} [step=1.0]
   */
  decrementTarget(step = 1.0) {
    this.setTargetMultiplier(this._targetMultiplier - step);
    return this._targetMultiplier;
  }

  /**
   * Calculates and sets target multiplier corresponding to a desired win probability percentage.
   * @param {number} winChancePercent
   */
  setTargetByWinChance(winChancePercent) {
    const target = calculateTargetMultiplier(winChancePercent, this.config.houseEdge);
    this.setTargetMultiplier(target);
    return this._targetMultiplier;
  }

  /**
   * Configures turbo mode.
   * @param {boolean} enabled
   */
  setTurbo(enabled) {
    this.settings.turbo = !!enabled;
    this.emit("settings:change", { ...this.settings });
  }

  // ==========================================
  // Core Game Loop & Round Execution
  // ==========================================

  /**
   * Executes a single Limbo game round.
   *
   * Flow:
   * 1. Validates inputs & ensures engine is not already rolling.
   * 2. Sets status to ROLLING.
   * 3. Debits wager from balance immediately and emits events.
   * 4. Derives cryptographically sound or provably fair result.
   * 5. Runs ticker animation loop (or instant in turbo mode).
   * 6. Settles round, credits payout if win, updates statistics & history.
   * 7. Transitions to SETTLED and emits completion events.
   *
   * @param {Object} [overrideParams]
   * @param {number} [overrideParams.betAmount]
   * @param {number} [overrideParams.targetMultiplier]
   * @returns {Promise<Object>} Settled round result
   */
  async playRound(overrideParams = {}) {
    if (this._status !== LimboStatus.WAITING_FOR_BET && this._status !== LimboStatus.IDLE) {
      const err = new Error("Please wait for the next round to start.");
      this._emitError("ROUND_IN_PROGRESS", err.message);
      throw err;
    }

    if (this.isRolling) {
      const err = new Error("LimboEngine is already rolling a round.");
      this._emitError("ROUND_IN_PROGRESS", err.message);
      throw err;
    }

    const wager = overrideParams.betAmount !== undefined ? Number(overrideParams.betAmount) : this._betAmount;
    const target =
      overrideParams.targetMultiplier !== undefined
        ? Number(overrideParams.targetMultiplier)
        : this._targetMultiplier;

    // Validate bet
    const betError = this.validateBet(wager);
    if (betError) {
      this._emitError("INVALID_BET", betError);
      throw new Error(betError);
    }

    // Validate target
    const targetError = this.validateTarget(target);
    if (targetError) {
      this._emitError("INVALID_TARGET", targetError);
      throw new Error(targetError);
    }

    // Initialize round
    const roundId = `round_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this._currentRound = {
      id: roundId,
      betAmount: wager,
      targetMultiplier: target,
      startTime: Date.now(),
    };
    this._displayMultiplier = 1.0;

    // 1. Deduct wager immediately
    const prevBalance = this._balance;
    this._balance = parseFloat((this._balance - wager).toFixed(2));
    this.emit("balance:change", {
      balance: this._balance,
      previousBalance: prevBalance,
      delta: -wager,
      reason: "bet_placed",
      roundId,
    });

    this.emit("round:start", {
      roundId,
      betAmount: wager,
      targetMultiplier: target,
      timestamp: this._currentRound.startTime,
    });
    this.emit("round:tick", { multiplier: 1.0, progress: 0.0 });

    // 2. Transition state to COUNTDOWN
    this._setStatus(LimboStatus.COUNTDOWN, {
      roundId,
      betAmount: wager,
      targetMultiplier: target,
      duration: this.settings.turbo ? 0 : 200,
    });

    if (!this.settings.turbo) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // 3. Derive provably fair outcome
    const provablyMeta = provablyFairManager.getNextBetMeta();
    const rawOutcome = generateLimboOutcome({
      betAmount: wager,
      targetMultiplier: target,
      houseEdge: this.config.houseEdge,
    });

    const fullOutcome = {
      ...rawOutcome,
      id: roundId,
      provablyFair: provablyMeta,
    };

    // 4. Transition state to FLYING and animate multiplier ticker
    this._setStatus(LimboStatus.FLYING, {
      roundId,
      betAmount: wager,
      targetMultiplier: target,
      finalMultiplier: fullOutcome.multiplier,
    });
    await this._animateMultiplier(fullOutcome.multiplier);

    // 5. Settle round outcome -> transitions to CRASHED
    return this._settleRound(fullOutcome, wager, target);
  }

  /**
   * Internal animation ticker running cubic ease-out progression.
   * @private
   * @param {number} finalMultiplier
   * @returns {Promise<void>}
   */
  _animateMultiplier(finalMultiplier) {
    return new Promise((resolve) => {
      if (this.settings.turbo) {
        this._displayMultiplier = finalMultiplier;
        this.emit("round:tick", { multiplier: finalMultiplier, progress: 1.0 });
        resolve();
        return;
      }

      const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
      const duration = Math.min(
        850,
        Math.max(280, Math.log10(Math.max(1.1, finalMultiplier)) * 380)
      );
      const startVal = 1.0;
      const endVal = finalMultiplier;
      let lastVal = 1.0;

      const step = () => {
        if (this._isDestroyed) {
          resolve();
          return;
        }

        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);

        // Ease-out cubic curve: 1 - (1 - t)^3
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentVal = parseFloat((startVal + (endVal - startVal) * eased).toFixed(2));

        if (currentVal !== lastVal) {
          lastVal = currentVal;
          this._displayMultiplier = currentVal;
          this.emit("round:tick", { multiplier: currentVal, progress });
        }

        if (progress < 1.0) {
          if (typeof requestAnimationFrame !== "undefined") {
            this._animationFrameId = requestAnimationFrame(step);
          } else {
            this._animationFrameId = setTimeout(step, 16);
          }
        } else {
          this._displayMultiplier = endVal;
          this.emit("round:tick", { multiplier: endVal, progress: 1.0 });
          this._animationFrameId = null;
          resolve();
        }
      };

      if (typeof requestAnimationFrame !== "undefined") {
        this._animationFrameId = requestAnimationFrame(step);
      } else {
        this._animationFrameId = setTimeout(step, 16);
      }
    });
  }

  /**
   * Settles the outcome, handles payouts, updates stats and emits settlement events.
   * @private
   * @param {Object} outcome
   * @param {number} wager
   * @param {number} target
   */
  _settleRound(outcome, wager, target) {
    const hasWon = outcome.win;
    const payout = outcome.payout;
    const netProfit = outcome.netProfit;
    const multiplier = outcome.multiplier;

    // Credit win if won
    if (hasWon && payout > 0) {
      const prevBal = this._balance;
      this._balance = parseFloat((this._balance + payout).toFixed(2));
      this.emit("balance:change", {
        balance: this._balance,
        previousBalance: prevBal,
        delta: payout,
        reason: "round_win",
        roundId: outcome.id,
      });

      this.emit("round:win", {
        roundId: outcome.id,
        payout,
        netProfit,
        multiplier,
        targetMultiplier: target,
      });
    } else {
      this.emit("round:loss", {
        roundId: outcome.id,
        lossAmount: wager,
        multiplier,
        targetMultiplier: target,
      });
    }

    // Update Session Statistics
    const nextWins = hasWon ? this._stats.wins + 1 : this._stats.wins;
    const nextLosses = !hasWon ? this._stats.losses + 1 : this._stats.losses;
    const totalRounds = this._stats.totalRounds + 1;
    const currentStreak = hasWon
      ? this._stats.currentStreak >= 0
        ? this._stats.currentStreak + 1
        : 1
      : this._stats.currentStreak <= 0
      ? this._stats.currentStreak - 1
      : -1;

    this._stats = {
      totalRounds,
      wins: nextWins,
      losses: nextLosses,
      totalWagered: parseFloat((this._stats.totalWagered + wager).toFixed(2)),
      totalPayout: parseFloat((this._stats.totalPayout + payout).toFixed(2)),
      netProfit: parseFloat((this._stats.netProfit + netProfit).toFixed(2)),
      currentStreak,
      bestStreak: Math.max(this._stats.bestStreak, currentStreak),
      worstStreak: Math.min(this._stats.worstStreak, currentStreak),
      highestMultiplier: Math.max(this._stats.highestMultiplier, multiplier),
      winRate: parseFloat(((nextWins / totalRounds) * 100).toFixed(2)),
    };

    // Update Round History
    const historyItem = {
      id: outcome.id,
      timestamp: Date.now(),
      betAmount: wager,
      targetMultiplier: target,
      multiplier,
      win: hasWon,
      payout,
      netProfit,
      provablyFair: outcome.provablyFair,
    };

    this._history = [historyItem, ...this._history.slice(0, this.config.maxHistorySize - 1)];

    // State settlement -> transitions to CRASHED
    this._lastResult = { ...outcome };
    this._currentRound = null;
    this._setStatus(LimboStatus.CRASHED, outcome);

    // Enforce casino-like cooldown cadence before allowing the next bet
    const cooldownDelay = this.settings.turbo ? 500 : 2500;
    setTimeout(() => {
      if (this._status === LimboStatus.CRASHED) {
        this._setStatus(LimboStatus.WAITING_FOR_BET, { cooldownComplete: true });
      }
    }, cooldownDelay);

    // Emit settlement events
    this.emit("round:result", outcome);
    this.emit("round:settled", outcome, this.getStateSnapshot());
    this.emit("stats:change", { ...this._stats });
    this.emit("history:change", [...this._history], historyItem);

    return outcome;
  }

  // ==========================================
  // Auto-Bet Engine
  // ==========================================

  /**
   * Initiates the automated betting loop.
   *
   * @param {Object} options
   * @param {number} options.count - Number of rounds to run (>0)
   * @param {number} [options.stopProfit=0] - Stop if net profit reaches this amount
   * @param {number} [options.stopLoss=0] - Stop if net loss reaches this amount
   * @param {number} [options.maxBetLimit=0] - Safety ceiling for progressive stakes
   * @param {string} [options.onWinAction='reset'] - 'reset' | 'increase'
   * @param {number} [options.onWinPercent=0] - Percentage increase on win
   * @param {string} [options.onLossAction='reset'] - 'reset' | 'increase'
   * @param {number} [options.onLossPercent=0] - Percentage increase on loss
   */
  startAutoBet(options = {}) {
    if (this._autoBet.isActive) {
      this._emitError("AUTOBET_ALREADY_ACTIVE", "Auto-betting is already in progress.");
      return;
    }

    const count = Number(options.count);
    if (isNaN(count) || count <= 0) {
      this._emitError("INVALID_AUTOBET_COUNT", "Auto-bet count must be greater than zero.");
      return;
    }

    const currentWager = this._betAmount;
    const betErr = this.validateBet(currentWager);
    if (betErr) {
      this._emitError("INVALID_BET", betErr);
      return;
    }

    this._autoBet = {
      isActive: true,
      totalRounds: count,
      roundsRemaining: count,
      startingBalance: this._balance,
      baseBet: currentWager,
      currentBet: currentWager,
      stopProfit: Math.max(0, Number(options.stopProfit) || 0),
      stopLoss: Math.max(0, Number(options.stopLoss) || 0),
      onWinAction: options.onWinAction === "increase" ? "increase" : "reset",
      onWinPercent: Math.max(0, Number(options.onWinPercent) || 0),
      onLossAction: options.onLossAction === "increase" ? "increase" : "reset",
      onLossPercent: Math.max(0, Number(options.onLossPercent) || 0),
      maxBetLimit: Math.max(0, Number(options.maxBetLimit) || 0),
    };

    this.emit("autobet:start", { ...this._autoBet });

    // Launch recursive loop
    this._runAutoBetStep();
  }

  /**
   * Internal step in the auto-bet loop.
   * @private
   */
  async _runAutoBetStep() {
    if (!this._autoBet.isActive || this._isDestroyed) {
      return;
    }

    // 1. Check remaining rounds
    if (this._autoBet.roundsRemaining <= 0) {
      this.stopAutoBet(AutoBetStopReason.COMPLETED);
      return;
    }

    // 2. Validate current wager against balance
    let wager = this._autoBet.currentBet;
    if (this._autoBet.maxBetLimit > 0 && wager > this._autoBet.maxBetLimit) {
      wager = this._autoBet.maxBetLimit;
    }

    const betErr = this.validateBet(wager);
    if (betErr) {
      const reason = this._balance < wager ? AutoBetStopReason.INSUFFICIENT_FUNDS : AutoBetStopReason.INVALID_BET;
      this.stopAutoBet(reason, betErr);
      return;
    }

    // 3. Play round
    let outcome;
    try {
      outcome = await this.playRound({ betAmount: wager });
    } catch (err) {
      this.stopAutoBet(AutoBetStopReason.ERROR, err.message);
      return;
    }

    if (!this._autoBet.isActive) return;

    this._autoBet.roundsRemaining -= 1;
    const netProfitSoFar = parseFloat((this._balance - this._autoBet.startingBalance).toFixed(2));

    this.emit("autobet:progress", {
      currentRound: this._autoBet.totalRounds - this._autoBet.roundsRemaining,
      remainingRounds: this._autoBet.roundsRemaining,
      currentBet: wager,
      netProfit: netProfitSoFar,
      outcome,
    });

    // 4. Check Stop-Profit condition
    if (this._autoBet.stopProfit > 0 && netProfitSoFar >= this._autoBet.stopProfit) {
      this.stopAutoBet(AutoBetStopReason.STOP_PROFIT_REACHED, `Reached profit limit (+${netProfitSoFar})`);
      return;
    }

    // 5. Check Stop-Loss condition
    if (this._autoBet.stopLoss > 0 && -netProfitSoFar >= this._autoBet.stopLoss) {
      this.stopAutoBet(AutoBetStopReason.STOP_LOSS_REACHED, `Reached stop loss limit (-${-netProfitSoFar})`);
      return;
    }

    // 6. Check if completed
    if (this._autoBet.roundsRemaining <= 0) {
      this.stopAutoBet(AutoBetStopReason.COMPLETED);
      return;
    }

    // 7. Calculate next round wager
    let nextWager = wager;
    if (outcome.win) {
      if (this._autoBet.onWinAction === "increase" && this._autoBet.onWinPercent > 0) {
        nextWager = parseFloat((wager * (1 + this._autoBet.onWinPercent / 100)).toFixed(2));
      } else {
        nextWager = this._autoBet.baseBet;
      }
    } else {
      if (this._autoBet.onLossAction === "increase" && this._autoBet.onLossPercent > 0) {
        nextWager = parseFloat((wager * (1 + this._autoBet.onLossPercent / 100)).toFixed(2));
      } else {
        nextWager = this._autoBet.baseBet;
      }
    }

    nextWager = Math.max(this.config.minBet, Math.min(this.config.maxBet, nextWager));
    this._autoBet.currentBet = nextWager;
    this.setBetAmount(nextWager);

    // Schedule next round with ergonomic delay after cooldown
    const delay = this.settings.turbo ? 550 : 2550; // slightly longer than cooldown to ensure state is WAITING_FOR_BET
    this._autoBetTimer = setTimeout(() => {
      this._runAutoBetStep();
    }, delay);
  }

  /**
   * Stops the auto-betting loop cleanly.
   * @param {string} [reason=AutoBetStopReason.MANUAL]
   * @param {string} [message]
   */
  stopAutoBet(reason = AutoBetStopReason.MANUAL, message = "") {
    if (!this._autoBet.isActive) return;

    if (this._autoBetTimer) {
      clearTimeout(this._autoBetTimer);
      this._autoBetTimer = null;
    }

    const summary = {
      reason,
      message,
      roundsPlayed: this._autoBet.totalRounds - this._autoBet.roundsRemaining,
      netProfit: parseFloat((this._balance - this._autoBet.startingBalance).toFixed(2)),
      endingBalance: this._balance,
    };

    this._autoBet.isActive = false;
    this.emit("autobet:stop", summary);
  }

  // ==========================================
  // Statistics & History Controls
  // ==========================================

  /**
   * Resets session statistics.
   */
  resetStats() {
    this._stats = {
      totalRounds: 0,
      wins: 0,
      losses: 0,
      totalWagered: 0,
      totalPayout: 0,
      netProfit: 0,
      currentStreak: 0,
      bestStreak: 0,
      worstStreak: 0,
      highestMultiplier: 1.0,
      winRate: 0.0,
    };
    this.emit("stats:change", { ...this._stats });
    return this._stats;
  }

  /**
   * Clears round history.
   */
  clearHistory() {
    this._history = [];
    this.emit("history:change", [], null);
  }

  // ==========================================
  // Internal Helpers & Teardown
  // ==========================================

  /**
   * Sets engine status and emits full state change notifications and state-specific hooks.
   * Emits:
   * - 'state:change' (status, snapshot, payload)
   * - 'status:change' ({ previous, current, snapshot, payload })
   * - 'state:idle' / 'status:IDLE'
   * - 'state:countdown' / 'status:COUNTDOWN'
   * - 'state:flying' / 'status:FLYING'
   * - 'state:crashed' / 'status:CRASHED'
   *
   * @private
   * @param {string} nextStatus
   * @param {Object} [payload={}]
   */
  _setStatus(nextStatus, payload = {}) {
    const prevStatus = this._status;
    this._status = nextStatus;
    const snapshot = this.getStateSnapshot();

    // 1. General state & status change events
    this.emit("state:change", this._status, snapshot, payload);
    this.emit("status:change", {
      previous: prevStatus,
      current: this._status,
      snapshot,
      ...payload,
    });

    // 2. Specific state hooks (supporting multiple naming conventions)
    switch (nextStatus) {
      case LimboStatus.IDLE:
        this.emit("state:idle", snapshot, payload);
        this.emit("status:IDLE", snapshot, payload);
        this.emit("idle", snapshot, payload);
        break;
      case LimboStatus.WAITING_FOR_BET:
        this.emit("state:waiting", snapshot, payload);
        this.emit("status:WAITING_FOR_BET", snapshot, payload);
        this.emit("waiting", snapshot, payload);
        break;
      case LimboStatus.COUNTDOWN:
        this.emit("state:countdown", payload, snapshot);
        this.emit("status:COUNTDOWN", payload, snapshot);
        this.emit("countdown", payload, snapshot);
        break;
      case LimboStatus.FLYING:
        this.emit("state:flying", payload, snapshot);
        this.emit("status:FLYING", payload, snapshot);
        this.emit("flying", payload, snapshot);
        break;
      case LimboStatus.CRASHED:
        this.emit("state:crashed", payload, snapshot);
        this.emit("status:CRASHED", payload, snapshot);
        this.emit("crashed", payload, snapshot);
        break;
      default:
        break;
    }
  }

  /**
   * Helper to emit structured errors.
   * @private
   * @param {string} code
   * @param {string} message
   */
  _emitError(code, message) {
    this.emit("error", { code, message });
  }

  /**
   * Procedural Rocket Drawing Function for HTML5 Canvas.
   * Visually represents the current multiplier's ascent, velocity heating,
   * supersonic plasma exhaust, and state transitions.
   *
   * @param {CanvasRenderingContext2D} ctx - HTML5 Canvas 2D context
   * @param {Object} options
   * @param {number} options.x - Center X position on canvas
   * @param {number} options.y - Center Y position on canvas
   * @param {number} [options.multiplier=1.0] - Current ascent multiplier
   * @param {number} [options.targetMultiplier=2.0] - Target multiplier
   * @param {string} [options.status='IDLE'] - 'IDLE' | 'COUNTDOWN' | 'FLYING' | 'CRASHED'
   * @param {boolean|null} [options.isWin=null] - Win outcome flag
   * @param {number} [options.tilt=0] - Rocket angle in radians
   * @param {number} [options.scale=1.0] - Scale multiplier
   * @param {number} [options.time=0] - Animation frame / timestamp for flame oscillation
   * @param {boolean} [options.glow=true] - Whether to render speed aura
   */
  drawRocket(ctx, options = {}) {
    return drawProceduralRocket(ctx, options);
  }

  /**
   * Static helper for drawing procedural rocket.
   */
  static drawProceduralRocket(ctx, options = {}) {
    return drawProceduralRocket(ctx, options);
  }

  /**
   * Cleans up all active timers, animation frames, and listeners.
   */
  destroy() {
    this._isDestroyed = true;
    if (this._autoBetTimer) {
      clearTimeout(this._autoBetTimer);
      this._autoBetTimer = null;
    }
    if (this._animationFrameId) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this._animationFrameId);
      } else {
        clearTimeout(this._animationFrameId);
      }
      this._animationFrameId = null;
    }
    this.removeAllListeners();
  }
}

/**
 * High-performance procedural rocket renderer for HTML5 Canvas.
 * Refactored for 60FPS execution on low-end mobile devices and high-DPI displays.
 * Features:
 * - Single-pass context transformation (minimal save/restore pipeline overhead)
 * - Dynamic multiplier color thermals (Cyan -> Green -> Amber -> Magenta -> Violet)
 * - Supersonic plasma exhaust plume with white-hot core & supersonic shock diamonds
 * - Titanium exhaust nozzles, swept delta stabilizer fins, specular dorsal sheen
 * - Pilot cyber visor with glass gleam reflection
 * - Dynamic scale clamping tailored for responsive container graphs
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} options
 */
export function drawProceduralRocket(ctx, options = {}) {
  const {
    x = 0,
    y = 0,
    multiplier = 1.0,
    targetMultiplier = 2.0,
    status = "IDLE",
    isWin = null,
    tilt = 0,
    scale = 1.0,
    time = 0,
    glow = true,
  } = options;

  if (!ctx) return;

  const isCountdown = status === "COUNTDOWN";
  const isFlying = status === "FLYING" || status === "ROLLING" || status === "ANIMATING";
  const isCrashed = status === "CRASHED" || status === "SETTLED";
  const isWon = isWin === true || (isCrashed && multiplier >= targetMultiplier);
  const isLost = isWin === false || (isCrashed && multiplier < targetMultiplier);

  // If lost and crashed, the crash explosion particle system takes over
  if (isLost && isCrashed) return;

  // Determine dynamic multiplier energy theme
  let energyColor = "#00f0ff"; // Base Cyan (< 2x)
  let energyGlow = "rgba(0, 240, 255, 0.35)";
  let heatColor = "#ffffff";

  if (isWon) {
    energyColor = "#00e701";
    energyGlow = "rgba(0, 231, 1, 0.6)";
    heatColor = "#d4ffd4";
  } else if (multiplier >= 100.0) {
    energyColor = "#b026ff"; // Cosmic Violet (100x+)
    energyGlow = "rgba(176, 38, 255, 0.55)";
    heatColor = "#ff88ff";
  } else if (multiplier >= 20.0) {
    energyColor = "#ff0055"; // Hyper Magenta (20x+)
    energyGlow = "rgba(255, 0, 85, 0.5)";
    heatColor = "#ffaaaa";
  } else if (multiplier >= 5.0) {
    energyColor = "#ffb700"; // Solar Amber (5x+)
    energyGlow = "rgba(255, 183, 0, 0.45)";
    heatColor = "#fff3cc";
  } else if (multiplier >= 2.0) {
    energyColor = "#00e701"; // Target Reached Green (2x+)
    energyGlow = "rgba(0, 231, 1, 0.45)";
    heatColor = "#ccffcc";
  }

  // Base dimensions (optimized 38x66 aspect ratio)
  const baseW = 38;
  const baseH = 66;
  const halfW = baseW * 0.5;
  const halfH = baseH * 0.5;

  ctx.save();
  ctx.translate(x, y);
  if (tilt !== 0) ctx.rotate(tilt);
  if (scale !== 1) ctx.scale(scale, scale);

  // ==========================================
  // 1. Ascent Velocity Thermal Glow / Bloom
  // ==========================================
  if (glow) {
    const auraRadius = isWon
      ? 46 + Math.sin(time * 0.08) * 6
      : isFlying
      ? 34 + Math.min(22, Math.log10(Math.max(1.1, multiplier)) * 12) + Math.sin(time * 0.12) * 3
      : isCountdown
      ? 28 + Math.random() * 4
      : 22;

    const auraGrad = ctx.createRadialGradient(0, 4, 8, 0, 4, auraRadius);
    auraGrad.addColorStop(0, energyGlow);
    auraGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.05)");
    auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 4, auraRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // ==========================================
  // 2. Supersonic Thruster Jet Plume & Core
  // ==========================================
  if (isFlying || isCountdown || isWon) {
    const ascentBoost = isFlying ? Math.min(2.2, 1 + Math.log10(Math.max(1, multiplier)) * 0.65) : 1;
    const flameLength = (isCountdown ? 18 : isWon ? 36 : 46 * ascentBoost) + Math.sin(time * 0.35) * 5;
    const flameWidth = halfW * (isCountdown ? 0.6 : 0.82);

    // Outer plasma flame jet
    const outerFlameGrad = ctx.createLinearGradient(0, halfH - 4, 0, halfH + flameLength);
    outerFlameGrad.addColorStop(0, energyColor);
    outerFlameGrad.addColorStop(0.5, "rgba(255, 120, 0, 0.75)");
    outerFlameGrad.addColorStop(1, "rgba(255, 0, 0, 0)");

    ctx.fillStyle = outerFlameGrad;
    ctx.beginPath();
    ctx.moveTo(-flameWidth, halfH - 2);
    ctx.quadraticCurveTo(-flameWidth * 0.7, halfH + flameLength * 0.5, 0, halfH + flameLength);
    ctx.quadraticCurveTo(flameWidth * 0.7, halfH + flameLength * 0.5, flameWidth, halfH - 2);
    ctx.closePath();
    ctx.fill();

    // Inner White-Hot Supersonic Core
    const coreLength = flameLength * 0.52;
    const coreWidth = flameWidth * 0.42;
    const innerFlameGrad = ctx.createLinearGradient(0, halfH - 2, 0, halfH + coreLength);
    innerFlameGrad.addColorStop(0, "#ffffff");
    innerFlameGrad.addColorStop(0.7, heatColor);
    innerFlameGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = innerFlameGrad;
    ctx.beginPath();
    ctx.moveTo(-coreWidth, halfH - 2);
    ctx.quadraticCurveTo(-coreWidth * 0.5, halfH + coreLength * 0.6, 0, halfH + coreLength);
    ctx.quadraticCurveTo(coreWidth * 0.5, halfH + coreLength * 0.6, coreWidth, halfH - 2);
    ctx.closePath();
    ctx.fill();

    // Supersonic shock diamond rings during high-speed flight
    if (isFlying && multiplier >= 1.5) {
      const diamondY = halfH + flameLength * 0.32;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, diamondY, coreWidth * 0.65, 1.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ==========================================
  // 3. Swept Aerodynamic Stabilizer Delta Fins
  // ==========================================
  // Left Delta Fin
  const finGradLeft = ctx.createLinearGradient(-halfW - 12, 0, -halfW + 4, halfH);
  finGradLeft.addColorStop(0, "#0e1626");
  finGradLeft.addColorStop(0.7, "#1a243b");
  finGradLeft.addColorStop(1, energyColor);

  ctx.fillStyle = finGradLeft;
  ctx.strokeStyle = energyColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-halfW + 2, 2);
  ctx.lineTo(-halfW - 12, halfH - 2);
  ctx.lineTo(-halfW + 3, halfH - 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right Delta Fin
  const finGradRight = ctx.createLinearGradient(halfW + 12, 0, halfW - 4, halfH);
  finGradRight.addColorStop(0, "#0e1626");
  finGradRight.addColorStop(0.7, "#1a243b");
  finGradRight.addColorStop(1, energyColor);

  ctx.fillStyle = finGradRight;
  ctx.beginPath();
  ctx.moveTo(halfW - 2, 2);
  ctx.lineTo(halfW + 12, halfH - 2);
  ctx.lineTo(halfW - 3, halfH - 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ==========================================
  // 4. Titanium Exhaust Nozzles (Dual Bell)
  // ==========================================
  const nozzleGrad = ctx.createLinearGradient(0, halfH - 7, 0, halfH + 2);
  nozzleGrad.addColorStop(0, "#1f293d");
  nozzleGrad.addColorStop(0.7, "#0f1522");
  nozzleGrad.addColorStop(1, energyColor);

  ctx.fillStyle = nozzleGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 0.8;

  // Left nozzle
  ctx.beginPath();
  ctx.rect(-11, halfH - 5, 8, 7);
  ctx.fill();
  ctx.stroke();

  // Right nozzle
  ctx.beginPath();
  ctx.rect(3, halfH - 5, 8, 7);
  ctx.fill();
  ctx.stroke();

  // ==========================================
  // 5. Main Rocket Fuselage Body
  // ==========================================
  const bodyGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
  bodyGrad.addColorStop(0, "#0c1322");
  bodyGrad.addColorStop(0.25, "#1e293b");
  bodyGrad.addColorStop(0.5, "#334155"); // Specular ridge reflection
  bodyGrad.addColorStop(0.85, "#1e293b");
  bodyGrad.addColorStop(1, "#080c16");

  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  // Nose cone tip
  ctx.moveTo(0, -halfH);
  // Right fuselage contour
  ctx.bezierCurveTo(halfW * 0.75, -halfH + 14, halfW, -8, halfW, halfH - 5);
  // Bottom skirt
  ctx.lineTo(-halfW, halfH - 5);
  // Left fuselage contour
  ctx.bezierCurveTo(-halfW, -8, -halfW * 0.75, -halfH + 14, 0, -halfH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Specular Dorsal Center Sheen Line
  const sheenGrad = ctx.createLinearGradient(0, -halfH, 0, halfH);
  sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
  sheenGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.35)");
  sheenGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.05)");
  sheenGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.strokeStyle = sheenGrad;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -halfH + 3);
  ctx.lineTo(0, halfH - 10);
  ctx.stroke();

  // Lateral high-tech neon racing pinstripes
  ctx.strokeStyle = energyColor;
  ctx.lineWidth = 1.2;

  // Left stripe
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.58, -5);
  ctx.lineTo(-halfW * 0.58, halfH - 8);
  ctx.stroke();

  // Right stripe
  ctx.beginPath();
  ctx.moveTo(halfW * 0.58, -5);
  ctx.lineTo(halfW * 0.58, halfH - 8);
  ctx.stroke();

  // ==========================================
  // 6. Nose Cone Heat Shield Cap
  // ==========================================
  const noseGrad = ctx.createLinearGradient(0, -halfH, 0, -halfH + 18);
  noseGrad.addColorStop(0, heatColor);
  noseGrad.addColorStop(0.4, energyColor);
  noseGrad.addColorStop(1, "#1e293b");

  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(0, -halfH);
  ctx.bezierCurveTo(halfW * 0.4, -halfH + 9, halfW * 0.58, -halfH + 14, halfW * 0.48, -halfH + 18);
  ctx.lineTo(-halfW * 0.48, -halfH + 18);
  ctx.bezierCurveTo(-halfW * 0.58, -halfH + 14, -halfW * 0.4, -halfH + 9, 0, -halfH);
  ctx.closePath();
  ctx.fill();

  // ==========================================
  // 7. Pilot Viewport / Cyber Visor Capsule
  // ==========================================
  const visorY = -halfH + 27;
  const visorW = 14;
  const visorH = 12;

  const visorGrad = ctx.createLinearGradient(0, visorY - visorH * 0.5, 0, visorY + visorH * 0.5);
  visorGrad.addColorStop(0, "#00f0ff");
  visorGrad.addColorStop(0.5, "#0066cc");
  visorGrad.addColorStop(1, "#001133");

  ctx.fillStyle = visorGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.ellipse(0, visorY, visorW * 0.5, visorH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Visor glass reflection gleam
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.ellipse(-2, visorY - 2.5, 2.5, 1.6, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  // ==========================================
  // 8. Dorsal Center Stabilizer Fin
  // ==========================================
  const dorsalGrad = ctx.createLinearGradient(0, -2, 0, halfH - 4);
  dorsalGrad.addColorStop(0, energyColor);
  dorsalGrad.addColorStop(1, "#0d131f");

  ctx.fillStyle = dorsalGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(2, halfH - 7);
  ctx.lineTo(-2, halfH - 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Export singleton instance for convenience
export const limboEngine = new LimboEngine();
export default LimboEngine;

