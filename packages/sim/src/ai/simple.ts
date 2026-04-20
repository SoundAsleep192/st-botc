import type { Brain } from "@botc/core";

/**
 * Simple AI: случайный выбор ночных целей + базовые эвристики голосования.
 * Злые знают своих (не голосуют против демона), добрые голосуют слабо в отсутствие инфы.
 * Подходит для sanity-check'а движка, но не репрезентативен: не использует ночную информацию.
 */
export function createSimpleBrain(): Brain {
  return {
    pickTarget(state, _self, candidates, _reason) {
      if (candidates.length === 0) return null;
      return state.rng.pick(candidates);
    },

    pickNominee(state, self, candidates) {
      if (!state.rng.bool(0.08)) return null;
      if (candidates.length === 0) return null;
      const ranked = [...candidates].sort((a, b) => {
        const ta = this.trustLevel(state, self, a);
        const tb = this.trustLevel(state, self, b);
        return ta - tb;
      });
      return ranked[0] ?? null;
    },

    voteOnNomination(state, self, nominee) {
      if (self.id === nominee.id) return false;
      if (self.currentTeam === "evil" && nominee.role.category === "demon") return false;
      if (self.currentTeam === "evil" && nominee.currentTeam === "good") {
        return state.rng.bool(0.4);
      }
      const live = state.players.filter((p) => p.status.alive).length;
      const panic = Math.max(0, 1 - live / state.players.length);
      const trust = this.trustLevel(state, self, nominee);
      const voteChance = 0.15 + panic * 0.3 - trust * 0.15;
      return state.rng.bool(Math.max(0.02, Math.min(0.9, voteChance)));
    },

    trustLevel(_state, self, other) {
      if (self.currentTeam === "evil" && other.currentTeam === "evil") return 1;
      if (self.id === other.id) return 1;
      return 0.5;
    },
  };
}
