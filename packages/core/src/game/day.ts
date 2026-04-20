import type { GameState, Player } from "../types";
import { killPlayer } from "./death";
import { hasActiveMark, livePlayers } from "./util";
import { elevenTryDayKill } from "../roles/handlers/townsfolk";
import { checkWhatsitWinAnnouncement } from "../roles/handlers/demons";
import { checkWin } from "./win";

/**
 * День: Оди (днём) → объявление победы Этосамого → номинации и казнь → ещё раз проверка победы.
 */
export function runDay(state: GameState): void {
  state.day += 1;

  // Оди — одноразовая дневная казнь
  elevenTryDayKill(state);
  if (checkWin(state)) return;

  // Мистер Этосамое — публичное объявление победы
  checkWhatsitWinAnnouncement(state);
  if (checkWin(state)) return;

  // Номинации и казнь.
  // Правила (как в BotC):
  //   1) Каждый живой может номинировать максимум 1 раз за день.
  //   2) Каждого живого можно номинировать максимум 1 раз за день.
  //   3) Каждая номинация — отдельное голосование, они НЕ суммируются.
  //   4) В конце дня казнят ТОЛЬКО ОДНОГО — с максимумом голосов среди тех,
  //      кто прошёл порог. При равенстве на максимуме — никого не казнят.
  const live = livePlayers(state);
  const nominators = live.slice();
  const hasNominated = new Set<number>();
  const wasNominated = new Set<number>();
  /** История номинаций этого дня: каждое голосование отдельно. */
  const nominations: Array<{ nomineeId: number; votes: number }> = [];

  const threshold = Math.ceil(live.length / 2);
  for (const nominator of nominators) {
    if (!nominator.status.alive) continue;
    if (hasNominated.has(nominator.id)) continue;
    const candidates = live.filter(
      (p) => p.id !== nominator.id && p.status.alive && !wasNominated.has(p.id)
    );
    if (candidates.length === 0) continue;
    const target = nominator.brain.pickNominee(state, nominator, candidates);
    if (!target || !target.status.alive) continue;
    if (wasNominated.has(target.id)) continue;

    // Тиер 3 Векны — активно помеченные не могут номинировать: попытка = немедленная смерть.
    if (state.vecnaEscalation >= 3 && hasActiveMark(nominator)) {
      killPlayer(state, nominator, { kind: "madness-violation" });
      hasNominated.add(nominator.id);
      continue;
    }

    hasNominated.add(nominator.id);
    wasNominated.add(target.id);

    const votes = collectVotes(state, target);
    nominations.push({ nomineeId: target.id, votes });
    state.log.push({
      phase: "day", day: state.day, type: "nominate",
      actor: nominator.id, target: target.id,
      detail: `${votes}/${threshold}`,
    });

    // Для Демогоргона: цель точно «участвовала» — она физически на арене номинации;
    // голосовавшие отмечают в voteOnNomination через votedTonight.
    (target.memory as { skippedAllVotes?: boolean }).skippedAllVotes = false;
    for (const p of live) {
      if ((p.memory as { votedTonight?: boolean }).votedTonight === true) {
        (p.memory as { skippedAllVotes?: boolean }).skippedAllVotes = false;
      }
    }
  }

  // Казнь: максимум голосов среди тех, кто прошёл порог; при ничье — никого.
  let execId: number | null = null;
  let maxVotes = 0;
  let tied = false;
  for (const { nomineeId, votes } of nominations) {
    if (votes < threshold) continue;
    if (votes > maxVotes) {
      maxVotes = votes;
      execId = nomineeId;
      tied = false;
    } else if (votes === maxVotes) {
      tied = true;
    }
  }
  if (tied) execId = null;

  if (execId !== null) {
    const target = state.players.find((p) => p.id === execId);
    if (target) killPlayer(state, target, { kind: "vote" });
  } else {
    const hadThresholdTie = nominations.some((n) => n.votes >= threshold);
    const detail =
      nominations.length === 0
        ? "нет номинаций"
        : hadThresholdTie
          ? "ничья на максимуме — никого не казнили"
          : "никто не набрал порога";
    state.log.push({ phase: "day", day: state.day, type: "exec-none", detail });
    // Никого не казнили — для Демогоргона: всё живое пропустило финальную казнь.
    for (const p of live) {
      (p.memory as { skippedAllVotes?: boolean }).skippedAllVotes = true;
    }
  }

  // После казни ещё раз проверяем объявление Этосамого (часто открывается новый перевес)
  checkWhatsitWinAnnouncement(state);
}

function collectVotes(state: GameState, nominee: Player): number {
  let votes = 0;
  for (const voter of livePlayers(state)) {
    // Тиер 3 Векны — голоса активно помеченных не считаются
    if (state.vecnaEscalation >= 3 && hasActiveMark(voter)) continue;

    const willVote = voter.brain.voteOnNomination(state, voter, nominee);
    if (willVote) {
      votes += 1;
      (voter.memory as { votedTonight?: boolean }).votedTonight = true;
    }
  }
  return votes;
}
