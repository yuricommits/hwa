"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleEmailSignup() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setConfirmed(true);
    setLoading(false);
  }

  async function handleGitHubLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (confirmed) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        padding: "1rem",
      }}>
        <div style={{
          maxWidth: "400px",
          width: "100%",
          textAlign: "center",
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            fontSize: "1.2rem",
          }}>
            ✓
          </div>
          <h2 style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: "0.75rem",
          }}>
            Check your email
          </h2>
          <p style={{
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}>
            We sent a confirmation link to{" "}
            <span style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
            }}>
              {email}
            </span>
            . Click it to activate your account.
          </p>
          <Link href="/login" style={{
            display: "inline-block",
            marginTop: "2rem",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
          }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background)",
      padding: "1rem",
      position: "relative",
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

      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "400px",
      }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            marginBottom: "0.5rem",
          }}>
            HWA
          </div>
          <h1 style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}>
            Create account
          </h1>
          <p style={{
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            marginTop: "0.5rem",
          }}>
            Start tracking AI code vulnerabilities
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}>
          {/* GitHub */}
          <button
            onClick={handleGitHubLogin}
            style={{
              width: "100%",
              padding: "10px",
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          {/* Divider */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          </div>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                padding: "9px 12px",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                padding: "9px 12px",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
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

          {/* Submit */}
          <button
            onClick={handleEmailSignup}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              background: "var(--text-primary)",
              color: "var(--background)",
              border: "none",
              borderRadius: "var(--radius)",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          marginTop: "1.5rem",
          fontSize: "0.8rem",
          color: "var(--text-secondary)",
        }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--text-primary)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
