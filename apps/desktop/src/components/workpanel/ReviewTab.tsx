import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DiffFile, WorkspaceDiff } from "@pi-desktop/shared";
import { useAppStore } from "../../stores/app-store";
import { api } from "../../lib/api";
import { cx } from "../ui";
import {
  IconChevronRight,
  IconDiff,
  IconSnapshot,
} from "../icons";

const REFRESH_DEBOUNCE_MS = 500;

function statusLabel(status: DiffFile["status"], t: (k: string) => string) {
  return t(`panel.review.status.${status}`);
}

function FileCard({ file }: { file: DiffFile }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const hasBody = file.hunks.length > 0;

  return (
    <div className={cx("diff-file", open && hasBody && "open")}>
      <button
        type="button"
        className="diff-file-header"
        aria-expanded={open && hasBody}
        disabled={!hasBody && !file.binary && !file.tooLarge}
        onClick={() => setOpen((v) => !v)}
        title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
      >
        <span className="diff-file-caret" aria-hidden>
          {hasBody ? <IconChevronRight size={12} /> : null}
        </span>
        <span className={cx("diff-file-status", `is-${file.status}`)}>
          {statusLabel(file.status, t)}
        </span>
        <span className="diff-file-path">
          {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
        </span>
        <span className="diff-file-counts">
          {file.additions > 0 && (
            <span className="diff-count-add">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="diff-count-del">−{file.deletions}</span>
          )}
        </span>
      </button>
      {open && (
        <div className="diff-file-body">
          {file.binary ? (
            <div className="diff-file-note">{t("panel.review.binary")}</div>
          ) : file.tooLarge ? (
            <div className="diff-file-note">{t("panel.review.tooLarge")}</div>
          ) : (
            file.hunks.map((hunk, hunkIndex) => (
              <div className="diff-hunk" key={hunkIndex}>
                <div className="diff-line hunk">
                  <span className="diff-line-text">{hunk.header}</span>
                </div>
                {hunk.lines.map((line, lineIndex) => (
                  <div className={cx("diff-line", line.type)} key={lineIndex}>
                    <span className="diff-line-sign" aria-hidden>
                      {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
                    </span>
                    <span className="diff-line-text">{line.text}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ReviewTab() {
  const { t } = useTranslation();
  const workspace = useAppStore((s) => s.workspace);
  const reviewRev = useAppStore((s) => s.reviewRev);
  const [diff, setDiff] = useState<WorkspaceDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchSeq = useRef(0);
  const debounceTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!workspace?.path) {
      setDiff(null);
      return;
    }
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const next = await api.workspaceDiff();
      if (seq === fetchSeq.current) setDiff(next);
    } catch {
      if (seq === fetchSeq.current) setDiff(null);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [workspace?.path]);

  // Initial + workspace-change fetch.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Agent Write/Edit/Bash completions bump reviewRev; debounce bursts.
  useEffect(() => {
    if (reviewRev === 0) return;
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = null;
      void refresh();
    }, REFRESH_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [reviewRev, refresh]);

  if (!workspace?.path) {
    return (
      <div className="work-tab-empty">
        <IconDiff size={20} />
        <p>{t("panel.review.noWorkspace")}</p>
      </div>
    );
  }

  const files = diff?.files ?? [];
  const totalAdd = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDel = files.reduce((sum, f) => sum + f.deletions, 0);

  return (
    <div className="review-tab">
      <div className="review-toolbar">
        <span className="review-summary">
          {diff && !diff.repo
            ? t("panel.review.noRepo")
            : files.length > 0
              ? t("panel.review.filesChanged", { count: files.length })
              : ""}
        </span>
        {files.length > 0 && (
          <span className="diff-file-counts">
            <span className="diff-count-add">+{totalAdd}</span>
            <span className="diff-count-del">−{totalDel}</span>
          </span>
        )}
        <button
          type="button"
          className={cx("icon-btn", loading && "is-loading")}
          onClick={() => void refresh()}
          title={t("panel.review.refresh")}
          disabled={loading}
        >
          <IconSnapshot size={14} />
        </button>
      </div>
      {diff?.truncated && (
        <div className="review-truncated">{t("panel.review.truncated")}</div>
      )}
      <div className="review-scroll">
        {diff && diff.repo && diff.clean ? (
          <div className="work-tab-empty">
            <IconDiff size={20} />
            <p>{t("panel.review.clean")}</p>
          </div>
        ) : diff && !diff.repo ? (
          <div className="work-tab-empty">
            <IconDiff size={20} />
            <p>{t("panel.review.noRepo")}</p>
          </div>
        ) : (
          files.map((file) => <FileCard key={file.path} file={file} />)
        )}
      </div>
    </div>
  );
}
