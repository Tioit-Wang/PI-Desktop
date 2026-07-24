export type PluginManifest = {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  icon?: string;
  ui?: {
    panel?: string;
    width?: number;
    height?: number;
    title?: string;
  };
  contributes?: {
    commands?: Array<{
      id: string;
      title: string;
      keywords?: string[];
      category?: string;
    }>;
    agentTools?: Array<{
      name: string;
      description: string;
      risk?: "low" | "medium" | "high";
      schema?: unknown;
    }>;
    skills?: string[];
    settings?: Array<{
      key: string;
      type: string;
      default?: unknown;
      title?: string;
    }>;
  };
  permissions?: string[];
  engines?: { piDesktop?: string };
  activationEvents?: string[];
};

export type PluginCommand = {
  id: string;
  title: string;
  keywords?: string[];
  category?: string;
  run: () => Promise<void> | void;
};

export type PluginTool = {
  name: string;
  description: string;
  risk?: "low" | "medium" | "high";
  schema?: unknown;
  execute: (args: unknown) => Promise<unknown> | unknown;
};

export type PluginHostApi = {
  plugin: {
    getId: () => string;
    getSettings: () => Promise<Record<string, unknown>>;
  };
  commands: {
    register: (command: PluginCommand) => Promise<void>;
    unregister: (id: string) => Promise<void>;
  };
  agent: {
    registerTool: (tool: PluginTool) => Promise<void>;
    unregisterTool: (name: string) => Promise<void>;
  };
  ui: {
    openPanel: (opts?: { title?: string }) => Promise<void>;
    showToast: (message: string) => Promise<void>;
  };
};

export type PluginModule = {
  onLoad?: () => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
};

export function validateManifest(raw: unknown): {
  ok: boolean;
  manifest?: PluginManifest;
  error?: string;
} {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "manifest must be an object" };
  }
  const m = raw as Partial<PluginManifest>;
  if (typeof m.id !== "string" || !m.id) {
    return { ok: false, error: "manifest.id is required" };
  }
  if (typeof m.name !== "string" || !m.name) {
    return { ok: false, error: "manifest.name is required" };
  }
  if (typeof m.version !== "string" || !m.version) {
    return { ok: false, error: "manifest.version is required" };
  }
  if (typeof m.main !== "string" || !m.main) {
    return { ok: false, error: "manifest.main is required" };
  }
  if (typeof m.schemaVersion !== "number") {
    return { ok: false, error: "manifest.schemaVersion is required" };
  }
  return { ok: true, manifest: m as PluginManifest };
}

/** Forced tool name prefix for plugin tools exposed to the agent. */
export function pluginToolName(pluginId: string, toolName: string): string {
  const safePlugin = pluginId.replace(/[^a-zA-Z0-9_]/g, "_");
  const safeTool = toolName.replace(/[^a-zA-Z0-9_]/g, "_");
  return `plugin_${safePlugin}_${safeTool}`;
}
