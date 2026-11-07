import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { responsiveImagesPlugin } from "../../../../../packages/images/src/vite-plugin";

const repositoryRoot = resolve(process.cwd(), "../..");

type Middleware = (
  request: { url?: string },
  response: {
    setHeader: (name: string, value: string) => void;
    end: (body: Uint8Array) => void;
  },
  next: () => void,
) => void | Promise<void>;

function installMiddleware(root: string): Middleware {
  let middleware: Middleware | undefined;
  const plugin = responsiveImagesPlugin();

  if (typeof plugin.configResolved === "function") {
    void Reflect.apply(plugin.configResolved, undefined, [
      { root, command: "serve" },
    ]);
  }

  if (typeof plugin.configureServer !== "function") {
    throw new Error("responsive image plugin did not configure a dev server");
  }

  void Reflect.apply(plugin.configureServer, undefined, [
    {
      middlewares: {
        use(handler: Middleware) {
          middleware = handler;
        },
      },
    },
  ]);

  if (!middleware) {
    throw new Error("responsive image plugin did not install middleware");
  }

  return middleware;
}

describe("responsive image dev middleware", () => {
  it("does not serve a file outside the Vite root", async () => {
    const middleware = installMiddleware(resolve(repositoryRoot, "apps/web"));
    let nextCalled = false;
    const headers = new Map<string, string>();

    await middleware(
      { url: "/../extension/public/icon/16.png?responsive-format=png" },
      {
        setHeader(name, value) {
          headers.set(name, value);
        },
        end() {
          throw new Error("middleware served a file outside its root");
        },
      },
      () => {
        nextCalled = true;
      },
    );

    expect(nextCalled).toBe(true);
    expect(headers.size).toBe(0);
  });

  it("does not serve a root-local symlink to a file outside the Vite root", async () => {
    const temporaryRoot = await fs.mkdtemp(
      join(tmpdir(), "responsive-images-test-"),
    );
    const linkedPath = join(temporaryRoot, "linked.png");
    const outsideImage = resolve(
      repositoryRoot,
      "apps/extension/public/icon/16.png",
    );

    try {
      await fs.symlink(outsideImage, linkedPath);
      const middleware = installMiddleware(temporaryRoot);
      let nextCalled = false;

      await middleware(
        { url: "/linked.png?responsive-format=png" },
        {
          setHeader() {},
          end() {
            throw new Error("middleware served a file through a symlink");
          },
        },
        () => {
          nextCalled = true;
        },
      );

      expect(nextCalled).toBe(true);
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("does not read an ICO fallback through a root-local symlink", async () => {
    const temporaryRoot = await fs.mkdtemp(
      join(tmpdir(), "responsive-images-test-"),
    );
    const sourcePath = join(temporaryRoot, "source.png");
    const icoPath = join(temporaryRoot, "source.ico");
    const outsideImage = resolve(
      repositoryRoot,
      "apps/extension/public/icon/16.png",
    );

    try {
      await fs.copyFile(outsideImage, sourcePath);
      await fs.symlink(outsideImage, icoPath);
      const middleware = installMiddleware(temporaryRoot);
      let contentType = "";

      await middleware(
        { url: "/source.png?responsive-format=ico" },
        {
          setHeader(name, value) {
            if (name === "Content-Type") contentType = value;
          },
          end() {},
        },
        () => {
          throw new Error("middleware did not serve the source fallback");
        },
      );

      expect(contentType).toBe("image/png");
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
