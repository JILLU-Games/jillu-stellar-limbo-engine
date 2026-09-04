import React, { useState } from "react";
import {
  Box,
  Button,
  Grid,
  Stack,
  TextField,
  Typography,
  Tabs,
  Tab,
  InputAdornment,
  Paper,
  Chip,
} from "@mui/material";
import { useLimboGame } from "../game/useLimboGame";
import Rocket from "../assets/img/rocket.png";
import Mountain from "../assets/img/mountain.png";
import Limbo1 from "../assets/img/limbo1.png";
import Limbo2 from "../assets/img/limbo2.png";
import $ from "jquery";

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`limbo-tabpanel-${index}`}
      aria-labelledby={`limbo-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const borderBottomStyles = {
  "& div": {
    background: "transparent !important",
    "&:hover:not(.Mui-disabled, .Mui-error):before": {
      borderBottom: "none",
    },
    "&::before": {
      borderBottom: "none",
    },
    "&::after": {
      borderBottom: "none",
    },
    input: {
      height: "50px",
      fontSize: "20px !important",
      textAlign: "center",
      fontWeight: "700",
      color: "white",
    },
  },
};

const optionTextField = {
  "& div fieldset": { display: "none" },
  "& div input": {
    color: "white",
    fontWeight: "700",
  },
};

/**
 * Core Game Logic Component for Limbo.
 * Encapsulates state management for user bets, target multipliers,
 * and PRNG-powered game outcomes.
 */
export default function LimboGameLogic({ setMyBets, myBets }) {
  const [tabIndex, setTabIndex] = useState(0);

  // Core Game Logic Hook
  const {
    betAmount,
    targetMultiplier,
    winChance,
    potentialPayout,
    potentialProfit,
    gameState,
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
    setBetAmount,
    setTargetMultiplier,
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
    executeRoll,
    startAutoBet,
    stopAutoBet,
    setIsProcessing,
  } = useLimboGame({
    setExternalBets: setMyBets,
    onOutcome: (outcome) => {
      // Trigger smooth jQuery animations matching game visuals
      const counterElem = $(".limbo-logic-counter");
      if (counterElem.length > 0) {
        counterElem
          .prop("Counter", 1.0)
          .animate(
            { Counter: outcome.multiplier },
            {
              duration: 500,
              step: function (now) {
                $(this).text(parseFloat(now).toFixed(2));
              },
              complete: function () {
                $(this).text(parseFloat(outcome.multiplier).toFixed(2));
              },
            }
          );
      }

      $(".limbo-logic-rocket").addClass("flying");
      $(".limbo-logic-payout, .limbo-logic-counter").removeClass("text-success text-danger limbo-result-win limbo-result-loss");

      setTimeout(() => {
        $(".limbo-logic-rocket").addClass("boom");
        setTimeout(() => {
          if (outcome.win) {
            $(".limbo-logic-payout, .limbo-logic-counter").addClass("text-success limbo-result-win");
          } else {
            $(".limbo-logic-payout, .limbo-logic-counter").addClass("text-danger limbo-result-loss");
          }
          $(".limbo-logic-rocket").removeClass("flying boom");
          setIsProcessing(false);
        }, 350);
      }, 400);
    },
  });

  const handlePlayClick = () => {
    if (tabIndex === 0) {
      if (!isProcessing) {
        executeRoll();
      }
    } else {
      if (isAutoBetting) {
        stopAutoBet();
      } else {
        startAutoBet();
      }
    }
  };

  return (
    <Box className="gameContent" sx={{ width: "100%" }}>
      {/* Visual Rocket & Limbo Canvas */}
      <Stack
        className="game-container game-limbo"
        sx={{
          flexDirection: "row",
          "@media (max-width:767px)": {
            flexDirection: "column",
          },
        }}
      >
        <Stack
          sx={{
            background: "transparent",
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box className="game-content game-content-limbo">
            <Box className="limbo-canvas">
              <img src={Limbo1} className="cloud cloud-r" alt="" />
              <img src={Limbo2} className="cloud cloud-d" alt="" />
              <img src={Limbo1} className="cloud cloud-v" alt="" />
              <img src={Limbo2} className="cloud cloud-g" alt="" />
              <img src={Mountain} className="limbo-bg" alt="" />
              <Box className="bg-star show-1">
                <Box className="l-star e-r" />
                <Box className="l-star s-p" />
                <Box className="l-star r-p" />
              </Box>

              <Box className="game-rocket notranslate">
                <Box className="rocket-number">
                  <span className="rocket-payout limbo-logic-payout">
                    <span className="counter limbo-logic-counter">
                      {displayMultiplier.toFixed(2)}
                    </span>
                    x
                  </span>
                  <Box className="rocket-boom limbo-logic-boom" />
                </Box>
                <Box className="rocket-wrap fire limbo-logic-rocket">
                  <Box className="rocket-img">
                    <img src={Rocket} alt="" />
                  </Box>
                  <Box className="rocket-fire" />
                </Box>
              </Box>
            </Box>
          </Box>
        </Stack>
      </Stack>

      {/* Target Multiplier & Win Chance Indicator Strip */}
      <Paper
        elevation={0}
        sx={{
          background: "rgba(22, 31, 44, 0.75)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          p: 1.5,
          mt: 2,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "#7a8b9e", display: "block" }}>
            Target Multiplier
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 800, color: "#45b6fe" }}>
            {targetMultiplier.toFixed(2)}x
          </Typography>
        </Box>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "#7a8b9e", display: "block" }}>
            Win Chance
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 800, color: "#04ff04" }}>
            {winChance}%
          </Typography>
        </Box>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "#7a8b9e", display: "block" }}>
            Profit on Win
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 800, color: "#ffb703" }}>
            +{potentialProfit} ₹ ({potentialPayout} ₹)
          </Typography>
        </Box>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "#7a8b9e", display: "block" }}>
            Status
          </Typography>
          <Chip
            size="small"
            label={gameState.toUpperCase()}
            sx={{
              fontWeight: 700,
              fontSize: "11px",
              bgcolor:
                gameState === "won"
                  ? "rgba(4, 255, 4, 0.2)"
                  : gameState === "lost"
                  ? "rgba(255, 0, 55, 0.2)"
                  : gameState === "running"
                  ? "rgba(69, 182, 254, 0.2)"
                  : "rgba(255, 255, 255, 0.1)",
              color:
                gameState === "won"
                  ? "#04ff04"
                  : gameState === "lost"
                  ? "#ff4d6d"
                  : gameState === "running"
                  ? "#45b6fe"
                  : "#adb5bd",
            }}
          />
        </Box>
        {lastOutcome && (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" sx={{ color: "#7a8b9e", display: "block" }}>
              Last Roll
            </Typography>
            <Chip
              size="small"
              label={`${lastOutcome.multiplier.toFixed(2)}x (${lastOutcome.win ? "WIN" : "LOSS"})`}
              sx={{
                fontWeight: 700,
                fontSize: "12px",
                bgcolor: lastOutcome.win ? "rgba(4, 255, 4, 0.2)" : "rgba(255, 0, 55, 0.2)",
                color: lastOutcome.win ? "#04ff04" : "#ff4d6d",
                border: `1px solid ${lastOutcome.win ? "#04ff04" : "#ff4d6d"}`,
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Main Game Controls: Bet Amount, Cash Out, and Bet Button */}
      <Stack className="game-control" mt={3}>
        <Grid container spacing={1} gap={{ xs: "15px", md: "0" }}>
          {/* Bet Amount Control */}
          <Grid item md={5} xs={12}>
            <Stack className="game-control-stack" gap={1} flexDirection="row">
              <Stack flex={1} gap={1}>
                <Button className="game-control-button" onClick={handleMinBet}>
                  min
                </Button>
                <Button className="game-control-button" onClick={handleMaxBet}>
                  max
                </Button>
              </Stack>
              <TextField
                hiddenLabel
                id="bet-amount-input"
                variant="filled"
                className="game-control-text"
                sx={borderBottomStyles}
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                type="number"
              />
              <Stack flex={1} gap={1} sx={{ display: "flex", width: "100%" }}>
                <Button className="game-control-button" onClick={handleHalveBet}>
                  1/2
                </Button>
                <Button className="game-control-button" onClick={handleDoubleBet}>
                  2x
                </Button>
              </Stack>
            </Stack>
          </Grid>

          {/* Target Multiplier (Cash Out) Control */}
          <Grid item md={3.5} xs={12}>
            <Stack className="game-control-stack" gap={1}>
              <Stack flexDirection="row" gap={1}>
                <Button
                  className="game-control-button"
                  onClick={() => decrementMultiplier(1.0)}
                >
                  -
                </Button>
                <TextField
                  hiddenLabel
                  id="target-multiplier-input"
                  variant="filled"
                  className="game-control-text"
                  sx={borderBottomStyles}
                  value={targetMultiplier}
                  onChange={(e) => setTargetMultiplier(e.target.value)}
                  type="number"
                />
                <Button
                  className="game-control-button"
                  onClick={() => incrementMultiplier(1.0)}
                >
                  +
                </Button>
              </Stack>
              <Typography
                component="span"
                variant="body2"
                sx={{ color: "#55657e", fontWeight: "900", textAlign: "center" }}
              >
                Cash Out (Target Multiplier)
              </Typography>
            </Stack>
          </Grid>

          {/* Action Bet Button */}
          <Grid item md={3.5} xs={12} sx={{ position: "relative" }}>
            <Button
              sx={{
                width: "100% !important",
                height: "100%",
                minHeight: "56px",
                position: "relative",
              }}
              variant="contained"
              className="btn-bet"
              onClick={handlePlayClick}
              disabled={isProcessing && !isAutoBetting}
            >
              {tabIndex === 0
                ? isProcessing
                  ? "Rolling..."
                  : "Bet"
                : isAutoBetting
                ? "Stop Auto"
                : "Start Auto"}
            </Button>
          </Grid>
        </Grid>
      </Stack>

      {/* Manual / Auto Mode Tabs */}
      <Box className="game-setting" mt={{ xs: 6, md: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(e, v) => setTabIndex(v)}
          aria-label="limbo game mode tabs"
        >
          <Tab
            label="Manual"
            className="game-setting-tab"
            disabled={isAutoBetting}
          />
          <Tab
            label="Auto"
            className="game-setting-tab"
          />
        </Tabs>
      </Box>

      {/* Auto Bet Parameter Controls */}
      <TabPanel value={tabIndex} index={1}>
        <Stack className="game-control-stack" gap={1}>
          <Grid container spacing={3} p={2}>
            <Grid item md={4} xs={6} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="span" variant="body2" className="game-auto-option-text">
                Number of Bets
              </Typography>
              <TextField
                id="auto-bet-count"
                type="number"
                hiddenLabel
                className="game-auto-option-textfield"
                sx={optionTextField}
                value={autoBetCount}
                onChange={(e) => setAutoBetCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </Grid>

            <Grid item md={4} xs={6} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="span" variant="body2" className="game-auto-option-text">
                Stop on Profit (₹)
              </Typography>
              <TextField
                id="auto-stop-profit"
                hiddenLabel
                className="game-auto-option-textfield"
                type="number"
                sx={optionTextField}
                value={stopProfit}
                onChange={(e) => setStopProfit(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </Grid>

            <Grid item md={4} xs={6} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="span" variant="body2" className="game-auto-option-text">
                Stop on Loss (₹)
              </Typography>
              <TextField
                id="auto-stop-loss"
                hiddenLabel
                className="game-auto-option-textfield"
                type="number"
                sx={optionTextField}
                value={stopLoss}
                onChange={(e) => setStopLoss(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </Grid>

            <Grid item md={4} xs={6} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="span" variant="body2" className="game-auto-option-text">
                Max Bet Limit (₹)
              </Typography>
              <TextField
                id="auto-max-bet"
                hiddenLabel
                className="game-auto-option-textfield"
                type="number"
                sx={optionTextField}
                value={maxBetLimit}
                onChange={(e) => setMaxBetLimit(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </Grid>

            <Grid item md={4} xs={6} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="span" variant="body2" className="game-auto-option-text">
                On Win Increase (%)
              </Typography>
              <TextField
                id="auto-on-win"
                hiddenLabel
                className="game-auto-option-textfield"
                type="number"
                sx={optionTextField}
                value={onWinPercent}
                onChange={(e) => setOnWinPercent(parseFloat(e.target.value) || 0)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" className="adornment">
                      %
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item md={4} xs={6} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography component="span" variant="body2" className="game-auto-option-text">
                On Loss Increase (%)
              </Typography>
              <TextField
                id="auto-on-loss"
                hiddenLabel
                className="game-auto-option-textfield"
                type="number"
                sx={optionTextField}
                value={onLossPercent}
                onChange={(e) => setOnLossPercent(parseFloat(e.target.value) || 0)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" className="adornment">
                      %
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </Stack>
      </TabPanel>

      {/* Session Game Statistics */}
      <Box
        sx={{
          mt: 3,
          p: 2,
          background: "rgba(14, 19, 27, 0.6)",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ color: "#7a8b9e", fontWeight: 700, mb: 1, letterSpacing: 0.5 }}
        >
          Session Statistics
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" sx={{ color: "#55657e" }}>
              Total Bets
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {stats.totalBets}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" sx={{ color: "#55657e" }}>
              Win / Loss
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              <span style={{ color: "#04ff04" }}>{stats.wins}</span> /{" "}
              <span style={{ color: "#ff4d6d" }}>{stats.losses}</span>
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" sx={{ color: "#55657e" }}>
              Net Profit
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 800,
                color: stats.netProfit >= 0 ? "#04ff04" : "#ff4d6d",
              }}
            >
              {stats.netProfit >= 0 ? `+${stats.netProfit}` : stats.netProfit} ₹
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" sx={{ color: "#55657e" }}>
              Best Multiplier
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: "#45b6fe" }}>
              {stats.highestMultiplier.toFixed(2)}x
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
