import type { Observation, Player } from "../types";

/** Добавить наблюдение в приватную память игрока. */
export function pushObservation(player: Player, obs: Observation): void {
  const mem = player.memory as { observations?: Observation[] };
  if (!mem.observations) mem.observations = [];
  mem.observations.push(obs);
}

/** Прочитать все наблюдения игрока (упорядочены по времени). */
export function getObservations(player: Player): Observation[] {
  const mem = player.memory as { observations?: Observation[] };
  return mem.observations ?? [];
}
