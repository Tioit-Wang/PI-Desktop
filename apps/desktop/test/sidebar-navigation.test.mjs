import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sidebarSource = await readFile(
  new URL("../src/components/Sidebar.tsx", import.meta.url),
  "utf8",
);

test("home sidebar exposes only the supported destination entries", () => {
  assert.match(sidebarSource, /data-nav="projects"/);
  assert.match(sidebarSource, /data-nav="plugins"/);
  assert.doesNotMatch(sidebarSource, /data-nav="pulls"/);
  assert.doesNotMatch(sidebarSource, /data-nav="scheduled"/);
  assert.doesNotMatch(sidebarSource, /t\("nav\.(?:pullRequests|scheduled)"\)/);
});
