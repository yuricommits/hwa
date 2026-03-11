use zed_extension_api::{self as zed, LanguageServerId, Result};

struct HwaExtension;

impl zed::Extension for HwaExtension {
    fn new() -> Self {
        HwaExtension
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let node_path = worktree
            .which("node")
            .ok_or("node not found in PATH — please install Node.js")?;

        Ok(zed::Command {
            command: node_path,
            args: vec![
                "/home/kim-yuri/north/hwa/apps/zed-extension/lsp/dist/server.js".to_string(),
                "--stdio".to_string(),
            ],
            env: vec![],
        })
    }
}

zed::register_extension!(HwaExtension);
