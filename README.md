# Изнанка Хокинса

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
| `export-png.sh` | Конвертер HTML → PNG. |

### Код: монорепа (Bun workspaces)

```
packages/
├── core/        Ядро: типы, реестр ролей, движок партии. Pure TS, no IO.
├── sim/         CLI-симулятор на core. Прогоняет N партий, отчёт по winrate.
├── grimoire/    (заглушка) Цифровой гримуар — SPA ведущего.
└── server/      (заглушка) Лобби-сервер — Jackbox-style комнаты.
```

## Быстрый старт

```bash
bun install
bun run sim -- --players 10 --games 1000 --demon all --seed 1
bun run typecheck
```

Подробнее — `packages/sim/README.md`.
