import type { RoleHandler, Player, GameState } from "../../types";
import { killPlayer } from "../../game/death";
import { liveGood, livePlayers } from "../../game/util";

// ═══════════════ УИЛЛ ═══════════════
// Чисто пассивная роль — реакция на onTargeted в night.ts.
export const willHandler: RoleHandler = {
  id: "will",
  onTargeted(self, state, byRole, effect) {
    self.status.wokeThisNight = true;
    // Случайный Житель получает тот же эффект
    const townsfolk = state.players.filter(
      (p) => p.status.alive && p.category === "townsfolk" && p.id !== self.id
    );
    const extra = state.rng.pickMaybe(townsfolk);
    state.log.push({
      phase: "night",
      night: state.night,
      type: "will-targeted",
      actor: self.id,
      detail: `byRole=${byRole}, effect=${effect}, also=${extra?.name ?? "—"}`,
    });
    if (extra) applyEffect(state, extra, effect, byRole);
  },
};

function applyEffect(state: GameState, target: Player, effect: string, byRole: string): void {
  switch (effect) {
    case "poison": target.status.poisoned = true; break;
    case "kill": killPlayer(state, target, { kind: "demon-chain", byRole: byRole as any }); break;
    case "mark": target.status.marks += 1; break;
    case "convert":
      if (target.currentTeam === "good") {
        target.currentTeam = "evil";
        state.convertedCount += 1;
      }
      break;
    // invert/block — не дублируем, слишком долго
  }
}

// ═══════════════ ТЕД ═══════════════
// Пассивная роль: умирает от любой «направленной» способности.
export const tedHandler: RoleHandler = {
  id: "ted",
  onTargeted(self, state, byRole, _effect) {
    if (!self.status.alive) return;
    killPlayer(state, self, { kind: "chain-from-death", byRole: byRole as any });
  },
};

// ═══════════════ ЮРИЙ ═══════════════
export const yuriHandler: RoleHandler = {
  id: "yuri",
  firstNight(self, _state) {
    // ведущий показывает стартовую команду. В simple AI — просто помечаем, что проснулся.
    self.status.wokeThisNight = true;
  },
  otherNight(self, state) {
    if ((self.memory as { yuriFrozen?: boolean }).yuriFrozen) {
      // переманен Этосамым — цикл остановлен
      return;
    }
    self.currentTeam = self.currentTeam === "good" ? "evil" : "good";
    self.status.wokeThisNight = true;
    state.log.push({ phase: "night", night: state.night, type: "yuri-switch", actor: self.id, detail: self.currentTeam });
  },
};

// ═══════════════ АЛЕКСЕЙ ═══════════════
export const alexeiHandler: RoleHandler = {
  id: "alexei",
  onSetup(self, state) {
    // Выбираем ближайшего доброго соседа (упрощённо: левый сосед, добрый, пропуская злых)
    const neighbors: Player[] = [];
    const idx = state.players.findIndex((p) => p.id === self.id);
    const n = state.players.length;
    // влево
    for (let i = 1; i < n; i++) {
      const cand = state.players[(idx - i + n) % n];
      if (cand && cand.currentTeam === "good") { neighbors.push(cand); break; }
    }
    // вправо
    for (let i = 1; i < n; i++) {
      const cand = state.players[(idx + i) % n];
      if (cand && cand.currentTeam === "good") { neighbors.push(cand); break; }
    }
    if (neighbors.length === 0) return;
    const chosen = state.rng.pick(neighbors);
    chosen.status.poisoned = true;
    (self.memory as { poisonedNeighbor?: number }).poisonedNeighbor = chosen.id;
    state.log.push({ phase: "setup", type: "alexei-neighbor-poison", actor: self.id, target: chosen.id });
  },
  firstNight(self, _state) {
    self.status.wokeThisNight = true;
  },
  otherNight(self, state) {
    // В N3 даёт имя одного злого
    if (state.night === 3 && self.status.alive && !self.status.poisoned && !self.status.drunk) {
      const evils = state.players.filter((p) => p.status.alive && p.currentTeam === "evil");
      if (evils.length > 0) {
        const target = state.rng.pick(evils);
        state.log.push({ phase: "night", night: 3, type: "alexei-name", actor: self.id, target: target.id });
      }
    }
  },
  onDeath(self, state, _cause) {
    // Снимаем отравление с выбранного соседа
    const id = (self.memory as { poisonedNeighbor?: number }).poisonedNeighbor;
    if (id === undefined) return;
    const neighbor = state.players.find((p) => p.id === id);
    if (neighbor) {
      neighbor.status.poisoned = false;
      state.log.push({ phase: "night", night: state.night, type: "alexei-death-unpoison", target: neighbor.id });
    }
  },
};

// ═══════════════ БАРБ ═══════════════
export const barbHandler: RoleHandler = {
  id: "barb",
  onDeath(self, state, _cause) {
    const candidates = state.players.filter((p) => p.id !== self.id && p.currentTeam === "good" && p.status.alive);
    const target = state.rng.pickMaybe(candidates);
    if (target) {
      target.status.poisoned = true;
      state.log.push({ phase: "day", day: state.day, type: "barb-posthumous-poison", actor: self.id, target: target.id });
    }
  },
};
