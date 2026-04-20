import type { DemonId, GameState, Team } from "@botc/core";

export interface BatchResult {
  games: number;
  goodWins: number;
  evilWins: number;
  byDemon: Record<DemonId, { games: number; goodWins: number; evilWins: number }>;
  byReason: Record<string, number>;
  /** Средняя длина партии в днях. */
  avgDays: number;
  /** Распределение длин (дни → количество партий). */
  dayDistribution: Record<number, number>;
  /** Для каждой роли: сколько партий выиграла её команда, когда роль присутствовала. */
  roleWinrate: Record<string, { games: number; wins: number }>;
}

export function emptyBatchResult(): BatchResult {
  return {
    games: 0,
    goodWins: 0,
    evilWins: 0,
    byDemon: {
      vecna: { games: 0, goodWins: 0, evilWins: 0 },
      mindflayer: { games: 0, goodWins: 0, evilWins: 0 },
      whatsit: { games: 0, goodWins: 0, evilWins: 0 },
    },
    byReason: {},
    avgDays: 0,
    dayDistribution: {},
    roleWinrate: {},
  };
}

export function addGame(result: BatchResult, state: GameState): void {
  result.games += 1;
  const winner: Team = state.winner ?? "good"; // если вдруг null — считаем ничья ≈ good
  if (winner === "good") result.goodWins += 1;
  else result.evilWins += 1;

  const demon = state.config.demon;
  const db = result.byDemon[demon];
  db.games += 1;
  if (winner === "good") db.goodWins += 1; else db.evilWins += 1;

  const reason = state.winReason ?? "—";
  result.byReason[reason] = (result.byReason[reason] ?? 0) + 1;

  result.dayDistribution[state.day] = (result.dayDistribution[state.day] ?? 0) + 1;

  // Среднее пересчитываем инкрементально
  result.avgDays = result.avgDays + (state.day - result.avgDays) / result.games;

  // Роль winrate: выигрыш команды = +1 к ролям этой команды
  for (const p of state.players) {
    const key = p.role.id;
    const entry = result.roleWinrate[key] ?? { games: 0, wins: 0 };
    entry.games += 1;
    if (p.currentTeam === winner) entry.wins += 1;
    result.roleWinrate[key] = entry;
  }
}

export function formatReport(result: BatchResult): string {
  const pct = (a: number, b: number) => (b === 0 ? "  —  " : `${((100 * a) / b).toFixed(1).padStart(5)}%`);
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════");
  lines.push(`  Партий:          ${result.games}`);
  lines.push(`  Добро выиграло:  ${result.goodWins}  (${pct(result.goodWins, result.games)})`);
  lines.push(`  Зло выиграло:    ${result.evilWins}  (${pct(result.evilWins, result.games)})`);
  lines.push(`  Средняя длина:   ${result.avgDays.toFixed(2)} дн.`);
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  По демонам:");
  for (const demon of ["vecna", "mindflayer", "whatsit"] as DemonId[]) {
    const d = result.byDemon[demon];
    if (d.games === 0) continue;
    lines.push(`    ${demon.padEnd(12)} игр: ${String(d.games).padStart(5)}  good: ${pct(d.goodWins, d.games)}  evil: ${pct(d.evilWins, d.games)}`);
  }
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  Топ причин победы:");
  const reasons = Object.entries(result.byReason).sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [r, c] of reasons) {
    lines.push(`    ${String(c).padStart(5)} × ${r}`);
  }
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("  Win-rate по ролям (процент побед команды роли):");
  const entries = Object.entries(result.roleWinrate)
    .filter(([_, v]) => v.games > 0)
    .sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games);
  for (const [id, v] of entries) {
    const rate = v.wins / v.games;
    const bar = "█".repeat(Math.round(rate * 20));
    lines.push(`    ${id.padEnd(14)} ${String(v.games).padStart(4)} игр · ${pct(v.wins, v.games)}  ${bar}`);
  }

  return lines.join("\n");
}
