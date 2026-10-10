// BenchmarkRunner skips beforeAll/afterAll/beforeEach/afterEach for bench
// suites, so this runner invokes suite hooks around the normal bench execution:
// - https://github.com/vitest-dev/vitest/issues/5075
// - https://github.com/vitest-dev/vitest/discussions/7850
//
// This runner is used only for local uninstrumented `vitest bench`. Under
// CodSpeed the plugin swaps in its own runner: the analysis (simulation) runner
// already invokes these hooks and measures a single call, so beforeEach runs
// before every measured call.
import { BenchmarkRunner, TestRunner } from "vitest";

type Suite = Parameters<BenchmarkRunner["runSuite"]>[0];
type SuiteHook = (...args: never[]) => unknown;

function getChildSuites(suite: Suite): Suite[] {
  return suite.tasks.filter((task): task is Suite => task.type === "suite");
}

async function runBeforeAllHooks(suite: Suite): Promise<void> {
  const hooks = TestRunner.getSuiteHooks(suite).beforeAll;
  for (const hook of hooks) {
    await hook(suite);
  }

  for (const childSuite of getChildSuites(suite)) {
    await runBeforeAllHooks(childSuite);
  }
}

async function runAfterAllHooks(suite: Suite): Promise<void> {
  for (const childSuite of getChildSuites(suite)) {
    await runAfterAllHooks(childSuite);
  }

  const hooks = TestRunner.getSuiteHooks(suite).afterAll;
  for (const hook of hooks.toReversed()) {
    await hook(suite);
  }
}

async function runBeforeEachHooks(suite: Suite): Promise<void> {
  const hooks = TestRunner.getSuiteHooks(suite).beforeEach as SuiteHook[];
  for (const hook of hooks) {
    await hook();
  }

  for (const childSuite of getChildSuites(suite)) {
    await runBeforeEachHooks(childSuite);
  }
}

async function runAfterEachHooks(suite: Suite): Promise<void> {
  for (const childSuite of getChildSuites(suite)) {
    await runAfterEachHooks(childSuite);
  }

  const hooks = TestRunner.getSuiteHooks(suite).afterEach as SuiteHook[];
  for (const hook of hooks.toReversed()) {
    await hook();
  }
}

export default class BenchRunner extends BenchmarkRunner {
  override async runSuite(suite: Suite): Promise<void> {
    await runBeforeAllHooks(suite);
    await runBeforeEachHooks(suite);
    try {
      await super.runSuite(suite);
    } finally {
      await runAfterEachHooks(suite);
      await runAfterAllHooks(suite);
    }
  }
}
