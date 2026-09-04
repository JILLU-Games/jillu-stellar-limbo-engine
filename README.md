# STELLAR LIMBO by JILLU

![JILLU Premium Games](https://img.shields.io/badge/Provider-JILLU-00d2ff?style=for-the-badge) ![Status](https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge)

Welcome to **Stellar Limbo**, a premium casino "crash/limbo" module built for commercial iGaming integration.

## 1. Game Overview
Stellar Limbo is a fast-paced, high-adrenaline multiplier game where players set a target multiplier and bet on a rocket's trajectory. With a seamless user interface, responsive controls, and immersive audio-visuals, the game is designed to maximize player retention and engagement.

## 2. Game Features
- **Provably Fair Engine:** Verifiable cryptographic PRNG system using standard HMAC SHA-256 for absolute fairness and transparency.
- **Auto-Bet Engine:** Advanced automated betting logic including Stop Profit, Stop Loss, and On-Win/Loss adjustments.
- **HTML5 Canvas Animation:** 60-FPS decoupled rocket animation physics for ultra-smooth performance on all devices.
- **Audio Synthesis:** Real-time Web Audio API procedural sound generation (no large MP3 files to load).
- **Responsive Layout:** Mobile-first thumb-friendly controls built for iOS and Android.

## 3. Technology Stack
- **Frontend Framework:** React 18
- **Styling:** Material UI (MUI) + Custom CSS (`casinoTheme.css`)
- **Animation:** Native HTML5 Canvas API (Decoupled from React State)
- **Audio:** Custom Web Audio API Synthesizer
- **PRNG:** Mulberry32 / Web Crypto API

## 4. Project Structure
- `/src/components/` - React UI components (LimboGame, ProviderLoader, StageCanvas).
- `/src/game-engine/` - Core logic (`LimboEngine.js`, `SoundManager.js`, `provablyFair.js`).
- `/src/context/` - Global state context (`FundContext.js`).
- `/src/styles/` - Theme configurations (`casinoTheme.css`).

## 5. Installation Guide
1. Run `npm install` to install dependencies.
2. Run `npm start` to run the development server.
3. Run `npm run build` to generate the production-ready static assets in `/build`.

## 6. Configuration Guide
Modify `src/config/casinoConfig.js` to adjust game rules:
- Min/Max Bet Amounts
- Default Target Multiplier
- House Edge %

## 7. Frontend Architecture
The game follows a strict **MVC-like architecture**:
- **Model:** `LimboEngine.js` handles the deterministic event loop.
- **View:** `LimboStageCanvas.js` runs a standalone `requestAnimationFrame` loop.
- **Controller:** `LimboGame.js` binds user inputs to the engine without choking the render cycle.

## 8. Backend Integration Points
To integrate with your Casino Backend:
1. Replace local balance logic in `FundContext.js` with your REST/WebSocket APIs.
2. Intercept `engine.playRound()` inside `LimboGame.js` to dispatch bet slips to your server.
3. Replace local `limboPRNG.js` logic with server-signed results for true real-money play.

## 9. API Requirements
For real-money integration, the backend must provide:
- `POST /api/bet` (Takes wager and target, returns outcome and server seed).
- `GET /api/balance` (Fetches current user balance).
- `POST /api/provably-fair/rotate` (Rotates seed pair).

## 10. Casino Platform Integration Guide
Stellar Limbo is packaged as a standard React component `<LimboGame />`. You can mount it within an iFrame or directly within a Next.js / React-based sportsbook/casino wrapper. 
For iFrame communication, use `window.postMessage` to pass authentication tokens.

## 11. Customization Guide
- **Colors & Branding:** Edit `/src/styles/casinoTheme.css` CSS variables (`--primary-glow`, `--bg-dark`).
- **Logo:** Replace the `ProviderLoader.js` JILLU branding with your own operator logo if white-labeling is required.
