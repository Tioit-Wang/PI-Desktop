import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { IconBuild, IconExplore, IconFix, IconReview } from "./icons";

type Suggestion = {
  id: string
  titleKey: string
  promptKey: string
  tone: "blue" | "green" | "purple" | "orange"
  icon: ReactNode
};

export function HomeSuggestions() {
  const { t } = useTranslation();
  const prefillComposer = useAppStore((s) => s.prefillComposer);

  const items: Suggestion[] = [
    {
      id: "codex-explore",
      titleKey: "home.suggestions.explore",
      promptKey: "home.suggestions.explorePrompt",
      tone: "blue",
      icon: <IconExplore size={16} />,
    },
    {
      id: "codex-create",
      titleKey: "home.suggestions.create",
      promptKey: "home.suggestions.createPrompt",
      tone: "green",
      icon: <IconBuild size={16} />,
    },
    {
      id: "codex-review",
      titleKey: "home.suggestions.review",
      promptKey: "home.suggestions.reviewPrompt",
      tone: "purple",
      icon: <IconReview size={16} />,
    },
    {
      id: "codex-fix",
      titleKey: "home.suggestions.fix",
      promptKey: "home.suggestions.fixPrompt",
      tone: "orange",
      icon: <IconFix size={16} />,
    },
  ];

  return (
    <div className="home-suggestions" data-testid="home-suggestions">
      <div className="home-suggestions-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`home-suggestion-card tone-${item.tone}`}
            onClick={() => prefillComposer(t(item.promptKey))}
          >
            <span className="home-suggestion-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="home-suggestion-title">{t(item.titleKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
