import React, { useEffect, useState } from "react";
import { Box, Typography, LinearProgress, Fade, keyframes } from "@mui/material";

const logoAnimation = keyframes`
  0% { transform: translateY(0px) scale(1); opacity: 0.85; filter: drop-shadow(0 0 0px rgba(0,210,255,0)); }
  50% { transform: translateY(-5px) scale(1.03); opacity: 1; filter: drop-shadow(0 0 15px rgba(0,210,255,0.6)); }
  100% { transform: translateY(0px) scale(1); opacity: 0.85; filter: drop-shadow(0 0 0px rgba(0,210,255,0)); }
`;

export default function ProviderLoader({ onLoaded }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 15) + 5;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          setTimeout(() => {
            if (onLoaded) onLoaded();
          }, 400); // Wait for fade out
        }, 500); // brief pause at 100%
      }
      setProgress(current);
    }, 120);

    return () => clearInterval(interval);
  }, [onLoaded]);

  if (!visible && progress === 100) return null;

  return (
    <Fade in={visible} timeout={400}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "#070b12",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Provider Logo */}
          <Box
            component="img"
            src="/JILLU-LOGO.png"
            alt="JILLU"
            sx={{
              height: { xs: 50, sm: 70 },
              mb: 1,
              objectFit: "contain",
              animation: `${logoAnimation} 2.5s ease-in-out infinite`,
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: "#8496ad",
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontSize: "0.75rem",
              mb: 6,
            }}
          >
            Premium Casino Games
          </Typography>

          {/* Game Title */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              mb: 8,
              padding: "16px 32px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "16px",
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: "#ffffff",
                textShadow: "0 0 20px rgba(0, 210, 255, 0.4)",
              }}
            >
              STELLAR LIMBO
            </Typography>
          </Box>

          {/* Progress Bar */}
          <Box sx={{ width: "240px", textAlign: "center" }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.1)",
                "& .MuiLinearProgress-bar": {
                  backgroundColor: "#00d2ff",
                  boxShadow: "0 0 10px rgba(0,210,255,0.8)",
                },
                mb: 2,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: "#8496ad",
                fontWeight: 700,
                fontFamily: "monospace",
                letterSpacing: "1px",
              }}
            >
              INITIALIZING ENGINE {progress}%
            </Typography>
          </Box>
        </Box>

        {/* Ambient Background Glow */}
        <Box
          sx={{
            position: "absolute",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(0,210,255,0.08) 0%, rgba(0,0,0,0) 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      </Box>
    </Fade>
  );
}
