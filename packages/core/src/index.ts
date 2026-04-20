// Публичный API ядра.
// Всё, что нужно потребителям (sim / grimoire / server), реэкспортируется отсюда.

export type {
  Team, Category, DemonId, RoleId, Role, RoleHandler, TargetEffect, DeathCause,
  PlayerStatus, Player, GameConfig, GameState, LogEvent, RNG, Brain, SetupPlan,
  Observation,
} from "./types";

export { pushObservation, getObservations } from "./ai/observations";

export { createRng, randomSeed } from "./rng";
export { baseSetup, adjustForDemon, adjustForBrenner } from "./config";
export { ROLES, ALL_ROLE_IDS, rolesByCategory, role } from "./roles/registry";

export { setupGame } from "./game/setup";
export { playGame } from "./game/engine";
export { runNight, runSetupHooks } from "./game/night";
export { runDay } from "./game/day";
export { checkWin } from "./game/win";
export { killPlayer, tryKill } from "./game/death";
export { livePlayers, liveGood, liveEvil, byRole, targetWithRedirect, pickLiveOther } from "./game/util";

// Минимальный "null-brain": возвращает случайные цели/голоса/подозрения.
// Достаточен, чтобы движок мог работать автономно (например, в юнит-тестах).
export { createRandomBrain } from "./ai-null";
