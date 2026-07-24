import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduledTask } from "@pi-desktop/shared";
import { useAppStore } from "../stores/app-store";
import { api } from "../lib/api";
import { Badge, Button, Field, Input, Panel, Select, Textarea } from "../components/ui";
import { IconClock } from "../components/icons";

export function ScheduledPage() {
  const { t } = useTranslation();
  const setPage = useAppStore((s) => s.setPage);
  const selectSession = useAppStore((s) => s.selectSession);
  const sendPrompt = useAppStore((s) => s.sendPrompt);
  const setToast = useAppStore((s) => s.setToast);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<ScheduledTask["cadence"]>("manual");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.listScheduled();
      setTasks(res.tasks || []);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const cadenceLabel = (value: ScheduledTask["cadence"]) => {
    if (value === "hourly") return t("scheduled.cadenceHourly");
    if (value === "daily") return t("scheduled.cadenceDaily");
    if (value === "weekly") return t("scheduled.cadenceWeekly");
    return t("scheduled.cadenceManual");
  };

  return (
    <div className="thread-scroll">
      <div className="mx-auto w-full max-w-[820px] px-8 py-10">
        <div className="mb-6">
          <div className="text-[20px] font-medium tracking-tight">{t("scheduled.title")}</div>
          <div className="mt-1 text-[13px] text-text-secondary">{t("scheduled.subtitle")}</div>
        </div>

        <Panel className="mb-4 space-y-3 p-4">
          <div className="text-[13.5px] font-medium">{t("scheduled.create")}</div>
          <Field label={t("nav.newTask")}>
            <Input
              value={title}
              placeholder={t("chat.untitledTask")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t("scheduled.prompt")}>
            <Textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Summarize git status and open issues every morning"
            />
          </Field>
          <Field label={t("scheduled.cadence")}>
            <Select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as ScheduledTask["cadence"])}
            >
              <option value="manual">{t("scheduled.cadenceManual")}</option>
              <option value="hourly">{t("scheduled.cadenceHourly")}</option>
              <option value="daily">{t("scheduled.cadenceDaily")}</option>
              <option value="weekly">{t("scheduled.cadenceWeekly")}</option>
            </Select>
          </Field>
          <Button
            variant="primary"
            disabled={creating || !prompt.trim()}
            onClick={async () => {
              setCreating(true);
              try {
                await api.createScheduled({
                  title: title.trim() || prompt.trim().slice(0, 48),
                  prompt: prompt.trim(),
                  cadence,
                  enabled: true,
                });
                setPrompt("");
                setTitle("");
                setCadence("manual");
                await refresh();
                setToast(t("scheduled.create"));
              } catch (e) {
                setToast(e instanceof Error ? e.message : String(e));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? "…" : t("scheduled.create")}
          </Button>
        </Panel>

        {loading && tasks.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-text-muted">…</div>
        ) : tasks.length === 0 ? (
          <Panel className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-hover text-text-secondary">
              <IconClock size={20} />
            </div>
            <div className="text-[15px] font-medium">{t("scheduled.emptyTitle")}</div>
            <div className="mt-2 max-w-md text-[13px] text-text-secondary">
              {t("scheduled.emptyBody")}
            </div>
          </Panel>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <Panel key={task.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-[13.5px] font-medium">{task.title}</div>
                      <Badge tone={task.enabled ? "success" : "neutral"}>
                        {task.enabled ? t("scheduled.enabled") : t("scheduled.disabled")}
                      </Badge>
                      <Badge>{cadenceLabel(task.cadence)}</Badge>
                    </div>
                    <div className="mt-1 line-clamp-2 text-[12.5px] text-text-secondary">
                      {task.prompt}
                    </div>
                    <div className="mt-1 text-[11.5px] text-text-muted">
                      {t("scheduled.lastRun")}:{" "}
                      {task.lastRunAt
                        ? new Date(task.lastRunAt).toLocaleString()
                        : t("scheduled.never")}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        try {
                          const res = await api.runScheduled(task.id);
                          await selectSession(res.sessionId);
                          setPage("chat");
                          await sendPrompt(res.prompt);
                          await refresh();
                        } catch (e) {
                          setToast(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      {t("scheduled.runNow")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await api.updateScheduled({
                          id: task.id,
                          enabled: !task.enabled,
                        });
                        await refresh();
                      }}
                    >
                      {task.enabled ? t("scheduled.disabled") : t("scheduled.enabled")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api.deleteScheduled(task.id);
                        await refresh();
                      }}
                    >
                      {t("scheduled.delete")}
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
