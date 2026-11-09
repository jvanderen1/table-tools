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
