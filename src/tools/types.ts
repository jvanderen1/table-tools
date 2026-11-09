import type { ComponentType } from "react";

export type ToolMeta = {
  /** URL slug — folder name under src/tools/ */
  id: string;
  title: string;
  summary: string;
  /** Character / campaign label shown on the home card */
  tags: string[];
};

export type ToolModule = {
  meta: ToolMeta;
  Component: ComponentType;
};
