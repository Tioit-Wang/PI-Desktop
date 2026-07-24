use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretMeta {
    pub secret_ref: String,
    pub provider_id: Option<String>,
    pub kind: String,
    pub backend: String,
    pub updated_at: String,
}

pub struct SecretStore {
    dir: PathBuf,
    key: [u8; 32],
}

impl SecretStore {
    pub fn open(data_dir: &Path) -> Result<Self> {
        let dir = data_dir.join("secrets");
        fs::create_dir_all(&dir)?;
        let key_path = dir.join(".machine-key");
        let key = if key_path.exists() {
            let bytes = fs::read(&key_path)?;
            if bytes.len() != 32 {
                return Err(anyhow!("invalid machine key length"));
            }
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            key
        } else {
            let mut key = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut key);
            fs::write(&key_path, key)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&key_path)?.permissions();
                perms.set_mode(0o600);
                fs::set_permissions(&key_path, perms)?;
            }
            key
        };
        Ok(Self { dir, key })
    }

    fn path_for(&self, secret_ref: &str) -> PathBuf {
        let mut hasher = Sha256::new();
        hasher.update(secret_ref.as_bytes());
        let hash = hex::encode(hasher.finalize());
        self.dir.join(format!("{hash}.bin"))
    }

    pub fn set(&self, secret_ref: &str, value: &str) -> Result<String> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)?;
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, value.as_bytes())
            .map_err(|e| anyhow!("encrypt failed: {e}"))?;
        let mut blob = Vec::with_capacity(12 + ciphertext.len());
        blob.extend_from_slice(&nonce_bytes);
        blob.extend_from_slice(&ciphertext);
        fs::write(self.path_for(secret_ref), B64.encode(blob))?;
        Ok("file_fallback".into())
    }

    pub fn get(&self, secret_ref: &str) -> Result<Option<String>> {
        let path = self.path_for(secret_ref);
        if !path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(path)?;
        let blob = B64.decode(raw.trim()).context("decode secret blob")?;
        if blob.len() < 13 {
            return Err(anyhow!("secret blob too short"));
        }
        let (nonce_bytes, ciphertext) = blob.split_at(12);
        let cipher = Aes256Gcm::new_from_slice(&self.key)?;
        let nonce = Nonce::from_slice(nonce_bytes);
        let plain = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow!("decrypt failed: {e}"))?;
        Ok(Some(String::from_utf8(plain)?))
    }

    pub fn has(&self, secret_ref: &str) -> bool {
        self.path_for(secret_ref).exists()
    }

    pub fn delete(&self, secret_ref: &str) -> Result<()> {
        let path = self.path_for(secret_ref);
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}

pub fn secret_ref_for_provider(provider_id: &str) -> String {
    format!("secret:provider:{provider_id}:api_key")
}
