import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  pluginToolName,
  validateManifest,
  type PluginManifest,
  type PluginModule,
  type PluginHostApi,
} from "@pi-desktop/plugin-sdk";

export type RegisteredCommand = {
  id: string;
  title: string;
  category?: string;
  keywords?: string[];
  pluginId: string;
  run: () => Promise<void>;
};

export type RegisteredPluginTool = {
  fullName: string;
  pluginId: string;
  name: string;
  description: string;
  risk?: string;
  execute: (args: unknown) => Promise<unknown>;
};

export class PluginRuntime {
  private commands = new Map<string, RegisteredCommand>();
  private tools = new Map<string, RegisteredPluginTool>();
  private loaded = new Map<string, { manifest: PluginManifest; path: string }>();
  private toasts: string[] = [];

  getCommands(): RegisteredCommand[] {
    return [...this.commands.values()];
  }

  getTools(): RegisteredPluginTool[] {
    return [...this.tools.values()];
  }

  drainToasts(): string[] {
    const t = this.toasts.slice();
    this.toasts = [];
    return t;
  }

  async loadFromPath(pluginPath: string): Promise<PluginManifest> {
    const manifestPath = join(pluginPath, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error("PLUGIN_INVALID: manifest.json missing");
    }
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    const validated = validateManifest(raw);
    if (!validated.ok || !validated.manifest) {
      throw new Error(`PLUGIN_INVALID: ${validated.error}`);
    }
    const manifest = validated.manifest;
    await this.unload(manifest.id);

    const mainPath = join(pluginPath, manifest.main);
    if (!existsSync(mainPath)) {
      throw new Error("PLUGIN_LOAD_FAILED: main entry missing");
    }

    const require = createRequire(import.meta.url);
    let mod: PluginModule;
    try {
      // CommonJS example plugins
      delete require.cache[require.resolve(mainPath)];
      mod = require(mainPath) as PluginModule;
    } catch {
      mod = (await import(pathToFileURL(mainPath).href)) as PluginModule;
    }

    const api = this.createApi(manifest, pluginPath);
    // inject global for example plugin contract
    (globalThis as any).pi = api;

    if (mod.onLoad) await mod.onLoad();
    this.loaded.set(manifest.id, { manifest, path: pluginPath });
    return manifest;
  }

  async unload(pluginId: string): Promise<void> {
    for (const [id, cmd] of this.commands) {
      if (cmd.pluginId === pluginId) this.commands.delete(id);
    }
    for (const [name, tool] of this.tools) {
      if (tool.pluginId === pluginId) this.tools.delete(name);
    }
    this.loaded.delete(pluginId);
  }

  private createApi(manifest: PluginManifest, pluginPath: string): PluginHostApi {
    const pluginId = manifest.id;
    return {
      plugin: {
        getId: () => pluginId,
        getSettings: async () => {
          const defaults: Record<string, unknown> = {};
          for (const s of manifest.contributes?.settings ?? []) {
            defaults[s.key] = s.default;
          }
          return defaults;
        },
      },
      commands: {
        register: async (command) => {
          this.commands.set(command.id, {
            id: command.id,
            title: command.title,
            category: command.category,
            keywords: command.keywords,
            pluginId,
            run: async () => {
              await command.run();
            },
          });
        },
        unregister: async (id) => {
          this.commands.delete(id);
        },
      },
      agent: {
        registerTool: async (tool) => {
          const fullName = pluginToolName(pluginId, tool.name);
          this.tools.set(fullName, {
            fullName,
            pluginId,
            name: tool.name,
            description: tool.description,
            risk: tool.risk,
            execute: async (args) => tool.execute(args),
          });
        },
        unregisterTool: async (name) => {
          const fullName = pluginToolName(pluginId, name);
          this.tools.delete(fullName);
        },
      },
      ui: {
        openPanel: async () => {
          // Panel HTML is available at pluginPath/ui.panel; MVP records toast.
          this.toasts.push(`Opened panel for ${manifest.name}`);
        },
        showToast: async (message) => {
          this.toasts.push(message);
        },
      },
    };
  }
}
