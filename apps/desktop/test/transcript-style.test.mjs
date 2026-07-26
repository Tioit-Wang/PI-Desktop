import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesSource = await readFile(
  new URL("../src/styles/globals.css", import.meta.url),
  "utf8",
);
const transcriptSource = await readFile(
  new URL("../src/components/ChatTranscript.tsx", import.meta.url),
  "utf8",
);

test("user turns keep a compact right-aligned plate", () => {
  assert.match(stylesSource, /\.message-row\.user \{\s*justify-content:\s*flex-end;/);
  assert.match(
    stylesSource,
    /\.message-row\.user \.message-col \{[\s\S]*?max-width:\s*min\(78%,\s*560px\);[\s\S]*?align-items:\s*flex-end;/,
  );
  assert.match(
    stylesSource,
    /\.message-row\.user \.message-bubble \{[\s\S]*?max-width:\s*min\(78%,\s*560px\);[\s\S]*?border-radius:\s*var\(--radius-lg-plus\);[\s\S]*?border:\s*1px solid/,
  );
});

test("assistant turns stay transparent full-width prose", () => {
  assert.match(
    stylesSource,
    /\.message-row\.assistant \.message-bubble[\s\S]*?background:\s*transparent;/,
  );
  assert.match(
    stylesSource,
    /\.message-row\.assistant \.message-col[\s\S]*?width:\s*min\(100%,\s*720px\);/,
  );
  assert.match(
    stylesSource,
    /\.message-row\.assistant\.streaming \.message-bubble \{[\s\S]*?border-left:\s*2px solid/,
  );
});

test("transcript density and hover actions are quiet", () => {
  assert.match(stylesSource, /\.message-row \{[\s\S]*?padding:\s*10px 0;/);
  assert.match(stylesSource, /\.thread-content \{[\s\S]*?padding:\s*20px 28px 228px;/);
  assert.match(
    stylesSource,
    /\.message-actions \{[\s\S]*?opacity:\s*0;[\s\S]*?\.message-row:hover \.message-actions/,
  );
  assert.match(stylesSource, /\.message-row\.user \.message-actions \{[\s\S]*?justify-content:\s*flex-end;/);
});

test("transcript markup uses the dedicated user text surface and streaming class", () => {
  assert.match(transcriptSource, /className="message-user-text selectable"/);
  assert.match(transcriptSource, /streaming \? " streaming" : ""/);
  assert.match(transcriptSource, /CopyButton text=\{message\.content\}/);
});

test("user plaintext preserves hard newlines without forced mid-word breaks", () => {
  assert.match(
    stylesSource,
    /\.message-user-text \{\s*\/\* Preserve hard newlines; wrap long tokens without splitting every CJK glyph\. \*\/\s*display:\s*block;\s*width:\s*fit-content;\s*max-width:\s*100%;\s*white-space:\s*pre-wrap;\s*overflow-wrap:\s*break-word;\s*word-break:\s*normal;\s*line-break:\s*strict;/,
  );
  assert.doesNotMatch(stylesSource, /\.message-user-text br \{/);
});

test("assistant meta chips and retry action are wired", () => {
  assert.match(transcriptSource, /function MessageMeta/);
  assert.match(transcriptSource, /message-meta-chip/);
  assert.match(transcriptSource, /chat\.usageTokens/);
  assert.match(transcriptSource, /retryAssistantMessage/);
  assert.match(transcriptSource, /chat\.retry/);
  assert.match(stylesSource, /\.message-meta-chip\.usage/);
});

test("regenerate rewrites the current turn instead of appending", async () => {
  const storeSource = await readFile(
    new URL("../src/stores/app-store.ts", import.meta.url),
    "utf8",
  );
  const mainSource = await readFile(
    new URL("../electron/main/index.ts", import.meta.url),
    "utf8",
  );
  const protocolSource = await readFile(
    new URL("../../../packages/shared/src/protocol.ts", import.meta.url),
    "utf8",
  );
  assert.match(storeSource, /truncateBefore:\s*userIndex/);
  assert.match(storeSource, /messages:\s*kept/);
  assert.match(mainSource, /session\.replaceMessages/);
  assert.match(mainSource, /agent\.disposeSession/);
  assert.match(mainSource, /truncateBefore/);
  assert.match(protocolSource, /sessionReplaceMessages/);
});
