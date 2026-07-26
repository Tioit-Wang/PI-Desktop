import assert from "node:assert/strict";
import test from "node:test";
import {
  isIgnoredName,
  resolveWithinRoot,
} from "../electron/main/fs-panel.ts";

const ROOT = "/Users/dev/project";

test("resolves relative paths inside the workspace root", () => {
  assert.equal(resolveWithinRoot(ROOT, ""), ROOT);
  assert.equal(resolveWithinRoot(ROOT, "src/app.ts"), `${ROOT}/src/app.ts`);
  assert.equal(
    resolveWithinRoot(ROOT, "a/./b/../c.txt"),
    `${ROOT}/a/c.txt`,
  );
});

test("rejects traversal and absolute escapes", () => {
  assert.equal(resolveWithinRoot(ROOT, ".."), null);
  assert.equal(resolveWithinRoot(ROOT, "../sibling"), null);
  assert.equal(resolveWithinRoot(ROOT, "src/../../etc/passwd"), null);
  // Absolute inputs are treated as root-relative, not trusted as-is.
  assert.equal(
    resolveWithinRoot(ROOT, "/etc/passwd"),
    `${ROOT}/etc/passwd`,
  );
  // A sibling directory sharing the root as a string prefix must not pass.
  assert.equal(resolveWithinRoot(ROOT, "../project-evil/x"), null);
  assert.equal(resolveWithinRoot("", "anything"), null);
});

test("default ignore list hides vcs and dependency directories", () => {
  for (const name of [".git", "node_modules", "target", "__pycache__"]) {
    assert.equal(isIgnoredName(name), true, name);
  }
  assert.equal(isIgnoredName("src"), false);
  assert.equal(isIgnoredName("gitignore"), false);
});
