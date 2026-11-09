import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/#/tools/gary-grapplesauce-combat");
  await expect(page.getByRole("heading", { name: "Gary Grapplesauce" })).toBeVisible();
});

test("walks into a turn and back to the start", async ({ page }) => {
  await page.getByRole("button", { name: "My turn" }).click();
  await expect(page.getByRole("button", { name: "Deal damage" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "My turn" })).toBeVisible();
});

test("keeps damage and healing apart", async ({ page }) => {
  await page.getByRole("tab", { name: "Hit" }).click();
  await expect(page.getByRole("button", { name: "Take damage" })).toBeVisible();
  await page.getByRole("tab", { name: "Heal" }).click();
  await expect(page.getByRole("button", { name: "Heal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Full HP" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Take damage" })).toHaveCount(0);
});

test("offers a hit die and a two-tap sheet reset", async ({ page }) => {
  await page.getByRole("tab", { name: "Rest" }).click();
  await expect(page.getByRole("button", { name: /Spend 1d10/ })).toBeDisabled();
  await page.getByRole("button", { name: "Reset sheet" }).click();
  await expect(page.getByText("Tap Reset sheet again")).toBeVisible();
});

test("tapping Play again leaves a plan", async ({ page }) => {
  await page.getByRole("button", { name: "My turn" }).click();
  await page.getByRole("button", { name: "Deal damage" }).click();
  await page.getByRole("tab", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "My turn" })).toBeVisible();
});

test("takes damage, drops to 0, and healing clears the death saves", async ({ page }) => {
  const hp = page.getByRole("meter", { name: "Hit points" });
  await expect(hp).toHaveAttribute("aria-valuenow", "103");

  await page.getByRole("tab", { name: "Hit" }).click();
  await page.getByRole("textbox", { name: "Damage amount" }).fill("102");
  await page.getByRole("button", { name: "Take damage" }).click();
  await expect(hp).toHaveAttribute("aria-valuenow", "1");

  await page.getByRole("textbox", { name: "Damage amount" }).fill("1");
  await page.getByRole("button", { name: "Take damage" }).click();
  await expect(page.getByRole("button", { name: "Roll save" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Now" }).getByText("Dying"),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Healing amount" }).fill("10");
  await page.getByRole("button", { name: "Heal", exact: true }).click();
  await expect(hp).toHaveAttribute("aria-valuenow", "10");
  await expect(page.getByRole("button", { name: "Roll save" })).toHaveCount(0);
});

test("spends a hit die after Gary is hurt", async ({ page }) => {
  await page.getByRole("tab", { name: "Hit" }).click();
  await page.getByRole("textbox", { name: "Damage amount" }).fill("20");
  await page.getByRole("button", { name: "Take damage" }).click();
  await expect(page.getByRole("meter", { name: "Hit points" })).toHaveAttribute(
    "aria-valuenow",
    "83",
  );

  await page.getByRole("tab", { name: "Rest" }).click();
  await page.getByRole("button", { name: /Spend 1d10/ }).click();
  await expect(page.getByText("8 dice left")).toBeVisible();
  const now = await page
    .getByRole("meter", { name: "Hit points" })
    .getAttribute("aria-valuenow");
  expect(Number(now)).toBeGreaterThan(83);
  expect(Number(now)).toBeLessThanOrEqual(96);
});

test("spends Haymaker and undoes it from the plan", async ({ page }) => {
  await page.getByRole("button", { name: "My turn" }).click();
  await page.getByRole("button", { name: "Deal damage" }).click();
  await page.getByRole("button", { name: "Haymaker · 1 Moxie" }).click();
  await expect(page.getByText("4/5")).toBeVisible();
  await page.locator(".sticky").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("5/5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Haymaker · 1 Moxie" })).toBeEnabled();
});

test("taking off the lifting belt lowers the punch", async ({ page }) => {
  await page.getByRole("tab", { name: "Gear" }).click();
  const visible = (text: string) =>
    page.getByText(text, { exact: true }).filter({ visible: true });
  await expect(visible("1d10+5").first()).toBeVisible();
  await page.getByRole("switch", { name: "Equip Lifting Belt" }).click();
  await expect(visible("1d10-1").first()).toBeVisible();
});

test("a condition changes what Gary can do", async ({ page }) => {
  await page.getByRole("tab", { name: "Conds" }).click();
  await page.getByRole("button", { name: "Blinded", exact: true }).click();
  await expect(page.getByText("Attack +9 Dis")).toBeVisible();
});

test("the dice tray rolls a die into the log", async ({ page }) => {
  await page.getByRole("button", { name: "Dice", exact: true }).click();
  const tray = page.getByRole("dialog", { name: "Dice" });
  await tray.getByRole("button", { name: "Roll 1d20" }).click();
  await expect(tray.getByText("1d20").first()).toBeVisible();
});
