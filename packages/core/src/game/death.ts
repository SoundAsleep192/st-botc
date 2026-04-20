import type { DeathCause, GameState, Player } from "../types";
import { getHandler } from "../roles/handlers";

/**
 * Попытка убить игрока. Учитывает защиты, иммунитеты, Концерт.
 * Возвращает true, если игрок действительно умер.
 */
export function tryKill(state: GameState, target: Player, cause: DeathCause): boolean {
  if (!target.status.alive) return false;

  // Эдди-Концерт: если сейчас ночь Концерта, атака перенаправляется на Эдди.
  // Это обрабатывается на уровне targetWithRedirect до вызова tryKill, здесь только финальный удар.

  // Макс: иммунитет к Демону
  if (target.role.id === "max" && isDemonCause(cause)) {
    state.log.push({
      phase: "night",
      night: state.night,
      type: "death-blocked-max",
      target: target.id,
      detail: causeString(cause),
    });
    return false;
  }

  // Защита
  if (target.status.protectedTonight) {
    state.log.push({
      phase: "night",
      night: state.night,
      type: "death-blocked-protection",
      target: target.id,
      detail: causeString(cause),
    });
    // Штраф Хоппера: если спасение от Демона
    if (target.status.savedThisNight && target.status.lastSaveSource === "demon" && isDemonCause(cause)) {
      state.hopperPenalty = true;
    }
    return false;
  }

  return killPlayer(state, target, cause);
}

/** Безусловная смерть (для казни, «направленного» Теда и т.п.). */
export function killPlayer(state: GameState, target: Player, cause: DeathCause): boolean {
  if (!target.status.alive) return false;

  target.status.alive = false;
  state.log.push({
    phase: state.night > 0 && state.day === state.night - 1 ? "night" : "day",
    night: state.night,
    day: state.day,
    type: "death",
    target: target.id,
    detail: causeString(cause),
  });

  // Триггерная реакция этой роли на свою смерть (Барб и т.п.)
  const handler = getHandler(target.role.id);
  handler?.onDeath?.(target, state, cause);

  // Смерть игрока с активной Меткой → эскалация Векны.
  // Свежая (поставленная этой ночью) ещё не считается активной.
  const activeMarks = target.status.marks - target.status.marksPlacedTonight;
  if (activeMarks > 0 && cause.kind !== "mark-escalation") {
    state.vecnaEscalation += 1;
  }

  return true;
}

function isDemonCause(cause: DeathCause): boolean {
  return (
    cause.kind === "demon-direct" ||
    cause.kind === "mark-escalation" ||
    cause.kind === "demon-chain"
  );
}

function causeString(cause: DeathCause): string {
  switch (cause.kind) {
    case "vote": return "казнь";
    case "demon-direct": return `прямая атака Демона (${cause.byRole})`;
    case "mark-escalation": return "срабатывание Метки Векны";
    case "demon-chain": return `цепная смерть (${cause.byRole})`;
    case "minion": return `атака Приспешника (${cause.byRole})`;
    case "chain-from-death": return `цепной эффект (${cause.byRole})`;
    case "concert": return "концерт Эдди";
    case "oneshot-eleven": return "дневная казнь от Оди";
    case "madness-violation": return "нарушение безумия Метки Векны";
  }
}
