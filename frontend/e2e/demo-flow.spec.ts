import { expect, test } from "@playwright/test";

// The three-minute demo: demo profile -> dashboard -> Cek Lowongan -> learning loop -> one practice answer.
test("demo flow works end to end", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /contoh mahasiswa/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 150_000 });
  await expect(page.getByRole("heading", { name: /Rani \(demo\)/ })).toBeVisible();

  await page.goto("/careers/check");
  await page.getByRole("button", { name: "Pakai contoh" }).click();
  await page.getByRole("button", { name: "Cek kesiapanku" }).click();
  await expect(page.getByText("Kesiapanmu untuk lowongan ini")).toBeVisible();
  await expect(page.getByText("Mulai dari sini")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Yang dibaca PathSync" })).toBeVisible();

  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Siklus belajar" }).first()).toBeVisible();
  await expect(page.getByText("Langkah berikutnya").first()).toBeVisible();

  await page.goto("/learn/practice/requirements_elicitation?tier=basic");
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Periksa jawaban" }).click();
  await expect(page.getByText(/^(Benar|Belum tepat)$/)).toBeVisible();
  await expect(page.getByText("Inti:")).toBeVisible();
});

test("public pages load without a profile", async ({ page }) => {
  for (const path of ["/", "/careers", "/how-it-works"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
  }
});
