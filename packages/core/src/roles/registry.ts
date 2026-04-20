import type { Role, RoleId } from "../types";

/**
 * Реестр всех 25 ролей сета «Изнанка Хокинса» с порядком ночей.
 * Порядок согласуется с `/roles.md` → «ПОРЯДОК НОЧЕЙ».
 *
 * Логика нумерации:
 * - firstNight 0 / otherNight 0 = роль не просыпается в эту фазу.
 * - Меньшее число = раньше в ночи.
 * - Шаги идут с «разбросом» в 10, чтобы при желании можно было вставить
 *   новую роль между существующими без полного пересчёта.
 */

const R = (r: Role): Role => r;

export const ROLES: Record<RoleId, Role> = {
  // ───────────── ЖИТЕЛИ ─────────────
  eleven:   R({ id: "eleven",   name: "Eleven",       ruName: "Оди",             category: "townsfolk", team: "good", firstNight: 0,   otherNight: 160, oneshot: true }),
  hopper:   R({ id: "hopper",   name: "Hopper",       ruName: "Хоппер",          category: "townsfolk", team: "good", firstNight: 0,   otherNight: 80 }),
  steve:    R({ id: "steve",    name: "Steve",        ruName: "Стив",            category: "townsfolk", team: "good", firstNight: 0,   otherNight: 90 }),
  robin:    R({ id: "robin",    name: "Robin",        ruName: "Робин",           category: "townsfolk", team: "good", firstNight: 0,   otherNight: 150 }),
  nancy:    R({ id: "nancy",    name: "Nancy",        ruName: "Нэнси",           category: "townsfolk", team: "good", firstNight: 70,  otherNight: 0 }),
  dustin:   R({ id: "dustin",   name: "Dustin",       ruName: "Дастин",          category: "townsfolk", team: "good", firstNight: 0,   otherNight: 110 }),
  joyce:    R({ id: "joyce",    name: "Joyce",        ruName: "Джойс",           category: "townsfolk", team: "good", firstNight: 0,   otherNight: 120 }),
  mike:     R({ id: "mike",     name: "Mike",         ruName: "Майк",            category: "townsfolk", team: "good", firstNight: 0,   otherNight: 130 }),
  max:      R({ id: "max",      name: "Max",          ruName: "Макс",            category: "townsfolk", team: "good", firstNight: 0,   otherNight: 0 }),
  lucas:    R({ id: "lucas",    name: "Lucas",        ruName: "Лукас",           category: "townsfolk", team: "good", firstNight: 0,   otherNight: 140 }),
  murray:   R({ id: "murray",   name: "Murray",       ruName: "Мюррей",          category: "townsfolk", team: "good", firstNight: 80,  otherNight: 0 }),
  suzy:     R({ id: "suzy",     name: "Suzy",         ruName: "Сюзи",            category: "townsfolk", team: "good", firstNight: 0,   otherNight: 170 }),
  eddie:    R({ id: "eddie",    name: "Eddie",        ruName: "Эдди",            category: "townsfolk", team: "good", firstNight: 0,   otherNight: 10, oneshot: true }),

  // ───────────── ИЗГОИ ─────────────
  will:     R({ id: "will",     name: "Will",         ruName: "Уилл",            category: "outsider",  team: "good", firstNight: 0,   otherNight: 0 }),
  ted:      R({ id: "ted",      name: "Ted",          ruName: "Тед",             category: "outsider",  team: "good", firstNight: 0,   otherNight: 0 }),
  yuri:     R({ id: "yuri",     name: "Yuri",         ruName: "Юрий",            category: "outsider",  team: "good", firstNight: 40,  otherNight: 20 }),
  alexei:   R({ id: "alexei",   name: "Alexei",       ruName: "Алексей",         category: "outsider",  team: "good", firstNight: 50,  otherNight: 0 }),
  barb:     R({ id: "barb",     name: "Barb",         ruName: "Барб",            category: "outsider",  team: "good", firstNight: 0,   otherNight: 0 }),

  // ───────────── ПРИСПЕШНИКИ ─────────────
  billy:    R({ id: "billy",    name: "Billy",        ruName: "Билли",           category: "minion",    team: "evil", firstNight: 0,   otherNight: 40 }),
  brenner:  R({ id: "brenner",  name: "Brenner",      ruName: "Бреннер",         category: "minion",    team: "evil", firstNight: 10,  otherNight: 0 }),
  grigori:  R({ id: "grigori",  name: "Grigori",      ruName: "Григорий",        category: "minion",    team: "evil", firstNight: 0,   otherNight: 30 }),
  demogorgon:R({id: "demogorgon",name: "Demogorgon",  ruName: "Демогоргон",      category: "minion",    team: "evil", firstNight: 0,   otherNight: 100 }),

  // ───────────── ДЕМОНЫ ─────────────
  vecna:    R({ id: "vecna",    name: "Vecna",        ruName: "Векна",           category: "demon",     team: "evil", firstNight: 60,  otherNight: 70 }),
  mindflayer:R({id: "mindflayer",name: "Mind Flayer", ruName: "Истязатель",      category: "demon",     team: "evil", firstNight: 0,   otherNight: 50 }),
  whatsit:  R({ id: "whatsit",  name: "Mr Whatsit",   ruName: "М-р Этосамое",    category: "demon",     team: "evil", firstNight: 0,   otherNight: 60 }),
};

export const ALL_ROLE_IDS: RoleId[] = Object.keys(ROLES) as RoleId[];

export function rolesByCategory(category: Role["category"]): Role[] {
  return ALL_ROLE_IDS.map((id) => ROLES[id]).filter((r) => r.category === category);
}

export function role(id: RoleId): Role {
  const r = ROLES[id];
  if (!r) throw new Error(`Unknown role id: ${id}`);
  return r;
}
