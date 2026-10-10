import type { Component } from "solid-js";

type DocFrontmatter = {
  title: string;
  description: string;
  order: number;
};

type DocModule = {
  default: Component;
  frontmatter: unknown;
};

export type DocEntry = DocFrontmatter & {
  slug: string;
  content: Component;
};

const docModules = import.meta.glob<DocModule>("../../../content/docs/*.mdx", {
  eager: true,
});

function getDocSlug(path: string): string {
  const slug = path.match(/\/([^/]+)\.mdx$/)?.[1];

  if (!slug) {
    throw new Error(`Invalid docs content path: ${path}`);
  }

  return slug;
}

function isDocFrontmatter(value: unknown): value is DocFrontmatter {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("title" in value) || typeof value.title !== "string") {
    return false;
  }

  if (!("description" in value) || typeof value.description !== "string") {
    return false;
  }

  if (!("order" in value) || typeof value.order !== "number") {
    return false;
  }

  return true;
}

function getDocEntry(path: string, module: DocModule): DocEntry {
  if (!isDocFrontmatter(module.frontmatter)) {
    throw new Error(`Invalid doc frontmatter for: ${path}`);
  }

  return {
    slug: getDocSlug(path),
    ...module.frontmatter,
    content: module.default,
  };
}

export const docs = Object.entries(docModules)
  .map(([path, module]) => getDocEntry(path, module))
  .toSorted((left, right) => left.order - right.order);

const docsBySlug = Object.fromEntries(
  docs.map((entry) => [entry.slug, entry]),
) as Record<string, DocEntry>;

export function getDocBySlug(slug: string | undefined): DocEntry | undefined {
  if (!slug) {
    return undefined;
  }

  return docsBySlug[slug];
}
