import type { RoleHandler, Player, GameState } from "../../types";
import { killPlayer, tryKill } from "../../game/death";
import { livePlayers, pickLiveOther, targetWithRedirect } from "../../game/util";

// ═══════════════ ВЕКНА ═══════════════
export const vecnaHandler: RoleHandler = {
  id: "vecna",

  firstNight(vecna, state) {
    placeMark(vecna, state);
  },

  otherNight(vecna, state) {
    // Ночью сначала срабатывают СТАРЫЕ метки (поставленные прошлой ночью)
    // — это реализовано в ночном порядке как «killPhase». Тут только вешаем новую.
    placeMark(vecna, state);
  },
};

function placeMark(vecna: Player, state: GameState): void {
  const candidates = state.players.filter((p) => p.status.alive && p.id !== vecna.id);
  const target = targetWithRedirect(state, vecna, vecna.brain.pickTarget(state, vecna, candidates, "vecna-mark"));
  if (!target) return;

  // При отравлении/опьянении Векны — метка в молоко (ведущий решает).
  if (vecna.status.poisoned || vecna.status.drunk) {
    state.log.push({ phase: "night", night: state.night, type: "vecna-mark-missed", actor: vecna.id });
    return;
  }
  target.status.marks += 1;
  target.status.marksPlacedTonight += 1;
  target.status.wokeThisNight = true;
  vecna.status.wokeThisNight = true;
  state.log.push({
    phase: "night",
    night: state.night,
    type: "vecna-mark",
    actor: vecna.id,
    target: target.id,
  });
}

/**
 * Kill-phase Векны: срабатывают только «старые» метки (поставленные в предыдущую ночь или раньше).
 * `marksPlacedTonight` — счётчик меток этой ночи, они пока НЕ активны.
 */
export function resolveVecnaMarks(state: GameState): void {
  const vecna = state.players.find((p) => p.role.id === "vecna");
  if (!vecna) return;

  // Работаем только с игроками, у кого есть хотя бы одна «старая» метка.
  const marked = state.players.filter(
    (p) => p.status.alive && p.status.marks - p.status.marksPlacedTonight > 0
  );

  for (const p of marked) {
    if (p.status.protectedTonight) {
      p.status.marks -= 1;
      state.log.push({ phase: "night", night: state.night, type: "vecna-mark-saved", target: p.id });
      if (p.status.savedThisNight && p.status.lastSaveSource === "demon") {
        state.hopperPenalty = true;
      }
      continue;
    }

    // Макс иммунна — метка гасится без смерти, эскалации нет.
    if (p.role.id === "max") {
      p.status.marks -= 1;
      state.log.push({ phase: "night", night: state.night, type: "vecna-mark-miss-max", target: p.id });
      continue;
    }

    const killed = tryKill(state, p, { kind: "mark-escalation" });
    if (killed) {
      p.status.marks -= 1;
      state.vecnaEscalation += 1;
      applyEscalation(state);
    }
  }
}

function applyEscalation(state: GameState): void {
  const n = state.vecnaEscalation;
  if (n === 4) {
    state.winner = "evil";
    state.winReason = `Векна: 4 смерти с активной Меткой → автопобеда зла`;
  }
  // Эффекты тиеров 1..3 (отравление, безумие, no-vote) применяются к игрокам с активными метками
  // в момент их проверки — делается в ночной обработке и дневной фазе.
}

// ═══════════════ ИСТЯЗАТЕЛЬ ═══════════════
export const mindflayerHandler: RoleHandler = {
  id: "mindflayer",

  otherNight(demon, state) {
    demon.status.wokeThisNight = true;
    if (demon.status.poisoned || demon.status.drunk) {
      state.log.push({ phase: "night", night: state.night, type: "mindflayer-poisoned", actor: demon.id });
      return;
    }

    // Выбор действия: простой ИИ — «травить новую цель, если ещё нет 3+ отравленных, иначе — цепная»
    const currentPoisonedCount = state.players.filter((p) => p.status.alive && p.status.poisoned).length;
    const goCascade = currentPoisonedCount >= 2 && state.rng.bool(0.6);

    if (goCascade) {
      // Цепная смерть
      const victims = state.players.filter((p) => p.status.alive && p.status.poisoned);
      state.log.push({ phase: "night", night: state.night, type: "mindflayer-cascade", actor: demon.id, detail: `${victims.length} жертв` });
      for (const v of victims) {
        if (v.status.protectedTonight) continue;
        if (v.role.id === "max") continue; // иммунитет
        tryKill(state, v, { kind: "demon-chain", byRole: "mindflayer" });
      }
    } else {
      const candidates = state.players.filter((p) => p.status.alive && p.id !== demon.id && !p.status.poisoned);
      const target = targetWithRedirect(state, demon, demon.brain.pickTarget(state, demon, candidates, "mindflayer-poison"));
      if (!target) return;
      target.status.poisoned = true;
      target.status.wokeThisNight = true;
      state.log.push({ phase: "night", night: state.night, type: "mindflayer-poison", actor: demon.id, target: target.id });
    }
  },
};

// ═══════════════ МИСТЕР ЭТОСАМОЕ ═══════════════
export const whatsitHandler: RoleHandler = {
  id: "whatsit",

  otherNight(demon, state) {
    demon.status.wokeThisNight = true;
    if (demon.status.poisoned || demon.status.drunk) return;
    const candidates = state.players.filter((p) => p.status.alive && p.currentTeam === "good");
    const target = targetWithRedirect(state, demon, demon.brain.pickTarget(state, demon, candidates, "whatsit-convert"));
    if (!target) return;

    // Переманивание: команда меняется на злую до конца игры.
    target.currentTeam = "evil";
    target.status.wokeThisNight = true;
    state.convertedCount += 1;

    // Юрий: цикл смены команды останавливается
    if (target.role.id === "yuri") {
      (target.memory as { yuriFrozen?: boolean }).yuriFrozen = true;
    }

    state.log.push({
      phase: "night",
      night: state.night,
      type: "whatsit-convert",
      actor: demon.id,
      target: target.id,
      detail: `${target.role.ruName} переманен`,
    });
  },
};

/**
 * Дневной триггер: Мистер Этосамое публично объявляет победу.
 * Простое AI-решение: объявлять, как только количество живых злых ≥ живых добрых.
 */
export function checkWhatsitWinAnnouncement(state: GameState): void {
  const demon = state.players.find((p) => p.role.id === "whatsit" && p.status.alive);
  if (!demon) return;

  const liveEvil = state.players.filter((p) => p.status.alive && p.currentTeam === "evil").length;
  const liveGood = state.players.filter((p) => p.status.alive && p.currentTeam === "good").length;

  if (liveEvil >= liveGood) {
    state.winner = "evil";
    state.winReason = `Мистер Этосамое объявил победу: ${liveEvil}Z ≥ ${liveGood}D`;
    state.whatsitClaim = "resolved-win";
    state.log.push({
      phase: "day",
      day: state.day,
      type: "whatsit-victory",
      actor: demon.id,
      detail: `${liveEvil} злых vs ${liveGood} добрых`,
    });
  }
  // В «smart» режиме AI может решить ещё подождать. В simple — объявляет при первой возможности.
}
