import type { GameState, Player } from "../types";

export function livePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.status.alive);
}

export function pickLiveOther(state: GameState, self: Player): Player | null {
  const candidates = state.players.filter((p) => p.status.alive && p.id !== self.id);
  if (candidates.length === 0) return null;
  return state.rng.pick(candidates);
}

/**
 * Перенаправляет цель на Эдди, если он объявил Концерт этой ночью.
 * Применяется ко всем злым-активным действиям.
 */
export function targetWithRedirect<T extends Player | null>(
  state: GameState,
  actor: Player,
  original: T
): Player | null {
  if (!original) return null;
  if (state.eddieConcertNight !== state.night) return original;
  if (actor.currentTeam !== "evil") return original;
  const eddie = state.players.find((p) => p.role.id === "eddie" && p.status.alive);
  if (!eddie) return original;
  return eddie;
}

export function byRole(state: GameState, roleId: string): Player | null {
  return state.players.find((p) => p.role.id === roleId) ?? null;
}

export function liveGood(state: GameState): Player[] {
  return state.players.filter((p) => p.status.alive && p.currentTeam === "good");
}

export function liveEvil(state: GameState): Player[] {
  return state.players.filter((p) => p.status.alive && p.currentTeam === "evil");
}

/** Активная Метка Векны = старая (поставленная в прошлую ночь или раньше). */
export function hasActiveMark(p: Player): boolean {
  return p.status.marks - p.status.marksPlacedTonight > 0;
}
