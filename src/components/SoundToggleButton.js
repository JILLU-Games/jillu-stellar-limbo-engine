import React, { useState, useEffect } from "react";
import { IconButton, Tooltip, Stack, Typography } from "@mui/material";
import { VolumeUp, VolumeOff } from "@mui/icons-material";
import { soundManager } from "../game-engine/SoundManager";

/**
 * SoundToggleButton - Interactive UI audio controller with volume and mute state.
 *
 * @param {Object} props
 * @param {string} [props.size='small'] - Button size
 * @param {boolean} [props.showLabel=false] - Whether to show text label next to button
 * @param {string} [props.className=''] - Extra CSS classes
 */
export default function SoundToggleButton({
  size = "small",
  showLabel = false,
  className = "",
}) {
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);

  useEffect(() => {
    const unsub = soundManager.subscribe(({ isMuted: nextMuted }) => {
      setIsMuted(nextMuted);
    });
    return unsub;
  }, []);

  const handleToggle = (e) => {
    e?.stopPropagation();
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundManager.playClick();
    }
  };

  return (
    <Tooltip title={isMuted ? "Unmute Sound FX" : "Mute Sound FX"} arrow>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={showLabel ? handleToggle : undefined}
        sx={{ cursor: showLabel ? "pointer" : "default" }}
      >
        <IconButton
          size={size}
          id="sound-toggle-btn"
          className={`casino-tool-btn ${!isMuted ? "active" : ""} ${className}`}
          onClick={handleToggle}
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          sx={{
            color: isMuted ? "#62758d" : "#00d2ff",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              color: "#ffffff",
              bgcolor: "rgba(0, 210, 255, 0.12)",
            },
          }}
        >
          {isMuted ? (
            <VolumeOff sx={{ fontSize: size === "small" ? "0.85rem" : "1.1rem" }} />
          ) : (
            <VolumeUp sx={{ fontSize: size === "small" ? "0.85rem" : "1.1rem" }} />
          )}
        </IconButton>
        {showLabel && (
          <Typography
            variant="caption"
            sx={{
              color: isMuted ? "#62758d" : "#8496ad",
              fontSize: "0.75rem",
              userSelect: "none",
            }}
          >
            {isMuted ? "Muted" : "Sound ON"}
          </Typography>
        )}
      </Stack>
    </Tooltip>
  );
}
