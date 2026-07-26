import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const composerSource = await readFile(
  new URL("../src/components/Composer.tsx", import.meta.url),
  "utf8",
);
const transcriptSource = await readFile(
  new URL("../src/components/ChatTranscript.tsx", import.meta.url),
  "utf8",
);
const appSource = await readFile(
  new URL("../src/App.tsx", import.meta.url),
  "utf8",
);
const mainSource = await readFile(
  new URL("../electron/main/index.ts", import.meta.url),
  "utf8",
);

test("composer exposes the runtime thinking level order and provider filtering", () => {
  for (const level of ["off", "minimal", "low", "medium", "high", "xhigh", "max"]) {
    assert.match(composerSource, new RegExp(`"${level}"`));
  }
  assert.match(composerSource, /supportedThinkingLevels/);
  assert.match(composerSource, /supportsReasoning/);
  assert.match(composerSource, /thinkingLevelForProvider/);
  assert.match(composerSource, /thinkingLevel:\s*level/);
});

test("switching to a provider without reasoning resets the session level", () => {
  assert.match(
    composerSource,
    /if\s*\(!provider\?\.supportsReasoning\)\s*return\s*"off"/,
  );
  assert.match(composerSource, /thinkingLevel:\s*thinkingLevelForProvider\(/);
});

test("main resolves reasoning from each session's exact selected model", () => {
  assert.match(mainSource, /function enrichSession/);
  assert.match(mainSource, /modelId:\s*session\.modelId/);
  assert.match(mainSource, /sessions:\s*result\.sessions\.map/);
  assert.match(mainSource, /enrichProvider\(provider, modelId\)/);
  assert.match(mainSource, /capabilities\.delete\("reasoning"\)/);
});

test("transcript keeps assistant thinking in a separate disclosure", () => {
  assert.match(transcriptSource, /<details[\s\S]*<summary/);
  assert.match(transcriptSource, /message\.thinking/);
  assert.match(transcriptSource, /Markdown source=\{thinking\}/);
  assert.match(transcriptSource, /CopyButton text=\{message\.content\}/);
  assert.match(transcriptSource, /!thinkingText\(message\)/);
  assert.match(transcriptSource, /thinkingText\(lastVisibleMessage\)/);
});

test("thinking-only assistant streams open the transcript surface", () => {
  assert.match(appSource, /typeof m\.thinking === "string"/);
  assert.match(appSource, /hasContent \|\| hasThinking/);
});
