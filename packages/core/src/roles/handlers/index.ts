import type { RoleHandler, RoleId } from "../../types";
import {
  elevenHandler, hopperHandler, steveHandler, robinHandler, nancyHandler,
  dustinHandler, joyceHandler, mikeHandler, maxHandler, lucasHandler,
  murrayHandler, suzyHandler, eddieHandler,
} from "./townsfolk";
import {
  willHandler, tedHandler, yuriHandler, alexeiHandler, barbHandler,
} from "./outsiders";
import {
  billyHandler, brennerHandler, grigoriHandler, demogorgonHandler,
} from "./minions";
import {
  vecnaHandler, mindflayerHandler, whatsitHandler,
} from "./demons";

const HANDLERS: Record<RoleId, RoleHandler> = {
  // townsfolk
  eleven: elevenHandler,
  hopper: hopperHandler,
  steve: steveHandler,
  robin: robinHandler,
  nancy: nancyHandler,
  dustin: dustinHandler,
  joyce: joyceHandler,
  mike: mikeHandler,
  max: maxHandler,
  lucas: lucasHandler,
  murray: murrayHandler,
  suzy: suzyHandler,
  eddie: eddieHandler,
  // outsiders
  will: willHandler,
  ted: tedHandler,
  yuri: yuriHandler,
  alexei: alexeiHandler,
  barb: barbHandler,
  // minions
  billy: billyHandler,
  brenner: brennerHandler,
  grigori: grigoriHandler,
  demogorgon: demogorgonHandler,
  // demons
  vecna: vecnaHandler,
  mindflayer: mindflayerHandler,
  whatsit: whatsitHandler,
};

export function getHandler(id: RoleId): RoleHandler | undefined {
  return HANDLERS[id];
}

export { vecnaHandler, mindflayerHandler, whatsitHandler } from "./demons";
