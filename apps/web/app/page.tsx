import Link from "next/link";

export default function LandingPage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "2rem",
      background: "var(--background)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          linear-gradient(var(--border-subtle) 1px, transparent 1px),
          linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        opacity: 0.5,
      }} />

      {/* Content */}
      <div style={{
        position: "relative",
        maxWidth: "640px",
        width: "100%",
        textAlign: "center",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 12px",
          border: "1px solid var(--border)",
          borderRadius: "999px",
          fontSize: "11px",
          color: "var(--text-secondary)",
          marginBottom: "2rem",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.05em",
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--accent-red)",
            display: "inline-block",
          }} />
          AI CODE VULNERABILITY TRACKER
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: "1.5rem",
          color: "var(--text-primary)",
        }}>
          Your AI writes<br />
          <span style={{ color: "var(--text-muted)" }}>vulnerable code.</span>
        </h1>

        {/* Subheading */}
        <p style={{
          fontSize: "1rem",
          color: "var(--text-secondary)",
          lineHeight: 1.7,
          marginBottom: "2.5rem",
          maxWidth: "480px",
          margin: "0 auto 2.5rem",
        }}>
          AI tools use outdated training data. The packages they recommend
          have CVEs. The patterns they suggest are deprecated.
          Hwa tracks all of it.
        </p>

        {/* CTA */}
        <div style={{
          display: "flex",
          gap: "12px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          <Link href="/signup" style={{
            padding: "10px 24px",
            background: "var(--text-primary)",
            color: "var(--background)",
            borderRadius: "var(--radius)",
            fontWeight: 500,
            fontSize: "0.875rem",
            transition: "opacity 0.15s",
          }}>
            Get started
          </Link>
          <Link href="/login" style={{
            padding: "10px 24px",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            borderRadius: "var(--radius)",
            fontWeight: 500,
            fontSize: "0.875rem",
            transition: "border-color 0.15s",
          }}>
            Sign in
          </Link>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px",
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          marginTop: "4rem",
          overflow: "hidden",
        }}>
          {[
            { value: "90%+", label: "devs use AI tools" },
            { value: "CVEs", label: "in AI recommendations" },
            { value: "0", label: "warnings from AI" },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: "1.25rem",
              background: "var(--surface)",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
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
      </div>
    </main>
  );
}
