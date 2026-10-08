import { expect, test } from "./fixtures";

test.describe("team invites", () => {
  test("an admin invites a teammate who activates and signs in", async ({
    asAdmin,
    browser,
    workerServer,
  }) => {
    const email = `newhire.${Date.now()}@e2e.local`;
    const password = "NewHirePass123!";

    await asAdmin.goto("/settings/members?tab=invite");

    // The page has multiple role selects; scope to the invite form.
    const form = asAdmin.locator("form").filter({
      has: asAdmin.getByRole("button", { name: "Enviar invitación" }),
    });

    await form.getByLabel("Nombres").fill("Nueva");
    await form.getByLabel("Primer apellido").fill("Contratacion");
    await form.getByLabel("Segundo apellido").fill("E2E");
    await form.getByLabel("Correo corporativo").fill(email);
    await form
      .getByRole("combobox", { name: "Rol", exact: true })
      .selectOption("back_office");
    await form.getByRole("button", { name: "Enviar invitación" }).click();

    const linkText = asAdmin.getByText(/https?:\/\/\S+\/login\/invite\/\S+/);

    await expect(linkText).toBeVisible();

    const inviteUrl = (await linkText.textContent())?.trim();

    if (!inviteUrl) {
      throw new Error("invite link was not surfaced");
    }

    const context = await browser.newContext({
      baseURL: workerServer.baseURL,
    });

    const invitee = await context.newPage();

    await invitee.goto(inviteUrl);

    await expect(
      invitee.getByRole("button", { name: "Activar cuenta" }),
    ).toBeVisible();

    await expect(invitee.locator(`input[value="${email}"]`)).toBeVisible();

    await invitee
      .getByPlaceholder("Contraseña", { exact: true })
      .fill(password);

    await invitee.getByPlaceholder("Confirmar contraseña").fill(password);

    await invitee.getByRole("button", { name: "Activar cuenta" }).click();

    await expect(invitee).not.toHaveURL(/\/login\/invite/);

    await context.close();
  });
});
