import type { ToolModule } from "./types";
import { meta as garyMeta } from "./gary-grapplesauce-combat/meta";
import { GaryCombatTool } from "./gary-grapplesauce-combat/Tool";

/**
 * Register every table tool here.
 * Cursor tip: after scaffolding with `npm run new-tool`, add one import + one entry.
 */
export const tools: ToolModule[] = [
  {
    meta: garyMeta,
    Component: GaryCombatTool,
  },
];

export function getTool(id: string) {
  return tools.find((t) => t.meta.id === id);
}
