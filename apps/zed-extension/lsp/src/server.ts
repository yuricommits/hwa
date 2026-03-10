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

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let apiUrl: string | null = null;
let apiKey: string | null = null;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const settings = params.initializationOptions as {
    apiUrl?: string;
    apiKey?: string;
  };

  apiUrl = settings?.apiUrl ?? null;
  apiKey = settings?.apiKey ?? null;

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
  if (!apiUrl || !apiKey) {
    connection.console.warn("HWA: apiUrl and apiKey not configured");
    return;
  }

  const content = document.getText();
  const language = detectLanguage(document.uri);

  try {
    const response = await fetch(`${apiUrl}/api/lsp/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ content, language }),
    });

    if (!response.ok) {
      connection.console.error(`HWA: scan failed with status ${response.status}`);
      return;
    }

    const data = (await response.json()) as ScanResponse;
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

    connection.sendDiagnostics({ uri: document.uri, diagnostics });
  } catch (err) {
    connection.console.error(`HWA: scan error — ${String(err)}`);
  }
}

// Scan on save
documents.onDidSave((event) => {
  void scanDocument(event.document);
});

// Scan on open
documents.onDidOpen((event) => {
  void scanDocument(event.document);
});

documents.listen(connection);
connection.listen();
