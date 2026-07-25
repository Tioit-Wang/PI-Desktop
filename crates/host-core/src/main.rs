mod artifacts;
mod audit;
mod db;
mod permissions;
mod plugins;
mod providers;
mod rpc;
mod scheduled;
mod secrets;
mod sessions;
mod state;
mod tools;
mod workspace;

use std::sync::Arc;
use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_writer(std::io::stderr)
        .init();

    let data_dir = std::env::var("PI_DESKTOP_DATA_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join(".pi-desktop")
        });

    std::fs::create_dir_all(&data_dir)?;
    std::fs::create_dir_all(data_dir.join("logs"))?;
    std::fs::create_dir_all(data_dir.join("plugins/installed"))?;
    std::fs::create_dir_all(data_dir.join("plugins/data"))?;
    std::fs::create_dir_all(data_dir.join("cache"))?;

    let state = Arc::new(Mutex::new(AppState::open(&data_dir)?));
    tracing::info!(path = %data_dir.display(), "host-core starting");
    rpc::serve(state).await
}
