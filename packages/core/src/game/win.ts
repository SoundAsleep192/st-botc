import type { GameState } from "../types";
import { liveEvil, liveGood } from "./util";

/**
 * Возвращает true, если игра закончена (winner != null).
 * Помещает winner/winReason в состояние, если побеждён.
 */
export function checkWin(state: GameState): boolean {
  if (state.winner !== null) return true;

  // Мёртвый Демон = победа добра
  const demon = state.players.find((p) => p.role.category === "demon");
  if (demon && !demon.status.alive) {
    state.winner = "good";
    state.winReason = `Демон ${demon.role.ruName} мёртв`;
    return true;
  }

  const good = liveGood(state).length;
  const evil = liveEvil(state).length;

  // Живых добрых ≤ 0 → зло
  if (good === 0) {
    state.winner = "evil";
    state.winReason = "Добрых не осталось";
    return true;
  }

  // Защита от зависаний: если лимит дней
  if (state.day >= state.config.dayLimit) {
    state.winner = "good";
    state.winReason = `Лимит дней (${state.config.dayLimit}), ничья → добро`;
    return true;
  }

  return false;
}
