# GAME_DOCUMENTATION

## Game Engine Explanation
The Stellar Limbo engine operates autonomously from the React component lifecycle. `LimboEngine.js` is implemented as an event-driven `EventEmitter` pattern. It calculates mathematical crash points, enforces the 98% RTP (Return to Player) via inverse logic `(98 / (1 - float))`, and emits `round:start`, `round:tick`, and `round:end` events.

## Main Components
- **`LimboGame.js`**: The main presentation container handling bets, UI controls, and Provably Fair configuration.
- **`ProviderLoader.js`**: Initial splash screen maintaining the JILLU brand identity.
- **`LimboStageCanvas.js`**: A highly optimized HTML5 `<canvas>` rendering system running its own internal `requestAnimationFrame`.

## Asset Structure
- **Vector Icons**: Standard MUI `@mui/icons-material` for ultra-fast loading without heavy sprite sheets.
- **Audio**: `SoundManager.js` uses Web Audio API procedural synthesis (Oscillators, GainNodes) avoiding external MP3/WAV dependencies, ensuring instant playback.

## Animation System
To avoid state choke (triggering React renders 60 times a second), the `LimboStageCanvas` extracts mutable game engine variables (`isRolling`, `targetMultiplier`, `status`) inside its RAF loop using a React `ref`.
Particle systems (explosion fragments) and visual transformations (rocket tilt/scale, neon trail) are mapped linearly to `dt` (delta time) for cross-platform frame-rate independence.

## State Management
Global funds and betting parameters are managed by `FundContext.js`.
Local interaction state is contained in `LimboGame.js`.
The actual running status of the rocket and current tick multipliers are securely tracked in the `LimboEngine` class instance.

## Future Backend Connection
For production, the client-side RNG in `limboPRNG.js` must be bypassed. Connect a WebSocket inside `LimboEngine.js` `playRound()`:
1. Client requests round with `betAmount` and `targetMultiplier`.
2. Server validates balance, calculates crash point, deductions, and stores state in PostgreSQL/Redis.
3. Server broadcasts result.
4. Client Engine receives outcome and visually plays out the explosion/win animation based on server data.
