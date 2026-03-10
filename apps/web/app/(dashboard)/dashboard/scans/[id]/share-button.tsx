"use client";

import { useState } from "react";

export default function ShareButton({
  scanId,
  isPublic,
  shareToken,
}: {
  scanId: string;
  isPublic: boolean;
  shareToken: string | null;
}) {
  const [shared, setShared] = useState(isPublic);
  const [token, setToken] = useState(shareToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function toggleShare() {
    setLoading(true);
    const action = shared ? "disable" : "enable";

    const response = await fetch("/api/scan/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanId, action }),
    });

    const data = await response.json() as { token?: string };

    if (action === "enable" && data.token) {
      setToken(data.token);
      setShared(true);
    } else {
      setToken(null);
      setShared(false);
    }

    setLoading(false);
  }

  async function copyLink() {
    if (!token) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/report/${token}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {shared && token && (
        <button
          onClick={copyLink}
          style={{
            padding: "6px 12px",
            background: copied ? "rgba(34, 197, 94, 0.1)" : "var(--surface-raised)",
            border: `1px solid ${copied ? "rgba(34, 197, 94, 0.3)" : "var(--border)"}`,
            borderRadius: "var(--radius)",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: copied ? "var(--accent-green)" : "var(--text-secondary)",
            cursor: "pointer",
            letterSpacing: "0.05em",
            transition: "all 0.15s",
          }}
        >
          {copied ? "COPIED!" : "COPY LINK"}
        </button>
      )}

      <button
        onClick={toggleShare}
        disabled={loading}
        style={{
          padding: "6px 14px",
          background: shared ? "rgba(255, 59, 59, 0.1)" : "var(--surface-raised)",
          border: `1px solid ${shared ? "rgba(255, 59, 59, 0.3)" : "var(--border)"}`,
          borderRadius: "var(--radius)",
          fontSize: "11px",
          fontFamily: "var(--font-mono)",
          color: shared ? "var(--accent-red)" : "var(--text-secondary)",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          letterSpacing: "0.05em",
          transition: "all 0.15s",
        }}
      >
        {loading ? "..." : shared ? "REVOKE" : "SHARE"}
      </button>
    </div>
  );
}
