import { describe, expect, test } from "bun:test";
import { makeTestState, getByRole, targetByRole, scriptBrain } from "./helpers";
import { runNight, runSetupHooks } from "../game/night";
import { runDay } from "../game/day";

describe("Метки Векны", () => {
  test("метка, поставленная N1, не убивает в ту же ночь", () => {
    const state = makeTestState(["vecna", "robin", "hopper", "max", "eleven", "dustin"]);
    runSetupHooks(state);

    const vecna = getByRole(state, "vecna");
    targetByRole(vecna, "dustin", state);

    runNight(state, true);

    expect(getByRole(state, "dustin").status.alive).toBe(true);
    expect(getByRole(state, "dustin").status.marks).toBe(1);
    expect(state.vecnaEscalation).toBe(0);
  });

  test("метка срабатывает на следующую ночь", () => {
    const state = makeTestState(["vecna", "robin", "hopper", "max", "eleven", "dustin"]);
    runSetupHooks(state);

    const vecna = getByRole(state, "vecna");
    targetByRole(vecna, "dustin", state);
    // Хоппер пусть защитит не ту цель (бесполезно), чтобы не спасал dustin
    scriptBrain(getByRole(state, "hopper"), {
      target: () => getByRole(state, "eleven"),
    });

    runNight(state, true);
    runDay(state); // ни одной казни — голоса по дефолту false
    // На второй ночи Векна ставит ещё одну метку (любую) — не важно, dustin всё равно умрёт.
    targetByRole(vecna, "robin", state);
    runNight(state, false);

    expect(getByRole(state, "dustin").status.alive).toBe(false);
    expect(state.vecnaEscalation).toBe(1);
  });

  test("Хоппер защитил помеченного — метка снята, эскалация не идёт", () => {
    const state = makeTestState(["vecna", "hopper", "max", "eleven", "dustin", "robin"]);
    runSetupHooks(state);

    const vecna = getByRole(state, "vecna");
    const hopper = getByRole(state, "hopper");

    targetByRole(vecna, "dustin", state);

    runNight(state, true);
    runDay(state);

    // N2: защищаем dustin, метка (старая) срабатывает → спас
    targetByRole(hopper, "dustin", state);
    targetByRole(vecna, "robin", state);
    runNight(state, false);

    expect(getByRole(state, "dustin").status.alive).toBe(true);
    expect(getByRole(state, "dustin").status.marks).toBe(0);
    expect(state.vecnaEscalation).toBe(0);
  });

  test("Макс иммунна к Метке: гасится без смерти, эскалация не идёт", () => {
    const state = makeTestState(["vecna", "hopper", "max", "eleven", "dustin", "robin"]);
    runSetupHooks(state);
    const vecna = getByRole(state, "vecna");
    targetByRole(vecna, "max", state);

    runNight(state, true);
    runDay(state);
    targetByRole(vecna, "robin", state);
    runNight(state, false);

    expect(getByRole(state, "max").status.alive).toBe(true);
    expect(getByRole(state, "max").status.marks).toBe(0);
    expect(state.vecnaEscalation).toBe(0);
  });

  test("4 смерти с активной меткой → автопобеда зла", () => {
    // Без Хоппера/Стива (у них случайный brain спасает помеченных случайно).
    const state = makeTestState([
      "vecna", "robin", "dustin", "joyce", "mike", "lucas", "max", "eleven",
    ], { dayLimit: 20 });
    runSetupHooks(state);
    const vecna = getByRole(state, "vecna");

    const victims = ["robin", "dustin", "joyce", "mike"] as const;

    // N1: ставим метку на robin — она станет активной к N2
    targetByRole(vecna, "robin", state);
    runNight(state, true);
    runDay(state);

    for (let i = 0; i < victims.length; i++) {
      const nextVictim = victims[i + 1] ?? "lucas";
      targetByRole(vecna, nextVictim, state);
      runNight(state, false);
      if (state.winner) break;
      runDay(state);
      if (state.winner) break;
    }

    expect(state.winner).toBe("evil");
    expect(state.vecnaEscalation).toBeGreaterThanOrEqual(4);
    expect(state.winReason).toMatch(/4 смерти/);
  });
});
