import { Stack, Text } from "../../ui";

/** Replace this with the real interactive tool. */
export function TemplateTool() {
  return (
    <Stack gap={12}>
      <h1>New tool</h1>
      <Text tone="secondary">
        Implement the play aid here. Reuse components from `src/ui` and
        `usePersistentState` for trackers that should survive refresh.
      </Text>
    </Stack>
  );
}
