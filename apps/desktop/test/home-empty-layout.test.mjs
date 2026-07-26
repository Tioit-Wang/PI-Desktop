import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [app, styles, checklist] = await Promise.all([
  read("../src/App.tsx"),
  read("../src/styles/globals.css"),
  read("../src/components/OnboardingChecklist.tsx"),
]);

test("empty home uses a single scrollable stack instead of dual-grow portals", () => {
  assert.match(app, /className="home-main-content" data-testid="home-empty"/);
  assert.match(app, /className="home-scroll"/);
  assert.match(app, /className="home-stack-inner"/);
  assert.match(app, /className="home-suggestions-block"/);
  assert.match(app, /<HomeSuggestions \/>/);
  assert.match(app, /<OnboardingChecklist \/>/);
  assert.match(app, /home-composer-wrap/);
  assert.doesNotMatch(app, /home-upper|home-lower|home-suggestions-portal/);

  assert.match(styles, /\.home-main-content \{[\s\S]*?overflow:\s*hidden;/);
  assert.match(styles, /\.home-scroll \{[\s\S]*?overflow-y:\s*auto;/);
  // Auto block margins center the stack when it fits and degrade to
  // top-aligned scrolling on overflow; justify-content:center would clip
  // the top of overflowing content.
  assert.match(
    styles,
    /\.home-stack-inner \{[\s\S]*?flex-direction:\s*column;[\s\S]*?margin:\s*auto;/,
  );
  assert.doesNotMatch(
    styles.match(/\.home-stack-inner \{[^}]*\}/s)?.[0] ?? "",
    /^\s*justify-content:\s*center;/m,
  );
  assert.match(styles, /\.home-suggestions-block \{/);
  assert.doesNotMatch(styles, /\.home-upper \{|\.home-lower \{|\.home-suggestions-portal \{/);
});

test("suggestion cards stay in document flow above the home composer", () => {
  const emptyStart = app.indexOf("{!hasTranscript ? (");
  const emptyEnd = app.indexOf("<ChatTranscript", emptyStart);
  const emptyBlock = app.slice(emptyStart, emptyEnd);
  const cardsAt = emptyBlock.indexOf("home-suggestions-block");
  const composerAt = emptyBlock.indexOf("home-composer-wrap");
  assert.notEqual(cardsAt, -1);
  assert.notEqual(composerAt, -1);
  assert.ok(cardsAt < composerAt, "cards must precede composer in markup");
});

test("short windows keep the empty stack scrollable rather than overlapping", () => {
  assert.match(styles, /@media \(max-height:\s*760px\)/);
  assert.match(styles, /@media \(max-height:\s*640px\)/);
  assert.match(checklist, /home-onboarding-checklist/);
  assert.doesNotMatch(checklist, /\bmt-6\b/);
});
