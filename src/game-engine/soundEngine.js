/**
 * Casino Web Audio Sound Engine
 *
 * Backwards-compatible wrapper delegating to SoundManager.
 */

import { SoundManager, soundManager } from "./SoundManager";

export { SoundManager, soundManager };
export const soundEngine = soundManager;
export default soundEngine;
