import { expect, test, type Page } from "@playwright/test";

// Phone check (audit 21 Oct): no sideways scrolling, one h1, a language, and every control and image named.
// Public pages first, then the pages that need a profile (a demo profile is created once).
const PUBLIC = ["/", "/careers", "/how-it-works", "/about", "/privacy", "/admin", "/advisor"];
const WITH_PROFILE = ["/dashboard", "/skills", "/careers", "/careers/check", "/learn", "/evidence", "/assessment", "/settings"];

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

async function audit(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const controls = [...document.querySelectorAll("button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=radio],[role=checkbox],[role=tab]")].filter(visible);
    const unnamed = controls.filter((e) => {
      const el = e as HTMLInputElement;
      return !(e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.textContent?.trim() || e.getAttribute("title") ||
        e.getAttribute("placeholder") || (el.labels && el.labels.length) || e.querySelector("img[alt]"));
    });
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      lang: document.documentElement.lang,
      h1: document.querySelectorAll("h1").length,
      unnamed: unnamed.map((e) => e.outerHTML.slice(0, 90)),
      imagesWithoutAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
      // checkboxes that were 20 px before the fix: a touch target must be at least 24 x 24 px (WCAG 2.2, 2.5.8)
      // the size that can be tapped is the box or its ::after hit area, whichever is larger (the shared Checkbox widens it)
      tinyCheckboxes: [...document.querySelectorAll("[role=checkbox]")].filter(visible).filter((e) => {
        const r = e.getBoundingClientRect();
        const after = getComputedStyle(e, "::after");
        const w = Math.max(r.width, parseFloat(after.width) || 0);
        const h = Math.max(r.height, parseFloat(after.height) || 0);
        return w < 24 || h < 24;
      }).length,
    };
  });
}

async function expectPhoneFriendly(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), path).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  const a = await audit(page);
  expect(a.overflow, `${path} scrolls sideways`).toBe(false);
  expect(a.lang, `${path} lang`).toBe("id");
  expect(a.h1, `${path} h1`).toBe(1);
  expect(a.unnamed, `${path} unnamed controls`).toEqual([]);
  expect(a.imagesWithoutAlt, `${path} images without alt`).toBe(0);
  expect(a.tinyCheckboxes, `${path} checkboxes under 24 px`).toBe(0);
}

test("public pages are phone friendly", async ({ page }) => {
  for (const path of PUBLIC) await expectPhoneFriendly(page, path);
});

test("pages with a profile are phone friendly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /profil mahasiswa demo/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 150_000 });
  for (const path of WITH_PROFILE) await expectPhoneFriendly(page, path);
});
