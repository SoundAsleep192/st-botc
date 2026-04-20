// Глобальные типы симулятора. Всё строгое, никаких any.

export type Team = "good" | "evil";

export type Category = "townsfolk" | "outsider" | "minion" | "demon";

export type DemonId = "vecna" | "mindflayer" | "whatsit";

export type RoleId =
  // townsfolk
  | "eleven" | "hopper" | "steve" | "robin" | "nancy" | "dustin" | "joyce"
  | "mike" | "max" | "lucas" | "murray" | "suzy" | "eddie"
  // outsiders
  | "will" | "ted" | "yuri" | "alexei" | "barb"
  // minions
  | "billy" | "brenner" | "grigori" | "demogorgon"
  // demons
  | DemonId;

export interface Role {
  id: RoleId;
  name: string;
  ruName: string;
  category: Category;
  /** Команда по «разряду». У Юрия = outsider/good, хотя фактически меняется. */
  team: Team;
  /** Позиция в первой ночи (0 — не действует). */
  firstNight: number;
  /** Позиция в остальных ночах (0 — не действует). */
  otherNight: number;
  /** Однократная дневная/ночная способность? */
  oneshot?: boolean;
}

export interface RoleHandler {
  id: RoleId;
  /** Вызывается при составлении партии (например, у Алексея — выбрать отравляемого соседа). */
  onSetup?(player: Player, state: GameState): void;
  /** Ночные способности. Если в партии первая ночь — выбирается firstNight. */
  firstNight?(player: Player, state: GameState): void;
  otherNight?(player: Player, state: GameState): void;
  /** Реакция на смерть этого игрока (Барб отравляет; триггер эскалации Векны и т.п.). */
  onDeath?(player: Player, state: GameState, cause: DeathCause): void;
  /** Реакция на то, что этот игрок стал целью активной злой способности (Уилл, Тед). */
  onTargeted?(player: Player, state: GameState, byRole: RoleId, effect: TargetEffect): void;
}

export type TargetEffect =
  | "kill"
  | "mark"
  | "poison"
  | "block"
  | "invert"
  | "convert";

export type DeathCause =
  | { kind: "vote" }
  | { kind: "demon-direct"; byRole: RoleId }
  | { kind: "mark-escalation" }
  | { kind: "demon-chain"; byRole: RoleId }
  | { kind: "minion"; byRole: RoleId }
  | { kind: "chain-from-death"; byRole: RoleId }
  | { kind: "concert" }
  | { kind: "oneshot-eleven" }
  | { kind: "madness-violation" };

export interface PlayerStatus {
  alive: boolean;
  poisoned: boolean;
  drunk: boolean;
  mad: boolean;
  /** Количество Меток Векны (все, вне зависимости от свежести). */
  marks: number;
  /** Из `marks` — сколько поставлено именно этой ночью (срабатывают только со след. ночи). */
  marksPlacedTonight: number;
  /** Был ли спасён в эту ночь (для триггера штрафа Хоппера). */
  savedThisNight: boolean;
  /** Источник последнего сохранения для штрафа (demon / other). */
  lastSaveSource: "demon" | "other" | null;
  /** Был ли Билли-инверсирован в эту ночь. */
  invertedTonight: boolean;
  /** Протравлен Билли-инверсией (до следующей ночи). */
  poisonedByBilly: boolean;
  /** Для Оди: «просыпался ли этой ночью» — ведут все ночные действия. */
  wokeThisNight: boolean;
  /** Защищён ли этой ночью (любой защитой). */
  protectedTonight: boolean;
}

export interface Player {
  id: number;
  seat: number;
  name: string;
  role: Role;
  /** Команда «по разряду» — у Юрия всегда outsider, но currentTeam меняется ночью. */
  category: Category;
  /** Текущая команда для проверок и условий победы. */
  currentTeam: Team;
  status: PlayerStatus;
  /** Использована ли одноразовая способность. */
  oneshotUsed: boolean;
  /** Приватные данные, нужные конкретной роли (цели, счётчики и т.п.). */
  memory: Record<string, unknown>;
  /** AI-"мозг". */
  brain: Brain;
  /** Известная роль-клейм (что игрок публично заявляет). */
  claim?: RoleId;
}

export interface GameConfig {
  players: number;
  demon: DemonId;
  seed: number;
  verbose: boolean;
  /** Максимум дней до ничьей (защита от бесконечного цикла). */
  dayLimit: number;
  /**
   * Фабрика AI-мозгов. Если не задана — используется `createRandomBrain` из core.
   * Конкретные стратегии (simple / smart) живут в пакете `@botc/sim`.
   */
  brainFactory?: () => Brain;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  night: number;
  day: number;
  /** Счётчик эскалации Векны: сколько игроков с активной Меткой умерло. */
  vecnaEscalation: number;
  /** Кулдаун Стива: «пропустить следующую ночь». */
  steveCooldown: boolean;
  /** Штраф Хоппера: «следующей ночью умирает». */
  hopperPenalty: boolean;
  /** Отмеченная ночь для Концерта Эдди. Null — ещё не объявлено. */
  eddieConcertNight: number | null;
  /** Счётчик переманенных (Этосамое) — для статистики. */
  convertedCount: number;
  /** Кто объявил что он Этосамое днём: результат проверки. */
  whatsitClaim: "pending" | "resolved-win" | "resolved-loss" | null;
  rng: RNG;
  log: LogEvent[];
  winner: Team | null;
  winReason: string | null;
}

export interface LogEvent {
  phase: "setup" | "night" | "day";
  night?: number;
  day?: number;
  type: string;
  actor?: number;
  target?: number;
  /** Пояснение для лога. */
  detail?: string;
}

export interface RNG {
  next(): number;
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  pickMaybe<T>(arr: readonly T[]): T | undefined;
  sample<T>(arr: readonly T[], n: number): T[];
  shuffle<T>(arr: readonly T[]): T[];
  bool(p?: number): boolean;
  seed: number;
}

/** Базовый интерфейс AI. Роли обращаются к brain'у, когда нужен выбор цели, голоса и т.п. */
export interface Brain {
  pickTarget(state: GameState, self: Player, candidates: Player[], reason: string): Player | null;
  pickNominee(state: GameState, self: Player, candidates: Player[]): Player | null;
  voteOnNomination(state: GameState, self: Player, nominee: Player): boolean;
  /** Для злых: чей блеф/заявление подтверждать; для добрых — кому верить. */
  trustLevel(state: GameState, self: Player, other: Player): number;
}

export interface SetupPlan {
  townsfolk: number;
  outsiders: number;
  minions: number;
  demons: number;
}

/**
 * Наблюдения, которые инфо-роли записывают в `self.memory.observations`.
 * Smart AI читает их для построения матрицы подозрений.
 * Инфа хранится В ТОМ ВИДЕ, в котором её получил игрок (т.е. с возможной инверсией от отравления/Билли).
 */
export type Observation =
  | { type: "robin-read"; night: number; targetId: number; reportedDemon: boolean }
  | { type: "mike-pair"; night: number; targetId: number; sameTeam: boolean }
  | { type: "murray-pair"; night: number; a: number; b: number }
  | { type: "nancy-pair"; night: number; a: number; b: number; guessedRole: RoleId }
  | { type: "joyce-mark"; night: number; targetId: number; hasMark: boolean }
  | { type: "suzy-guess"; night: number; targetId: number; guessRole: RoleId; correct: boolean }
  | { type: "lucas-targeted"; night: number; targetId: number; wasTargeted: boolean }
  | { type: "dustin-side"; night: number; neighborId: number };
