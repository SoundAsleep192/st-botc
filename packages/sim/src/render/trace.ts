import type { GameState, LogEvent, Player } from "@botc/core";

/**
 * Человекочитаемый трейс партии: шапка, состав, поночно сгруппированные события,
 * итог и список мёртвых.
 */
export function formatTrace(state: GameState): string {
  const out: string[] = [];
  out.push(header(state));
  out.push(composition(state));

  const setupEvents = state.log.filter((e) => e.phase === "setup");
  if (setupEvents.length) {
    out.push(section("СЕТАП"));
    for (const e of setupEvents) out.push("  • " + renderEvent(e, state));
  }

  const maxNight = maxField(state.log, "night", "night");
  const maxDay = maxField(state.log, "day", "day");
  const last = Math.max(maxNight, maxDay);

  for (let n = 1; n <= last; n++) {
    const nightEvents = state.log.filter((e) => e.phase === "night" && e.night === n);
    if (nightEvents.length) {
      out.push(section(`НОЧЬ ${n}`));
      for (const e of nightEvents) {
        const line = renderEvent(e, state);
        if (line) out.push("  • " + line);
      }
    }

    const dayEvents = state.log.filter((e) => e.phase === "day" && e.day === n);
    if (dayEvents.length) {
      out.push(section(`ДЕНЬ ${n}`));
      const nomins = dayEvents.filter((e) => e.type === "nominate");
      const others = dayEvents.filter((e) => e.type !== "nominate");

      if (nomins.length) {
        out.push("  номинации:");
        for (const e of nomins) {
          out.push("    · " + renderEvent(e, state));
        }
      }
      for (const e of others) {
        const line = renderEvent(e, state);
        if (line) out.push("  • " + line);
      }
    }
  }

  out.push(resultBlock(state));
  out.push(rosterAfter(state));
  return out.join("\n");
}

// ───────────────────────── helpers ─────────────────────────

function maxField(events: LogEvent[], phase: "night" | "day", field: "night" | "day"): number {
  let m = 0;
  for (const e of events) {
    if (e.phase !== phase) continue;
    const v = field === "night" ? e.night : e.day;
    if (typeof v === "number" && v > m) m = v;
  }
  return m;
}

function header(state: GameState): string {
  const demon = state.players.find((p) => p.category === "demon");
  const demonRu = demon ? demon.role.ruName : "?";
  const line = "═".repeat(60);
  return [
    line,
    "  ИЗНАНКА ХОКИНСА · партия",
    `  seed: ${state.config.seed}  ·  игроков: ${state.players.length}  ·  демон: ${demonRu}`,
    line,
  ].join("\n");
}

function section(title: string): string {
  return `\n── ${title} ${"─".repeat(Math.max(0, 56 - title.length))}`;
}

function composition(state: GameState): string {
  const lines = ["\nСОСТАВ:"];
  for (const p of state.players) {
    const teamMark = p.category === "demon" ? "◆" : p.currentTeam === "evil" ? "▲" : "·";
    const seat = String(p.seat + 1).padStart(2, " ");
    const name = p.name.padEnd(4, " ");
    const role = p.role.ruName.padEnd(14, " ");
    const cat = `[${p.category}]`.padEnd(12, " ");
    const team = `(${p.currentTeam})`;
    lines.push(`  ${seat} ${teamMark} ${name}  ${role}  ${cat} ${team}`);
  }
  return lines.join("\n");
}

function playerInfo(state: GameState, id: number | undefined): string {
  if (id === undefined) return "?";
  const p = state.players[id];
  if (!p) return String(id);
  return `${p.name} (${p.role.ruName})`;
}

function pname(state: GameState, id: number | undefined): string {
  if (id === undefined) return "?";
  return state.players[id]?.name ?? String(id);
}

// ─── per-event renderers ───

function renderEvent(e: LogEvent, s: GameState): string {
  const t = pname(s, e.target);
  const a = pname(s, e.actor);
  const d = e.detail ?? "";

  switch (e.type) {
    // Сетап / статусы
    case "composition":
      return `состав: ${d}`;
    case "alexei-neighbor-poison":
      return `Алексей отравил соседа: ${t}`;
    case "alexei-death-unpoison":
      return `Алексей умер → отравление снято с ${t}`;
    case "alexei-name":
      return `Алексей назвал имя: ${t}`;
    case "yuri-switch":
      return `Юрий теперь в команде: ${d}`;
    case "will-targeted":
      return `Уилл стал целью зла (${d})`;
    case "barb-posthumous-poison":
      return `Барб посмертно отравляет: ${t}`;
    case "ted-marked":
      return `Тед сделал отметку: ${t}`;

    // Защитники
    case "hopper-protect": return `Хоппер защищает: ${t}`;
    case "steve-protect": return `Стив защищает: ${t}`;
    case "steve-pass": return `Стив пасует`;
    case "steve-cooldown": return `Стив на кулдауне`;

    // Инфо-роли
    case "robin-check":
      return `Робин прочитал ${t}: ${d === "демон" ? "⚠ ДЕМОН" : "чисто"}`;
    case "mike-team":
      return `Майк проверил ${t}: ${d === "same" ? "одна команда" : "✦ РАЗНЫЕ команды"}`;
    case "mike-no-wake":
      return `Майк проверил ${t}: не просыпался`;
    case "joyce-check":
      return `Джойс проверила ${t}: ${d === "да" ? "⚠ метка/статус" : "чисто"}`;
    case "lucas-check":
      return `Лукас проверил ${t}: ${d === "yes" ? "⚠ под атакой" : "чисто"}`;
    case "suzy-check":
      return `Сюзи проверила ${t}: ${d}`;
    case "eleven-check":
      return `Оди проверила ${t}: ${d === "да" ? "просыпался" : "спал"}`;
    case "dustin-side":
      return `Дастин чует зло со стороны: ${d}`;
    case "nancy-investigate":
      return `Нэнси: ${d}`;
    case "nancy-fake":
      return `Нэнси (без приспешника): ${d}`;
    case "nancy-demon":
      return `Нэнси видит Демона: ${t}`;
    case "murray-pair":
      return `Мюррей: пара — ${d}`;

    // Злые
    case "vecna-mark":
      return `Векна ставит Метку: ${t}`;
    case "vecna-mark-missed":
      return `Векна отравлен — Метка в молоко`;
    case "mindflayer-poison":
      return `Истязатель отравляет: ${t}`;
    case "mindflayer-cascade":
      return `Истязатель → ЦЕПНАЯ атака на отравленных (${d})`;
    case "mindflayer-poisoned":
      return `Истязатель отравлен — ночь потеряна`;
    case "whatsit-convert":
      return `Мистер Этосамое переманивает: ${t} (${d})`;
    case "whatsit-yuri-freeze":
      return `Этосамое заморозил Юрия (цикл остановлен)`;
    case "whatsit-victory":
      return `✦ МИСТЕР ЭТОСАМОЕ ОБЪЯВИЛ ПОБЕДУ (${d})`;
    case "demogorgon-hit":
      return `Демогоргон бьёт: ${t}`;
    case "demogorgon-miss":
      return `Демогоргон целился в ${t}, но он голосовал — промах`;
    case "billy-invert":
      return `Билли инвертирует: ${t}`;
    case "brenner-grimoire":
      return `Бреннер смотрит гримуар (знает всё зло)`;
    case "brenner-poison":
      return `Бреннер отравляет: ${t}`;
    case "grigori-block":
      return `Григорий блокирует: ${t}`;
    case "eddie-concert":
      return `♪ Эдди объявил КОНЦЕРТ`;

    // Kill-phase / защиты
    case "death":
      return `☠ ${t} умер(ла) — ${d}`;
    case "death-blocked-protection":
      return `${t} спасён защитой (${d})`;
    case "death-blocked-max":
      return `${t} — Макс иммунна (${d})`;
    case "vecna-mark-saved":
      return `Метка ${t} снята защитой`;
    case "vecna-mark-miss-max":
      return `Метка ${t} (Макс) — иммунитет, без смерти`;

    // День
    case "nominate":
      return `${a} → ${t}${d ? `  (${d} голосов)` : ""}`;
    case "exec-none":
      return `→ никого не казнили${d ? ` (${d})` : ""}`;
    case "eleven-oneshot":
      return `Оди ⚡ расстреляла ${t}`;
    case "whatsit-win-check":
      return `Мистер Этосамое проверка: ${d}`;
    case "whatsit-win-announce":
      return `✦ Мистер Этосамое объявил ПОБЕДУ: ${d}`;

    default: {
      const bits: string[] = [e.type];
      if (e.actor !== undefined) bits.push(`actor=${a}`);
      if (e.target !== undefined) bits.push(`target=${t}`);
      if (d) bits.push(d);
      return bits.join(" · ");
    }
  }
}

// ─── финальный блок ───

function resultBlock(state: GameState): string {
  const line = "═".repeat(60);
  const winner = state.winner === "good" ? "ДОБРО" : state.winner === "evil" ? "ЗЛО" : "—";
  return [
    "\n" + line,
    "  РЕЗУЛЬТАТ",
    line,
    `  Победитель: ${winner}`,
    `  Причина: ${state.winReason ?? "—"}`,
    `  Длительность: ${state.day} дн. / ${state.night} ноч.`,
    `  Эскалация Векны: ${state.vecnaEscalation}   Переманенных: ${state.convertedCount}`,
  ].join("\n");
}

function rosterAfter(state: GameState): string {
  const live: Player[] = state.players.filter((p) => p.status.alive);
  const dead: Player[] = state.players.filter((p) => !p.status.alive);
  const out: string[] = [];
  out.push("\n  Живые:");
  if (live.length === 0) out.push("    (никого)");
  else for (const p of live) out.push(`    · ${p.name} (${p.role.ruName}) [${p.currentTeam}]`);
  out.push("\n  Мёртвые:");
  if (dead.length === 0) out.push("    (никого)");
  else {
    const deathEvents = state.log.filter((e) => e.type === "death");
    for (const p of dead) {
      const dev = deathEvents.find((e) => e.target === p.id);
      const where = dev
        ? dev.phase === "night"
          ? `N${dev.night}`
          : `D${dev.day}`
        : "?";
      out.push(`    · ${where}  ${p.name} (${p.role.ruName}) — ${dev?.detail ?? "неизвестно"}`);
    }
  }
  return out.join("\n");
}
