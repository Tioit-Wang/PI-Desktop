import type { SessionSummary } from "@pi-desktop/shared";

export function normalizeProjectPath(projectPath?: string | null): string | null {
  const value = projectPath?.trim();
  if (!value) return null;

  const normalized = value.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized || "/";
}

export function sessionMatchesProject(
  session: Pick<SessionSummary, "projectPath">,
  projectPath?: string | null,
): boolean {
  return normalizeProjectPath(session.projectPath) === normalizeProjectPath(projectPath);
}

export function groupSidebarSessions(
  sessions: SessionSummary[],
  projectPath?: string | null,
): {
  projectSessions: SessionSummary[];
  temporarySessions: SessionSummary[];
} {
  const normalizedProjectPath = normalizeProjectPath(projectPath);

  return {
    projectSessions: normalizedProjectPath
      ? sessions.filter(
          (session) => normalizeProjectPath(session.projectPath) === normalizedProjectPath,
        )
      : [],
    temporarySessions: sessions.filter(
      (session) => normalizeProjectPath(session.projectPath) === null,
    ),
  };
}
