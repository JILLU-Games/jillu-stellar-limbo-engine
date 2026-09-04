import React, { useState, useContext, useCallback, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Grid,
  Stack,
  TextField,
  Typography,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";
import {
  FlashOn,
  FlashOff,
  Fullscreen,
  FullscreenExit,
  Security,
  RestartAlt,
  Casino,
} from "@mui/icons-material";
import FundContext from "../context/FundContext";
import snackbar from "../hooks/snackbar";
import { toast } from "react-hot-toast";
import {
  calculateWinChance,
  MIN_BET,
  MAX_BET,
  MIN_MULTIPLIER,
  MAX_MULTIPLIER,
} from "../game/limboPRNG";
import { LimboEngine, AutoBetStopReason } from "../game-engine/LimboEngine";
import { soundManager } from "../game-engine/SoundManager";
import provablyFairManager from "../game-engine/provablyFair";
import CASINO_CONFIG from "../config/casinoConfig";
import LimboStageCanvas from "./LimboStageCanvas";
import SoundToggleButton from "./SoundToggleButton";
import ProviderLoader from "./ProviderLoader";
import $ from "jquery";

/**
 * Professional Casino Limbo Game Component
 * Provider: JILLU
 * Game: Stellar Limbo
 */
export function LimboGame({ setMyBets, myBets = [] }) {
  const { fund, setFund } = useContext(FundContext);

  // 1. Bet & Multiplier Inputs
  const [betAmount, setBetAmount] = useState(CASINO_CONFIG.defaultBet);
  const [targetMultiplier, setTargetMultiplier] = useState(CASINO_CONFIG.defaultTargetMultiplier);

  // 2. Game Outcome & Visual States
  const [gameState, setGameState] = useState("WAITING_FOR_BET"); // 'WAITING_FOR_BET' | 'IDLE' | 'COUNTDOWN' | 'FLYING' | 'CRASHED'
  const [gameResult, setGameResult] = useState(null);
  const [winnings, setWinnings] = useState(0);
  const [isWin, setIsWin] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  // 3. Tab State (0: Manual, 1: Auto)
  const [tabIndex, setTabIndex] = useState(0);

  // 4. Feature States: Turbo, Fullscreen
  const [isTurbo, setIsTurbo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 5. Provably Fair Modal State
  const [pfModalOpen, setPfModalOpen] = useState(false);
  const [clientSeedInput, setClientSeedInput] = useState(provablyFairManager.clientSeed);
  const [selectedHistoryPill, setSelectedHistoryPill] = useState(null);

  // 6. Recent Multipliers Pills
  const [recentMultipliers, setRecentMultipliers] = useState([
    { multiplier: 2.15, win: true },
    { multiplier: 1.34, win: false },
    { multiplier: 3.5, win: true },
    { multiplier: 1.05, win: false },
    { multiplier: 12.8, win: true },
    { multiplier: 1.82, win: false },
  ]);

  // 7. Auto-Bet Engine State
  const [autoBetCount, setAutoBetCount] = useState(10);
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const [stopProfit, setStopProfit] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [onWinAction, setOnWinAction] = useState("reset"); // "reset" | "increase"
  const [onWinPercent, setOnWinPercent] = useState(0);
  const [onLossAction, setOnLossAction] = useState("reset"); // "reset" | "increase"
  const [onLossPercent, setOnLossPercent] = useState(0);

  // 8. Session Statistics
  const [stats, setStats] = useState({
    totalRounds: 0,
    wins: 0,
    losses: 0,
    totalWagered: 0,
    netProfit: 0,
    currentStreak: 0,
    bestStreak: 0,
    highestMultiplier: 1.0,
  });

  // Initialize decoupled LimboEngine instance
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new LimboEngine({
      initialBalance: fund,
      defaultBet: CASINO_CONFIG.defaultBet,
      defaultTargetMultiplier: CASINO_CONFIG.defaultTargetMultiplier,
      turbo: isTurbo,
    });
  }
  const engine = engineRef.current;

  // Sync turbo mode with LimboEngine
  useEffect(() => {
    engine.setTurbo(isTurbo);
  }, [isTurbo, engine]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  // Listen to fullscreen changes
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard shortcut listener (Space = bet, A = 1/2, S = 2x, D = Min, F = Max)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        // Fire click if valid
        const playBtn = document.querySelector(".casino-bet-button");
        if (playBtn && !playBtn.disabled) {
          playBtn.click();
        }
      } else if (e.key === "a" || e.key === "A") {
        soundManager.playChip();
        setBetAmount(engineRef.current.halveBet());
      } else if (e.key === "s" || e.key === "S") {
        soundManager.playChip();
        setBetAmount(engineRef.current.doubleBet());
      } else if (e.key === "d" || e.key === "D") {
        soundManager.playChip();
        setBetAmount(engineRef.current.setMinBet());
      } else if (e.key === "f" || e.key === "F") {
        soundManager.playChip();
        setBetAmount(engineRef.current.setMaxBet());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Input Validation Helpers ---
  const getBetValidationError = useCallback(
    (amount) => {
      const num = Number(amount);
      if (amount === "" || isNaN(num)) return "Enter a valid bet amount";
      if (num < MIN_BET) return `Minimum bet is ${MIN_BET} ₹`;
      if (fund <= 0) return "Balance is 0 ₹. Tap Reset to reload credits.";
      if (num > fund) return `Bet exceeds balance (${fund.toFixed(2)} ₹)`;
      if (num > MAX_BET) return `Maximum bet is ${MAX_BET} ₹`;
      return null;
    },
    [fund]
  );

  const getTargetValidationError = useCallback((target) => {
    const num = Number(target);
    if (target === "" || isNaN(num)) return "Enter a valid target multiplier";
    if (num < MIN_MULTIPLIER) return `Target must be at least ${MIN_MULTIPLIER}x`;
    if (num > MAX_MULTIPLIER) return `Target cannot exceed ${MAX_MULTIPLIER.toLocaleString()}x`;
    return null;
  }, []);

  const betError = getBetValidationError(betAmount);
  const targetError = getTargetValidationError(targetMultiplier);
  const isFormValid = !betError && !targetError;

  const validTarget = !targetError ? Number(targetMultiplier) : MIN_MULTIPLIER;
  const validBet = !betError ? Number(betAmount) : 0;
  const winChance = calculateWinChance(validTarget);
  const potentialWinnings = parseFloat((validBet * validTarget).toFixed(2));
  const potentialProfit = parseFloat((potentialWinnings - validBet).toFixed(2));

  // Keep engine balance synchronized if external balance changes (e.g. reload)
  useEffect(() => {
    if (Math.abs(engine.balance - fund) > 0.01 && !engine.isRolling) {
      engine.setBalance(fund, "external_sync");
    }
  }, [fund, engine]);

  // Decoupled LimboEngine Event Listeners
  useEffect(() => {
    // 1. Core State Lifecycle Listeners ('IDLE', 'COUNTDOWN', 'FLYING', 'CRASHED')
    const unsubState = engine.on("state:change", (status) => {
      setGameState(status);
      setIsRolling(status === "COUNTDOWN" || status === "FLYING");
    });

    const unsubIdle = engine.on("state:idle", () => {
      setGameState("IDLE");
      setIsRolling(false);
    });

    const unsubWaiting = engine.on("state:waiting", () => {
      setGameState("WAITING_FOR_BET");
      setIsRolling(false);
    });

    const unsubCountdown = engine.on("state:countdown", () => {
      setGameState("COUNTDOWN");
      setIsRolling(true);
      soundManager.playCountdown();
      $(".limbo-payout-text, .limbo-counter-text").removeClass(
        "text-success text-danger limbo-result-win limbo-result-loss"
      );
      $(".limbo-rocket-anim").removeClass("boom").addClass("flying");
    });

    const unsubFlying = engine.on("state:flying", () => {
      setGameState("FLYING");
      setIsRolling(true);
      soundManager.playTakeoff();
    });

    const unsubCrashed = engine.on("state:crashed", (outcome) => {
      setGameState("CRASHED");
      setIsRolling(false);
    });

    const unsubStart = engine.on("round:start", () => {
      setIsRolling(true);
      setIsWin(null);
      setGameResult(null);
      setWinnings(0);
      $(".limbo-payout-text, .limbo-counter-text").removeClass(
        "text-success text-danger limbo-result-win limbo-result-loss"
      );
      $(".limbo-rocket-anim").removeClass("boom").addClass("flying");
    });

    const unsubTick = engine.on("round:tick", ({ multiplier }) => {
      soundManager.playTick(multiplier);
    });

    const unsubWin = engine.on("round:win", () => {
      soundManager.playWin();
      $(".limbo-payout-text, .limbo-counter-text").addClass("text-success limbo-result-win");
    });

    const unsubLoss = engine.on("round:loss", () => {
      soundManager.playCrash();
      $(".limbo-payout-text, .limbo-counter-text").addClass("text-danger limbo-result-loss");
    });

    const unsubResult = engine.on("round:result", (outcome) => {
      $(".limbo-rocket-anim").addClass("boom");
      setTimeout(() => {
        $(".limbo-rocket-anim").removeClass("flying boom");
      }, 350);

      setGameResult(outcome.multiplier);
      setWinnings(outcome.payout);
      setIsWin(outcome.win);
      setGameState("CRASHED");
      setIsRolling(false);

      setRecentMultipliers((prev) => [
        { multiplier: outcome.multiplier, win: outcome.win },
        ...prev.slice(0, 9),
      ]);

      const historyRecord = {
        id: outcome.id,
        time: Date.now(),
        betAmount: outcome.betAmount,
        targetMultiplier: outcome.targetMultiplier,
        cashOut: outcome.targetMultiplier,
        multiplier: outcome.multiplier,
        flag: outcome.win,
        payout: outcome.payout,
        netProfit: outcome.netProfit,
      };

      if (setMyBets) {
        setMyBets((prev) => [historyRecord, ...(prev || []).slice(0, 19)]);
      }
    });

    const unsubBalance = engine.on("balance:change", ({ balance }) => {
      setFund(balance);
    });

    const unsubStats = engine.on("stats:change", (nextStats) => {
      setStats(nextStats);
    });

    const unsubAutoStart = engine.on("autobet:start", () => {
      setIsAutoBetting(true);
    });

    const unsubAutoProgress = engine.on("autobet:progress", ({ remainingRounds, currentBet }) => {
      setAutoBetCount(remainingRounds);
      setBetAmount(currentBet);
    });

    const unsubAutoStop = engine.on("autobet:stop", ({ reason, message }) => {
      setIsAutoBetting(false);
      if (reason === AutoBetStopReason.STOP_PROFIT_REACHED) {
        snackbar(message || "Stop profit reached!", "success");
      } else if (reason === AutoBetStopReason.STOP_LOSS_REACHED) {
        snackbar(message || "Stop loss reached!", "warning");
      } else if (reason === AutoBetStopReason.INSUFFICIENT_FUNDS) {
        snackbar("Auto-bet stopped: Insufficient balance.", "error");
      } else if (reason === AutoBetStopReason.COMPLETED) {
        snackbar("Auto-bet completed successfully.", "success");
      }
    });

    const unsubError = engine.on("error", ({ message }) => {
      snackbar(message, "error");
    });

    return () => {
      unsubState();
      unsubIdle();
      unsubWaiting();
      unsubCountdown();
      unsubFlying();
      unsubCrashed();
      unsubStart();
      unsubTick();
      unsubWin();
      unsubLoss();
      unsubResult();
      unsubBalance();
      unsubStats();
      unsubAutoStart();
      unsubAutoProgress();
      unsubAutoStop();
      unsubError();
    };
  }, [engine, setFund, setMyBets]);

  // Reset Session Stats
  const handleResetStats = () => {
    const freshStats = engine.resetStats();
    setStats(freshStats);
    snackbar("Session statistics reset", "info");
  };

  // Quick Bet Modifiers
  const handleMinBet = () => {
    soundManager.playChip();
    setBetAmount(engine.setMinBet());
  };

  const handleMaxBet = () => {
    soundManager.playChip();
    setBetAmount(engine.setMaxBet());
  };

  const handleHalveBet = () => {
    soundManager.playChip();
    setBetAmount(engine.halveBet());
  };

  const handleDoubleBet = () => {
    soundManager.playChip();
    setBetAmount(engine.doubleBet());
  };

  const handleQuickAdd = (addVal) => {
    soundManager.playChip();
    setBetAmount(engine.addBet(addVal));
  };

  // Primary Bet Button Action
  const handlePlayClick = () => {
    soundManager.playBetPlaced();
    if (tabIndex === 0) {
      if (!isRolling) {
        engine
          .playRound({ betAmount: Number(betAmount), targetMultiplier: Number(targetMultiplier) })
          .catch((err) => {
            console.error("LimboEngine playRound Error:", err);
            snackbar(err.message, "error");
          });
      }
    } else {
      if (isAutoBetting) {
        engine.stopAutoBet(AutoBetStopReason.MANUAL);
        snackbar("Auto-bet stopped by user.", "info");
      } else {
        if (autoBetCount <= 0) {
          snackbar("Set number of rounds to at least 1", "error");
          return;
        }
        engine.setBetAmount(Number(betAmount));
        engine.setTargetMultiplier(Number(targetMultiplier));
        engine.startAutoBet({
          count: Number(autoBetCount),
          stopProfit: Number(stopProfit),
          stopLoss: Number(stopLoss),
          onWinAction,
          onWinPercent: Number(onWinPercent),
          onLossAction,
          onLossPercent: Number(onLossPercent),
        });
      }
    }
  };

  // Provably Fair Client Seed Update
  const handleSaveClientSeed = () => {
    provablyFairManager.setClientSeed(clientSeedInput);
    snackbar("Client seed updated for next rounds.", "success");
    setPfModalOpen(false);
  };

  return (
    <Box id="limbo-casino-root" sx={{ width: "100%", maxWidth: "860px", margin: "0 auto", px: { xs: 0.2, sm: 0.8 } }}>
      <ProviderLoader />
      {/* 1. Sleek Compact Header Bar */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={{ xs: 0.6, sm: 1 }}
        px={{ xs: 0.2, sm: 0.5 }}
        gap={0.8}
      >
        <Stack direction="row" alignItems="center" gap={{ xs: 0.5, sm: 0.8 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 900,
              letterSpacing: "0.5px",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: { xs: "0.86rem", sm: "1.1rem" },
            }}
          >
            <Casino sx={{ color: "#00d2ff", fontSize: { xs: "0.95rem", sm: "1.2rem" } }} /> LIMBO
          </Typography>
          <Box className="casino-rtp-tag">98.0% RTP</Box>
        </Stack>

        <Stack direction="row" spacing={{ xs: 0.3, sm: 0.4 }} alignItems="center">
          <Tooltip title="Provably Fair Verification">
            <IconButton
              size="small"
              className="casino-tool-btn"
              onClick={() => setPfModalOpen(true)}
            >
              <Security sx={{ fontSize: { xs: "0.8rem", sm: "0.9rem" } }} />
            </IconButton>
          </Tooltip>
          
          {/* Web Audio API Sound Toggle Button */}
          <SoundToggleButton size="small" />

          <Tooltip title={isTurbo ? "Turbo Mode Active (Fast)" : "Normal Animation Mode"}>
            <IconButton
              size="small"
              className={`casino-tool-btn ${isTurbo ? "active" : ""}`}
              onClick={() => setIsTurbo(!isTurbo)}
            >
              {isTurbo ? <FlashOn sx={{ fontSize: { xs: "0.8rem", sm: "0.9rem" } }} /> : <FlashOff sx={{ fontSize: { xs: "0.8rem", sm: "0.9rem" } }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}>
            <IconButton
              size="small"
              className="casino-tool-btn"
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? <FullscreenExit sx={{ fontSize: { xs: "0.8rem", sm: "0.9rem" } }} /> : <Fullscreen sx={{ fontSize: { xs: "0.8rem", sm: "0.9rem" } }} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* 2. Recent Multipliers Pills Strip - Sleek, Small & Clean */}
      <Box mb={{ xs: 0.5, sm: 0.8 }}>
        <Box className="casino-history-pills-bar">
          <Typography
            variant="caption"
            sx={{
              color: "#62758d",
              fontWeight: 500,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              fontSize: { xs: "0.55rem", sm: "0.62rem" },
              mr: 0.4,
              flexShrink: 0,
            }}
          >
            History
          </Typography>
          {recentMultipliers.map((item, idx) => {
            const isHigh = item.multiplier >= 10.0;
            return (
              <Box
                key={idx}
                className={`casino-history-pill ${
                  isHigh ? "pill-high" : item.win ? "pill-win" : "pill-loss"
                }`}
                onClick={() => setSelectedHistoryPill(item)}
              >
                {item.multiplier.toFixed(2)}x
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* 3. Visual Rocket Stage Canvas (Stake / Roobet Style) */}
      <Box
        id="game-graph"
        className={`game-graph casino-stage-card game-limbo compact-stage ${
          !isRolling && isWin !== null ? (isWin ? "win-aura limbo-stage-win" : "loss-aura limbo-stage-loss") : ""
        }`}
        sx={{
          minHeight: { xs: "285px", sm: "310px", md: "350px" },
          height: { xs: "285px", sm: "310px", md: "350px" },
          position: "relative",
        }}
      >
        {/* Real-time Floating Outcome Pill on Round Conclusion */}
        {!isRolling && isWin !== null && (
          <Box className={`casino-floating-outcome ${isWin ? "win" : "loss"}`}>
            {isWin ? (
              <span>+{winnings > 0 ? winnings : potentialProfit} ₹ ({gameResult ? gameResult.toFixed(2) : "0.00"}x WIN)</span>
            ) : (
              <span>CRASHED @ {gameResult ? gameResult.toFixed(2) : "0.00"}x</span>
            )}
          </Box>
        )}

        {/* Responsive HTML5 Canvas Rocket Multiplier Engine */}
        <LimboStageCanvas
          engine={engine}
          gameState={gameState}
          isRolling={isRolling}
          isWin={isWin}
          targetMultiplier={targetMultiplier}
          gameResult={gameResult}
          winnings={winnings}
          potentialProfit={potentialProfit}
          isTurbo={isTurbo}
        />
      </Box>

      {/* 4. Compact Real Casino Bet Console */}
      <Box className="casino-console-card" mt={{ xs: 0.5, sm: 1.0 }}>
        {/* Mode Selector Tabs (Manual / Auto) */}
        <Box className="casino-mode-tabs" mb={{ xs: 0.5, sm: 1.0 }}>
          <button
            type="button"
            className={`casino-mode-tab ${tabIndex === 0 ? "active" : ""}`}
            onClick={() => {
              soundManager.playClick();
              setTabIndex(0);
            }}
          >
            Manual Bet
          </button>
          <button
            type="button"
            className={`casino-mode-tab ${tabIndex === 1 ? "active" : ""}`}
            onClick={() => {
              soundManager.playClick();
              setTabIndex(1);
            }}
          >
            Auto Bet
          </button>
        </Box>

        {/* Inputs Grid - Side-by-Side Compact 2-Column Cards */}
        <Grid container spacing={{ xs: 0.6, sm: 1.2 }}>
          {/* Card 1: Bet Amount Card */}
          <Grid item xs={12} sm={6}>
            <Box className="casino-control-card" id="bet-amount-card">
              {/* Card Header */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography className="casino-card-label">
                  BET AMOUNT
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography className="casino-card-stat" sx={{ color: "#00d2ff" }}>
                    Balance: {fund.toFixed(2)} ₹
                  </Typography>
                  {fund <= 50 && (
                    <Tooltip title="Reset play balance to 1,000 ₹">
                      <Button
                        size="small"
                        onClick={() => {
                          setFund(1000);
                          toast.success("Balance reset to 1,000 ₹!");
                        }}
                        sx={{
                          fontSize: "0.58rem",
                          py: 0.1,
                          px: 0.5,
                          minWidth: "auto",
                          color: "#00e701",
                          bgcolor: "rgba(0, 231, 1, 0.12)",
                          border: "1px solid rgba(0, 231, 1, 0.3)",
                          borderRadius: "4px",
                          textTransform: "none",
                          fontWeight: 800,
                          lineHeight: 1.2,
                        }}
                      >
                        +1000 ₹
                      </Button>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>

              {/* Input Control Box */}
              <Box className="casino-input-box">
                <Typography sx={{ color: "#00d2ff", fontWeight: 800, pl: 0.8, pr: 0.3, fontSize: { xs: "0.82rem", sm: "0.9rem" } }}>
                  ₹
                </Typography>
                <input
                  type="number"
                  className="casino-input-field"
                  value={betAmount}
                  disabled={isRolling || isAutoBetting}
                  onChange={(e) => setBetAmount(e.target.value)}
                  onBlur={() => {
                    const num = Number(betAmount);
                    if (isNaN(num) || num < MIN_BET) setBetAmount(MIN_BET);
                    else if (num > MAX_BET) setBetAmount(MAX_BET);
                  }}
                  step="1"
                  min={MIN_BET}
                  max={MAX_BET}
                />
                <Box className="casino-input-btn-group">
                  <button
                    type="button"
                    className="casino-quick-btn"
                    disabled={isRolling || isAutoBetting}
                    onClick={handleHalveBet}
                    title="Half Bet"
                  >
                    ½
                  </button>
                  <button
                    type="button"
                    className="casino-quick-btn"
                    disabled={isRolling || isAutoBetting}
                    onClick={handleDoubleBet}
                    title="Double Bet"
                  >
                    2×
                  </button>
                  <button
                    type="button"
                    className="casino-quick-btn"
                    disabled={isRolling || isAutoBetting}
                    onClick={handleMaxBet}
                    title="Max Bet"
                  >
                    Max
                  </button>
                </Box>
              </Box>

              {/* Card Footer: Quick Chip Presets */}
              <Stack direction="row" spacing={{ xs: 0.4, sm: 0.6 }} alignItems="center" sx={{ flexWrap: "wrap", gap: "3px" }}>
                {[10, 50, 100, 250].map((chipVal) => (
                  <Chip
                    key={chipVal}
                    label={`+${chipVal}`}
                    size="small"
                    className="casino-chip-preset"
                    disabled={isRolling || isAutoBetting}
                    onClick={() => handleQuickAdd(chipVal)}
                  />
                ))}
              </Stack>
              {betError && (
                <Typography variant="caption" sx={{ color: "#ff4d6d", fontWeight: 700, fontSize: "0.68rem" }}>
                  {betError}
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Card 2: Target Multiplier Card */}
          <Grid item xs={12} sm={6}>
            <Box className="casino-control-card" id="target-multiplier-card">
              {/* Card Header */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography className="casino-card-label">
                  TARGET MULTIPLIER
                </Typography>
                <Typography className="casino-card-stat" sx={{ color: "#00e701", fontWeight: 800 }}>
                  Win Chance: {winChance}%
                </Typography>
              </Stack>

              {/* Input Control Box */}
              <Box className="casino-input-box">
                <input
                  type="number"
                  className="casino-input-field"
                  value={targetMultiplier}
                  disabled={isRolling || isAutoBetting}
                  onChange={(e) => setTargetMultiplier(e.target.value)}
                  onBlur={() => {
                    const num = Number(targetMultiplier);
                    if (isNaN(num) || num < MIN_MULTIPLIER) setTargetMultiplier(MIN_MULTIPLIER);
                    else if (num > MAX_MULTIPLIER) setTargetMultiplier(MAX_MULTIPLIER);
                  }}
                  step="0.1"
                  min={MIN_MULTIPLIER}
                  max={MAX_MULTIPLIER}
                />
                <Typography sx={{ color: "#8496ad", fontWeight: 800, pr: 0.5, fontSize: { xs: "0.82rem", sm: "0.9rem" } }}>
                  ×
                </Typography>
                <Box className="casino-input-btn-group">
                  <button
                    type="button"
                    className="casino-quick-btn"
                    disabled={isRolling || isAutoBetting}
                    onClick={() => {
                      soundManager.playChip();
                      setTargetMultiplier((prev) =>
                        Math.max(MIN_MULTIPLIER, parseFloat((Number(prev || 2) - 0.5).toFixed(2)))
                      );
                    }}
                    title="Decrease 0.5x"
                  >
                    -0.5
                  </button>
                  <button
                    type="button"
                    className="casino-quick-btn"
                    disabled={isRolling || isAutoBetting}
                    onClick={() => {
                      soundManager.playChip();
                      setTargetMultiplier((prev) =>
                        Math.min(MAX_MULTIPLIER, parseFloat((Number(prev || 2) + 0.5).toFixed(2)))
                      );
                    }}
                    title="Increase 0.5x"
                  >
                    +0.5
                  </button>
                </Box>
              </Box>

              {/* Card Footer: Quick Multiplier Presets & Potential Profit Preview */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: "wrap", gap: "3px" }}>
                <Stack direction="row" spacing={{ xs: 0.3, sm: 0.5 }} alignItems="center" sx={{ gap: "3px" }}>
                  {[1.5, 2.0, 5.0, 10.0].map((mVal) => (
                    <Chip
                      key={mVal}
                      label={`${mVal.toFixed(1)}x`}
                      size="small"
                      className={`casino-chip-preset ${Number(targetMultiplier) === mVal ? "active" : ""}`}
                      disabled={isRolling || isAutoBetting}
                      onClick={() => {
                        soundManager.playChip();
                        setTargetMultiplier(mVal);
                      }}
                    />
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ color: "#8496ad", fontWeight: 700, fontSize: { xs: "0.62rem", sm: "0.72rem" } }}>
                  Profit: <span style={{ color: "#00e701", fontWeight: 800 }}>+{potentialProfit} ₹</span>
                </Typography>
              </Stack>
              {targetError && (
                <Typography variant="caption" sx={{ color: "#ff4d6d", fontWeight: 700, fontSize: "0.68rem" }}>
                  {targetError}
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Auto Bet Settings (Only when Auto Bet is selected) */}
          {tabIndex === 1 && (
            <Grid item xs={12}>
              <Paper
                sx={{
                  background: "rgba(14, 20, 31, 0.9)",
                  p: { xs: 0.8, sm: 1.2 },
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <Grid container spacing={{ xs: 0.6, sm: 1 }}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" sx={{ color: "#8496ad", fontWeight: 700, fontSize: { xs: "0.62rem", sm: "0.68rem" } }}>
                      NUMBER OF ROUNDS
                    </Typography>
                    <Box className="casino-input-box" mt={0.2}>
                      <input
                        type="number"
                        className="casino-input-field"
                        value={autoBetCount}
                        disabled={isAutoBetting}
                        onChange={(e) => setAutoBetCount(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" sx={{ color: "#8496ad", fontWeight: 700, fontSize: { xs: "0.62rem", sm: "0.68rem" } }}>
                      STOP PROFIT (₹)
                    </Typography>
                    <Box className="casino-input-box" mt={0.2}>
                      <input
                        type="number"
                        className="casino-input-field"
                        value={stopProfit}
                        disabled={isAutoBetting}
                        onChange={(e) => setStopProfit(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" sx={{ color: "#8496ad", fontWeight: 700, fontSize: { xs: "0.62rem", sm: "0.68rem" } }}>
                      STOP LOSS (₹)
                    </Typography>
                    <Box className="casino-input-box" mt={0.2}>
                      <input
                        type="number"
                        className="casino-input-field"
                        value={stopLoss}
                        disabled={isAutoBetting}
                        onChange={(e) => setStopLoss(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: "#8496ad", fontWeight: 700, fontSize: { xs: "0.62rem", sm: "0.68rem" } }}>
                      ON WIN ACTION
                    </Typography>
                    <Stack direction="row" spacing={0.5} mt={0.2}>
                      <button
                        type="button"
                        className={`casino-quick-btn ${onWinAction === "reset" ? "active" : ""}`}
                        style={{ flex: 1 }}
                        disabled={isAutoBetting}
                        onClick={() => setOnWinAction("reset")}
                      >
                        Reset Base
                      </button>
                      <button
                        type="button"
                        className={`casino-quick-btn ${onWinAction === "increase" ? "active" : ""}`}
                        style={{ flex: 1 }}
                        disabled={isAutoBetting}
                        onClick={() => setOnWinAction("increase")}
                      >
                        + %
                      </button>
                      {onWinAction === "increase" && (
                        <Box className="casino-input-box" sx={{ width: { xs: 60, sm: 80 } }}>
                          <input
                            type="number"
                            className="casino-input-field"
                            placeholder="%"
                            value={onWinPercent}
                            disabled={isAutoBetting}
                            onChange={(e) => setOnWinPercent(Math.max(0, Number(e.target.value) || 0))}
                          />
                        </Box>
                      )}
                    </Stack>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: "#8496ad", fontWeight: 700, fontSize: { xs: "0.62rem", sm: "0.68rem" } }}>
                      ON LOSS ACTION
                    </Typography>
                    <Stack direction="row" spacing={0.5} mt={0.2}>
                      <button
                        type="button"
                        className={`casino-quick-btn ${onLossAction === "reset" ? "active" : ""}`}
                        style={{ flex: 1 }}
                        disabled={isAutoBetting}
                        onClick={() => setOnLossAction("reset")}
                      >
                        Reset Base
                      </button>
                      <button
                        type="button"
                        className={`casino-quick-btn ${onLossAction === "increase" ? "active" : ""}`}
                        style={{ flex: 1 }}
                        disabled={isAutoBetting}
                        onClick={() => setOnLossAction("increase")}
                      >
                        + %
                      </button>
                      {onLossAction === "increase" && (
                        <Box className="casino-input-box" sx={{ width: { xs: 60, sm: 80 } }}>
                          <input
                            type="number"
                            className="casino-input-field"
                            placeholder="%"
                            value={onLossPercent}
                            disabled={isAutoBetting}
                            onChange={(e) => setOnLossPercent(Math.max(0, Number(e.target.value) || 0))}
                          />
                        </Box>
                      )}
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* Big Vibrant Stake-Style BET Button */}
          <Grid item xs={12} mt={{ xs: 0.2, sm: 0.5 }}>
            <Button
              variant="contained"
              className={`casino-bet-button ${isAutoBetting ? "danger" : ""}`}
              disabled={
                ((!isFormValid || fund < MIN_BET) && !isAutoBetting) ||
                (isRolling && !isAutoBetting) ||
                (!isAutoBetting && gameState !== "WAITING_FOR_BET" && gameState !== "IDLE")
              }
              onClick={handlePlayClick}
            >
              {isAutoBetting
                ? `STOP AUTOBET (${autoBetCount} LEFT)`
                : isRolling
                ? "ROCKET FLYING..."
                : (!isAutoBetting && gameState !== "WAITING_FOR_BET" && gameState !== "IDLE")
                ? "WAITING FOR ROUND..."
                : tabIndex === 1
                ? "START AUTO BET"
                : `BET ${betAmount} ₹`}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* 5. Live Session Statistics Strip - Compact 4-Box Bento */}
      <Box mt={{ xs: 0.8, sm: 1.2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" px={0.4} mb={{ xs: 0.3, sm: 0.6 }}>
          <Typography variant="caption" sx={{ color: "#8496ad", fontWeight: 800, fontSize: { xs: "0.62rem", sm: "0.72rem" } }}>
            SESSION PERFORMANCE
          </Typography>
          <Button
            size="small"
            startIcon={<RestartAlt sx={{ fontSize: { xs: "0.85rem", sm: "1rem" } }} />}
            onClick={handleResetStats}
            sx={{
              color: "#54657b",
              fontSize: { xs: "0.6rem", sm: "0.68rem" },
              textTransform: "none",
              p: 0,
              minWidth: "auto",
              "&:hover": { color: "#ffffff" },
            }}
          >
            Reset Stats
          </Button>
        </Stack>

        <Box className="casino-stats-strip">
          <Box className="casino-stat-item">
            <Box className="casino-stat-label">Total Rounds</Box>
            <Box className="casino-stat-val">{stats.totalRounds}</Box>
          </Box>
          <Box className="casino-stat-item">
            <Box className="casino-stat-label">Win Rate</Box>
            <Box
              className="casino-stat-val"
              style={{ color: stats.wins >= stats.losses ? "#00e701" : "#ff4d6d" }}
            >
              {stats.totalRounds > 0
                ? `${((stats.wins / stats.totalRounds) * 100).toFixed(1)}%`
                : "0.0%"}
            </Box>
          </Box>
          <Box className="casino-stat-item">
            <Box className="casino-stat-label">Net Profit / Loss</Box>
            <Box
              className="casino-stat-val"
              style={{ color: stats.netProfit >= 0 ? "#00e701" : "#ff4d6d" }}
            >
              {stats.netProfit >= 0 ? `+${stats.netProfit} ₹` : `${stats.netProfit} ₹`}
            </Box>
          </Box>
          <Box className="casino-stat-item">
            <Box className="casino-stat-label">Best Multiplier</Box>
            <Box className="casino-stat-val" style={{ color: "#ffb703" }}>
              {stats.highestMultiplier.toFixed(2)}x
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Provably Fair Dialog */}
      <Dialog
        open={pfModalOpen}
        onClose={() => setPfModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: "#111723",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "14px",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Security sx={{ color: "#00d2ff" }} /> Provably Fair Verification
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: "#8496ad" }}>
              Casino Limbo uses transparent cryptographic hashing. Every game result is determined
              before the round starts using a combination of the Server Seed Hash, Client Seed, and
              Nonce.
            </Typography>

            <Box>
              <Typography variant="caption" sx={{ color: "#54657b", fontWeight: 700 }}>
                CURRENT SERVER SEED (SHA-256 HASH)
              </Typography>
              <Paper
                sx={{
                  p: 1.2,
                  mt: 0.5,
                  background: "#090d14",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  color: "#00d2ff",
                }}
              >
                {provablyFairManager.serverSeedHash}
              </Paper>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: "#54657b", fontWeight: 700 }}>
                CUSTOM CLIENT SEED
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={clientSeedInput}
                onChange={(e) => setClientSeedInput(e.target.value)}
                sx={{
                  mt: 0.5,
                  "& .MuiOutlinedInput-root": {
                    background: "#090d14",
                    color: "#ffffff",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                  },
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: "#54657b", fontWeight: 700 }}>
                NONCE (BET COUNTER)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: "#ffffff", mt: 0.2 }}>
                {provablyFairManager.nonce}
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.5,
                background: "rgba(0, 210, 255, 0.05)",
                border: "1px solid rgba(0, 210, 255, 0.2)",
                borderRadius: "8px",
              }}
            >
              <Typography variant="caption" sx={{ color: "#00d2ff", display: "block", mb: 0.5 }}>
                MATHEMATICAL FORMULA:
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                Multiplier = floor( (98 / (1 - float)) * 100 ) / 100
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <Button onClick={() => setPfModalOpen(false)} sx={{ color: "#8496ad" }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveClientSeed}
            sx={{
              background: "#00d2ff",
              color: "#061521",
              fontWeight: 800,
              "&:hover": { background: "#00b5dc" },
            }}
          >
            Save Client Seed
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Round Details Dialog */}
      <Dialog
        open={Boolean(selectedHistoryPill)}
        onClose={() => setSelectedHistoryPill(null)}
        PaperProps={{
          sx: {
            background: "#111723",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "14px",
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Round Multiplier Details</DialogTitle>
        <DialogContent>
          {selectedHistoryPill && (
            <Stack spacing={1.5} sx={{ minWidth: "260px" }}>
              <Typography variant="body2" sx={{ color: "#8496ad" }}>
                Crash Multiplier:
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  color: selectedHistoryPill.win ? "#04ff04" : "#ff4d6d",
                }}
              >
                {selectedHistoryPill.multiplier.toFixed(2)}x
              </Typography>
              <Typography variant="caption" sx={{ color: "#54657b" }}>
                Outcome: {selectedHistoryPill.win ? "WIN (≥ Target)" : "CRASH (< Target)"}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedHistoryPill(null)} sx={{ color: "#00d2ff" }}>
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>

      {/* Provider Branding Footer */}
      <Box sx={{ textAlign: "center", mt: 4, mb: 1, opacity: 0.6 }}>
        <Typography variant="caption" sx={{ color: "#8496ad", fontSize: "0.65rem", letterSpacing: "1px", mb: 0.5, display: "block" }}>
          POWERED BY
        </Typography>
        <Box
          component="img"
          src="/JILLU-LOGO.png"
          alt="JILLU"
          sx={{ height: 18, objectFit: "contain", opacity: 0.8 }}
        />
      </Box>
    </Box>
  );
}

export default LimboGame;
