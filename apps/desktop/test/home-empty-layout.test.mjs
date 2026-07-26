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
  assert.match(
    styles,
    /\.home-stack-inner \{[\s\S]*?flex-direction:\s*column;[\s\S]*?min-height:\s*100%;/,
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
