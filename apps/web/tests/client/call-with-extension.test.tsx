// @vitest-environment happy-dom
import { render } from "@solidjs/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallWithExtension } from "~/features/extension/call-with-extension";

const ASSIGNMENT_ID = "0199d3a0-0000-7000-8000-000000000042";
const EXECUTIVE_STATE = {
  presenceStatus: "ready",
  syncHealth: "ok",
  assignmentId: ASSIGNMENT_ID,
  contactId: "0199d3a0-0000-7000-8000-000000000007",
  phone: "999999111",
  presenceUpdatedAt: 1_000,
  syncUpdatedAt: 1_000,
};

type ExtensionReply = (message: unknown) => unknown;

// Mock the browser messaging boundary while leaving token handling in the app.
function installExtension(reply: ExtensionReply) {
  const received: unknown[] = [];
  const runtime = {
    lastError: undefined as { message: string } | undefined,
    sendMessage: (
      _extensionId: string,
      message: unknown,
      callback: (response?: unknown) => void,
    ) => {
      received.push(message);
      callback(reply(message));
    },
  };
  Object.assign(globalThis, { chrome: { runtime } });
  return { received, runtime };
}

function stubTokenEndpoint(response: Response) {
  const fetchStub = vi.fn<
    (url: string, init: RequestInit) => Promise<Response>
  >(async () => response);
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("CallWithExtension", () => {
  let container: HTMLElement;
  let dispose: () => void;

  beforeEach(() => {
    vi.stubEnv("VITE_CRM_EXTENSION_ID", "ext-test");
    container = document.createElement("div");
    document.body.append(container);
    dispose = render(
      () => <CallWithExtension assignmentId={ASSIGNMENT_ID} />,
      container,
    );
  });

  afterEach(() => {
    dispose();
    container.remove();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "chrome");
  });

  function clickCall() {
    const button = container.querySelector("button");
    if (!button) {
      throw new Error("the call button is not rendered");
    }
    button.click();
  }

  async function shownMessage(): Promise<string> {
    return vi.waitFor(() => {
      const message = container.querySelector("[role=status], [role=alert]");
      expect(message).not.toBeNull();
      return message?.textContent ?? "";
    });
  }

  it("offers the action before anything is sent", () => {
    expect(container.textContent).toContain("Llamar con la extensión");
    expect(container.querySelector("[role=status], [role=alert]")).toBeNull();
  });

  it("hands the signed token to the extension and reports success", async () => {
    const fetchStub = stubTokenEndpoint(
      jsonResponse({ handoffToken: "signed.token.value", expiresAt: 1 }),
    );
    const extension = installExtension(() => ({
      ok: true,
      executiveState: EXECUTIVE_STATE,
    }));

    clickCall();

    expect(await shownMessage()).toContain("Contacto enviado a la extensión");
    expect(fetchStub).toHaveBeenCalledWith(
      "/api/extension/handoff-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ assignmentId: ASSIGNMENT_ID }),
      }),
    );
    expect(extension.received).toEqual([
      { type: "assignment.handoff", token: "signed.token.value" },
    ]);
  });

  it("says the extension is missing when the page cannot reach one", async () => {
    stubTokenEndpoint(jsonResponse({ handoffToken: "signed.token.value" }));

    clickCall();

    expect(await shownMessage()).toContain("No se encontró la extensión");
  });

  it("says the extension is missing when the runtime reports an error", async () => {
    stubTokenEndpoint(jsonResponse({ handoffToken: "signed.token.value" }));
    const extension = installExtension(() => undefined);
    extension.runtime.lastError = {
      message: "Could not establish connection.",
    };

    clickCall();

    const message = await shownMessage();
    expect(message).toContain("No se encontró la extensión");
    expect(message).toContain("Could not establish connection.");
  });

  it("says the extension is missing when sending throws, and leaves the action usable", async () => {
    stubTokenEndpoint(jsonResponse({ handoffToken: "signed.token.value" }));
    const extension = installExtension(() => undefined);
    extension.runtime.sendMessage = () => {
      throw new TypeError("Invalid extension id: 'ext-test'");
    };

    clickCall();

    const message = await shownMessage();
    expect(message).toContain("No se encontró la extensión");
    expect(message).toContain("Invalid extension id");
    expect(container.querySelector("button")?.hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("shows why the extension refused the handoff", async () => {
    stubTokenEndpoint(jsonResponse({ handoffToken: "signed.token.value" }));
    installExtension(() => ({
      ok: false,
      error: "cannot replace handoff during an active call",
      executiveState: { ...EXECUTIVE_STATE, presenceStatus: "active" },
    }));

    clickCall();

    const message = await shownMessage();
    expect(message).toContain("Se rechazó el contacto");
    expect(message).toContain("cannot replace handoff during an active call");
  });

  it("shows why the server refused the token and never contacts the extension", async () => {
    stubTokenEndpoint(
      jsonResponse({ error: "La asignación ya no está activa." }, 409),
    );
    const extension = installExtension(() => ({
      ok: true,
      executiveState: EXECUTIVE_STATE,
    }));

    clickCall();

    const message = await shownMessage();
    expect(message).toContain("Se rechazó el contacto");
    expect(message).toContain("La asignación ya no está activa.");
    expect(extension.received).toEqual([]);
  });

  it("requests one token for repeated clicks while a handoff is pending", async () => {
    const fetchStub = stubTokenEndpoint(
      jsonResponse({ handoffToken: "signed.token.value" }),
    );
    installExtension(() => ({ ok: true, executiveState: EXECUTIVE_STATE }));

    clickCall();
    clickCall();

    await shownMessage();
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});
