import { useTranslation } from "react-i18next";
import { IconGlobe } from "../icons";

export function BrowserTab() {
  const { t } = useTranslation();

  return (
    <div className="work-tab-empty">
      <IconGlobe size={20} />
      <p>{t("panel.browser.empty")}</p>
    </div>
  );
}
