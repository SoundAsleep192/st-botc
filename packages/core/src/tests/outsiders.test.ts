import { describe, expect, test } from "bun:test";
import { makeTestState, getByRole } from "./helpers";
import { runNight, runSetupHooks } from "../game/night";
import { killPlayer } from "../game/death";

describe("Алексей — отравление соседа", () => {
  test("на setup соседний добрый отравлен; при смерти Алексея отравление снимается", () => {
    // Соседи Алексея — slot+1 и slot-1. joyce на seat 2 гарантированно соседний.
    const state = makeTestState(["vecna", "alexei", "joyce", "dustin", "mike"]);
    runSetupHooks(state);

    const poisonedNeighbors = state.players.filter(
      (p) => p.status.poisoned && p.currentTeam === "good"
    );
    expect(poisonedNeighbors.length).toBe(1);
    const poisoned = poisonedNeighbors[0]!;

    killPlayer(state, getByRole(state, "alexei"), { kind: "vote" });

    expect(poisoned.status.poisoned).toBe(false);
  });
});

describe("Барб — посмертное отравление", () => {
  test("смерть Барб днём отравляет одного доброго", () => {
    const state = makeTestState(["vecna", "barb", "robin", "dustin", "joyce", "mike"]);
    runSetupHooks(state);

    // Барб умирает — её onDeath-хук должен отравить случайного доброго.
    killPlayer(state, getByRole(state, "barb"), { kind: "vote" });

    const poisoned = state.players.filter(
      (p) => p.status.poisoned && p.currentTeam === "good"
    );
    expect(poisoned.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Юрий — ночная смена команды", () => {
  test("каждую ночь меняется currentTeam", () => {
    const state = makeTestState(["vecna", "yuri", "robin", "dustin", "joyce"]);
    runSetupHooks(state);
    const yuri = getByRole(state, "yuri");

    expect(yuri.currentTeam).toBe("good");
    runNight(state, true); // firstNight: показ команды, команда не меняется
    expect(yuri.currentTeam).toBe("good");
    runNight(state, false); // otherNight: меняется
    expect(yuri.currentTeam).toBe("evil");
    runNight(state, false);
    expect(yuri.currentTeam).toBe("good");
  });
});
