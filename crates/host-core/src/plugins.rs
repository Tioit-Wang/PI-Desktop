use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub enabled: bool,
    pub source: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    pub permissions: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub version: String,
    pub main: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub contributes: Option<Value>,
}

pub struct PluginManager {
    data_dir: PathBuf,
    runtime: Vec<PluginSummary>,
}

impl PluginManager {
    pub fn new(data_dir: &Path) -> Self {
        let mut mgr = Self {
            data_dir: data_dir.to_path_buf(),
            runtime: Vec::new(),
        };
        let _ = mgr.reload_from_disk();
        mgr
    }

    fn registry_path(&self) -> PathBuf {
        self.data_dir.join("plugins/registry.json")
    }

    pub fn list(&self) -> Vec<PluginSummary> {
        self.runtime.clone()
    }

    pub fn reload_from_disk(&mut self) -> Result<()> {
        let path = self.registry_path();
        if !path.exists() {
            self.runtime.clear();
            return Ok(());
        }
        let raw = fs::read_to_string(path)?;
        self.runtime = serde_json::from_str(&raw).unwrap_or_default();
        Ok(())
    }

    fn save(&self) -> Result<()> {
        let path = self.registry_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_string_pretty(&self.runtime)?)?;
        Ok(())
    }

    pub fn load_dev(&mut self, plugin_path: &str) -> Result<PluginSummary> {
        let path = PathBuf::from(plugin_path);
        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            return Err(anyhow!("PLUGIN_INVALID: manifest.json missing"));
        }
        let raw = fs::read_to_string(&manifest_path)?;
        let manifest: PluginManifest =
            serde_json::from_str(&raw).map_err(|e| anyhow!("PLUGIN_INVALID: {e}"))?;
        if manifest.id.is_empty() || manifest.main.is_empty() {
            return Err(anyhow!("PLUGIN_INVALID: id/main required"));
        }
        let main_path = path.join(&manifest.main);
        if !main_path.exists() {
            return Err(anyhow!("PLUGIN_LOAD_FAILED: main entry missing"));
        }

        let summary = PluginSummary {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            enabled: true,
            source: "dev".into(),
            status: "ready".into(),
            error_message: None,
            permissions: manifest.permissions.clone(),
            path: Some(path.to_string_lossy().to_string()),
        };

        self.runtime.retain(|p| p.id != summary.id);
        self.runtime.push(summary.clone());
        self.save()?;
        let _ = Utc::now();
        Ok(summary)
    }

    pub fn set_enabled(&mut self, id: &str, enabled: bool) -> Result<Option<PluginSummary>> {
        if let Some(plugin) = self.runtime.iter_mut().find(|p| p.id == id) {
            plugin.enabled = enabled;
            plugin.status = if enabled {
                "ready".into()
            } else {
                "disabled".into()
            };
            let out = plugin.clone();
            self.save()?;
            return Ok(Some(out));
        }
        Ok(None)
    }

    pub fn uninstall(&mut self, id: &str) -> Result<bool> {
        let before = self.runtime.len();
        self.runtime.retain(|p| p.id != id);
        self.save()?;
        Ok(self.runtime.len() < before)
    }
}
