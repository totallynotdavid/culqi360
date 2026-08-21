import { makeAuthSession } from "@tests/support/unit/factories";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserId } from "~/domain/ids";
import type { AvatarService } from "~/server/users/avatar-service";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<unknown>>(),
  get: vi.fn<AvatarService["get"]>(),
}));

vi.mock("~/server/platform/action/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("~/server/composition/application", () => ({
  getApplication: () => ({ users: { avatars: { get: mocks.get } } }),
}));

const { respondWithAvatar } = await import("~/server/users/avatar-http");
const { GET: getOwnAvatar } = await import("~/routes/api/me/avatar");
const { GET: getUserAvatar } =
  await import("~/routes/api/users/[userId]/avatar");

const userId = UserId.trust("7");
const teammateId = "00000000-0000-4000-8000-000000000009";

function requestAvatar(
  request = new Request("http://localhost/api/me/avatar"),
) {
  return respondWithAvatar(request, userId, { get: mocks.get });
}

function storedAvatar(version: number) {
  return {
    ok: true as const,
    value: {
      storageKey: "7/avatar.png",
      mimeType: "image/png",
      version,
      updatedAt: new Date(),
      bytes: new Uint8Array([1, 2, 3]),
    },
  };
}

describe("avatar response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a missing avatar", async () => {
    mocks.get.mockResolvedValue({
      ok: false,
      error: { code: "avatar_not_found" },
    });

    const response = await requestAvatar();

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Profile picture not found");
  });

  it("reports unavailable avatar storage", async () => {
    mocks.get.mockResolvedValue({
      ok: false,
      error: { code: "storage_unavailable" },
    });

    const response = await requestAvatar();

    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toBe(
      "Profile picture service unavailable",
    );
  });

  it("honors a matching ETag", async () => {
    mocks.get.mockResolvedValue(storedAvatar(3));

    const response = await requestAvatar(
      new Request("http://localhost/api/me/avatar", {
        headers: { "if-none-match": '"avatar-7-v3"' },
      }),
    );

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"avatar-7-v3"');
  });

  it("returns the stored avatar", async () => {
    mocks.get.mockResolvedValue(storedAvatar(4));

    const response = await requestAvatar();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("etag")).toBe('"avatar-7-v4"');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
  });

  it("reports a missing user", async () => {
    mocks.get.mockResolvedValue({
      ok: false,
      error: { code: "user_not_found" },
    });

    const response = await requestAvatar();

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("User not found");
  });

  it("reports an unavailable avatar repository", async () => {
    mocks.get.mockResolvedValue({
      ok: false,
      error: { code: "repository_unavailable" },
    });

    const response = await requestAvatar();

    expect(response.status).toBe(503);
  });
});

describe("avatar routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests for your own avatar", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await getOwnAvatar({
      request: new Request("http://localhost/api/me/avatar"),
    });

    expect(response.status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests for a teammate's avatar", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await getUserAvatar({
      request: new Request("http://localhost/api/users/7/avatar"),
      params: { userId: "7" },
    });

    expect(response.status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("rejects a teammate's avatar without team:read", async () => {
    mocks.getSession.mockResolvedValue(
      makeAuthSession({ userId, role: "executive" }),
    );

    const response = await getUserAvatar({
      request: new Request(`http://localhost/api/users/${teammateId}/avatar`),
      params: { userId: teammateId },
    });

    expect(response.status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("serves a teammate's avatar to a permitted reader", async () => {
    mocks.getSession.mockResolvedValue(
      makeAuthSession({ userId, role: "superuser" }),
    );
    mocks.get.mockResolvedValue(storedAvatar(2));

    const response = await getUserAvatar({
      request: new Request(`http://localhost/api/users/${teammateId}/avatar`),
      params: { userId: teammateId },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe(`"avatar-${teammateId}-v2"`);
  });
});
