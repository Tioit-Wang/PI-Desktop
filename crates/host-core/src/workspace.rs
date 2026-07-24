use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct WorkspaceState {
    pub path: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectWorkspace {
    pub path: String,
    pub name: String,
}

impl WorkspaceState {
    pub fn get(&self) -> Option<ProjectWorkspace> {
        match (&self.path, &self.name) {
            (Some(path), Some(name)) => Some(ProjectWorkspace {
                path: path.clone(),
                name: name.clone(),
            }),
            _ => None,
        }
    }

    pub fn set(&mut self, path: impl AsRef<Path>) -> ProjectWorkspace {
        let path = path.as_ref().canonicalize().unwrap_or_else(|_| path.as_ref().to_path_buf());
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("workspace")
            .to_string();
        let path_str = path.to_string_lossy().to_string();
        self.path = Some(path_str.clone());
        self.name = Some(name.clone());
        ProjectWorkspace {
            path: path_str,
            name,
        }
    }

    pub fn clear(&mut self) {
        self.path = None;
        self.name = None;
    }
}

/// Resolve a user-provided path against workspace root and ensure it stays inside.
pub fn resolve_in_workspace(workspace_root: &Path, input: &str) -> Result<PathBuf, String> {
    let root = workspace_root
        .canonicalize()
        .map_err(|e| format!("workspace canonicalize failed: {e}"))?;
    let candidate = if Path::new(input).is_absolute() {
        PathBuf::from(input)
    } else {
        root.join(input)
    };

    // Reject parent escapes before canonicalize when possible
    if candidate
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        // still allow if canonical form stays inside
    }

    let resolved = if candidate.exists() {
        candidate
            .canonicalize()
            .map_err(|e| format!("path canonicalize failed: {e}"))?
    } else {
        // For write paths that don't exist yet, canonicalize parent
        let parent = candidate
            .parent()
            .ok_or_else(|| "invalid path".to_string())?;
        let file = candidate
            .file_name()
            .ok_or_else(|| "invalid path".to_string())?;
        if parent.as_os_str().is_empty() {
            root.join(file)
        } else {
            let parent_canon = if parent.exists() {
                parent
                    .canonicalize()
                    .map_err(|e| format!("parent canonicalize failed: {e}"))?
            } else {
                // ensure parent is under root by lexical join
                if !parent.starts_with(&root) && parent != root {
                    let joined = root.join(parent);
                    if !joined.starts_with(&root) {
                        return Err("PATH_OUTSIDE_WORKSPACE".into());
                    }
                    return Ok(joined.join(file));
                }
                parent.to_path_buf()
            };
            parent_canon.join(file)
        }
    };

    if !resolved.starts_with(&root) {
        return Err("PATH_OUTSIDE_WORKSPACE".into());
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn blocks_escape() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("a.txt"), "x").unwrap();
        let err = resolve_in_workspace(root, "../outside.txt").unwrap_err();
        assert_eq!(err, "PATH_OUTSIDE_WORKSPACE");
    }

    #[test]
    fn allows_inside() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("a.txt"), "x").unwrap();
        let p = resolve_in_workspace(root, "a.txt").unwrap();
        assert!(p.ends_with("a.txt"));
    }
}
