import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/app-store";
import { IconFolder } from "../icons";

export function FilesTab() {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);

  if (!workspace?.path) {
    return (
      <div className="work-tab-empty">
        <IconFolder size={20} />
        <p>{t("panel.files.noWorkspace")}</p>
      </div>
    );
  }

  return (
    <div className="work-tab-empty">
      <IconFolder size={20} />
      <p>{t("panel.files.empty")}</p>
    </div>
  );
}
