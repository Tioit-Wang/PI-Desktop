import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const panelSource = await readFile(
  new URL("../src/components/workpanel/WorkPanel.tsx", import.meta.url),
  "utf8",
);
const storeSource = await readFile(
  new URL("../src/stores/app-store.ts", import.meta.url),
  "utf8",
);
const globalStyles = await readFile(
  new URL("../src/styles/globals.css", import.meta.url),
  "utf8",
);

test("work panel replaces the context panel overlay", async () => {
  await assert.rejects(
    access(new URL("../src/components/ContextPanel.tsx", import.meta.url)),
    { code: "ENOENT" },
  );
  assert.doesNotMatch(appSource, /ContextPanel/);
  assert.doesNotMatch(appSource, /contextOpen/);
  assert.match(appSource, /nav\.toggleWorkPanel/);
});

test("work panel docks as an app-shell column, not a main-pane overlay", () => {
  // Rendered after the main pane closes, as a shell sibling.
  assert.match(appSource, /<\/section>\s*\{workPanelOpen && <WorkPanel \/>\}/);
  // Docked column participates in flex layout instead of overlaying.
  assert.match(globalStyles, /\.work-panel \{[^}]*flex: 0 0 auto/s);
  assert.doesNotMatch(
    globalStyles.match(/\.work-panel \{[^}]*\}/s)?.[0] ?? "",
    /position:\s*absolute/,
  );
});

test("terminal pane survives tab switches by hiding instead of unmounting", () => {
  assert.match(panelSource, /tab !== "terminal" && "is-hidden"/);
  assert.match(panelSource, /<TerminalTab active=\{tab === "terminal"\} \/>/);
});

test("panel open state, tab, and width persist under one storage key", () => {
  assert.match(storeSource, /pi\.desktop\.workPanel/);
  assert.match(storeSource, /open: state\.workPanelOpen/);
  assert.match(storeSource, /tab: state\.workPanelTab/);
  assert.match(storeSource, /width: state\.workPanelWidth/);
});

test("agent workspace mutations invalidate the review diff across sessions", () => {
  const bumpIndex = storeSource.indexOf("WORKSPACE_MUTATING_TOOLS.has(toolName)");
  const gateIndex = storeSource.indexOf(
    "if (envelope.sessionId !== get().activeSessionId)",
  );
  assert.ok(bumpIndex > -1, "reviewRev bump exists");
  assert.ok(gateIndex > -1, "cross-session gate exists");
  assert.ok(
    bumpIndex < gateIndex,
    "reviewRev bump must run before the cross-session early-return",
  );
});
