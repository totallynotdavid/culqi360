import { readdir } from "node:fs/promises";

type PackageManifest = {
  scripts?: Record<string, string>;
};

type ScriptLocation = {
  directory: string;
  name: string;
};

type WorkflowCommand = {
  directory: string;
  command: string;
};

const defaultTasks = ["test", "lint", "typecheck", "check", "build"];
const ignoredWorkflowFiles = new Set(["bench-search.yml", "codspeed.yml"]);
const ignoredWorkflowScripts = new Set(["test:perf"]);

function locationKey(location: ScriptLocation): string {
  return `${location.directory}:${location.name}`;
}

function normalizeDirectory(directory: string): string {
  return directory.replace(/\/+$/, "") || ".";
}

function commandTokens(command: string): string[] {
  return command.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? [];
}

function isPackageScriptName(name: string): boolean {
  return !name.includes("/") && !name.endsWith(".ts");
}

function scriptReferences(
  command: string,
  baseDirectory: string,
): ScriptLocation[] {
  const references: ScriptLocation[] = [];
  const runPattern = /\bbun run\b([^;&|\n]*)/g;
  const optionsWithValues = new Set(["--cwd", "--env-file", "--filter"]);

  for (const match of command.matchAll(runPattern)) {
    const tokens = commandTokens(match[1]);
    let directory = baseDirectory;
    const names: string[] = [];
    let parallel = false;

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index].replace(/^['"]|['"]$/g, "");
      if (!token) continue;
      if (token === "--parallel") {
        parallel = true;
        continue;
      }
      if (token.startsWith("--")) {
        if (optionsWithValues.has(token)) index += 1;
        continue;
      }
      if (!parallel && names.length > 0) continue;
      if (token === "--") continue;
      names.push(token);
    }

    const cwdTokenIndex = tokens.findIndex(
      (token) => token.replace(/^['"]|['"]$/g, "") === "--cwd",
    );
    if (cwdTokenIndex >= 0 && tokens[cwdTokenIndex + 1]) {
      directory = normalizeDirectory(
        tokens[cwdTokenIndex + 1].replace(/^['"]|['"]$/g, ""),
      );
    }

    for (const name of names) {
      if (isPackageScriptName(name)) references.push({ directory, name });
    }
  }

  return references;
}

function directCommands(command: string): string[] {
  const references: string[] = [];
  const directPattern = /\b(cargo|bash)\s+([^;&|\n]+)/g;

  for (const match of command.matchAll(directPattern)) {
    references.push(`${match[1]} ${match[2].trim()}`);
  }

  return references;
}

function parseTomlValue(value: string): string[] {
  if (value.trim().startsWith("[")) {
    return [...value.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
  }

  const match = value.match(/^\s*"([^"]*)"/);
  return match ? [match[1]] : [];
}

function parseMiseTaskCommands(mise: string, taskName: string): string[] {
  const sectionPattern = new RegExp(
    `\\[tasks\\.${taskName}\\]([\\s\\S]*?)(?=\\n\\[|$)`,
  );
  const section = mise.match(sectionPattern)?.[1] ?? "";
  const runValue = section.match(/^\s*run\s*=\s*(.+)$/m)?.[1] ?? "";
  return parseTomlValue(runValue);
}

async function readManifest(directory: string): Promise<PackageManifest> {
  return await Bun.file(`${directory}/package.json`).json();
}

function parseCargoAliases(config: string): Map<string, string[]> {
  const aliases = new Map<string, string[]>();
  const aliasPattern = /^\s*([\w-]+)\s*=\s*(.+)$/gm;

  for (const match of config.matchAll(aliasPattern)) {
    const value = parseTomlValue(match[2]);
    if (value.length > 0) aliases.set(match[1], value);
  }

  return aliases;
}

function normalizeCargoCommand(
  command: string,
  aliases: Map<string, string[]>,
): string {
  const tokens = commandTokens(command);
  if (tokens[0] !== "cargo" || !tokens[1]) return command.trim();

  const alias = aliases.get(tokens[1]);
  if (!alias) return command.trim();

  return normalizeCargoCommand(
    ["cargo", ...alias, ...tokens.slice(2)].join(" "),
    aliases,
  );
}

function workflowRunCommands(workflow: string): WorkflowCommand[] {
  const commands: WorkflowCommand[] = [];
  const lines = workflow.split("\n");
  let stepDirectory = ".";
  let runIndent = -1;
  let block: string[] = [];

  const flush = () => {
    if (block.length > 0) {
      commands.push({ directory: stepDirectory, command: block.join("\n") });
      block = [];
    }
    runIndent = -1;
  };

  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (runIndent >= 0 && trimmed && indent <= runIndent) flush();
    if (trimmed.startsWith("- ")) stepDirectory = ".";

    const workingDirectory = line.match(/^\s+working-directory:\s*(\S+)\s*$/);
    if (workingDirectory) {
      stepDirectory = normalizeDirectory(workingDirectory[1]);
      continue;
    }

    const run = line.match(/^(\s*)run:\s*(.*)$/);
    if (!run) {
      if (runIndent >= 0 && !trimmed) block.push("");
      else if (runIndent >= 0 && indent > runIndent) block.push(trimmed);
      continue;
    }

    flush();
    runIndent = run[1].length;
    const isBlockScalar = /^[|>][-+]?$/.test(run[2]);
    if (run[2] && !isBlockScalar) {
      commands.push({ directory: stepDirectory, command: run[2] });
      runIndent = -1;
    }
  }

  flush();
  return commands;
}

async function localReferences(): Promise<{
  scripts: Set<string>;
  commands: Set<string>;
}> {
  const scripts = new Set<string>();
  const commands = new Set<string>();
  const mise = await Bun.file("mise.toml").text();
  const aliases = parseCargoAliases(
    await Bun.file(".cargo/config.toml").text(),
  );
  const visited = new Set<string>();

  async function visit(location: ScriptLocation): Promise<void> {
    const normalized = {
      ...location,
      directory: normalizeDirectory(location.directory),
    };
    const key = locationKey(normalized);
    if (visited.has(key)) return;
    visited.add(key);

    const manifest = await readManifest(normalized.directory);
    const script = manifest.scripts?.[normalized.name];
    if (!script) {
      throw new Error(`Local check task references missing script ${key}`);
    }

    scripts.add(key);
    for (const command of directCommands(script)) {
      commands.add(normalizeCargoCommand(command, aliases));
    }
    await Promise.all(
      scriptReferences(script, normalized.directory).map((reference) =>
        visit(reference),
      ),
    );
  }

  const taskCommands = defaultTasks.flatMap((task) =>
    parseMiseTaskCommands(mise, task),
  );
  await Promise.all(
    taskCommands.map(async (command) => {
      for (const direct of directCommands(command)) {
        commands.add(normalizeCargoCommand(direct, aliases));
      }
      await Promise.all(
        scriptReferences(command, ".").map((reference) => visit(reference)),
      );
    }),
  );

  return { scripts, commands };
}

async function workflowReferences(): Promise<{
  scripts: Set<string>;
  commands: Set<string>;
  excluded: string[];
}> {
  const scripts = new Set<string>();
  const commands = new Set<string>();
  const excluded: string[] = [];
  const workflowFiles = (await readdir(".github/workflows")).filter(
    (file) => file.endsWith(".yml") || file.endsWith(".yaml"),
  );

  const workflows = await Promise.all(
    workflowFiles.map(async (file) => ({
      file,
      workflow: await Bun.file(`.github/workflows/${file}`).text(),
    })),
  );

  for (const { file, workflow } of workflows) {
    if (ignoredWorkflowFiles.has(file)) {
      excluded.push(file);
      continue;
    }

    for (const run of workflowRunCommands(workflow)) {
      for (const reference of scriptReferences(run.command, run.directory)) {
        if (!ignoredWorkflowScripts.has(reference.name)) {
          scripts.add(locationKey(reference));
        }
      }
      for (const command of directCommands(run.command)) {
        commands.add(command);
      }
    }
  }

  return { scripts, commands, excluded };
}

const local = await localReferences();
const ci = await workflowReferences();
const aliases = parseCargoAliases(await Bun.file(".cargo/config.toml").text());
const missingScripts = [...ci.scripts].filter(
  (script) => !local.scripts.has(script),
);
const missingCommands = [...ci.commands].filter(
  (command) => !local.commands.has(normalizeCargoCommand(command, aliases)),
);

if (missingScripts.length > 0 || missingCommands.length > 0) {
  if (missingScripts.length > 0) {
    console.error(
      `CI scripts are outside the default local check tasks: ${missingScripts.sort().join(", ")}`,
    );
  }
  if (missingCommands.length > 0) {
    console.error(
      `CI commands are outside the default local check tasks: ${missingCommands.sort().join(", ")}`,
    );
  }
  process.exit(1);
}

console.log(
  `CI/local parity verified for ${ci.scripts.size} workflow scripts and ${ci.commands.size} direct commands; performance workflows excluded: ${ci.excluded.join(", ")}; performance scripts excluded: ${[...ignoredWorkflowScripts].join(", ")}`,
);
