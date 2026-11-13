import { expect, test } from "./fixtures";
import { rosterByKey } from "./roster";

const MEMBER = rosterByKey("executive");

declare global {
  interface Window {
    allowResetLinkCopy: boolean;
  }
}

test.describe("member reset link", () => {
  test("an admin generates a link, falls back to manual copy, then copies", async ({
    browser,
    workerServer,
  }) => {
    const admin = rosterByKey("admin");
    const context = await browser.newContext({
      baseURL: workerServer.baseURL,
    });
    await context.addInitScript(() => {
      window.allowResetLinkCopy = false;
      navigator.clipboard.writeText = (text: string) =>
        window.allowResetLinkCopy
          ? Promise.resolve()
          : Promise.reject(new Error(`denied: ${text.length}`));
    });
    await context.addCookies([
      { name: "session", value: admin.token, url: workerServer.baseURL },
    ]);
    const page = await context.newPage();

    await page.goto(`/settings/members/${MEMBER.userId}`);
    await page.getByRole("button", { name: "Generar enlace" }).click();

    const field = page.getByLabel("Enlace de restablecimiento");
    await expect(field).toHaveValue(/\/reset-password\?token=[a-z2-7]{32}$/);
    await expect(
      page.getByText("Válido por 1 hora y de un solo uso."),
    ).toBeVisible();

    // Auto-copy was denied: link stays visible for manual copy.
    await expect(page.getByText("Copia el enlace manualmente")).toBeVisible();

    await page.evaluate(() => (window.allowResetLinkCopy = true));
    await page.getByRole("button", { name: "Copiar enlace" }).click();
    await expect(page.getByRole("button", { name: "Copiado" })).toBeVisible();

    await context.close();
  });

  test("a member who cannot manage sees no reset-link section", async ({
    signInAs,
  }) => {
    // hr can read the team but lacks team:manage.
    const page = await signInAs("hr");

    await page.goto(`/settings/members/${MEMBER.userId}`);
    await expect(page.getByText(MEMBER.email)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contraseña" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Generar enlace" }),
    ).toHaveCount(0);
  });
});
