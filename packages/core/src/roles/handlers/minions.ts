import type { RoleHandler, Player, GameState } from "../../types";
import { tryKill } from "../../game/death";
import { livePlayers, targetWithRedirect } from "../../game/util";

// ═══════════════ БИЛЛИ ═══════════════
export const billyHandler: RoleHandler = {
  id: "billy",
  otherNight(self, state) {
    if (self.status.poisoned || self.status.drunk) return;
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = targetWithRedirect(state, self, self.brain.pickTarget(state, self, candidates, "billy-invert"));
    if (!target) return;
    target.status.invertedTonight = true;
    if (target.currentTeam === "good") target.status.poisonedByBilly = true;
    (target.memory as { targetedByEvil?: boolean }).targetedByEvil = true;
    target.status.wokeThisNight = true;
    self.status.wokeThisNight = true;
    state.log.push({ phase: "night", night: state.night, type: "billy-invert", actor: self.id, target: target.id });
  },
};

// ═══════════════ БРЕННЕР ═══════════════
export const brennerHandler: RoleHandler = {
  id: "brenner",
  firstNight(self, state) {
    // «Видит гримуар» — для симулятора это ничего не меняет в AI (мы уже всё знаем).
    // Просто лог + wake.
    self.status.wokeThisNight = true;
    state.log.push({ phase: "night", night: 1, type: "brenner-grimoire", actor: self.id });
  },
};

// ═══════════════ ГРИГОРИЙ ═══════════════
export const grigoriHandler: RoleHandler = {
  id: "grigori",
  otherNight(self, state) {
    if (self.status.poisoned || self.status.drunk) return;
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = targetWithRedirect(state, self, self.brain.pickTarget(state, self, candidates, "grigori-block"));
    if (!target) return;
    (target.memory as { blockedTonight?: boolean }).blockedTonight = true;
    (target.memory as { targetedByEvil?: boolean }).targetedByEvil = true;
    target.status.wokeThisNight = true;
    self.status.wokeThisNight = true;
    state.log.push({ phase: "night", night: state.night, type: "grigori-block", actor: self.id, target: target.id });
  },
};

// ═══════════════ ДЕМОГОРГОН ═══════════════
export const demogorgonHandler: RoleHandler = {
  id: "demogorgon",
  otherNight(self, state) {
    if (self.status.poisoned || self.status.drunk) return;
    const candidates = livePlayers(state).filter(
      (p) => p.id !== self.id && p.role.id !== "dustin"
    );
    const target = targetWithRedirect(state, self, self.brain.pickTarget(state, self, candidates, "demogorgon-kill"));
    if (!target) return;
    self.status.wokeThisNight = true;
    target.status.wokeThisNight = true;
    (target.memory as { targetedByEvil?: boolean }).targetedByEvil = true;

    // Проверка «не участвовал в голосовании»: для симуляции считаем, что ~60% игроков голосуют за хотя бы одну номинацию.
    // Упрощение: в simple AI считаем, что игрок не голосовал с вероятностью 0.35
    const skippedVote = (target.memory as { skippedAllVotes?: boolean }).skippedAllVotes === true;
    if (!skippedVote) {
      state.log.push({ phase: "night", night: state.night, type: "demogorgon-miss", actor: self.id, target: target.id });
      return;
    }
    tryKill(state, target, { kind: "minion", byRole: "demogorgon" });
    state.log.push({ phase: "night", night: state.night, type: "demogorgon-hit", actor: self.id, target: target.id });
  },
};
