import type { RoleHandler, Player, GameState } from "../../types";
import { killPlayer } from "../../game/death";
import { byRole, liveEvil, liveGood, livePlayers } from "../../game/util";
import { pushObservation } from "../../ai/observations";

// ═══════════════ ОДИ (Eleven) ═══════════════
export const elevenHandler: RoleHandler = {
  id: "eleven",
  otherNight(self, state) {
    if (!self.status.alive) return;
    if (self.oneshotUsed) return;
    // Простая ночная инфа: «просыпался ли кто-то». AI-цель — случайный живой.
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "eleven-check");
    if (!target) return;
    // Лог инфы (мы не используем её для решений в simple-AI, но пишем для протокола)
    state.log.push({
      phase: "night", night: state.night, type: "eleven-check",
      actor: self.id, target: target.id,
      detail: target.status.wokeThisNight ? "да" : "нет",
    });
  },
};

/** Днём Оди один раз за игру может «расстрелять» игрока. Обрабатывается в day.ts. */
export function elevenTryDayKill(state: GameState): void {
  const eleven = state.players.find((p) => p.role.id === "eleven" && p.status.alive && !p.oneshotUsed);
  if (!eleven) return;

  // Простая эвристика: если живых добрых ≤ живых злых — паника, стрелять в самого подозрительного
  const ge = liveGood(state).length;
  const ee = liveEvil(state).length;
  const panic = ge <= ee + 1;
  if (!panic && !state.rng.bool(0.05)) return; // иначе редко стреляет

  // Выбираем самого нетрастового живого (не себя)
  const candidates = livePlayers(state).filter((p) => p.id !== eleven.id);
  if (candidates.length === 0) return;
  const ranked = [...candidates].sort(
    (a, b) => eleven.brain.trustLevel(state, eleven, a) - eleven.brain.trustLevel(state, eleven, b)
  );
  const target = ranked[0];
  if (!target) return;

  eleven.oneshotUsed = true;
  killPlayer(state, target, { kind: "oneshot-eleven" });
  state.log.push({
    phase: "day", day: state.day, type: "eleven-oneshot",
    actor: eleven.id, target: target.id,
  });
}

// ═══════════════ ХОППЕР ═══════════════
export const hopperHandler: RoleHandler = {
  id: "hopper",
  otherNight(self, state) {
    if (state.hopperPenalty) {
      state.hopperPenalty = false;
      // Хоппер умирает, если ранее спас от Демона. Обрабатываем здесь, чтобы не в kill-phase.
      killPlayer(state, self, { kind: "demon-direct", byRole: "hopper-penalty" as any });
      return;
    }
    if (self.status.poisoned || self.status.drunk) return;
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "hopper-protect");
    if (!target) return;
    target.status.protectedTonight = true;
    target.status.savedThisNight = true;
    target.status.lastSaveSource = "other"; // будет перезаписано в death.tryKill, если источник = Демон
    self.status.wokeThisNight = true;
    target.status.wokeThisNight = true;
    state.log.push({ phase: "night", night: state.night, type: "hopper-protect", actor: self.id, target: target.id });
  },
};

// ═══════════════ СТИВ ═══════════════
export const steveHandler: RoleHandler = {
  id: "steve",
  otherNight(self, state) {
    if (state.steveCooldown) {
      state.steveCooldown = false;
      state.log.push({ phase: "night", night: state.night, type: "steve-cooldown", actor: self.id });
      return;
    }
    if (self.status.poisoned || self.status.drunk) return;
    // Simple AI: в 80% случаев защищает, в 20% пасует
    if (state.rng.bool(0.2)) {
      state.log.push({ phase: "night", night: state.night, type: "steve-pass", actor: self.id });
      return;
    }
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "steve-protect");
    if (!target) return;
    target.status.protectedTonight = true;
    target.status.savedThisNight = true;
    target.status.lastSaveSource = "other";
    state.steveCooldown = true;
    self.status.wokeThisNight = true;
    target.status.wokeThisNight = true;
    state.log.push({ phase: "night", night: state.night, type: "steve-protect", actor: self.id, target: target.id });
  },
};

// ═══════════════ РОБИН ═══════════════
// Читает одного игрока, узнаёт демон он или нет. Инфа инвертируется при отравлении/безумии.
export const robinHandler: RoleHandler = {
  id: "robin",
  otherNight(self, state) {
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "robin-check");
    if (!target) return;
    self.status.wokeThisNight = true;
    const actual = target.role.category === "demon";
    const noisy = self.status.poisoned || self.status.drunk || self.status.mad;
    const reported = noisy ? !actual : actual;
    pushObservation(self, { type: "robin-read", night: state.night, targetId: target.id, reportedDemon: reported });
    state.log.push({
      phase: "night", night: state.night, type: "robin-check",
      actor: self.id, target: target.id, detail: reported ? "демон" : "не демон",
    });
  },
};

// ═══════════════ НЭНСИ ═══════════════
// Первая ночь: показывают пару «один из них — приспешник» + возможную роль.
// В партии без миньонов (Whatsit) ведущий подсовывает пару добрых с фейковой ролью.
export const nancyHandler: RoleHandler = {
  id: "nancy",
  firstNight(self, state) {
    self.status.wokeThisNight = true;
    const goods = state.players.filter(
      (p) => p.id !== self.id && p.currentTeam === "good" && p.role.id !== "yuri"
    );
    if (goods.length < 2) return;

    const minions = state.players.filter((p) => p.category === "minion" && p.status.alive);
    if (minions.length === 0) {
      const pair = state.rng.sample(goods, 2);
      const fakeRoleId = state.rng.pick(goods).role.id;
      pushObservation(self, { type: "nancy-pair", night: 1, a: pair[0]!.id, b: pair[1]!.id, guessedRole: fakeRoleId });
      state.log.push({
        phase: "night", night: 1, type: "nancy-fake",
        actor: self.id,
        detail: `fake: ${pair[0]!.name}, ${pair[1]!.name}, role=${fakeRoleId}`,
      });
      return;
    }

    const realMinion = state.rng.pick(minions);
    const decoys = goods.filter((p) => p.id !== realMinion.id);
    const decoy = state.rng.pickMaybe(decoys);
    if (!decoy) return;
    pushObservation(self, { type: "nancy-pair", night: 1, a: realMinion.id, b: decoy.id, guessedRole: realMinion.role.id });
    state.log.push({
      phase: "night", night: 1, type: "nancy-investigate",
      actor: self.id, target: realMinion.id,
      detail: `pair: ${realMinion.name}, ${decoy.name}, role=${realMinion.role.id}`,
    });
  },
};

// ═══════════════ ДАСТИН ═══════════════
// Узнаёт: с какой стороны (по кругу живых) находится демон. Мы сохраняем соседа с той стороны.
export const dustinHandler: RoleHandler = {
  id: "dustin",
  otherNight(self, state) {
    self.status.wokeThisNight = true;
    const demon = state.players.find((p) => p.category === "demon" && p.status.alive);
    if (!demon) return;
    const live = livePlayers(state);
    const selfIdx = live.findIndex((p) => p.id === self.id);
    const demonIdx = live.findIndex((p) => p.id === demon.id);
    if (selfIdx < 0 || demonIdx < 0) return;
    const leftDist = (selfIdx - demonIdx + live.length) % live.length;
    const rightDist = (demonIdx - selfIdx + live.length) % live.length;
    const side: "left" | "right" =
      leftDist < rightDist ? "left" : leftDist > rightDist ? "right" : state.rng.bool() ? "left" : "right";
    const neighborIdx = side === "left" ? (selfIdx - 1 + live.length) % live.length : (selfIdx + 1) % live.length;
    const neighbor = live[neighborIdx];
    if (neighbor) pushObservation(self, { type: "dustin-side", night: state.night, neighborId: neighbor.id });
    state.log.push({ phase: "night", night: state.night, type: "dustin-side", actor: self.id, detail: side });
  },
};

// ═══════════════ ДЖОЙС ═══════════════
// Узнаёт: есть ли у игрока метка или статус (отравление/безумие).
export const joyceHandler: RoleHandler = {
  id: "joyce",
  otherNight(self, state) {
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "joyce-check");
    if (!target) return;
    self.status.wokeThisNight = true;
    const has = target.status.marks > 0 || target.status.poisoned || target.status.drunk || target.status.mad;
    const noisy = self.status.poisoned || self.status.drunk || self.status.mad;
    const reported = noisy ? !has : has;
    pushObservation(self, { type: "joyce-mark", night: state.night, targetId: target.id, hasMark: reported });
    state.log.push({
      phase: "night", night: state.night, type: "joyce-check",
      actor: self.id, target: target.id, detail: reported ? "да" : "нет",
    });
  },
};

// ═══════════════ МАЙК ═══════════════
// Узнаёт: одной ли команды с собой. Работает только если target «просыпался» этой ночью.
export const mikeHandler: RoleHandler = {
  id: "mike",
  otherNight(self, state) {
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "mike-check");
    if (!target) return;
    self.status.wokeThisNight = true;
    if (!target.status.wokeThisNight) {
      state.log.push({ phase: "night", night: state.night, type: "mike-no-wake", actor: self.id, target: target.id });
      return;
    }
    const actual = target.currentTeam === self.currentTeam;
    const noisy = self.status.poisoned || self.status.drunk || self.status.mad;
    const reported = noisy ? !actual : actual;
    pushObservation(self, { type: "mike-pair", night: state.night, targetId: target.id, sameTeam: reported });
    state.log.push({
      phase: "night", night: state.night, type: "mike-team",
      actor: self.id, target: target.id, detail: reported ? "same" : "diff",
    });
  },
};

// ═══════════════ МАКС ═══════════════
// Чисто пассивная роль: иммунитет обрабатывается в death.tryKill().
export const maxHandler: RoleHandler = { id: "max" };

// ═══════════════ ЛУКАС ═══════════════
// Узнаёт: был ли target целью активной злой способности этой ночью.
export const lucasHandler: RoleHandler = {
  id: "lucas",
  otherNight(self, state) {
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "lucas-check");
    if (!target) return;
    self.status.wokeThisNight = true;
    const actual = (target.memory as { targetedByEvil?: boolean }).targetedByEvil === true;
    const noisy = self.status.poisoned || self.status.drunk || self.status.mad;
    const reported = noisy ? !actual : actual;
    pushObservation(self, { type: "lucas-targeted", night: state.night, targetId: target.id, wasTargeted: reported });
    state.log.push({
      phase: "night", night: state.night, type: "lucas-check",
      actor: self.id, target: target.id, detail: reported ? "yes" : "no",
    });
  },
};

// ═══════════════ МЮРРЕЙ ═══════════════
// Первая ночь: показывается пара (один приспешник + один добрый, или наоборот — «минимум один злой»).
export const murrayHandler: RoleHandler = {
  id: "murray",
  firstNight(self, state) {
    const minions = state.players.filter((p) => p.category === "minion" && p.id !== self.id);
    const goods = state.players.filter((p) => p.id !== self.id && p.currentTeam === "good" && p.role.id !== "yuri");
    if (minions.length === 0 || goods.length === 0) return;
    const minion = state.rng.pick(minions);
    const decoy = state.rng.pick(goods);
    self.status.wokeThisNight = true;
    pushObservation(self, { type: "murray-pair", night: 1, a: minion.id, b: decoy.id });
    state.log.push({
      phase: "night", night: 1, type: "murray-pair",
      actor: self.id, detail: `${minion.name}, ${decoy.name}`,
    });
  },
};

// ═══════════════ СЮЗИ ═══════════════
// Называет игрока и роль; узнаёт, совпадает или нет.
export const suzyHandler: RoleHandler = {
  id: "suzy",
  otherNight(self, state) {
    const candidates = livePlayers(state).filter((p) => p.id !== self.id);
    const target = self.brain.pickTarget(state, self, candidates, "suzy-check");
    if (!target) return;
    const guess = state.rng.pick(state.players).role.id;
    self.status.wokeThisNight = true;
    const actual = target.role.id === guess;
    const noisy = self.status.poisoned || self.status.drunk || self.status.mad;
    const reported = noisy ? !actual : actual;
    pushObservation(self, { type: "suzy-guess", night: state.night, targetId: target.id, guessRole: guess, correct: reported });
    state.log.push({
      phase: "night", night: state.night, type: "suzy-check",
      actor: self.id, target: target.id,
      detail: `guess=${guess}, answer=${reported ? "yes" : "no"}`,
    });
  },
};

// ═══════════════ ЭДДИ ═══════════════
export const eddieHandler: RoleHandler = {
  id: "eddie",
  otherNight(self, state) {
    if (self.oneshotUsed) return;
    if (self.status.poisoned || self.status.drunk) return;
    // Simple AI: редко объявляет Концерт (10%) на поздних ночах
    if (state.night < 3) return;
    if (!state.rng.bool(0.15)) return;

    self.oneshotUsed = true;
    self.status.wokeThisNight = true;
    state.eddieConcertNight = state.night;
    state.log.push({ phase: "night", night: state.night, type: "eddie-concert", actor: self.id });
    // Смерть Эдди — в конце ночной kill-phase
  },
};

export function resolveEddieConcert(state: GameState): void {
  if (state.eddieConcertNight !== state.night) return;
  const eddie = state.players.find((p) => p.role.id === "eddie" && p.status.alive);
  if (!eddie) return;
  killPlayer(state, eddie, { kind: "concert" });
}
