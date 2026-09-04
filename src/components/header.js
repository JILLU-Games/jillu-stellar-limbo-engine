import { useContext, useState, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Modal,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import { AccountBalanceWallet, Refresh } from "@mui/icons-material";
import SoundToggleButton from "./SoundToggleButton";
import FundContext from "../context/FundContext";
import axios from "axios";
import { toast } from "react-hot-toast";
import snackbar from "../hooks/snackbar";
import CASINO_CONFIG from "../config/casinoConfig";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "90%",
  maxWidth: 420,
  bgcolor: "#111723",
  color: "#ffffff",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)",
  p: 3,
  borderRadius: "14px",
};

const Header = () => {
  const { fund, userId, setFund, depositFlag, autobetFlag, resetBalance } =
    useContext(FundContext);

  const [open, setOpen] = useState(false);
  const [dialogOpen, setdialogOpen] = useState(false);
  const dialoghandleClose = () => setdialogOpen(false);

  const handleDepositAmount = (amount) => {
    setFund((prev) => parseFloat((prev + amount).toFixed(2)));
    setOpen(false);
    toast.success(`Deposited ${amount} ₹ successfully!`);
    snackbar(`Added ${amount} ₹ to wallet balance.`, "success");
  };

  const handleRefund = () => {
    resetBalance();
    dialoghandleClose();
    toast.success("Wallet reset to base demo balance!");
    snackbar("Balance reset to 1,000 ₹", "info");

    if (process.env.REACT_APP_SERVER_URL) {
      axios
        .post(`${process.env.REACT_APP_SERVER_URL}/api/game/save-game`, {
          fund: 1000,
          userId,
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  useEffect(() => {
    if (depositFlag) {
      setOpen(true);
    }
  }, [depositFlag]);

  return (
    <Box className="casino-header">
      <Container maxWidth="xl">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ minHeight: "44px" }}
        >
          {/* Brand Logo & Tag */}
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Box className="casino-brand-title">CASINO LIMBO</Box>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Chip
                label="VERIFIED RTP 98%"
                size="small"
                sx={{
                  bgcolor: "rgba(0, 210, 255, 0.12)",
                  color: "#00d2ff",
                  fontWeight: 800,
                  fontSize: "10px",
                  border: "1px solid rgba(0, 210, 255, 0.25)",
                }}
              />
            </Box>
          </Stack>

          {/* User Profile & Wallet Capsule */}
          <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 2 }}>
            {/* Player Info (Desktop) */}
            <Typography
              variant="caption"
              sx={{
                color: "#8496ad",
                fontFamily: "monospace",
                display: { xs: "none", md: "block" },
              }}
            >
              ID: {String(userId).slice(-6)}
            </Typography>

            {/* Wallet Balance Capsule */}
            <Box className="casino-wallet-capsule">
              <AccountBalanceWallet sx={{ color: "#00d2ff", fontSize: { xs: "0.95rem", sm: "1.1rem" } }} />
              <Typography className="casino-balance-amount" sx={{ fontSize: { xs: "0.82rem", sm: "0.9rem" } }}>
                {fund.toFixed(2)}{" "}
                <span style={{ color: "#00d2ff", fontSize: "0.8rem" }}>
                  {CASINO_CONFIG.currency.symbol}
                </span>
              </Typography>
              <Button
                variant="contained"
                className="casino-deposit-btn"
                onClick={() => setOpen(true)}
                sx={{ minWidth: { xs: "28px", sm: "64px" }, px: { xs: 0.8, sm: 1.5 } }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Deposit
                </Box>
                <Box component="span" sx={{ display: { xs: "inline", sm: "none" }, fontWeight: 900 }}>
                  +
                </Box>
              </Button>
            </Box>

            {/* Audio FX Toggle Button */}
            <SoundToggleButton size="small" />

            {/* Reset / Refund Control */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh fontSize="small" />}
              onClick={() => {
                if (autobetFlag) {
                  snackbar("Please stop auto-bet first!", "error");
                } else {
                  setdialogOpen(true);
                }
              }}
              sx={{
                color: "#8496ad",
                borderColor: "rgba(255, 255, 255, 0.12)",
                fontSize: "0.75rem",
                textTransform: "none",
                borderRadius: "8px",
                minHeight: "36px",
                display: { xs: "none", sm: "inline-flex" },
                "&:hover": {
                  borderColor: "#00d2ff",
                  color: "#ffffff",
                  bgcolor: "rgba(0, 210, 255, 0.08)",
                },
              }}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </Container>

      {/* Deposit Funds Modal */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <Box sx={modalStyle}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#ffffff", mb: 1 }}>
            Deposit Demo Credits
          </Typography>
          <Typography variant="body2" sx={{ color: "#8496ad", mb: 2 }}>
            Instant balance reload for testing and simulation on the casino platform.
          </Typography>

          <Stack spacing={1.5} mb={2}>
            <Stack direction="row" spacing={1}>
              {[500, 1000, 2500].map((amt) => (
                <Button
                  key={amt}
                  variant="outlined"
                  fullWidth
                  onClick={() => handleDepositAmount(amt)}
                  sx={{
                    borderColor: "rgba(0, 210, 255, 0.3)",
                    color: "#00d2ff",
                    fontWeight: 800,
                    py: 1,
                    "&:hover": {
                      bgcolor: "rgba(0, 210, 255, 0.15)",
                      borderColor: "#00d2ff",
                    },
                  }}
                >
                  +{amt} ₹
                </Button>
              ))}
            </Stack>
            <Button
              variant="contained"
              fullWidth
              onClick={() => handleDepositAmount(5000)}
              sx={{
                background: "linear-gradient(135deg, #00d2ff 0%, #0077ff 100%)",
                fontWeight: 900,
                py: 1.2,
              }}
            >
              Deposit +5,000 ₹ VIP Credit
            </Button>
          </Stack>

          <Button
            fullWidth
            onClick={() => setOpen(false)}
            sx={{ color: "#8496ad", textTransform: "none" }}
          >
            Cancel
          </Button>
        </Box>
      </Modal>

      {/* Reset Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={dialoghandleClose}
        PaperProps={{
          sx: {
            background: "#111723",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "14px",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Reset Balance</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "#8496ad" }}>
            Do you want to reset your wallet balance back to the default starting balance (1,000 ₹)?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={dialoghandleClose} sx={{ color: "#8496ad" }}>
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            variant="contained"
            sx={{
              background: "#ff3355",
              fontWeight: 800,
              "&:hover": { background: "#d91c3e" },
            }}
          >
            Confirm Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Header;
