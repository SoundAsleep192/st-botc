import { describe, expect, test } from "bun:test";
import { makeTestState, getByRole, targetByRole, scriptBrain } from "./helpers";
import { runNight, runSetupHooks } from "../game/night";

describe("Григорий — блокировка", () => {
  test("заблокированный Хоппер не может защитить — цель получает эффект", () => {
    const state = makeTestState(["mindflayer", "grigori", "hopper", "max", "dustin", "joyce"]);
    runSetupHooks(state);
    const grigori = getByRole(state, "grigori");
    const hopper = getByRole(state, "hopper");
    const dustin = getByRole(state, "dustin");

    runNight(state, true);

    targetByRole(grigori, "hopper", state);
    targetByRole(hopper, "dustin", state);
    targetByRole(getByRole(state, "mindflayer"), "dustin", state);

    runNight(state, false);

    // Защита не должна была сработать: Хоппер был заблокирован.
    expect(dustin.status.protectedTonight).toBe(false);
    expect(dustin.status.poisoned).toBe(true);
  });
});

describe("Демогоргон — убивает только не голосовавших", () => {
  test("цель, не пропустившая ни одного голосования — жива", () => {
    const state = makeTestState(["demogorgon", "vecna", "robin", "dustin", "joyce", "mike"]);
    runSetupHooks(state);
    // Фиксируем цель Векны, чтобы её случайная метка не задела жертву теста.
    targetByRole(getByRole(state, "vecna"), "joyce", state);
    runNight(state, true);

    const demogorgon = getByRole(state, "demogorgon");
    targetByRole(demogorgon, "robin", state);
    targetByRole(getByRole(state, "vecna"), "joyce", state);

    const robin = getByRole(state, "robin");
    (robin.memory as { skippedAllVotes?: boolean }).skippedAllVotes = false;

    runNight(state, false);

    expect(robin.status.alive).toBe(true);
  });

  test("цель, пропустившая все голосования — умирает", () => {
    const state = makeTestState(["demogorgon", "vecna", "robin", "dustin", "joyce", "mike"]);
    runSetupHooks(state);
    targetByRole(getByRole(state, "vecna"), "joyce", state);
    runNight(state, true);

    const demogorgon = getByRole(state, "demogorgon");
    targetByRole(demogorgon, "robin", state);
    targetByRole(getByRole(state, "vecna"), "joyce", state);

    const robin = getByRole(state, "robin");
    (robin.memory as { skippedAllVotes?: boolean }).skippedAllVotes = true;

    runNight(state, false);

    expect(robin.status.alive).toBe(false);
  });
});
