import type { GameState, Player } from "../types";
import { getHandler } from "../roles/handlers";
import { resolveEddieConcert } from "../roles/handlers/townsfolk";
import { resolveVecnaMarks } from "../roles/handlers/demons";

/**
 * Выполняет ночь. first=true — первая ночь.
 */
export function runNight(state: GameState, first: boolean): void {
  state.night += 1;
  resetNightFlags(state);

  // Собираем ролей в порядке.
  const order = state.players
    .filter((p) => p.status.alive)
    .map((p) => ({
      player: p,
      step: first ? p.role.firstNight : p.role.otherNight,
    }))
    .filter((x) => x.step > 0)
    .sort((a, b) => a.step - b.step);

  for (const { player } of order) {
    if (!player.status.alive) continue;
    const blocked = (player.memory as { blockedTonight?: boolean }).blockedTonight === true;
    if (blocked) continue;

    const handler = getHandler(player.role.id);
    if (!handler) continue;
    if (first) handler.firstNight?.(player, state);
    else handler.otherNight?.(player, state);
  }

  // Kill-phase: Векна + Истязатель + Демогоргон уже разыграли; метка срабатывает у кого висит
  if (!first) {
    resolveVecnaMarks(state);
    resolveEddieConcert(state);
  }

  applyEscalationEffects(state);
}

/**
 * Вызывается в начале setup, проходит всем ролям с onSetup (Алексей).
 */
export function runSetupHooks(state: GameState): void {
  for (const player of state.players) {
    const handler = getHandler(player.role.id);
    handler?.onSetup?.(player, state);
  }
}

function resetNightFlags(state: GameState): void {
  for (const p of state.players) {
    p.status.savedThisNight = false;
    p.status.protectedTonight = false;
    p.status.wokeThisNight = false;
    p.status.invertedTonight = false;
    p.status.lastSaveSource = null;
    // «Свежие» метки прошлой ночи становятся активными для этой ночи.
    p.status.marksPlacedTonight = 0;
    (p.memory as { blockedTonight?: boolean; targetedByEvil?: boolean }).blockedTonight = false;
    (p.memory as { targetedByEvil?: boolean }).targetedByEvil = false;

    // Билли-отравление живёт «до следующей ночи» — то есть снимаем в начале этой ночи
    if (p.status.poisonedByBilly) {
      p.status.poisoned = false;
      p.status.poisonedByBilly = false;
    }
  }
}

function applyEscalationEffects(state: GameState): void {
  // Эффекты привязаны к АКТИВНЫМ меткам (старым), не к свежим.
  const isActivelyMarked = (p: { status: { marks: number; marksPlacedTonight: number; alive: boolean } }) =>
    p.status.alive && p.status.marks - p.status.marksPlacedTonight > 0;

  // Тиер 1: отравляем активно помеченных
  if (state.vecnaEscalation >= 1) {
    for (const p of state.players) {
      if (isActivelyMarked(p)) p.status.poisoned = true;
    }
  }
  // Тиер 2: безумие
  if (state.vecnaEscalation >= 2) {
    for (const p of state.players) {
      if (isActivelyMarked(p)) p.status.mad = true;
    }
  }
  // Тиер 3: нет голоса / нельзя номинировать — реализуется в day.ts
}
