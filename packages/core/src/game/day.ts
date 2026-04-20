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

  // Обычный ход дня: номинации и казнь (упрощённо — одна казнь в день максимум)
  const live = livePlayers(state);
  const nominators = live.slice();
  const nominated: Map<number, number> = new Map(); // nominee id → vote count

  const threshold = Math.ceil(live.length / 2);
  for (const nominator of nominators) {
    if (!nominator.status.alive) continue;
    const candidates = live.filter((p) => p.id !== nominator.id && p.status.alive);
    const target = nominator.brain.pickNominee(state, nominator, candidates);
    if (!target || !target.status.alive) continue;

    // Тиер 3 Векны — активно помеченные не могут номинировать: попытка = немедленная смерть
    if (state.vecnaEscalation >= 3 && hasActiveMark(nominator)) {
      killPlayer(state, nominator, { kind: "madness-violation" });
      continue;
    }

    const votes = collectVotes(state, target);
    nominated.set(target.id, (nominated.get(target.id) ?? 0) + votes);
    state.log.push({
      phase: "day", day: state.day, type: "nominate",
      actor: nominator.id, target: target.id,
      detail: `${votes}/${threshold}`,
    });

    // Фиксируем «не пропустил голосование» для цели и голосовавших — для Демогоргона
    (target.memory as { skippedAllVotes?: boolean }).skippedAllVotes = false;
    for (const p of live) {
      if ((p.memory as { votedTonight?: boolean }).votedTonight === true) {
        (p.memory as { skippedAllVotes?: boolean }).skippedAllVotes = false;
      }
    }
  }

  // Определяем казнь: нужен порог = ceil(live/2), побеждает максимум голосов
  let execId: number | null = null;
  let maxVotes = 0;
  for (const [id, votes] of nominated.entries()) {
    if (votes >= threshold && votes > maxVotes) {
      maxVotes = votes;
      execId = id;
    }
  }

  if (execId !== null) {
    const target = state.players.find((p) => p.id === execId);
    if (target) killPlayer(state, target, { kind: "vote" });
  } else {
    if (nominated.size > 0) {
      state.log.push({ phase: "day", day: state.day, type: "exec-none", detail: "никто не набрал порога" });
    } else {
      state.log.push({ phase: "day", day: state.day, type: "exec-none", detail: "нет номинаций" });
    }
    // Никто не казнён — помечаем всех как «пропустил голосование» для Демогоргона
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
