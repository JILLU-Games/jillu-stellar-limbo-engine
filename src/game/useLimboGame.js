import { useState, useCallback, useRef, useEffect, useContext } from "react";
import FundContext from "../context/FundContext";
import snackbar from "../hooks/snackbar";
import { LimboEngine, LimboStatus, AutoBetStopReason } from "../game-engine/LimboEngine";
import { MIN_BET, MAX_BET, MIN_MULTIPLIER, MAX_MULTIPLIER } from "./limboPRNG";

/**
 * Custom React hook bridging the headless LimboEngine with React UI state.
 *
 * All core game loop, betting, target validation, auto-betting logic,
 * and result generation are handled entirely by LimboEngine.
 */
export function useLimboGame({ onOutcome, setExternalBets, customEngine } = {}) {
  const { fund, setFund, setAutobetFlag } = useContext(FundContext);

  // Maintain engine instance
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current =
      customEngine ||
      new LimboEngine({
        initialBalance: fund,
        defaultBet: 10,
        defaultTargetMultiplier: 2.0,
      });
  }
  const engine = engineRef.current;

  // React states derived from engine state
  const [betAmount, setBetAmountState] = useState(engine.betAmount);
  const [targetMultiplier, setTargetMultiplierState] = useState(engine.targetMultiplier);
  const [gameState, setGameState] = useState(engine.status || "IDLE");
  const [engineStatus, setEngineStatus] = useState(engine.status || "IDLE");
  const [lastOutcome, setLastOutcome] = useState(null);
  const [displayMultiplier, setDisplayMultiplier] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(0);
  const [stopProfit, setStopProfit] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [maxBetLimit, setMaxBetLimit] = useState(0);
  const [onWinPercent, setOnWinPercent] = useState(0);
  const [onLossPercent, setOnLossPercent] = useState(0);
  const [stats, setStats] = useState(engine.stats);
  const [betHistory, setBetHistory] = useState([]);

  // Sync fund changes with engine if external fund changes
  useEffect(() => {
    if (Math.abs(engine.balance - fund) > 0.01 && !engine.isRolling) {
      engine.setBalance(fund, "sync");
    }
  }, [fund, engine]);

  // Subscribe to LimboEngine events
  useEffect(() => {
    const unsubBalance = engine.on("balance:change", ({ balance }) => {
      setFund(balance);
    });

    const unsubBet = engine.on("bet:change", ({ betAmount: newBet }) => {
      setBetAmountState(newBet);
    });

    const unsubTarget = engine.on("target:change", ({ targetMultiplier: newTarget }) => {
      setTargetMultiplierState(newTarget);
    });

    const unsubState = engine.on("state:change", (status) => {
      setEngineStatus(status);
      setGameState(status);
      setIsProcessing(status === LimboStatus.COUNTDOWN || status === LimboStatus.FLYING);
    });

    const unsubIdle = engine.on("state:idle", () => {
      setGameState("IDLE");
      setEngineStatus("IDLE");
      setIsProcessing(false);
    });

    const unsubCountdown = engine.on("state:countdown", () => {
      setGameState("COUNTDOWN");
      setEngineStatus("COUNTDOWN");
      setIsProcessing(true);
    });

    const unsubFlying = engine.on("state:flying", () => {
      setGameState("FLYING");
      setEngineStatus("FLYING");
      setIsProcessing(true);
    });

    const unsubCrashed = engine.on("state:crashed", () => {
      setGameState("CRASHED");
      setEngineStatus("CRASHED");
      setIsProcessing(false);
    });

    const unsubTick = engine.on("round:tick", ({ multiplier }) => {
      setDisplayMultiplier(multiplier);
    });

    const unsubResult = engine.on("round:result", (outcome) => {
      setLastOutcome(outcome);
      setDisplayMultiplier(outcome.multiplier);
      setGameState("CRASHED");
      if (onOutcome) onOutcome(outcome);
    });

    const unsubHistory = engine.on("history:change", (history, latest) => {
      setBetHistory(history);
      if (setExternalBets && latest) {
        setExternalBets((prev) => [latest, ...prev.slice(0, 9)]);
      }
    });

    const unsubStats = engine.on("stats:change", (newStats) => {
      setStats(newStats);
    });

    const unsubAutoStart = engine.on("autobet:start", () => {
      setIsAutoBetting(true);
      if (setAutobetFlag) setAutobetFlag(true);
    });

    const unsubAutoProgress = engine.on("autobet:progress", ({ remainingRounds }) => {
      setAutoBetCount(remainingRounds);
    });

    const unsubAutoStop = engine.on("autobet:stop", ({ reason, message }) => {
      setIsAutoBetting(false);
      if (setAutobetFlag) setAutobetFlag(false);
      if (reason === AutoBetStopReason.STOP_PROFIT_REACHED) {
        snackbar(message || "Stop profit reached!", "success");
      } else if (reason === AutoBetStopReason.STOP_LOSS_REACHED) {
        snackbar(message || "Stop loss reached!", "warning");
      } else if (reason === AutoBetStopReason.INSUFFICIENT_FUNDS) {
        snackbar("Auto-bet stopped: Insufficient balance.", "error");
      }
    });

    const unsubError = engine.on("error", ({ message }) => {
      snackbar(message, "error");
    });

    return () => {
      unsubBalance();
      unsubBet();
      unsubTarget();
      unsubState();
      unsubIdle();
      unsubCountdown();
      unsubFlying();
      unsubCrashed();
      unsubTick();
      unsubResult();
      unsubHistory();
      unsubStats();
      unsubAutoStart();
      unsubAutoProgress();
      unsubAutoStop();
      unsubError();
    };
  }, [engine, onOutcome, setExternalBets, setFund, setAutobetFlag]);

  // Cleanup engine on unmount if we created it
  useEffect(() => {
    return () => {
      if (!customEngine) {
        engine.destroy();
      }
    };
  }, [customEngine, engine]);

  // Derived calculations from engine
  const winChance = engine.winChance;
  const potentialPayout = engine.potentialPayout;
  const potentialProfit = engine.potentialProfit;

  // Actions delegated to engine
  const updateBetAmount = useCallback(
    (value) => {
      engine.setBetAmount(value);
    },
    [engine]
  );

  const handleMinBet = useCallback(() => engine.setMinBet(), [engine]);
  const handleMaxBet = useCallback(() => engine.setMaxBet(), [engine]);
  const handleHalveBet = useCallback(() => engine.halveBet(), [engine]);
  const handleDoubleBet = useCallback(() => engine.doubleBet(), [engine]);

  const updateTargetMultiplier = useCallback(
    (value) => {
      engine.setTargetMultiplier(value);
    },
    [engine]
  );

  const incrementMultiplier = useCallback((step = 1.0) => engine.incrementTarget(step), [engine]);
  const decrementMultiplier = useCallback((step = 1.0) => engine.decrementTarget(step), [engine]);

  const executeRoll = useCallback(
    async (wagerToUse) => {
      try {
        const outcome = await engine.playRound({
          betAmount: wagerToUse !== undefined ? wagerToUse : betAmount,
          targetMultiplier,
        });
        return outcome;
      } catch (err) {
        return null;
      }
    },
    [engine, betAmount, targetMultiplier]
  );

  const startAutoBet = useCallback(() => {
    engine.startAutoBet({
      count: autoBetCount,
      stopProfit,
      stopLoss,
      maxBetLimit,
      onWinAction: onWinPercent > 0 ? "increase" : "reset",
      onWinPercent,
      onLossAction: onLossPercent > 0 ? "increase" : "reset",
      onLossPercent,
    });
  }, [engine, autoBetCount, stopProfit, stopLoss, maxBetLimit, onWinPercent, onLossPercent]);

  const stopAutoBet = useCallback(() => {
    engine.stopAutoBet(AutoBetStopReason.MANUAL);
  }, [engine]);

  return {
    // Engine Instance
    engine,

    // State
    betAmount,
    targetMultiplier,
    winChance,
    potentialPayout,
    potentialProfit,
    gameState,
    engineStatus,
    displayMultiplier,
    lastOutcome,
    isProcessing,
    isAutoBetting,
    autoBetCount,
    stopProfit,
    stopLoss,
    maxBetLimit,
    onWinPercent,
    onLossPercent,
    stats,
    betHistory,

    // Actions & Setters
    setBetAmount: updateBetAmount,
    setTargetMultiplier: updateTargetMultiplier,
    handleMinBet,
    handleMaxBet,
    handleHalveBet,
    handleDoubleBet,
    incrementMultiplier,
    decrementMultiplier,
    setAutoBetCount,
    setStopProfit,
    setStopLoss,
    setMaxBetLimit,
    setOnWinPercent,
    setOnLossPercent,
    setIsProcessing,
    executeRoll,
    startAutoBet,
    stopAutoBet,
    MIN_BET,
    MAX_BET,
    MIN_MULTIPLIER,
    MAX_MULTIPLIER,
  };
}
