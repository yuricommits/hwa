import { serviceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

const ECOSYSTEMS = ["npm", "pip", "go"];

type GitHubAdvisory = {
  ghsa_id: string;
  summary: string;
  severity: string;
  published_at: string;
  updated_at: string;
  cvss?: { score: number };
  vulnerabilities: Array<{
    package: {
      name: string;
      ecosystem: string;
    };
    first_patched_version: string | null;
  }>;
};

function mapEcosystem(ghEcosystem: string): string {
  const map: Record<string, string> = {
    npm: "npm",
    pip: "pypi",
    go: "go",
  };
  return map[ghEcosystem.toLowerCase()] ?? "npm";
}

function mapSeverity(severity: string, cvssScore?: number): string {
  if (cvssScore !== undefined) {
    if (cvssScore >= 9.0) return "critical";
    if (cvssScore >= 7.0) return "high";
    if (cvssScore >= 4.0) return "medium";
    return "low";
  }
  const map: Record<string, string> = {
    critical: "critical",
    high: "high",
    moderate: "medium",
    low: "low",
  };
  return map[severity.toLowerCase()] ?? "medium";
}

async function fetchGitHubAdvisories(
  ecosystem: string,
  page: number
): Promise<GitHubAdvisory[]> {
  const url = new URL("https://api.github.com/advisories");
  url.searchParams.set("ecosystem", ecosystem);
  url.searchParams.set("per_page", "30");
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) return [];
  return response.json() as Promise<GitHubAdvisory[]>;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { synced: 0, skipped: 0, errors: 0 };

  for (const ecosystem of ECOSYSTEMS) {
    try {
      const advisories = await fetchGitHubAdvisories(ecosystem, 1);
      if (advisories.length === 0) continue;

      // Collect all unique packages first
      const uniquePackages = new Map<string, { name: string; ecosystem: string }>();
      for (const advisory of advisories) {
        for (const vuln of advisory.vulnerabilities) {
          if (!vuln.package?.name) continue;
          const mapped = mapEcosystem(vuln.package.ecosystem);
          const key = `${vuln.package.name}:${mapped}`;
          uniquePackages.set(key, { name: vuln.package.name, ecosystem: mapped });
        }
      }

      // Batch upsert all packages
      const packageList = Array.from(uniquePackages.values());
      if (packageList.length === 0) continue;

      const { data: upsertedPackages } = await serviceClient
        .from("packages")
        .upsert(packageList, { onConflict: "name,ecosystem" })
        .select("id, name, ecosystem");

      if (!upsertedPackages) continue;

      // Build package lookup map
      const pkgMap = new Map(
        upsertedPackages.map((p) => [`${p.name}:${p.ecosystem}`, p.id])
      );

      // Batch upsert CVE records
      const cveRecords = [];
      for (const advisory of advisories) {
        for (const vuln of advisory.vulnerabilities) {
          if (!vuln.package?.name) continue;
          const mapped = mapEcosystem(vuln.package.ecosystem);
          const pkgId = pkgMap.get(`${vuln.package.name}:${mapped}`);
          if (!pkgId) { results.skipped++; continue; }

          cveRecords.push({
            cve_id: advisory.ghsa_id,
            package_id: pkgId,
            severity: mapSeverity(advisory.severity, advisory.cvss?.score),
            description: advisory.summary,
            published_at: advisory.published_at,
            last_modified: advisory.updated_at,
            patched_version: vuln.first_patched_version ?? null,
            source: "github",
            raw_data: advisory,
          });
        }
      }

      // Insert in chunks of 50
      for (let i = 0; i < cveRecords.length; i += 50) {
        const chunk = cveRecords.slice(i, i + 50);
        await serviceClient
          .from("cve_records")
          .upsert(chunk, { onConflict: "cve_id" });
        results.synced += chunk.length;
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
