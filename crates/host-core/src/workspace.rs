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

/// Lexically resolve `.` / `..` components without touching the filesystem.
/// `..` at the filesystem root clamps (stays at root); the caller's
/// starts_with check then rejects anything that climbed out of the workspace.
fn normalize_lexical(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Resolve a user-provided path against workspace root and ensure it stays inside.
///
/// Two layers of defense:
/// 1. Lexical normalization of `.`/`..` before any check, so traversal via
///    nonexistent parents cannot hide behind an uncanonicalizable path.
/// 2. Canonicalization of the deepest existing ancestor, so symlinks inside
///    the workspace cannot smuggle a target outside it.
pub fn resolve_in_workspace(workspace_root: &Path, input: &str) -> Result<PathBuf, String> {
    let root = workspace_root
        .canonicalize()
        .map_err(|e| format!("workspace canonicalize failed: {e}"))?;
    let candidate = if Path::new(input).is_absolute() {
        PathBuf::from(input)
    } else {
        root.join(input)
    };

    let normalized = normalize_lexical(&candidate);
    if !normalized.starts_with(&root) {
        return Err("PATH_OUTSIDE_WORKSPACE".into());
    }

    // Canonicalize the deepest existing ancestor (resolves symlinks), then
    // re-append the not-yet-existing tail.
    let mut existing = normalized.clone();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    while !existing.exists() {
        match (existing.parent(), existing.file_name()) {
            (Some(parent), Some(name)) => {
                tail.push(name.to_os_string());
                existing = parent.to_path_buf();
            }
            _ => break,
        }
    }
    let mut resolved = existing
        .canonicalize()
        .map_err(|e| format!("path canonicalize failed: {e}"))?;
    for part in tail.iter().rev() {
        resolved.push(part);
    }

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
    fn blocks_escape_via_nonexistent_parent() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        // `sub` does not exist; lexical traversal must still be caught.
        let err = resolve_in_workspace(root, "sub/../../evil/new.txt").unwrap_err();
        assert_eq!(err, "PATH_OUTSIDE_WORKSPACE");
        let err = resolve_in_workspace(root, "a/b/../../../evil.txt").unwrap_err();
        assert_eq!(err, "PATH_OUTSIDE_WORKSPACE");
    }

    #[test]
    fn blocks_absolute_outside() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let err = resolve_in_workspace(root, "/etc/hosts").unwrap_err();
        assert_eq!(err, "PATH_OUTSIDE_WORKSPACE");
    }

    #[test]
    fn allows_new_nested_path() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let p = resolve_in_workspace(root, "newdir/sub/file.txt").unwrap();
        assert!(p.starts_with(root.canonicalize().unwrap()));
        assert!(p.ends_with("newdir/sub/file.txt"));
    }

    #[cfg(unix)]
    #[test]
    fn blocks_symlink_escape() {
        let dir = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let root = dir.path();
        std::os::unix::fs::symlink(outside.path(), root.join("link")).unwrap();
        let err = resolve_in_workspace(root, "link/new.txt").unwrap_err();
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
