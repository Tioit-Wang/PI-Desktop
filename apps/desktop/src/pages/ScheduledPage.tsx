import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { Button, Panel } from "../components/ui";
import { IconClock } from "../components/icons";

export function ScheduledPage() {
  const { t } = useTranslation();
  const newSession = useAppStore((s) => s.newSession);
  const setPage = useAppStore((s) => s.setPage);
  const setToast = useAppStore((s) => s.setToast);

  return (
    <div className="thread-scroll">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-[20px] font-medium tracking-tight">{t("scheduled.title")}</div>
            <div className="mt-1 text-[13px] text-text-secondary">{t("scheduled.subtitle")}</div>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await newSession();
              setPage("chat");
              setToast(t("scheduled.create"));
            }}
          >
            {t("scheduled.create")}
          </Button>
        </div>

        <Panel className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
            <IconClock size={20} />
          </div>
          <div className="text-[15px] font-medium">{t("scheduled.emptyTitle")}</div>
          <div className="mt-2 max-w-md text-[13px] text-text-secondary">
            {t("scheduled.emptyBody")}
          </div>
          <Button
            className="mt-5"
            variant="primary"
            onClick={async () => {
              await newSession();
              setPage("chat");
            }}
          >
            {t("scheduled.create")}
          </Button>
        </Panel>
      </div>
    </div>
  );
}
