import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const globalStyles = await readFile(
  new URL("../src/styles/globals.css", import.meta.url),
  "utf8",
);

test("shell chrome is not text-selectable by default", () => {
  assert.match(
    globalStyles,
    /html,\s*body,\s*#root\s*\{[^}]*-webkit-user-select:\s*none;[^}]*user-select:\s*none;/s,
  );
  assert.match(
    globalStyles,
    /button,\s*\[role="button"\][^}]*\{[^}]*-webkit-user-select:\s*none;[^}]*user-select:\s*none;/s,
  );
});

test("editing and document-like content explicitly remains selectable", () => {
  assert.match(
    globalStyles,
    /input,\s*textarea,\s*select,\s*\[contenteditable\][\s\S]*?-webkit-user-select:\s*text;[\s\S]*?user-select:\s*text;/,
  );
  assert.match(
    globalStyles,
    /\.message-bubble[\s\S]*?\.message-user-text[\s\S]*?\.prose-chat[\s\S]*?\.tool-row-content[\s\S]*?pre[\s\S]*?code[\s\S]*?-webkit-user-select:\s*text;[\s\S]*?user-select:\s*text;/,
  );
});
