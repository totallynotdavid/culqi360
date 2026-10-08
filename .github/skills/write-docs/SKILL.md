---
name: write-docs
description:
  "Write or revise technical Markdown documents. Use when editing READMEs,
  runbooks, architecture notes, setup guides, or contributor documentation.
  Covers document framing, paragraph structure, link labels, command blocks, and
  readability review."
---

## workflow

1. Read the document and the code, config, or commands it describes.
2. Identify the document class before editing: front page, task guide,
   architecture note, runbook, or reference.
3. Draft or rewrite the content in plain text first.
4. Add headings, lists, links, and tables only after the prose is coherent.
5. Verify commands, file references, and configuration names against source
   files.
6. Remove any sentence that does not add a fact, a constraint, or a procedure.
7. Reread the document in raw Markdown and in rendered order.

## document rules

- Start with the document job.
- Use headings only for distinct technical topics.
- Group by task, flow, or system boundary.
- Keep lists for steps, options, and parallel items.
- Use prose when sequence is not the main point.
- Introduce command blocks with one short lead-in sentence when context is
  needed.
- Put volatile details near the source-of-truth file or regeneration command
  that controls them.

## editing rules

- Use short declarative sentences.
- Keep one technical idea per paragraph.
- Make the first sentence carry the paragraph topic.
- Prefer concrete nouns and direct verbs.
- Use the same term for the same concept throughout the document.
- Link files and directories that the reader is expected to inspect.
- Use readable link labels; keep the precise path in the target.
- Use tables only for data that is naturally tabular.
- Prefer procedural statements over value judgments.
- Example: `Run migrations before starting the worker.` is better than
  `This worker is important during setup.`

## review rubric

- Job clarity: the first screen makes the document purpose obvious.
- Section economy: each heading introduces a distinct topic with enough content
  to justify it.
- Sentence utility: each sentence adds a fact, a constraint, or a procedure.
- Paragraph shape: each paragraph develops one idea and stops.
- Readability: links, paths, and command blocks do not interrupt the prose.
- Specificity: statements name concrete interfaces, files, inputs, outputs, or
  failure conditions.
- Maintainability: volatile facts point back to the file or command that
  controls them.

## fail conditions

- Headings exist only to complete an outline.
- Paragraphs are lists in disguise.
- Visible links read like raw filesystem paths when a shorter label would be
  clear.
- Commands appear without enough context to know when to run them.
- The same concept is renamed for variety.
- The text is generic enough to fit a different repository unchanged.
