import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import type { Plugin, ResolvedConfig } from "vite";

export function responsiveImagesPlugin(): Plugin {
  let config: ResolvedConfig;

  return {
    name: "crm-responsive-images",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // req.url might be relative or include the base path
        const urlPath = req.url?.split("?")[0] || "";
        const searchParams = new URLSearchParams(req.url?.split("?")[1] || "");
        const format = searchParams.get("responsive-format");

        if (format) {
          // Resolve the file path relative to the root
          const filePath = path.join(config.root, urlPath);
          if (existsSync(filePath)) {
            try {
              const sourceBuffer = await fs.readFile(filePath);
              let outputBuffer: Buffer;
              let contentType = `image/${format}`;

              if (format === "avif") {
                outputBuffer = await sharp(sourceBuffer).avif().toBuffer();
              } else if (format === "webp") {
                outputBuffer = await sharp(sourceBuffer).webp().toBuffer();
              } else if (format === "ico") {
                const icoPath = filePath.replace(
                  path.extname(filePath),
                  ".ico",
                );
                if (existsSync(icoPath)) {
                  outputBuffer = await fs.readFile(icoPath);
                  contentType = "image/x-icon";
                } else {
                  outputBuffer = await sharp(sourceBuffer).png().toBuffer();
                  contentType = "image/png";
                }
              } else if (format === "png") {
                outputBuffer = await sharp(sourceBuffer).png().toBuffer();
              } else if (format === "jpg" || format === "jpeg") {
                outputBuffer = await sharp(sourceBuffer).jpeg().toBuffer();
              } else {
                outputBuffer = await sharp(sourceBuffer).png().toBuffer();
              }

              res.setHeader("Content-Type", contentType);
              res.setHeader("Cache-Control", "max-age=3600");
              res.end(outputBuffer);
              return;
            } catch (e) {
              return next(e);
            }
          }
        }
        next();
      });
    },
    async transform(_code, id) {
      if (!id.includes("?responsive")) return null;

      const cleanId = id.split("?")[0] ?? id;
      const isDev = config.command === "serve";

      if (isDev) {
        const relativePath = path.relative(config.root, cleanId);
        // We use the absolute path from the root for the dev URL
        const results = {
          avif: `/${relativePath}?responsive-format=avif`,
          webp: `/${relativePath}?responsive-format=webp`,
          png: `/${relativePath}?responsive-format=png`,
          fallback: `/${relativePath}?responsive-format=ico`,
        };
        return {
          code: `export default ${JSON.stringify(results, null, 2)};`,
          map: null,
        };
      }

      const sourceBuffer = await fs.readFile(cleanId);
      const ext = path.extname(cleanId);
      const baseName = path.basename(cleanId, ext);

      const formats = ["avif", "webp", "png"] as const;

      const formatResults = await Promise.all(
        formats.map(async (format) => {
          try {
            let outputBuffer: Buffer;
            if (format === "avif") {
              outputBuffer = await sharp(sourceBuffer).avif().toBuffer();
            } else if (format === "webp") {
              outputBuffer = await sharp(sourceBuffer).webp().toBuffer();
            } else if (format === "png") {
              outputBuffer = await sharp(sourceBuffer).png().toBuffer();
            } else if (format === "jpg" || format === "jpeg") {
              outputBuffer = await sharp(sourceBuffer).jpeg().toBuffer();
            } else {
              outputBuffer = await sharp(sourceBuffer).png().toBuffer();
            }

            const referenceId = this.emitFile({
              type: "asset",
              name: `${baseName}.${format}`,
              source: outputBuffer,
            });

            return [format, referenceId] as const;
          } catch (e) {
            console.warn(`Failed to generate ${format} for ${cleanId}:`, e);
            return null;
          }
        }),
      );

      const emittedAssets: Record<string, string> = {};

      formatResults.forEach((result) => {
        if (result) {
          emittedAssets[result[0]] = result[1];
        }
      });

      // Special handling for ICO (static fallback)
      const icoPath = cleanId.replace(ext, ".ico");
      if (existsSync(icoPath)) {
        const icoBuffer = await fs.readFile(icoPath);
        const referenceId = this.emitFile({
          type: "asset",
          name: `${baseName}.ico`,
          source: icoBuffer,
        });
        emittedAssets["fallback"] = referenceId;
      } else if (emittedAssets["png"]) {
        // Default fallback to PNG if no .ico found
        emittedAssets["fallback"] = emittedAssets["png"];
      }

      const moduleOutput = Object.entries(emittedAssets)
        .map(
          ([key, refId]) =>
            `"${key === "fallback" ? "fallback" : key}": "__VITE_ASSET__${refId}__"`,
        )
        .join(",\n  ");

      return {
        code: `export default {\n  ${moduleOutput}\n};`,
        map: null,
      };
    },
  };
}
