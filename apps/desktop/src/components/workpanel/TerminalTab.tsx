import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/app-store";
import { IconTerminal } from "../icons";

export function TerminalTab({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  void active;

  if (!workspace?.path) {
    return (
      <div className="work-tab-empty">
        <IconTerminal size={20} />
        <p>{t("panel.terminal.noWorkspace")}</p>
      </div>
    );
  }

  return <div className="work-terminal-host" />;
}
