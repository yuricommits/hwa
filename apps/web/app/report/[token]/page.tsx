import { serviceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import Link from "next/link";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
  info: "var(--severity-info)",
};

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Fetch scan by share token
  const { data: scan } = await serviceClient
    .from("scans")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .single();

  if (!scan) notFound();

  // Fetch files
  const { data: files } = await serviceClient
    .from("scan_files")
    .select("filename, language")
    .eq("scan_id", scan.id);

  // Fetch vulnerabilities
  const { data: vulnerabilities } = await serviceClient
    .from("vulnerabilities")
    .select("*")
    .eq("scan_id", scan.id)
    .order("severity", { ascending: true });

  const vulns = vulnerabilities ?? [];
  const critical = vulns.filter((v) => v.severity === "critical").length;
  const high = vulns.filter((v) => v.severity === "high").length;
  const medium = vulns.filter((v) => v.severity === "medium").length;
  const low = vulns.filter((v) => v.severity === "low").length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "2rem",
            paddingBottom: "2rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
                marginBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--accent-red)",
                  display: "inline-block",
                }}
              />
              HWA · PUBLIC REPORT
            </div>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                marginBottom: "0.25rem",
              }}
            >
              {files?.[0]?.filename ?? "Untitled scan"}
            </h1>
            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
              }}
            >
              {scan.language} · {new Date(scan.created_at).toLocaleString()}
            </div>
          </div>

          {/* Severity badge */}
          {critical > 0 && (
            <div
              style={{
                padding: "6px 14px",
                background: "rgba(255, 59, 59, 0.1)",
                border: "1px solid rgba(255, 59, 59, 0.3)",
                borderRadius: "999px",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--severity-critical)",
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
              }}
            >
              {critical} CRITICAL
            </div>
          )}
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1px",
            background: "var(--border)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            marginBottom: "2rem",
          }}
        >
          {[
            {
              label: "Critical",
              value: critical,
              color: "var(--severity-critical)",
            },
            { label: "High", value: high, color: "var(--severity-high)" },
            { label: "Medium", value: medium, color: "var(--severity-medium)" },
            { label: "Low", value: low, color: "var(--severity-low)" },
            {
              label: "Total",
              value: vulns.length,
              color: "var(--text-primary)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "1.25rem",
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  color: stat.color,
                  marginBottom: "4px",
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Vulnerabilities */}
        {vulns.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "3rem",
              textAlign: "center",
              background: "var(--surface)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--accent-green)",
                letterSpacing: "0.1em",
                marginBottom: "0.75rem",
              }}
            >
              NO VULNERABILITIES FOUND
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
              }}
            >
              This scan came back clean
            </p>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 80px 1fr 80px",
                gap: "1rem",
                padding: "10px 1.25rem",
                background: "var(--surface)",
                borderBottom: "1px solid var(--border)",
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em",
              }}
            >
              <div>SEVERITY</div>
              <div>TYPE</div>
              <div>DESCRIPTION</div>
              <div>LINE</div>
            </div>

            {vulns.map((vuln, i) => (
              <div
                key={vuln.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 80px 1fr 80px",
                  gap: "1rem",
                  padding: "1rem 1.25rem",
                  borderBottom:
                    i < vulns.length - 1 ? "1px solid var(--border)" : "none",
                  background: i % 2 === 0 ? "var(--surface)" : "transparent",
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: SEVERITY_COLORS[vuln.severity],
                    letterSpacing: "0.05em",
                  }}
                >
                  <span
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: SEVERITY_COLORS[vuln.severity],
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {vuln.severity.toUpperCase()}
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {vuln.type.toUpperCase()}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-primary)",
                      marginBottom: "4px",
                      lineHeight: 1.5,
                    }}
                  >
                    {vuln.description}
                  </div>
                  {vuln.cve_id && (
                    <div
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent-red)",
                      }}
                    >
                      {vuln.cve_id}
                    </div>
                  )}
                  {vuln.suggestion && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        marginTop: "4px",
                        padding: "6px 10px",
                        background: "var(--surface-raised)",
                        borderRadius: "var(--radius)",
                        borderLeft: "2px solid var(--border)",
                      }}
                    >
                      → {vuln.suggestion}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                  }}
                >
                  {vuln.line_start
                    ? `L${vuln.line_start}${
                        vuln.line_end && vuln.line_end !== vuln.line_start
                          ? `–${vuln.line_end}`
                          : ""
                      }`
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: "2rem",
            paddingTop: "2rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Generated by HWA · AI Code Vulnerability Tracker
          </div>

          <Link
            href="/"
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            Try HWA →
          </Link>
        </div>
      </div>
    </div>
  );
}
