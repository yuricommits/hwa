import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import * as path from "path";

const LOG_FILE = path.join(process.env.HOME ?? "/tmp", "hwa-lsp.log");

function log(msg: string): void {
  const line = `${new Date().toISOString()} ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let apiUrl: string | null = null;
let apiKey: string | null = null;

log("HWA LSP starting");

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const settings = params.initializationOptions as {
    apiUrl?: string;
    apiKey?: string;
  };

  apiUrl = settings?.apiUrl ?? null;
  apiKey = settings?.apiKey ?? null;

  log(`HWA initialized apiUrl=${apiUrl} apiKey=${apiKey ? "set" : "NOT SET"}`);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
    },
  };
});

function detectLanguage(uri: string): string {
  if (uri.endsWith(".ts") || uri.endsWith(".tsx")) return "typescript";
  if (uri.endsWith(".js") || uri.endsWith(".jsx")) return "javascript";
  if (uri.endsWith(".py")) return "python";
  if (uri.endsWith(".go")) return "go";
  return "typescript";
}

function mapSeverity(severity: string): DiagnosticSeverity {
  switch (severity) {
    case "critical":
    case "high":
      return DiagnosticSeverity.Error;
    case "medium":
      return DiagnosticSeverity.Warning;
    default:
      return DiagnosticSeverity.Information;
  }
}

type VulnerabilityResult = {
  severity: string;
  description: string;
  suggestion: string;
  lineStart: number;
  lineEnd: number;
  cveId: string | null;
};

type ScanResponse = {
  vulnerabilities: VulnerabilityResult[];
};

async function scanDocument(document: TextDocument): Promise<void> {
  log(`HWA scanning ${document.uri}`);

  if (!apiUrl || !apiKey) {
    log("HWA apiUrl or apiKey not set — check Zed settings");
    return;
  }

  const content = document.getText();
  const language = detectLanguage(document.uri);

  log(`HWA language=${language} content=${content.length} chars`);

  try {
    const response = await fetch(`${apiUrl}/api/lsp/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ content, language }),
    });

    log(`HWA API status=${response.status}`);

    if (!response.ok) {
      log(`HWA API error: ${response.status}`);
      return;
    }

    const data = (await response.json()) as ScanResponse;
    log(`HWA found ${data.vulnerabilities?.length ?? 0} vulnerabilities`);

    const diagnostics: Diagnostic[] = [];

    for (const vuln of data.vulnerabilities ?? []) {
      const startLine = Math.max(0, (vuln.lineStart ?? 1) - 1);
      const endLine = Math.max(0, (vuln.lineEnd ?? vuln.lineStart ?? 1) - 1);

      const message = vuln.suggestion
        ? `${vuln.description}\n→ ${vuln.suggestion}${vuln.cveId ? `\n${vuln.cveId}` : ""}`
        : vuln.description;

      diagnostics.push({
        severity: mapSeverity(vuln.severity),
        range: {
          start: { line: startLine, character: 0 },
          end: { line: endLine, character: Number.MAX_SAFE_INTEGER },
        },
        message,
        source: "hwa",
        code: vuln.cveId ?? vuln.severity.toUpperCase(),
      });
    }

    log(`HWA sending ${diagnostics.length} diagnostics`);
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
  } catch (err) {
    log(`HWA error: ${String(err)}`);
  }
}

documents.onDidSave((event) => {
  log("HWA onDidSave triggered");
  void scanDocument(event.document);
});

documents.onDidOpen((event) => {
  log("HWA onDidOpen triggered");
  void scanDocument(event.document);
});

documents.onDidChangeContent((event) => {
  log("HWA onDidChangeContent triggered");
  void scanDocument(event.document);
});

documents.listen(connection);
connection.listen();
