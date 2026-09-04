import React, { useEffect, useRef } from "react";
import { drawProceduralRocket } from "../game-engine/LimboEngine";
import RocketImgSrc from "../assets/img/rocket.png";
import MountainImgSrc from "../assets/img/mountain.png";
import Limbo1ImgSrc from "../assets/img/limbo1.png";
import Limbo2ImgSrc from "../assets/img/limbo2.png";
import BoomImgSrc from "../assets/img/boom.png";

/**
 * Responsive HTML5 Canvas for Limbo Multiplier Rocket Animation
 * Features:
 * - ResizeObserver integration for pixel-perfect dynamic resizing
 * - High-DPI (Retina) support via devicePixelRatio
 * - Parallax starfield & cosmic nebula particles
 * - Dynamic rocket engine particle flame & smoke system
 * - Target multiplier guideline with neon badge
 * - Celebratory win confetti/sparkles and crash explosion particles
 * - Smooth 60fps rendering loop with cleanup
 */
export default function LimboStageCanvas({
  engine,
  gameState = "IDLE",
  isRolling = false,
  isWin = null,
  targetMultiplier = 2.0,
  gameResult = null,
  winnings = 0,
  potentialProfit = 0,
  isTurbo = false,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const stateRef = useRef({
    gameState,
    isRolling,
    isWin,
    targetMultiplier,
    gameResult,
    winnings,
    potentialProfit,
    isTurbo,
  });

  // Keep stateRef up to date for the animation loop
  useEffect(() => {
    stateRef.current = {
      gameState,
      isRolling: isRolling || gameState === "FLYING" || gameState === "COUNTDOWN",
      isWin,
      targetMultiplier,
      gameResult,
      winnings,
      potentialProfit,
      isTurbo,
      engine,
    };
  }, [
    gameState,
    isRolling,
    isWin,
    targetMultiplier,
    gameResult,
    winnings,
    potentialProfit,
    isTurbo,
    engine,
  ]);

  // Image assets ref
  const imagesRef = useRef({
    rocket: null,
    mountain: null,
    cloud1: null,
    cloud2: null,
    boom: null,
    loaded: false,
  });

  // Load images
  useEffect(() => {
    let loadedCount = 0;
    const total = 5;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount >= total) {
        imagesRef.current.loaded = true;
      }
    };

    const rocket = new Image();
    rocket.src = RocketImgSrc;
    rocket.onload = onLoad;

    const mountain = new Image();
    mountain.src = MountainImgSrc;
    mountain.onload = onLoad;

    const cloud1 = new Image();
    cloud1.src = Limbo1ImgSrc;
    cloud1.onload = onLoad;

    const cloud2 = new Image();
    cloud2.src = Limbo2ImgSrc;
    cloud2.onload = onLoad;

    const boom = new Image();
    boom.src = BoomImgSrc;
    boom.onload = onLoad;

    imagesRef.current = {
      rocket,
      mountain,
      cloud1,
      cloud2,
      boom,
      loaded: false,
    };
  }, []);

  // Main canvas animation system
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastTime = performance.now();

    // Simulation entities
    let stars = [];
    let warpLines = [];
    let thrustParticles = [];
    let celebrationParticles = [];
    let explosionParticles = [];
    let shockwaves = [];

    // Rocket physical state
    let rocketY = 0;
    let targetRocketY = 0;
    let rocketTilt = 0;
    let idleFloatTime = 0;
    let explosionTime = 0;

    // Initialize Stars based on container area
    const initStars = (w, h) => {
      stars = [];
      const starCount = Math.min(70, Math.max(25, Math.floor((w * h) / 4500)));
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: Math.random() * 1.4 + 0.4,
          speed: Math.random() * 0.35 + 0.1,
          alpha: Math.random() * 0.6 + 0.3,
          twinkleSpeed: Math.random() * 0.003 + 0.001,
          twinklePhase: Math.random() * Math.PI * 2,
          color: Math.random() > 0.35 ? "#ffffff" : "#00d2ff",
        });
      }
    };

    // Resize Handler using ResizeObserver with clamped mobile DPR
    const handleResize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);

      if (width <= 0 || height <= 0) return;

      // Clamp DPR to max 2.0 for 60FPS fill-rate performance on mobile high-DPI screens
      dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);

      initStars(width, height);
      if (rocketY === 0) rocketY = height * 0.70;
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

    // Spawn Particles (performance-capped)
    const spawnThrust = (rx, ry, isFast, scale = 1) => {
      if (thrustParticles.length > 30) return;
      const count = isFast ? 3 : 1;
      const plumeOffsetY = 30 * scale;
      for (let i = 0; i < count; i++) {
        thrustParticles.push({
          x: rx + (Math.random() - 0.5) * (12 * scale),
          y: ry + plumeOffsetY,
          vx: (Math.random() - 0.5) * 1.6,
          vy: Math.random() * 3.5 + 2.5,
          size: (Math.random() * 4 + 3) * scale,
          life: 1.0,
          decay: Math.random() * 0.045 + 0.035,
          color:
            Math.random() > 0.55
              ? "#00d2ff"
              : Math.random() > 0.3
              ? "#ff9900"
              : "#ff3300",
        });
      }
    };

    const spawnWinCelebration = (rx, ry) => {
      celebrationParticles = [];
      const count = Math.min(45, Math.floor(width / 10));
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        celebrationParticles.push({
          x: rx,
          y: ry,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.8,
          size: Math.random() * 4 + 2,
          life: 1.0,
          decay: Math.random() * 0.02 + 0.015,
          color: [
            "#00e701",
            "#00ffcc",
            "#ffff00",
            "#00d2ff",
            "#ffffff",
          ][Math.floor(Math.random() * 5)],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.18,
        });
      }
      shockwaves.push({
        x: rx,
        y: ry,
        radius: 4,
        maxRadius: Math.min(120, width * 0.35),
        alpha: 1.0,
        color: "#00e701",
      });
    };

    const spawnExplosion = (rx, ry) => {
      explosionParticles = [];
      const count = Math.min(50, Math.floor(width / 9));
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 7 + 1.5;
        explosionParticles.push({
          x: rx + (Math.random() - 0.5) * 16,
          y: ry + (Math.random() - 0.5) * 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 6 + 2.5,
          life: 1.0,
          decay: Math.random() * 0.035 + 0.022,
          color: [
            "#ff3355",
            "#ff7700",
            "#ffbb00",
            "#ff0000",
            "#441111",
          ][Math.floor(Math.random() * 5)],
        });
      }
      shockwaves.push({
        x: rx,
        y: ry,
        radius: 4,
        maxRadius: Math.min(100, width * 0.3),
        alpha: 1.0,
        color: "#ff3355",
      });
    };

    // State change tracking
    let prevIsRolling = false;

    // 60FPS Delta-timed Animation Loop
    const render = (now) => {
      // Calculate delta time in seconds, clamped between 1ms and 50ms
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0.001), 0.05);
      lastTime = now;
      const step = dt * 60; // 1.0 at standard 60FPS

      const currentState = stateRef.current;
      const curEngine = currentState.engine;
      const targetMult = currentState.targetMultiplier;

      const rolling = curEngine ? curEngine.isRolling || curEngine.status === "COUNTDOWN" || curEngine.status === "FLYING" : currentState.isRolling;
      const curMult = curEngine ? curEngine.displayMultiplier : 1.0;
      const engineState = curEngine ? curEngine.status : currentState.gameState;
      let winState = currentState.isWin;
      
      if (engineState === "CRASHED" && curEngine && curEngine.lastResult) {
        winState = curEngine.lastResult.win;
      }

      // Detect start of roll
      if (rolling && !prevIsRolling) {
        explosionParticles = [];
        celebrationParticles = [];
        shockwaves = [];
        explosionTime = 0;
      }

      // Responsive Rocket scale calculation tailored for game-graph container
      const scaleW = width / 400;
      const scaleH = height / 260;
      const rocketScale = Math.max(0.48, Math.min(1.05, Math.min(scaleW, scaleH) * 0.92));
      const rocketCenterX = width * 0.5;

      // Detect win/loss resolution
      if (!rolling && prevIsRolling && winState !== null) {
        if (winState === true) {
          spawnWinCelebration(rocketCenterX, rocketY);
        } else if (winState === false) {
          spawnExplosion(rocketCenterX, rocketY);
          explosionTime = 1.0;
        }
      }

      prevIsRolling = rolling;

      // 1. Clear Canvas & Deep Space Cosmic Background
      ctx.clearRect(0, 0, width, height);

      // Radial Cosmic Background
      const bgGradient = ctx.createRadialGradient(
        rocketCenterX,
        height * 0.4,
        15,
        rocketCenterX,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      bgGradient.addColorStop(0, "#152033");
      bgGradient.addColorStop(0.55, "#0d1422");
      bgGradient.addColorStop(1, "#070b12");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle Atmospheric Bloom Glow
      const nebula = ctx.createRadialGradient(
        rocketCenterX,
        height * 0.45,
        10,
        rocketCenterX,
        height * 0.45,
        height * 0.55
      );
      if (winState === true && !rolling) {
        nebula.addColorStop(0, "rgba(0, 231, 1, 0.14)");
        nebula.addColorStop(1, "rgba(0, 231, 1, 0)");
      } else if (winState === false && !rolling) {
        nebula.addColorStop(0, "rgba(255, 51, 85, 0.12)");
        nebula.addColorStop(1, "rgba(255, 51, 85, 0)");
      } else if (rolling) {
        nebula.addColorStop(0, "rgba(0, 210, 255, 0.12)");
        nebula.addColorStop(1, "rgba(0, 210, 255, 0)");
      } else {
        nebula.addColorStop(0, "rgba(0, 119, 255, 0.07)");
        nebula.addColorStop(1, "rgba(0, 119, 255, 0)");
      }
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, width, height);

      // 2. Stars & Warp Effect (Delta-time updated)
      idleFloatTime += dt * 1.8;

      if (rolling) {
        if (Math.random() > 0.35 && warpLines.length < 18) {
          warpLines.push({
            x: Math.random() * width,
            y: -10,
            length: Math.random() * 35 + 15,
            speed: (Math.random() * 10 + 8) * step,
            alpha: Math.random() * 0.6 + 0.3,
            color: Math.random() > 0.4 ? "#00d2ff" : "#ffffff",
          });
        }
      }

      // Draw & update warp lines
      for (let i = warpLines.length - 1; i >= 0; i--) {
        const line = warpLines[i];
        line.y += line.speed * (dt * 60);
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.globalAlpha = line.alpha;
        ctx.lineWidth = 1.2;
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x, line.y + line.length);
        ctx.stroke();

        if (line.y > height + 20) {
          warpLines.splice(i, 1);
        }
      }
      ctx.globalAlpha = 1.0;

      // Ambient Twinkling Stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const twinkle = Math.sin(now * star.twinkleSpeed + star.twinklePhase) * 0.15;
        const currentAlpha = Math.max(0.1, Math.min(0.85, star.alpha + twinkle));

        if (rolling) {
          star.y += star.speed * 4 * step;
          if (star.y > height) star.y = 0;
        } else {
          star.y += star.speed * 0.3 * step;
          if (star.y > height) star.y = 0;
        }

        ctx.fillStyle = star.color;
        ctx.globalAlpha = currentAlpha;
        ctx.fillRect(star.x, star.y, star.radius, star.radius);
      }
      ctx.globalAlpha = 1.0;

      // 3. Parallax Mountain Silhouettes at bottom
      const mountainImg = imagesRef.current.mountain;
      if (mountainImg && imagesRef.current.loaded) {
        ctx.globalAlpha = 0.35;
        const mHeight = Math.min(90, height * 0.30);
        ctx.drawImage(mountainImg, 0, height - mHeight, width, mHeight);
        ctx.globalAlpha = 1.0;
      }

      // 4. Target Multiplier Guideline
      const targetY = height * 0.44;
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = "rgba(0, 210, 255, 0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(10, targetY);
      ctx.lineTo(width - 10, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target Badge on the right
      const targetText = `TARGET ${Number(targetMult).toFixed(2)}x`;
      ctx.font = "bold 10px sans-serif";
      const textWidth = ctx.measureText(targetText).width;
      const badgeW = textWidth + 14;
      const badgeH = 18;
      const badgeX = width - badgeW - 14;
      const badgeY = targetY - badgeH * 0.5;

      ctx.fillStyle = "rgba(0, 210, 255, 0.15)";
      ctx.strokeStyle = "rgba(0, 210, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect?.(badgeX, badgeY, badgeW, badgeH, 4) ||
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#00d2ff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(targetText, badgeX + 7, targetY);
      ctx.restore();

      // 5. Responsive Rocket Position & Flight Physics
      const baseRocketY = height * 0.70;
      const topCeilingY = height * 0.22;

      const isCountdown = engineState === "COUNTDOWN";
      const isFlying = engineState === "FLYING" || (rolling && !isCountdown);
      const isCrashed = engineState === "CRASHED" || (!rolling && winState !== null);

      if (isCountdown) {
        // Pre-launch ignition rumble
        targetRocketY = baseRocketY + (Math.random() - 0.5) * 2.5;
        rocketTilt = (Math.random() - 0.5) * 0.03;
        spawnThrust(rocketCenterX, rocketY, false, rocketScale);
      } else if (isFlying) {
        // Smooth responsive ascent progress mapping
        const progress = Math.min(1.0, Math.max(0, (curMult - 1.0) / Math.max(0.01, targetMult - 1.0)));
        const baseAscent = baseRocketY - (baseRocketY - targetY) * Math.pow(progress, 0.75);
        const overshoot = curMult > targetMult ? Math.min(height * 0.16, Math.log10(curMult / targetMult) * height * 0.2) : 0;
        targetRocketY = Math.max(topCeilingY, baseAscent - overshoot);
        rocketTilt = Math.sin(now * 0.003) * 0.04;
        spawnThrust(rocketCenterX, rocketY, true, rocketScale);
      } else if (isCrashed && winState === true) {
        targetRocketY = Math.max(topCeilingY, targetY - height * 0.05);
        rocketTilt = 0;
        spawnThrust(rocketCenterX, rocketY, false, rocketScale);
      } else if (isCrashed && winState === false) {
        targetRocketY = baseRocketY;
        rocketTilt = 0;
      } else {
        // Idle gentle float
        targetRocketY = baseRocketY + Math.sin(idleFloatTime) * (height * 0.018);
        rocketTilt = Math.sin(idleFloatTime * 0.8) * 0.015;
        if (Math.random() > 0.45) spawnThrust(rocketCenterX, rocketY, false, rocketScale);
      }

      // Delta-time smoothed rocket Y interpolation (frame-rate independent 60FPS easing)
      rocketY += (targetRocketY - rocketY) * (1 - Math.exp(-14 * dt));

      // 6. Thrust Exhaust Particles
      for (let i = thrustParticles.length - 1; i >= 0; i--) {
        const p = thrustParticles[i];
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.size *= Math.pow(0.95, step);
        p.life -= p.decay * step;

        if (p.life <= 0 || p.size <= 0.5) {
          thrustParticles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = p.life * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // 7. Render High-performance Procedural Rocket
      drawProceduralRocket(ctx, {
        x: rocketCenterX,
        y: rocketY,
        multiplier: curMult,
        targetMultiplier: targetMult,
        status: engineState,
        isWin: winState,
        tilt: rocketTilt,
        scale: rocketScale,
        time: now * 0.06,
        glow: true,
      });

      // 8. Shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += 3.8 * step;
        sw.alpha -= 0.035 * step;

        if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
          shockwaves.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 9. Crash Explosion Particles & Boom Sprite
      if (explosionParticles.length > 0) {
        for (let i = explosionParticles.length - 1; i >= 0; i--) {
          const ep = explosionParticles[i];
          ep.x += ep.vx * step;
          ep.y += ep.vy * step;
          ep.vy += 0.15 * step; // Gravity
          ep.size *= Math.pow(0.96, step);
          ep.life -= ep.decay * step;

          if (ep.life <= 0 || ep.size <= 0.5) {
            explosionParticles.splice(i, 1);
            continue;
          }

          ctx.globalAlpha = Math.max(0, ep.life);
          ctx.fillStyle = ep.color;
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, ep.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Draw Explosion Blast Center
        const boomImg = imagesRef.current.boom;
        if (boomImg && imagesRef.current.loaded && explosionTime > 0.1) {
          ctx.globalAlpha = Math.min(1, explosionTime);
          const boomSize = Math.min(90, width * 0.28) * (1.2 - explosionTime * 0.2);
          ctx.drawImage(
            boomImg,
            rocketCenterX - boomSize * 0.5,
            rocketY - boomSize * 0.5,
            boomSize,
            boomSize
          );
          ctx.globalAlpha = 1.0;
          explosionTime -= 0.025 * step;
        }
      }

      // 10. Win Celebration Sparkles & Confetti
      for (let i = celebrationParticles.length - 1; i >= 0; i--) {
        const cp = celebrationParticles[i];
        cp.x += cp.vx * step;
        cp.y += cp.vy * step;
        cp.vy += 0.08 * step; // Gravity
        cp.rot += cp.rotSpeed * step;
        cp.life -= cp.decay * step;

        if (cp.life <= 0) {
          celebrationParticles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(cp.x, cp.y);
        ctx.rotate(cp.rot);
        ctx.globalAlpha = Math.max(0, cp.life);
        ctx.fillStyle = cp.color;
        ctx.fillRect(-cp.size * 0.5, -cp.size * 0.5, cp.size, cp.size * 1.4);
        ctx.restore();
      }

      // 11. Multiplier Display (Responsive typography in Canvas Header/Center)
      ctx.save();
      const multY = height * 0.23;
      const multStr = `${curMult.toFixed(2)}x`;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Dynamic Font Size
      const fontSize = Math.min(52, Math.max(30, width * 0.10));
      ctx.font = `900 ${fontSize}px sans-serif`;

      if (!rolling && winState === true) {
        ctx.fillStyle = "#00e701";
        ctx.shadowColor = "rgba(0, 231, 1, 0.75)";
        ctx.shadowBlur = 16;
      } else if (!rolling && winState === false) {
        ctx.fillStyle = "#ff3355";
        ctx.shadowColor = "rgba(255, 51, 85, 0.65)";
        ctx.shadowBlur = 14;
      } else if (rolling) {
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 210, 255, 0.65)";
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
        ctx.shadowBlur = 8;
      }

      ctx.fillText(multStr, rocketCenterX, multY);
      ctx.restore();

      // Loop
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      id="game-graph"
      ref={containerRef}
      className="game-graph limbo-game-graph"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: "12px",
      }}
    >
      <canvas
        id="limbo-multiplier-canvas"
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
