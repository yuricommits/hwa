"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LANGUAGES = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
];

const EXTENSION_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  go: "go",
};

type Tab = "paste" | "upload" | "history";

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--accent-amber)",
  processing: "var(--accent-cyan)",
  completed: "var(--accent-green)",
  failed: "var(--accent-red)",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
};

type ScanRecord = {
  id: string;
  status: string;
  language: string;
  created_at: string;
  completed_at: string | null;
  filename: string | null;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
};

export default function ScansPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("paste");
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function loadHistory() {
    setLoadingHistory(true);
    const supabase = createClient();

    const { data: scanData } = await supabase
      .from("scans")
      .select("id, status, language, created_at, completed_at")
      .order("created_at", { ascending: false });

    if (!scanData) {
      setLoadingHistory(false);
      return;
    }

    // Fetch files and vulnerabilities for each scan
    const enriched = await Promise.all(
      scanData.map(async (scan) => {
        const [{ data: files }, { data: vulns }] = await Promise.all([
          supabase
            .from("scan_files")
            .select("filename")
            .eq("scan_id", scan.id)
            .limit(1),
          supabase
            .from("vulnerabilities")
            .select("severity")
            .eq("scan_id", scan.id),
        ]);

        const v = vulns ?? [];
        return {
          ...scan,
          filename: files?.[0]?.filename ?? null,
          critical: v.filter((x) => x.severity === "critical").length,
          high: v.filter((x) => x.severity === "high").length,
          medium: v.filter((x) => x.severity === "medium").length,
          low: v.filter((x) => x.severity === "low").length,
          total: v.length,
        };
      })
    );

    setScans(enriched);
    setLoadingHistory(false);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === "history" && scans.length === 0) {
      loadHistory();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setFilename(selected.name);
    const ext = selected.name.split(".").pop()?.toLowerCase() ?? "";
    const detected = EXTENSION_MAP[ext];
    if (detected) setLanguage(detected);
    const reader = new FileReader();
    reader.onload = (ev) => setCode(ev.target?.result as string);
    reader.readAsText(selected);
  }

  async function handleSubmit() {
    if (!code.trim()) {
      setError("Please provide code to scan.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus("Creating scan...");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .insert({ user_id: user.id, status: "pending", language, is_public: false })
      .select()
      .single();

    if (scanError || !scan) {
      setError(scanError?.message ?? "Failed to create scan.");
      setLoading(false);
      setStatus(null);
      return;
    }

    const { error: fileError } = await supabase
      .from("scan_files")
      .insert({ scan_id: scan.id, filename: filename || "untitled", content: code, language });

    if (fileError) {
      setError(fileError.message);
      setLoading(false);
      setStatus(null);
      return;
    }

    setStatus("Analyzing...");

    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanId: scan.id }),
    });

    if (!response.ok) {
      setError("Analysis failed. Please try again.");
      setLoading(false);
      setStatus(null);
      return;
    }

    router.push(`/dashboard/scans/${scan.id}`);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          marginBottom: "0.25rem",
        }}>
          Scans
        </h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          Submit code or view your scan history
        </p>
      </div>

      {/* Card */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        overflow: "hidden",
        maxWidth: "860px",
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {(["paste", "upload", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              style={{
                padding: "12px 20px",
                fontSize: "0.8125rem",
                fontWeight: 500,
                background: "none",
                border: "none",
                borderBottom: tab === t
                  ? "2px solid var(--text-primary)"
                  : "2px solid transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                marginBottom: "-1px",
              }}
            >
              {t === "paste" ? "Paste Code" : t === "upload" ? "Upload File" : "History"}
            </button>
          ))}
        </div>

        {/* History tab */}
        {tab === "history" && (
          <div>
            {loadingHistory ? (
              <div style={{
                padding: "3rem",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--accent-cyan)",
                letterSpacing: "0.1em",
              }}>
                LOADING...
              </div>
            ) : scans.length === 0 ? (
              <div style={{
                padding: "3rem",
                textAlign: "center",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
              }}>
                No scans yet
              </div>
            ) : (
              <div>
                {/* Table header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 180px 120px",
                  gap: "1rem",
                  padding: "10px 1.25rem",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.08em",
                }}>
                  <div>FILE</div>
                  <div>STATUS</div>
                  <div>FINDINGS</div>
                  <div>DATE</div>
                </div>

                {scans.map((scan, i) => (
                  <div
                    key={scan.id}
                    onClick={() => router.push(`/dashboard/scans/${scan.id}`)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 180px 120px",
                      gap: "1rem",
                      padding: "1rem 1.25rem",
                      borderBottom: i < scans.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                      background: i % 2 === 0 ? "var(--surface)" : "transparent",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    {/* File */}
                    <div>
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8125rem",
                        color: "var(--text-primary)",
                        marginBottom: "2px",
                      }}>
                        {scan.filename ?? "untitled"}
                      </div>
                      <div style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                      }}>
                        {scan.id.slice(0, 8).toUpperCase()} · {scan.language}
                      </div>
                    </div>

                    {/* Status */}
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: STATUS_COLORS[scan.status],
                      letterSpacing: "0.05em",
                    }}>
                      <span style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: STATUS_COLORS[scan.status],
                        display: "inline-block",
                      }} />
                      {scan.status.toUpperCase()}
                    </div>

                    {/* Findings */}
                    <div style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}>
                      {scan.total === 0 ? (
                        <span style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}>
                          —
                        </span>
                      ) : (
                        Object.entries({
                          critical: scan.critical,
                          high: scan.high,
                          medium: scan.medium,
                          low: scan.low,
                        })
                          .filter(([, count]) => count > 0)
                          .map(([severity, count]) => (
                            <span
                              key={severity}
                              style={{
                                fontSize: "11px",
                                fontFamily: "var(--font-mono)",
                                color: SEVERITY_COLORS[severity],
                              }}
                            >
                              {count} {severity.slice(0, 4).toUpperCase()}
                            </span>
                          ))
                      )}
                    </div>

                    {/* Date */}
                    <div style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}>
                      {new Date(scan.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paste tab */}
        {(tab === "paste" || tab === "upload") && (
          <div style={{ padding: "1.5rem" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                    outline: "none",
                    fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Filename <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="e.g. auth.ts"
                  style={{
                    padding: "8px 12px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                    outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
            </div>

            {tab === "paste" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Code
                </label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your AI-generated code here..."
                  rows={20}
                  style={{
                    padding: "12px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--text-primary)",
                    fontSize: "0.8125rem",
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.7,
                    outline: "none",
                    resize: "vertical",
                    width: "100%",
                  }}
                />
              </div>
            )}

            {tab === "upload" && (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "3rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: file ? "rgba(34, 197, 94, 0.05)" : "var(--surface-raised)",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ts,.tsx,.js,.jsx,.py,.go"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {file ? (
                  <div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.875rem",
                      color: "var(--accent-green)",
                      marginBottom: "0.5rem",
                    }}>
                      ✓ {file.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {(file.size / 1024).toFixed(1)} KB · {language}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      letterSpacing: "0.1em",
                      marginBottom: "0.75rem",
                    }}>
                      CLICK TO UPLOAD
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      .ts · .tsx · .js · .jsx · .py · .go
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{
                marginTop: "1rem",
                padding: "10px 12px",
                background: "rgba(255, 59, 59, 0.1)",
                border: "1px solid rgba(255, 59, 59, 0.3)",
                borderRadius: "var(--radius)",
                fontSize: "0.8rem",
                color: "var(--accent-red)",
                fontFamily: "var(--font-mono)",
              }}>
                {error}
              </div>
            )}

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "1.5rem",
            }}>
              {status && (
                <div style={{
                  fontSize: "0.8rem",
                  color: "var(--accent-cyan)",
                  fontFamily: "var(--font-mono)",
                }}>
                  ⟳ {status}
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: "9px 24px",
                  background: "var(--text-primary)",
                  color: "var(--background)",
                  border: "none",
                  borderRadius: "var(--radius)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  marginLeft: "auto",
                }}
              >
                {loading ? "Running..." : "Run scan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
