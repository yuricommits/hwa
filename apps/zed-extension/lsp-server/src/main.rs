mod patterns;
mod scanner;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};

#[derive(Debug, Deserialize)]
struct RpcMessage {
    #[allow(dead_code)]
    jsonrpc: String,
    id: Option<Value>,
    method: Option<String>,
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct RpcResponse {
    jsonrpc: String,
    id: Value,
    result: Value,
}

#[derive(Debug, Serialize)]
struct RpcNotification {
    jsonrpc: String,
    method: String,
    params: Value,
}

fn send(msg: &impl Serialize) {
    let body = serde_json::to_string(msg).unwrap();
    let stdout = io::stdout();
    let mut out = stdout.lock();
    write!(out, "Content-Length: {}\r\n\r\n{}", body.len(), body).unwrap();
    out.flush().unwrap();
}

fn send_diagnostics(uri: &str, findings: &[scanner::Finding]) {
    let diagnostics: Vec<Value> = findings
        .iter()
        .map(|f| {
            let severity = match f.severity.as_str() {
                "critical" | "high" => 1,
                "medium" => 2,
                _ => 3,
            };
            let line = (f.line as u64).saturating_sub(1);
            json!({
                "range": {
                    "start": { "line": line, "character": 0 },
                    "end": { "line": line, "character": 0 }
                },
                "severity": severity,
                "source": "hwa",
                "message": format!("{}\n→ {}", f.description, f.suggestion),
                "code": f.severity.to_uppercase()
            })
        })
        .collect();

    send(&RpcNotification {
        jsonrpc: "2.0".to_string(),
        method: "textDocument/publishDiagnostics".to_string(),
        params: json!({
            "uri": uri,
            "diagnostics": diagnostics
        }),
    });
}

fn detect_language(uri: &str) -> &'static str {
    if uri.ends_with(".ts") || uri.ends_with(".tsx") {
        "typescript"
    } else if uri.ends_with(".js") || uri.ends_with(".jsx") {
        "javascript"
    } else if uri.ends_with(".py") {
        "python"
    } else if uri.ends_with(".go") {
        "go"
    } else if uri.ends_with(".rs") {
        "rust"
    } else {
        "unknown"
    }
}

fn handle_message(msg: RpcMessage) {
    match msg.method.as_deref() {
        Some("initialize") => {
            send(&RpcResponse {
                jsonrpc: "2.0".to_string(),
                id: msg.id.unwrap_or(json!(null)),
                result: json!({
                    "capabilities": {
                        "textDocumentSync": 1
                    },
                    "serverInfo": {
                        "name": "hwa-lsp",
                        "version": "0.1.0"
                    }
                }),
            });
        }
        Some("initialized") => {}
        Some("shutdown") => {
            send(&RpcResponse {
                jsonrpc: "2.0".to_string(),
                id: msg.id.unwrap_or(json!(null)),
                result: json!(null),
            });
        }
        Some("textDocument/didOpen") => {
            if let Some(params) = msg.params {
                let uri = params["textDocument"]["uri"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let text = params["textDocument"]["text"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let language = detect_language(&uri).to_string();
                let findings = scanner::scan(&text, &language);
                send_diagnostics(&uri, &findings);
            }
        }
        Some("textDocument/didChange") => {
            if let Some(params) = msg.params {
                let uri = params["textDocument"]["uri"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let changes = params["contentChanges"].as_array();
                if let Some(changes) = changes {
                    if let Some(last) = changes.last() {
                        let text = last["text"].as_str().unwrap_or("").to_string();
                        let language = detect_language(&uri).to_string();
                        let findings = scanner::scan(&text, &language);
                        send_diagnostics(&uri, &findings);
                    }
                }
            }
        }
        Some("textDocument/didSave") => {
            if let Some(params) = msg.params {
                let uri = params["textDocument"]["uri"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let text = params["text"].as_str().unwrap_or("").to_string();
                let language = detect_language(&uri).to_string();
                let findings = scanner::scan(&text, &language);
                send_diagnostics(&uri, &findings);
            }
        }
        _ => {
            if let Some(id) = msg.id {
                send(&RpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id,
                    result: json!(null),
                });
            }
        }
    }
}

fn main() {
    let stdin = io::stdin();
    let mut reader = stdin.lock();
    let mut buffer = String::new();

    loop {
        buffer.clear();

        // Read headers
        let mut content_length = 0usize;
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).unwrap_or(0) == 0 {
                return;
            }
            let line = line.trim();
            if line.is_empty() {
                break;
            }
            if let Some(len) = line.strip_prefix("Content-Length: ") {
                content_length = len.trim().parse().unwrap_or(0);
            }
        }

        if content_length == 0 {
            continue;
        }

        // Read body
        let mut body = vec![0u8; content_length];
        use std::io::Read;
        if reader.read_exact(&mut body).is_err() {
            return;
        }

        let body_str = String::from_utf8_lossy(&body);
        if let Ok(msg) = serde_json::from_str::<RpcMessage>(&body_str) {
            handle_message(msg);
        }
    }
}
