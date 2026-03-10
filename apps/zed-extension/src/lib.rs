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
        // Find node in PATH
        let node_path = worktree
            .which("node")
            .ok_or("node not found in PATH — please install Node.js")?;

        // LSP server will be bundled at this path
        let server_path = "lsp/dist/server.js";

        Ok(zed::Command {
            command: node_path,
            args: vec![
                server_path.to_string(),
                "--stdio".to_string(),
            ],
            env: vec![],
        })
    }
}

zed::register_extension!(HwaExtension);
