import { serviceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

const STALENESS_PATTERNS = [
  {
    package: "request",
    ecosystem: "npm",
    pattern: "use request for HTTP requests",
    becameStaleAt: "2020-02-11T00:00:00Z",
    reason: "Package officially deprecated by maintainer in February 2020",
    replacement: "Use native fetch (Node 18+), axios, or undici instead",
  },
  {
    package: "moment",
    ecosystem: "npm",
    pattern: "use moment for date manipulation",
    becameStaleAt: "2020-09-14T00:00:00Z",
    reason: "Moment.js is in maintenance mode, no new features, large bundle size",
    replacement: "Use date-fns, dayjs, or native Intl API instead",
  },
  {
    package: "crypto-js",
    ecosystem: "npm",
    pattern: "use crypto-js for cryptography",
    becameStaleAt: "2023-01-01T00:00:00Z",
    reason: "Multiple CVEs, last meaningful update in 2021, use native crypto instead",
    replacement: "Use Node.js built-in crypto module or Web Crypto API",
  },
  {
    package: "node-fetch",
    ecosystem: "npm",
    pattern: "use node-fetch for HTTP requests",
    becameStaleAt: "2022-02-01T00:00:00Z",
    reason: "Node 18+ ships with native fetch — node-fetch is no longer needed",
    replacement: "Use native fetch built into Node 18+",
  },
  {
    package: "bcrypt",
    ecosystem: "npm",
    pattern: "use MD5 for password hashing",
    becameStaleAt: "1996-01-01T00:00:00Z",
    reason: "MD5 is cryptographically broken, not suitable for password hashing",
    replacement: "Use bcrypt, argon2, or scrypt for password hashing",
  },
  {
    package: "jsonwebtoken",
    ecosystem: "npm",
    pattern: "use SHA1 for token generation",
    becameStaleAt: "2017-01-01T00:00:00Z",
    reason: "SHA1 is deprecated for security use cases by NIST since 2011",
    replacement: "Use SHA-256 or higher, or use jsonwebtoken for proper JWT tokens",
  },
];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let seeded = 0;
  let errors = 0;

  for (const pattern of STALENESS_PATTERNS) {
    try {
      const { data: pkg } = await serviceClient
        .from("packages")
        .select("id")
        .eq("name", pattern.package)
        .eq("ecosystem", pattern.ecosystem)
        .single();

      if (!pkg) continue;

      await serviceClient.from("staleness_records").upsert(
        {
          package_id: pkg.id,
          pattern: pattern.pattern,
          became_stale_at: pattern.becameStaleAt,
          reason: pattern.reason,
          replacement: pattern.replacement,
        },
        { onConflict: "package_id,pattern" }
      );

      seeded++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    success: true,
    seeded,
    errors,
    timestamp: new Date().toISOString(),
  });
}
