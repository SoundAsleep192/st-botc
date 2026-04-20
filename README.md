# Изнанка Хокинса

[![CI](https://github.com/SoundAsleep192/st-botc/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SoundAsleep192/st-botc/actions/workflows/ci.yml)

Custom Blood on the Clocktower set (Stranger Things) + инструментарий.

## Содержимое репозитория

### Игровые материалы (корень)

| Файл | Что это |
|---|---|
| `roles.md` | Полные описания 25 ролей и порядок ночей. |
| `jinxes.md` | Матрица взаимодействий / корнер-кейсы. |
| `sheet.html` | Печатный справочник ролей для игроков. |
| `night-order.html` | Печатный порядок ночей для ведущего. |
| `jinxes.html` | Печатный jinxes для ведущего. |
| `tokens-print.html` | Макет распечатки жетонов. |
| `tokens/` | PNG-жетоны ролей. |
| `export-png.sh` | Конвертер HTML → PNG (результат в `generated/png/`). |

### Код: монорепа (Bun workspaces)

```
packages/
├── core/        Ядро: типы, реестр ролей, движок партии. Pure TS, no IO.
├── sim/         CLI-симулятор на core. Прогоняет N партий, отчёт по winrate + читаемый трейс партии.
├── grimoire/    (заглушка) Цифровой гримуар — SPA ведущего.
└── server/      (заглушка) Лобби-сервер — Jackbox-style комнаты.
```

## Быстрый старт

```bash
bun install

# Прогон симуляции + итоговая статистика:
bun run sim -- --players 10 --games 1000 --demon all --seed 1

# Читаемый трейс ОДНОЙ партии (сетап → ночи/дни → итог):
bun run sim:trace --demon vecna --ai smart --seed 42

# Экспорт всех печатных листов в generated/png/ :
bun run export:png:all

# Проверки:
bun run typecheck
bun run test
```

Подробнее — `packages/sim/README.md`.

## Разработка

- **CI**: на каждый push/PR гоняется `typecheck` + `bun test` (см. `.github/workflows/ci.yml`).
- **PR / Issues**: используем шаблоны из `.github/` — бага/фича/PR.
- **Стиль коммитов**: осмысленный заголовок + краткое описание «зачем».
