import type { DemonId, GameConfig, Brain } from "@botc/core";
import { playGame, randomSeed, createRandomBrain } from "@botc/core";
import { createSimpleBrain } from "./ai/simple";
import { createSmartBrain } from "./ai/smart";
import { addGame, emptyBatchResult, formatReport } from "./stats/collector";
import { formatTrace } from "./render/trace";

type AiMode = "random" | "simple" | "smart";

interface CliArgs {
  players: number;
  games: number;
  demon: DemonId | "all";
  seed: number | null;
  aiMode: AiMode;
  verbose: boolean;
  dayLimit: number;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    players: 10,
    games: 1000,
    demon: "vecna",
    seed: null,
    aiMode: "simple",
    verbose: false,
    dayLimit: 30,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--players":   out.players = Number(argv[++i]); break;
      case "--games":     out.games = Number(argv[++i]); break;
      case "--demon":     out.demon = argv[++i] as DemonId | "all"; break;
      case "--seed":      out.seed = Number(argv[++i]); break;
      case "--ai":        out.aiMode = argv[++i] as AiMode; break;
      case "--verbose":   out.verbose = true; break;
      case "--day-limit": out.dayLimit = Number(argv[++i]); break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }
  return out;
}

function brainFactoryFor(mode: AiMode): () => Brain {
  switch (mode) {
    case "random": return createRandomBrain;
    case "simple": return createSimpleBrain;
    case "smart":  return createSmartBrain;
  }
}

function printHelp(): void {
  console.log(`
Изнанка Хокинса — симулятор

Использование:
  bun run start [flags]

Флаги:
  --players N     Число игроков (5..15). По умолчанию 10.
  --games N       Сколько партий. По умолчанию 1000.
  --demon NAME    vecna | mindflayer | whatsit | all. По умолчанию vecna.
  --seed N        Сид PRNG. По умолчанию случайный.
  --ai MODE       random | simple | smart. По умолчанию simple.
  --verbose       Печатать лог каждой партии (имеет смысл только с --games 1).
  --day-limit N   Максимум дней до ничьей. По умолчанию 30.
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const baseSeed = args.seed ?? randomSeed();
  const factory = brainFactoryFor(args.aiMode);

  const demons: DemonId[] = args.demon === "all"
    ? ["vecna", "mindflayer", "whatsit"]
    : [args.demon];

  const result = emptyBatchResult();

  console.log(`\n🎲 Старт: ${args.games} партий × ${demons.length} демон(ов), ${args.players} игр., AI=${args.aiMode}, seed=${baseSeed}\n`);

  const t0 = performance.now();

  for (const demon of demons) {
    for (let i = 0; i < args.games; i++) {
      const config: GameConfig = {
        players: args.players,
        demon,
        seed: baseSeed + i * 1000 + demons.indexOf(demon) * 1_000_000,
        verbose: args.verbose && args.games === 1,
        dayLimit: args.dayLimit,
        brainFactory: factory,
      };
      const state = playGame(config);
      addGame(result, state);

      if (config.verbose) console.log("\n" + formatTrace(state));
    }
  }

  const t1 = performance.now();
  if (args.games > 1 || !args.verbose) {
    console.log(formatReport(result));
    console.log(`\n⏱  ${(t1 - t0).toFixed(0)} мс · ${((result.games / (t1 - t0)) * 1000).toFixed(0)} партий/сек\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
