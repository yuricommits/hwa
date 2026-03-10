import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch scan stats
  const { data: scans } = await supabase
    .from("scans")
    .select("id, status")
    .eq("user_id", user.id);

  const totalScans = scans?.length ?? 0;
  const completedScanIds = scans
    ?.filter((s) => s.status === "completed")
    .map((s) => s.id) ?? [];

  // Fetch vulnerability counts
  const { data: vulns } = completedScanIds.length > 0
    ? await supabase
        .from("vulnerabilities")
        .select("severity")
        .in("scan_id", completedScanIds)
    : { data: [] };

  const critical = vulns?.filter((v) => v.severity === "critical").length ?? 0;
  const high = vulns?.filter((v) => v.severity === "high").length ?? 0;
  const stale = vulns?.filter((v) => v.severity === "medium").length ?? 0;

  // Fetch recent scans
  const { data: recentScans } = await supabase
    .from("scans")
    .select("id, status, language, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const STATUS_COLORS: Record<string, string> = {
    pending: "var(--accent-amber)",
    processing: "var(--accent-cyan)",
    completed: "var(--accent-green)",
    failed: "var(--accent-red)",
  };

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
          Overview
        </h1>
        <p style={{
          fontSize: "0.8125rem",
          color: "var(--text-secondary)",
        }}>
          Track vulnerabilities in your AI-generated code
        </p>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "1px",
        background: "var(--border)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        marginBottom: "2rem",
      }}>
        {[
          { label: "Total Scans", value: totalScans, color: "var(--text-primary)" },
          { label: "Critical", value: critical, color: "var(--severity-critical)" },
          { label: "High", value: high, color: "var(--severity-high)" },
          { label: "Stale Packages", value: stale, color: "var(--accent-cyan)" },
        ].map((stat) => (
          <div key={stat.label} style={{
            padding: "1.25rem",
            background: "var(--surface)",
          }}>
            <div style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: stat.color,
              marginBottom: "4px",
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Recent scans */}
      {totalScans === 0 ? (
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "3rem",
          textAlign: "center",
          background: "var(--surface)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            marginBottom: "0.75rem",
          }}>
            NO SCANS YET
          </div>
          <p style={{
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            marginBottom: "1.5rem",
          }}>
            Submit your first code scan to detect vulnerabilities
          </p>
          <Link href="/dashboard/scans">
            <button style={{
              padding: "8px 20px",
              background: "var(--text-primary)",
              color: "var(--background)",
              border: "none",
              borderRadius: "var(--radius)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}>
              New scan
            </button>
          </Link>
        </div>
      ) : (
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}>
          {/* Table header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 1.25rem",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}>
            <div style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em",
            }}>
              RECENT SCANS
            </div>
            <Link href="/dashboard/scans" style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
            }}>
              New scan →
            </Link>
          </div>

          {recentScans?.map((scan, i) => (
            <Link
              key={scan.id}
              href={`/dashboard/scans/${scan.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 140px",
                gap: "1rem",
                padding: "1rem 1.25rem",
                borderBottom: i < (recentScans.length - 1)
                  ? "1px solid var(--border)"
                  : "none",
                background: i % 2 === 0 ? "var(--surface)" : "transparent",
                alignItems: "center",
                transition: "background 0.15s",
              }}
            >
              {/* Scan ID */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.8125rem",
                color: "var(--text-primary)",
              }}>
                {scan.id.slice(0, 8).toUpperCase()}
                <span style={{
                  marginLeft: "8px",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-sans)",
                }}>
                  {scan.language}
                </span>
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

              {/* Date */}
              <div style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textAlign: "right",
              }}>
                {new Date(scan.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
