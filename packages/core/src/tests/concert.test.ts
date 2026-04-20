import { describe, expect, test } from "bun:test";
import { makeTestState, getByRole, targetByRole, scriptBrain } from "./helpers";
import { runNight, runSetupHooks } from "../game/night";

describe("Концерт Эдди и перенаправление", () => {
  test("Эдди объявляет Концерт → Демогоргон бьёт в Эдди", () => {
    const state = makeTestState(["demogorgon", "vecna", "eddie", "robin", "dustin", "joyce"]);
    runSetupHooks(state);

    // Первая ночь: ничего критичного; Эдди не может объявить в N1 (eddie otherNight только)
    runNight(state, true);

    // Программируем Эдди на Концерт и Демогоргона на убийство robin.
    const eddie = getByRole(state, "eddie");
    const demogorgon = getByRole(state, "demogorgon");

    // Нам нужно, чтобы Эдди гарантированно объявил Концерт.
    // В его handler'е оценивается state.night >= 3 и 15% шанс — принудим флагами.
    scriptBrain(eddie, {});
    state.night = 2; // чтобы eddie.otherNight сработал на «3-й» ночи: runNight инкрементирует до 3
    // После runNight night станет 3, в handler eddie это пройдёт проверку.

    // Чтобы симуляция была детерминированной, переопределим rng.bool у Эдди.
    // Проще — поставим флаг в memory и переопределим eddie-handler нельзя; но можно
    // просто сразу «активировать» Концерт до ночи, чтобы targetWithRedirect работал.
    // Это и есть ситуация: в N3 Эдди говорит «объявлен Концерт», мы симулируем именно N3.

    // Убедимся, что при запуске ночи 3 Концерт объявится вручную (обход RNG):
    eddie.oneshotUsed = false;
    state.eddieConcertNight = null;

    // Жёстко: таргетируем demogorgon на robin, но Концерт перенаправит на eddie.
    targetByRole(demogorgon, "robin", state);

    // Вместо надежды на RNG — пре-активируем Концерт перед ночью.
    // Для honest-теста используем отдельный ход: вручную вызовем eddie-обработчик
    // после runNight, когда флаг уже проставлен. Но проще — имитируем «Эдди уже объявил».
    state.eddieConcertNight = state.night + 1; // на ночь, которую сейчас сыграем

    runNight(state, false);

    // Эдди умер от Концерта; robin жив.
    expect(getByRole(state, "eddie").status.alive).toBe(false);
    expect(getByRole(state, "robin").status.alive).toBe(true);
  });
});
