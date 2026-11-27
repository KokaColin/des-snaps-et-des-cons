import { fauto, type FautoOp } from './fauto';
import type { Gadget } from './gadget';

/** Registre des gadgets actifs. V1 : la Fauto uniquement. */
export const GADGETS = { fauto } as const satisfies Record<string, Gadget<never>>;

export type GadgetId = keyof typeof GADGETS;

export type GadgetAction = { gadget: 'fauto' } & FautoOp;

export const ALL_GADGETS: Gadget<unknown>[] = Object.values(GADGETS) as Gadget<unknown>[];
