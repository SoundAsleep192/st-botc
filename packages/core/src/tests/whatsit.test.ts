import { describe, expect, test } from "bun:test";
import { makeTestState, getByRole, targetByRole } from "./helpers";
import { runNight, runSetupHooks } from "../game/night";
import { runDay } from "../game/day";

describe("Мистер Этосамое", () => {
  test("переманивает доброго → его команда меняется на evil", () => {
    const state = makeTestState(["whatsit", "robin", "dustin", "joyce", "mike"]);
    runSetupHooks(state);
    const whatsit = getByRole(state, "whatsit");

    targetByRole(whatsit, "robin", state);
    runNight(state, true);
    // whatsit не действует в первую ночь (firstNight: 0) — добавим N2
    runDay(state);
    runNight(state, false);

    expect(getByRole(state, "robin").currentTeam).toBe("evil");
    expect(state.convertedCount).toBe(1);
  });

  test("при переманивании Юрия его цикл смены команды останавливается", () => {
    const state = makeTestState(["whatsit", "yuri", "robin", "dustin", "joyce"]);
    runSetupHooks(state);
    const whatsit = getByRole(state, "whatsit");
    const yuri = getByRole(state, "yuri");

    runNight(state, true); // yuri-firstNight: показ команды (good)
    runDay(state);

    targetByRole(whatsit, "yuri", state);
    runNight(state, false);

    expect(yuri.currentTeam).toBe("evil");
    const frozen = (yuri.memory as { yuriFrozen?: boolean }).yuriFrozen;
    expect(frozen).toBe(true);

    runDay(state);
    runNight(state, false);
    expect(yuri.currentTeam).toBe("evil"); // цикл не идёт обратно
  });

  test("объявление победы при живых evil ≥ good", () => {
    // 6 игроков: демон + 2 заранее переманенных + 3 добрых.
    // После переманивания joyce станет 3 evil vs 3 good → объявление победы.
    const state = makeTestState(["whatsit", "robin", "dustin", "joyce", "mike", "lucas"]);
    runSetupHooks(state);
    const whatsit = getByRole(state, "whatsit");

    getByRole(state, "robin").currentTeam = "evil";
    getByRole(state, "dustin").currentTeam = "evil";

    targetByRole(whatsit, "joyce", state);
    runNight(state, false);
    runDay(state);

    expect(state.winner).toBe("evil");
    expect(state.winReason).toMatch(/Этосамое/);
  });
});
