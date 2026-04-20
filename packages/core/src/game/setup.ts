import type { Brain, DemonId, GameConfig, GameState, Player, Role, SetupPlan } from "../types";
import { ROLES, rolesByCategory } from "../roles/registry";
import { adjustForBrenner, adjustForDemon, baseSetup } from "../config";
import { createRng } from "../rng";
import { createRandomBrain } from "../ai-null";

/**
 * Собирает стартовый GameState по конфигу:
 * - выбирает раскладку,
 * - отбирает конкретных 25 ролей,
 * - создаёт игроков,
 * - назначает AI-мозги,
 * - инициализирует приватное состояние ролей (setup-хуки вызываются в engine после).
 */
export function setupGame(config: GameConfig): GameState {
  const rng = createRng(config.seed);
  const plan = adjustForDemon(baseSetup(config.players), config.demon, config.players);

  const { roles: picked, finalPlan } = pickRoles(plan, config.demon, rng);
  const brainFactory: () => Brain = config.brainFactory ?? createRandomBrain;
  const players = createPlayers(picked, brainFactory);

  const state: GameState = {
    config,
    players,
    night: 0,
    day: 0,
    vecnaEscalation: 0,
    steveCooldown: false,
    hopperPenalty: false,
    eddieConcertNight: null,
    convertedCount: 0,
    whatsitClaim: null,
    rng,
    log: [
      {
        phase: "setup",
        type: "composition",
        detail: `${finalPlan.townsfolk}Ж / ${finalPlan.outsiders}И / ${finalPlan.minions}П / ${finalPlan.demons}Д · demon=${config.demon}`,
      },
    ],
    winner: null,
    winReason: null,
  };

  // Все seat-ы задаются по порядку id — это «круглый стол».
  return state;
}

function pickRoles(
  plan: SetupPlan,
  demon: DemonId,
  rng: ReturnType<typeof createRng>
): { roles: Role[]; finalPlan: SetupPlan } {
  const townsfolkPool = rolesByCategory("townsfolk");
  const outsidersPool = rolesByCategory("outsider");
  const minionsPool = rolesByCategory("minion");

  let finalPlan = plan;

  // Сначала выбираем приспешников (чтобы учесть Бреннера)
  const minions = rng.sample(minionsPool, finalPlan.minions);
  if (minions.some((r) => r.id === "brenner")) {
    finalPlan = adjustForBrenner(finalPlan);
  }

  const townsfolk = rng.sample(townsfolkPool, finalPlan.townsfolk);
  const outsiders = rng.sample(outsidersPool, finalPlan.outsiders);

  const picked: Role[] = [];
  picked.push(...townsfolk, ...outsiders, ...minions, ROLES[demon]);

  const expected = finalPlan.townsfolk + finalPlan.outsiders + finalPlan.minions + finalPlan.demons;
  if (picked.length !== expected) {
    throw new Error(`Setup size mismatch: picked ${picked.length}, expected ${expected}`);
  }

  return { roles: rng.shuffle(picked), finalPlan };
}

function createPlayers(roles: Role[], brainFactory: () => Brain): Player[] {
  return roles.map((role, i) => {
    const brain = brainFactory();
    return {
      id: i,
      seat: i,
      name: `P${i + 1}`,
      role,
      category: role.category,
      currentTeam: role.team,
      status: {
        alive: true,
        poisoned: false,
        drunk: false,
        mad: false,
        marks: 0,
        marksPlacedTonight: 0,
        savedThisNight: false,
        lastSaveSource: null,
        invertedTonight: false,
        poisonedByBilly: false,
        wokeThisNight: false,
        protectedTonight: false,
      },
      oneshotUsed: false,
      memory: {},
      brain,
    };
  });
}
