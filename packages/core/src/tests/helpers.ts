import type {
  Brain, DemonId, GameConfig, GameState, Player, RoleId,
} from "../types";
import { ROLES } from "../roles/registry";
import { createRng } from "../rng";
import { createRandomBrain } from "../ai-null";

/**
 * Тестовая фабрика: детерминированно собирает партию с заданными ролями.
 * Первый игрок в массиве — seat 1, последний — seat N. Демон определяется автоматически.
 */
export function makeTestState(
  roleIds: RoleId[],
  opts: { seed?: number; dayLimit?: number } = {}
): GameState {
  const demonRole = roleIds.find((id) => ROLES[id].category === "demon");
  if (!demonRole) throw new Error("Need at least one demon in the composition");
  const demon = demonRole as DemonId;

  const config: GameConfig = {
    players: roleIds.length,
    demon,
    seed: opts.seed ?? 0,
    verbose: false,
    dayLimit: opts.dayLimit ?? 30,
  };

  const rng = createRng(config.seed);

  const players: Player[] = roleIds.map((id, i) => {
    const role = ROLES[id];
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
      brain: createRandomBrain(),
    };
  });

  return {
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
    log: [],
    winner: null,
    winReason: null,
  };
}

export function getByRole(state: GameState, roleId: RoleId): Player {
  const p = state.players.find((pl) => pl.role.id === roleId);
  if (!p) throw new Error(`No player with role ${roleId}`);
  return p;
}

/**
 * Скриптовый мозг: фиксирует решения игрока в тесте.
 * pickTarget по умолчанию возвращает первого кандидата.
 */
export function scriptBrain(
  player: Player,
  spec: {
    target?: (candidates: Player[]) => Player | null;
    nominee?: (candidates: Player[]) => Player | null;
    vote?: (nominee: Player) => boolean;
    trust?: (other: Player) => number;
  } = {}
): void {
  const brain: Brain = {
    pickTarget: (_s, _self, candidates) =>
      spec.target ? spec.target(candidates) : candidates[0] ?? null,
    pickNominee: (_s, _self, candidates) =>
      spec.nominee ? spec.nominee(candidates) : null,
    voteOnNomination: (_s, _self, nominee) =>
      spec.vote ? spec.vote(nominee) : false,
    trustLevel: (_s, _self, other) => (spec.trust ? spec.trust(other) : 0.5),
  };
  player.brain = brain;
}

/** Сокращение: заставить actor выбирать target указанной роли. */
export function targetByRole(actor: Player, targetRoleId: RoleId, state: GameState): void {
  scriptBrain(actor, {
    target: () => getByRole(state, targetRoleId),
  });
}
