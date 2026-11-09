#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];

if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error("Usage: npm run new-tool -- <kebab-case-id>");
  console.error("Example: npm run new-tool -- aria-spell-picker");
  process.exit(1);
}

const dest = join(root, "src/tools", id);
if (existsSync(dest)) {
  console.error(`Already exists: src/tools/${id}`);
  process.exit(1);
}

const title = id
  .split("-")
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(" ");
const componentName =
  id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("") + "Tool";

mkdirSync(dest, { recursive: true });

writeFileSync(
  join(dest, "meta.ts"),
  `import type { ToolMeta } from "../types";

export const meta: ToolMeta = {
  id: "${id}",
  title: "${title}",
  summary: "TODO: one-line table description.",
  tags: ["TODO"],
};
`,
);

writeFileSync(
  join(dest, "Tool.tsx"),
  `import { Stack, Text } from "../../ui";

export function ${componentName}() {
  return (
    <Stack gap={12}>
      <h1>${title}</h1>
      <Text tone="secondary">TODO: build the interactive play aid.</Text>
    </Stack>
  );
}
`,
);

const registryPath = join(root, "src/tools/registry.ts");
let registry = readFileSync(registryPath, "utf8");

const importMeta = `import { meta as ${componentName}Meta } from "./${id}/meta";\n`;
const importComp = `import { ${componentName} } from "./${id}/Tool";\n`;

if (!registry.includes(`from "./${id}/meta"`)) {
  registry = registry.replace(
    'import type { ToolModule } from "./types";\n',
    `import type { ToolModule } from "./types";\n${importMeta}${importComp}`,
  );
}

const entry = `  {\n    meta: ${componentName}Meta,\n    Component: ${componentName},\n  },\n`;
if (!registry.includes(`${componentName}Meta`)) {
  registry = registry.replace(
    "export const tools: ToolModule[] = [\n",
    `export const tools: ToolModule[] = [\n${entry}`,
  );
}

writeFileSync(registryPath, registry);

console.log(`Created src/tools/${id}`);
console.log(`Registered ${componentName} in src/tools/registry.ts`);
console.log("Next: edit meta.ts + Tool.tsx, then npm run dev");
