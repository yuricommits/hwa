use std::fs;
use zed_extension_api::{self as zed, LanguageServerId, Result};

struct HwaExtension {
    cached_binary_path: Option<String>,
}

impl zed::Extension for HwaExtension {
    fn new() -> Self {
        HwaExtension {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let binary_path = self.get_or_download_binary(language_server_id, worktree)?;
        Ok(zed::Command {
            command: binary_path,
            args: vec![],
            env: vec![],
        })
    }
}

impl HwaExtension {
    fn get_or_download_binary(
        &mut self,
        language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<String> {
        if let Some(path) = &self.cached_binary_path {
            if fs::metadata(path).is_ok() {
                return Ok(path.clone());
            }
        }

        let (platform, arch) = zed::current_platform();

        let binary_name = match platform {
            zed::Os::Windows => "hwa-lsp.exe",
            _ => "hwa-lsp",
        };

        let asset_name = match (platform, arch) {
            (zed::Os::Mac, zed::Architecture::Aarch64) => "hwa-lsp-darwin-arm64",
            (zed::Os::Mac, _) => "hwa-lsp-darwin-amd64",
            (zed::Os::Windows, _) => "hwa-lsp-windows-amd64.exe",
            (zed::Os::Linux, _) => "hwa-lsp-linux-amd64",
        };

        let version = "v0.1.2";
        let url = format!(
            "https://github.com/yuricommits/hwa/releases/download/{}/{}",
            version, asset_name
        );

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Downloading,
        );

        let binary_path = format!("./{binary_name}");

        let _response =
            zed::download_file(&url, &binary_path, zed::DownloadedFileType::Uncompressed)
                .map_err(|e| format!("Failed to download hwa-lsp: {e}"))?;

        zed::make_file_executable(&binary_path)
            .map_err(|e| format!("Failed to make hwa-lsp executable: {e}"))?;

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::None,
        );

        self.cached_binary_path = Some(binary_path.clone());
        Ok(binary_path)
    }
}

zed::register_extension!(HwaExtension);
