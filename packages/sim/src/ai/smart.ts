import type { Brain, GameState, Observation, Player, RoleId } from "@botc/core";
import { getObservations, ROLES } from "@botc/core";

/**
 * Smart AI (v0.2): строит матрицу подозрений на основе ночных observations,
 * использует её для выбора целей, номинаций и голосования.
 *
 * Evil-игроки:
 *   - знают своих (suspicion = 0 друг для друга),
 *   - защищают демона от голосований,
 *   - приоритизируют атаки на инфо-роли публики,
 *   - слабо номинируют — чтобы не выдавать себя.
 *
 * Good-игроки:
 *   - обновляют suspicion из наблюдений,
 *   - охотно номинируют/голосуют против top-suspect,
 *   - защитники прикрывают инфо-роли,
 *   - редко стреляют из Оди вне паники.
 */

/** Базовое значение подозрения «нейтрально» (для добрых). */
const BASE = 0.3;

/** Инфо-роли — приоритет для защиты/атаки. Первые — самые важные. */
const INFO_ROLE_PRIORITY: RoleId[] = [
  "robin", "joyce", "mike", "suzy", "dustin", "lucas", "murray", "nancy",
];

type Suspicion = Map<number, number>;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Сдвиг значения к target с весом 0..1 (1 = полностью заменить). */
function shiftTo(map: Suspicion, id: number, target: number, weight: number): void {
  const cur = map.get(id) ?? BASE;
  map.set(id, clamp01(cur * (1 - weight) + target * weight));
}

function bump(map: Suspicion, id: number, delta: number): void {
  const cur = map.get(id) ?? BASE;
  map.set(id, clamp01(cur + delta));
}

/** Приватная матрица — только собственные наблюдения self. Для выбора ночных целей. */
function buildPrivateSuspicion(state: GameState, self: Player): Suspicion {
  const map: Suspicion = new Map();
  for (const p of state.players) {
    if (p.id === self.id) map.set(p.id, 0);
    else if (self.currentTeam === "evil" && p.currentTeam === "evil") map.set(p.id, 0);
    else map.set(p.id, BASE);
  }
  if (self.currentTeam !== "good") return map;
  for (const o of getObservations(self)) applyObservation(map, o);
  return map;
}

/**
 * Публичная матрица — агрегация observations всех живых добрых (упрощённая модель claim-round).
 * В реальной партии добрые публично делятся инфой и доверяют друг другу.
 * Для злых возвращает их приватный взгляд + флаги своих.
 */
function buildPublicSuspicion(state: GameState, viewer: Player): Suspicion {
  const map: Suspicion = new Map();
  for (const p of state.players) map.set(p.id, BASE);

  // Мёртвые добрые до своей смерти публично делились инфой (клеймы) —
  // их observations продолжают влиять на коллективное мнение.
  // Юрий исключён: его команда может крутиться, инфа ненадёжна.
  const goodies = state.players.filter(
    (p) => p.currentTeam === "good" && p.role.id !== "yuri"
  );
  for (const g of goodies) {
    for (const o of getObservations(g)) applyObservation(map, o);
  }

  if (viewer.currentTeam === "evil") {
    for (const p of state.players) {
      if (p.currentTeam === "evil") map.set(p.id, 0);
    }
  }
  map.set(viewer.id, 0);
  return map;
}

function applyObservation(map: Suspicion, o: Observation): void {
  switch (o.type) {
    case "robin-read":
      if (o.reportedDemon) shiftTo(map, o.targetId, 0.97, 0.92);
      else shiftTo(map, o.targetId, 0.12, 0.55);
      break;

    case "mike-pair":
      // Self добрый → same=target тоже добрый, diff=target скорее всего злой.
      if (o.sameTeam) shiftTo(map, o.targetId, 0.15, 0.55);
      else shiftTo(map, o.targetId, 0.85, 0.55);
      break;

    case "murray-pair":
      // Минимум 1 из 2 — миньон.
      bump(map, o.a, 0.22);
      bump(map, o.b, 0.22);
      break;

    case "nancy-pair":
      // Один из двух — миньон (guessedRole = роль «возможного» миньона).
      bump(map, o.a, 0.22);
      bump(map, o.b, 0.22);
      break;

    case "joyce-mark":
      // Сама по себе метка не указывает на зло. Но если метка есть — игрок в фокусе демона:
      // скорее добрый (демон метит ценные цели).
      if (o.hasMark) shiftTo(map, o.targetId, 0.2, 0.2);
      break;

    case "suzy-guess": {
      if (!o.correct) break;
      const cat = ROLES[o.guessRole].category;
      if (cat === "demon" || cat === "minion") shiftTo(map, o.targetId, 0.97, 0.92);
      else shiftTo(map, o.targetId, 0.08, 0.7);
      break;
    }

    case "lucas-targeted":
      // Был под активной злой способностью — скорее всего добрый.
      if (o.wasTargeted) shiftTo(map, o.targetId, 0.12, 0.35);
      break;

    case "dustin-side":
      // Демон ближе с этой стороны — сосед под подозрением.
      bump(map, o.neighborId, 0.12);
      break;
  }
}

function susp(map: Suspicion, id: number): number {
  return map.get(id) ?? BASE;
}

function sortByPriority(list: Player[], roleOrder: RoleId[]): Player[] {
  return [...list].sort((a, b) => {
    const ai = roleOrder.indexOf(a.role.id);
    const bi = roleOrder.indexOf(b.role.id);
    const aa = ai < 0 ? 99 : ai;
    const bb = bi < 0 ? 99 : bi;
    return aa - bb;
  });
}

function pickMostSuspicious(candidates: Player[], map: Suspicion): Player | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => susp(map, b.id) - susp(map, a.id))[0] ?? null;
}

function pickLeastSuspicious(candidates: Player[], map: Suspicion): Player | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => susp(map, a.id) - susp(map, b.id))[0] ?? null;
}

// ───────── Good: выбор ночной цели ─────────
function pickGoodNightTarget(
  state: GameState,
  self: Player,
  candidates: Player[],
  map: Suspicion
): Player | null {
  if (candidates.length === 0) return null;

  switch (self.role.id) {
    case "hopper":
    case "steve": {
      // Защищаем инфо-роль с наименьшим подозрением (больше шанс что она добрая и полезная).
      const byPriority = sortByPriority(candidates, INFO_ROLE_PRIORITY);
      const top = byPriority.find((p) => INFO_ROLE_PRIORITY.includes(p.role.id) && susp(map, p.id) < 0.6);
      if (top) return top;
      return pickLeastSuspicious(candidates, map);
    }
    case "robin":
    case "joyce":
    case "mike":
    case "lucas":
    case "suzy":
    case "eleven":
      return pickMostSuspicious(candidates, map);

    default:
      return state.rng.pick(candidates);
  }
}

// ───────── Evil: выбор ночной цели ─────────
function pickEvilNightTarget(
  state: GameState,
  self: Player,
  candidates: Player[],
  _map: Suspicion
): Player | null {
  if (candidates.length === 0) return null;
  const evilIds = new Set(state.players.filter((p) => p.currentTeam === "evil").map((p) => p.id));
  const nonEvil = candidates.filter((c) => !evilIds.has(c.id));
  const pool = nonEvil.length > 0 ? nonEvil : candidates;

  switch (self.role.id) {
    case "vecna": {
      // Метить инфо-роль, но не Макс (иммунна) и не уже помеченных.
      const viable = pool.filter((p) => p.role.id !== "max" && p.status.marks === 0);
      const base = viable.length > 0 ? viable : pool;
      return sortByPriority(base, INFO_ROLE_PRIORITY)[0] ?? state.rng.pick(base);
    }
    case "mindflayer":
      return sortByPriority(pool, ["hopper", "steve", ...INFO_ROLE_PRIORITY])[0] ?? state.rng.pick(pool);

    case "whatsit": {
      // Переманивать townsfolk — желательно инфо-роль, чтобы лишить добро инфы.
      const townsfolk = pool.filter((p) => p.category === "townsfolk");
      const base = townsfolk.length > 0 ? townsfolk : pool;
      return sortByPriority(base, INFO_ROLE_PRIORITY)[0] ?? state.rng.pick(base);
    }
    case "grigori":
      return sortByPriority(pool, ["hopper", "steve", "robin", "joyce", "mike", "suzy"])[0] ?? state.rng.pick(pool);

    case "demogorgon":
    case "billy":
    case "brenner":
    default:
      return state.rng.pick(pool);
  }
}

export function createSmartBrain(): Brain {
  return {
    pickTarget(state, self, candidates, _reason) {
      if (candidates.length === 0) return null;
      // Ночные цели — по приватной инфе (Robin читает своего top-suspect).
      const map = buildPrivateSuspicion(state, self);
      return self.currentTeam === "evil"
        ? pickEvilNightTarget(state, self, candidates, map)
        : pickGoodNightTarget(state, self, candidates, map);
    },

    pickNominee(state, self, candidates) {
      const pool = candidates.filter((c) => c.id !== self.id);
      if (pool.length === 0) return null;
      // Номинации — по публичной инфе (клеймы).
      const map = buildPublicSuspicion(state, self);

      if (self.currentTeam === "evil") {
        // Злые редко номинируют, никогда — своих, чтобы не светиться.
        if (!state.rng.bool(0.05)) return null;
        const nonEvil = pool.filter((c) => c.currentTeam !== "evil");
        if (nonEvil.length === 0) return null;
        // Номинируем «самого доверенного добропорядочного» (чтобы публика его казнила).
        return [...nonEvil].sort((a, b) => susp(map, a.id) - susp(map, b.id))[0] ?? null;
      }

      // Добрые — только при явных подозрениях.
      const top = pickMostSuspicious(pool, map);
      if (!top) return null;
      const s = susp(map, top.id);
      if (s < 0.6) return null;
      const chance = 0.35 + (s - 0.6) * 1.0; // 0.35 → 0.75
      return state.rng.bool(Math.max(0.1, Math.min(0.9, chance))) ? top : null;
    },

    voteOnNomination(state, self, nominee) {
      if (self.id === nominee.id) return false;
      // Голосования — по публичной инфе.
      const map = buildPublicSuspicion(state, self);
      const live = state.players.filter((p) => p.status.alive).length;
      const panic = Math.max(0, 1 - live / state.players.length);

      if (self.currentTeam === "evil") {
        if (nominee.currentTeam === "evil") return false;
        // За казнь добрых голосуем умеренно, чтобы не спалить координацию.
        return state.rng.bool(0.5);
      }

      const s = susp(map, nominee.id);
      // Пороговая модель: без сильного подозрения добрые почти не голосуют.
      let chance: number;
      if (s < 0.45) chance = 0.03 + panic * 0.1;
      else if (s < 0.7) chance = 0.25 + (s - 0.45) * 1.6 + panic * 0.15;
      else chance = 0.65 + (s - 0.7) * 1.0 + panic * 0.1;
      return state.rng.bool(Math.max(0.01, Math.min(0.95, chance)));
    },

    trustLevel(state, self, other) {
      if (self.id === other.id) return 1;
      if (self.currentTeam === "evil" && other.currentTeam === "evil") return 1;
      const map = buildPublicSuspicion(state, self);
      return clamp01(1 - susp(map, other.id));
    },
  };
}
