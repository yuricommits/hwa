import { serviceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

type NvdCveItem = {
  cve: {
    id: string;
    descriptions: Array<{ lang: string; value: string }>;
    published: string;
    lastModified: string;
    metrics?: {
      cvssMetricV31?: Array<{
        cvssData: { baseScore: number; baseSeverity: string };
      }>;
      cvssMetricV2?: Array<{
        cvssData: { baseScore: number };
        baseSeverity: string;
      }>;
    };
    weaknesses?: Array<{
      description: Array<{ value: string }>;
    }>;
    configurations?: Array<{
      nodes: Array<{
        cpeMatch: Array<{
          criteria: string;
          versionEndExcluding?: string;
        }>;
      }>;
    }>;
  };
};

type NvdResponse = {
  vulnerabilities: NvdCveItem[];
  totalResults: number;
  resultsPerPage: number;
};

// Keywords to search — maps to your tracked ecosystems
const SEARCH_KEYWORDS = [
  "npm",
  "node.js",
  "python pip",
  "golang",
];

function mapSeverity(severity: string, score?: number): string {
  if (score !== undefined) {
    if (score >= 9.0) return "critical";
    if (score >= 7.0) return "high";
    if (score >= 4.0) return "medium";
    return "low";
  }
  const map: Record<string, string> = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
  };
  return map[severity.toLowerCase()] ?? "medium";
}

function getDescription(item: NvdCveItem): string {
  return (
    item.cve.descriptions.find((d) => d.lang === "en")?.value ??
    "No description available"
  );
}

function getCvss(item: NvdCveItem): { score: number; severity: string } | null {
  const v31 = item.cve.metrics?.cvssMetricV31?.[0];
  if (v31) {
    return {
      score: v31.cvssData.baseScore,
      severity: v31.cvssData.baseSeverity,
    };
  }
  const v2 = item.cve.metrics?.cvssMetricV2?.[0];
  if (v2) {
    return {
      score: v2.cvssData.baseScore,
      severity: v2.baseSeverity,
    };
  }
  return null;
}

function extractPackageName(criteria: string): string | null {
  // CPE format: cpe:2.3:a:vendor:product:version:...
  const parts = criteria.split(":");
  if (parts.length >= 5) {
    return parts[4] ?? null;
  }
  return null;
}

function mapKeywordToEcosystem(keyword: string): string {
  const map: Record<string, string> = {
    "npm": "npm",
    "node.js": "npm",
    "python pip": "pypi",
    "golang": "go",
  };
  return map[keyword] ?? "npm";
}

async function fetchNvdVulnerabilities(
  keyword: string,
  startIndex: number
): Promise<NvdResponse> {
  const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
  url.searchParams.set("keywordSearch", keyword);
  url.searchParams.set("resultsPerPage", "50");
  url.searchParams.set("startIndex", String(startIndex));

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (process.env.NVD_API_KEY) {
    headers["apiKey"] = process.env.NVD_API_KEY;
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    throw new Error(`NVD API error: ${response.status}`);
  }

  return response.json() as Promise<NvdResponse>;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { synced: 0, skipped: 0, errors: 0 };

  for (const keyword of SEARCH_KEYWORDS) {
    try {
      const ecosystem = mapKeywordToEcosystem(keyword);

      // Fetch first 50 results per keyword
      const data = await fetchNvdVulnerabilities(keyword, 0);

      if (!data.vulnerabilities || data.vulnerabilities.length === 0) continue;

      // Collect unique packages from CPE data
      const uniquePackages = new Map<string, string>();
      for (const item of data.vulnerabilities) {
        const nodes = item.cve.configurations?.flatMap((c) => c.nodes) ?? [];
        for (const node of nodes) {
          for (const cpe of node.cpeMatch ?? []) {
            const name = extractPackageName(cpe.criteria);
            if (name && name !== "*") {
              uniquePackages.set(name, ecosystem);
            }
          }
        }
      }

      // Batch upsert packages
      const packageList = Array.from(uniquePackages.entries()).map(
        ([name, eco]) => ({ name, ecosystem: eco })
      );

      let pkgMap = new Map<string, string>();

      if (packageList.length > 0) {
        const { data: upsertedPackages } = await serviceClient
          .from("packages")
          .upsert(packageList, { onConflict: "name,ecosystem" })
          .select("id, name, ecosystem");

        pkgMap = new Map(
          (upsertedPackages ?? []).map((p) => [
            `${p.name}:${p.ecosystem}`,
            p.id,
          ])
        );
      }

      // Build CVE records
      const cveRecords = [];
      for (const item of data.vulnerabilities) {
        const cvss = getCvss(item);
        const description = getDescription(item);

        const nodes = item.cve.configurations?.flatMap((c) => c.nodes) ?? [];
        const patchedVersion =
          nodes
            .flatMap((n) => n.cpeMatch ?? [])
            .find((c) => c.versionEndExcluding)
            ?.versionEndExcluding ?? null;

        // Try to find a matching package
        const firstCpe = nodes.flatMap((n) => n.cpeMatch ?? [])[0];
        const pkgName = firstCpe ? extractPackageName(firstCpe.criteria) : null;
        const pkgId = pkgName
          ? pkgMap.get(`${pkgName}:${ecosystem}`) ?? null
          : null;

        cveRecords.push({
          cve_id: item.cve.id,
          package_id: pkgId,
          severity: cvss
            ? mapSeverity(cvss.severity, cvss.score)
            : "medium",
          cvss_score: cvss?.score ?? null,
          description,
          published_at: item.cve.published,
          last_modified: item.cve.lastModified,
          patched_version: patchedVersion,
          source: "nvd",
          raw_data: item.cve,
        });
      }

      // Insert in chunks of 50
      for (let i = 0; i < cveRecords.length; i += 50) {
        const chunk = cveRecords.slice(i, i + 50);
        await serviceClient
          .from("cve_records")
          .upsert(chunk, { onConflict: "cve_id" });
        results.synced += chunk.length;
      }

      // NVD rate limit — wait 1s between keyword searches
      await new Promise((resolve) => setTimeout(resolve, 1000));

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

export { POST as GET };
