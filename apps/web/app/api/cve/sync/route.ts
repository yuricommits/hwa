import { serviceClient as supabase } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import type { OsvVulnerability, OsvQueryResponse } from "@hwa/types";

const TRACKED_PACKAGES = [
  { name: "express", ecosystem: "npm" },
  { name: "lodash", ecosystem: "npm" },
  { name: "axios", ecosystem: "npm" },
  { name: "jsonwebtoken", ecosystem: "npm" },
  { name: "bcrypt", ecosystem: "npm" },
  { name: "crypto-js", ecosystem: "npm" },
  { name: "node-fetch", ecosystem: "npm" },
  { name: "request", ecosystem: "npm" },
  { name: "moment", ecosystem: "npm" },
  { name: "mongoose", ecosystem: "npm" },
  { name: "sequelize", ecosystem: "npm" },
  { name: "mysql", ecosystem: "npm" },
  { name: "pg", ecosystem: "npm" },
  { name: "redis", ecosystem: "npm" },
  { name: "sharp", ecosystem: "npm" },
  { name: "multer", ecosystem: "npm" },
];

function mapSeverity(vuln: OsvVulnerability): string {
  const score = vuln.severity?.[0]?.score;
  if (!score) return "medium";
  const numeric = parseFloat(score);
  if (numeric >= 9.0) return "critical";
  if (numeric >= 7.0) return "high";
  if (numeric >= 4.0) return "medium";
  return "low";
}

async function fetchOsvVulnerabilities(
  packageName: string,
  ecosystem: string
): Promise<OsvVulnerability[]> {
  const response = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      package: { name: packageName, ecosystem },
    }),
  });

  if (!response.ok) return [];
  const data = (await response.json()) as OsvQueryResponse;
  return data.vulns ?? [];
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { synced: 0, errors: 0, packages: 0 };

  for (const pkg of TRACKED_PACKAGES) {
    try {
      const { data: packageRecord } = await supabase
        .from("packages")
        .upsert(
          { name: pkg.name, ecosystem: pkg.ecosystem },
          { onConflict: "name,ecosystem" }
        )
        .select()
        .single();

      if (!packageRecord) continue;
      results.packages++;

      const vulns = await fetchOsvVulnerabilities(pkg.name, pkg.ecosystem);

      for (const vuln of vulns) {
        const patchedVersion =
          vuln.affected?.[0]?.ranges?.[0]?.events?.find(
            (e: { introduced?: string; fixed?: string }) => e.fixed
          )?.fixed ?? null;

        await supabase.from("cve_records").upsert(
          {
            cve_id: vuln.id,
            package_id: packageRecord.id,
            severity: mapSeverity(vuln),
            description: vuln.summary,
            published_at: vuln.published,
            last_modified: vuln.modified,
            patched_version: patchedVersion,
            source: "osv",
            raw_data: vuln,
          },
          { onConflict: "cve_id" }
        );

        results.synced++;
      }
    } catch {
      results.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
