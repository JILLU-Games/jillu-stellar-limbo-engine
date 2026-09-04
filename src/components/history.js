import * as React from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from "@mui/material";
import { useEffect, useState, useContext } from "react";
import FundContext from "../context/FundContext";
import CASINO_CONFIG from "../config/casinoConfig";

export default function BetHistory({ socket, myBets = [] }) {
  const { userId } = useContext(FundContext);
  const [tabIndex, setTabIndex] = useState(0);
  const [globalHistory, setGlobalHistory] = useState([]);

  useEffect(() => {
    if (socket) {
      const handleAllBets = (data) => {
        if (data && Array.isArray(data.gameHistory)) {
          setGlobalHistory(data.gameHistory);
        }
      };
      socket.on("all-bets", handleAllBets);
      return () => {
        if (socket.off) socket.off("all-bets", handleAllBets);
      };
    }
  }, [socket]);

  const activeBets = tabIndex === 0 ? myBets : globalHistory;

  return (
    <Box sx={{ width: "100%", mt: 1.8, mb: 2 }}>
      {/* Table Header Controls */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          mb: 1,
        }}
      >
        <Tabs
          value={tabIndex}
          onChange={(e, val) => setTabIndex(val)}
          sx={{
            minHeight: "32px",
            "& .MuiTab-root": {
              minHeight: "32px",
              color: "#8496ad",
              fontWeight: 700,
              fontSize: "0.78rem",
              textTransform: "none",
              borderRadius: "6px",
              px: 1.2,
              py: 0.4,
              mr: 0.8,
              "&.Mui-selected": {
                color: "#ffffff",
                bgcolor: "#1b2638",
              },
            },
            "& .MuiTabs-indicator": { display: "none" },
          }}
        >
          <Tab label={`My Bets (${myBets.length})`} />
          <Tab label={`All Bets (${globalHistory.length})`} />
        </Tabs>

        <Typography variant="caption" sx={{ color: "#54657b", fontSize: "0.7rem" }}>
          Live Casino Feed • RTP 98.0%
        </Typography>
      </Box>

      {/* Bets Data Table */}
      <TableContainer
        component={Paper}
        sx={{
          bgcolor: "#111723",
          borderRadius: "10px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
          overflowX: "auto",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#0d131d" }}>
              <TableCell sx={{ color: "#54657b", fontWeight: 800, fontSize: "0.7rem", py: 0.8 }}>
                PLAYER
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "#54657b", fontWeight: 800, fontSize: "0.7rem", py: 0.8, display: { xs: "none", sm: "table-cell" } }}
              >
                TIME
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "#54657b", fontWeight: 800, fontSize: "0.7rem", py: 0.8 }}
              >
                BET ({CASINO_CONFIG.currency.symbol})
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "#54657b", fontWeight: 800, fontSize: "0.7rem", py: 0.8 }}
              >
                OUTCOME
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "#54657b", fontWeight: 800, fontSize: "0.7rem", py: 0.8 }}
              >
                PAYOUT ({CASINO_CONFIG.currency.symbol})
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activeBets.length > 0 ? (
              activeBets.map((row, idx) => {
                const isWon = Boolean(row.flag);
                const multVal = Number(row.multiplier || 0);
                const isSuperHigh = multVal >= 10.0;
                const playerName =
                  tabIndex === 0
                    ? `You (${String(userId).slice(-4)})`
                    : `User_${String(row.time || idx).slice(-4)}`;

                return (
                  <TableRow
                    key={idx}
                    sx={{
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" },
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <TableCell
                      sx={{
                        color: tabIndex === 0 ? "#00d2ff" : "#8496ad",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        py: 0.8,
                      }}
                    >
                      {playerName}
                    </TableCell>

                    <TableCell
                      align="right"
                      sx={{ color: "#54657b", fontSize: "0.72rem", py: 0.8, display: { xs: "none", sm: "table-cell" } }}
                    >
                      {row.time ? new Date(row.time).toLocaleTimeString() : "--"}
                    </TableCell>

                    <TableCell
                      align="right"
                      sx={{
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        fontVariantNumeric: "tabular-nums",
                        py: 0.8,
                      }}
                    >
                      {Number(row.betAmount || 0).toFixed(2)}
                    </TableCell>

                    <TableCell align="right" sx={{ py: 0.8 }}>
                      <Chip
                        size="small"
                        label={`${multVal.toFixed(2)}x`}
                        sx={{
                          fontWeight: 800,
                          fontSize: "0.68rem",
                          height: "20px",
                          bgcolor: isSuperHigh
                            ? "rgba(255, 183, 3, 0.18)"
                            : isWon
                            ? "rgba(0, 231, 1, 0.14)"
                            : "rgba(255, 51, 85, 0.12)",
                          color: isSuperHigh ? "#ffb703" : isWon ? "#00e701" : "#ff4d6d",
                          border: `1px solid ${
                            isSuperHigh
                              ? "rgba(255, 183, 3, 0.4)"
                              : isWon
                              ? "rgba(0, 231, 1, 0.35)"
                              : "rgba(255, 51, 85, 0.25)"
                          }`,
                        }}
                      />
                    </TableCell>

                    <TableCell
                      align="right"
                      sx={{
                        color: isWon ? "#00e701" : "#54657b",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        fontVariantNumeric: "tabular-nums",
                        py: 0.8,
                      }}
                    >
                      {isWon ? `+${Number(row.payout || 0).toFixed(2)}` : "0.00"}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: "#54657b" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
                    No bets recorded in session yet. Place a bet to begin!
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
