import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gridTemplateRows: "auto 1fr",
      minHeight: "100vh",
      background: "var(--background)",
    }}>
      {/* Sidebar */}
      <aside style={{
        gridRow: "1 / -1",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 0",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "auto",
      }}>
        {/* Logo */}
        <div style={{
          padding: "0 1.25rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1rem",
        }}>
          <Link href="/dashboard" style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent-red)",
              display: "inline-block",
            }} />
            HWA
          </Link>
        </div>

        {/* Nav */}
        <nav style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          padding: "0 0.75rem",
          flex: 1,
        }}>
          {[
            { href: "/dashboard", label: "Overview", icon: "⊞" },
            { href: "/dashboard/scans", label: "Scans", icon: "⊙" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "7px 10px",
                borderRadius: "var(--radius)",
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: "1rem 1.25rem 0",
          borderTop: "1px solid var(--border)",
          marginTop: "auto",
        }}>
          <div style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {user.email}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        padding: "2rem",
        overflow: "auto",
      }}>
        {children}
      </main>
    </div>
  );
}
