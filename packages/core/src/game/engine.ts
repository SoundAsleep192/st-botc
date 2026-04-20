import type { GameConfig, GameState } from "../types";
import { setupGame } from "./setup";
import { runNight, runSetupHooks } from "./night";
import { runDay } from "./day";
import { checkWin } from "./win";

/**
 * Одна партия до конца. Возвращает финальное состояние.
 */
export function playGame(config: GameConfig): GameState {
  const state = setupGame(config);

  runSetupHooks(state);
  if (checkWin(state)) return state;

  runNight(state, true);
  if (checkWin(state)) return state;

  while (state.winner === null) {
    runDay(state);
    if (checkWin(state)) break;
    runNight(state, false);
    if (checkWin(state)) break;
  }

  return state;
}
