import type { Brain } from "./types";

/**
 * Null-brain: полностью случайное поведение без эвристик.
 * Живёт в core, чтобы ядро могло работать автономно (тесты, прототипы).
 * Более умные стратегии — в пакете @botc/sim/ai.
 */
export function createRandomBrain(): Brain {
  return {
    pickTarget(state, _self, candidates, _reason) {
      if (candidates.length === 0) return null;
      return state.rng.pick(candidates);
    },

    pickNominee(state, _self, candidates) {
      if (!state.rng.bool(0.1)) return null;
      if (candidates.length === 0) return null;
      return state.rng.pick(candidates);
    },

    voteOnNomination(state, self, nominee) {
      if (self.id === nominee.id) return false;
      return state.rng.bool(0.15);
    },

    trustLevel(_state, _self, _other) {
      return 0.5;
    },
  };
}
