import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storeSource = await readFile(
  new URL("../src/stores/app-store.ts", import.meta.url),
  "utf8",
);
const sidebarSource = await readFile(
  new URL("../src/components/Sidebar.tsx", import.meta.url),
  "utf8",
);

test("project activation separates visible transcript state from background run state", () => {
  const activationBlock = storeSource.match(
    /activateProject: async[\s\S]*?openProjectPath:/,
  )?.[0] ?? "";
  assert.match(activationBlock, /switchesVisibleProject[\s\S]*activeSessionId: undefined/);
  assert.match(activationBlock, /switchesVisibleProject[\s\S]*messages: \[\]/);
  assert.match(activationBlock, /switchesVisibleProject[\s\S]*isRunning: false/);
  assert.doesNotMatch(
    activationBlock,
    /runningSessions:\s*\{\}/,
  );
  assert.doesNotMatch(activationBlock, /permission:\s*null/);
});

test("closed projects are not recreated from historical sidebar sessions", () => {
  assert.doesNotMatch(sidebarSource, /add\(session\.projectPath\)/);
  assert.match(sidebarSource, /const entry = byPath\.get\(sessionPath\)/);
  assert.match(sidebarSource, /if \(entry\) entry\.sessions\.push\(session\)/);
});

test("project session creation stops when project activation fails", () => {
  assert.match(
    sidebarSource,
    /const createProjectSession[\s\S]*if \(!\(await selectProject\(path\)\)\) return;[\s\S]*createSession/,
  );
  assert.match(sidebarSource, /return Boolean\(await activateProject\(path\)\)/);
});

test("manual ordering stays a persistence-only compatibility value", () => {
  assert.doesNotMatch(sidebarSource, /data-sort=["']manual["']/);
  for (const value of ["recent", "created", "oldest", "name"]) {
    assert.match(sidebarSource, new RegExp(`"${value}"`));
  }
});
