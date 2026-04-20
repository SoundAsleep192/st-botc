import type { DemonId, SetupPlan } from "./types";

/**
 * Базовые раскладки по числу игроков. Для нестандартного сетапа
 * (Бреннер +1 Изгой, Мистер Этосамое — 0 Приспешников) — корректируем после.
 */
export function baseSetup(players: number): SetupPlan {
  // В Trouble Brewing: 7→5/0/1/1; 8→5/1/1/1; 9→5/2/1/1; 10→7/0/2/1; ...
  // У нас 13 Townsfolk / 5 Outsiders / 4 Minions / 3 Demons. Разложим по TB-стилю:
  switch (players) {
    case 5:  return { townsfolk: 3, outsiders: 0, minions: 1, demons: 1 };
    case 6:  return { townsfolk: 3, outsiders: 1, minions: 1, demons: 1 };
    case 7:  return { townsfolk: 5, outsiders: 0, minions: 1, demons: 1 };
    case 8:  return { townsfolk: 5, outsiders: 1, minions: 1, demons: 1 };
    case 9:  return { townsfolk: 5, outsiders: 2, minions: 1, demons: 1 };
    case 10: return { townsfolk: 7, outsiders: 0, minions: 2, demons: 1 };
    case 11: return { townsfolk: 7, outsiders: 1, minions: 2, demons: 1 };
    case 12: return { townsfolk: 7, outsiders: 2, minions: 2, demons: 1 };
    case 13: return { townsfolk: 9, outsiders: 0, minions: 3, demons: 1 };
    case 14: return { townsfolk: 9, outsiders: 1, minions: 3, demons: 1 };
    case 15: return { townsfolk: 9, outsiders: 2, minions: 3, demons: 1 };
    default:
      throw new Error(`Unsupported player count: ${players}. Use 5–15.`);
  }
}

/**
 * Корректировка состава под выбранного демона.
 * - whatsit: 0 Приспешников, их слоты переезжают в Жителей (крупный стол — частично в Изгои).
 * - vecna / mindflayer: без изменений.
 */
export function adjustForDemon(plan: SetupPlan, demon: DemonId, players: number): SetupPlan {
  if (demon !== "whatsit") return plan;

  const freedSlots = plan.minions;
  if (players >= 12) {
    return {
      demons: plan.demons,
      minions: 0,
      outsiders: plan.outsiders + 1,
      townsfolk: plan.townsfolk + (freedSlots - 1),
    };
  }
  return {
    demons: plan.demons,
    minions: 0,
    outsiders: plan.outsiders,
    townsfolk: plan.townsfolk + freedSlots,
  };
}

/**
 * Корректировка под Бреннера: +1 Изгой, −1 Житель.
 * Применяется ТОЛЬКО если Бреннер реально попал в состав приспешников.
 */
export function adjustForBrenner(plan: SetupPlan): SetupPlan {
  return {
    ...plan,
    townsfolk: plan.townsfolk - 1,
    outsiders: plan.outsiders + 1,
  };
}
