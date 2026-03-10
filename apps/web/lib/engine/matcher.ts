import { serviceClient } from "@/lib/supabase/service";
import type { ExtractedPackage, VulnerabilityResult } from "@hwa/types";

export async function matchCves(
  packages: ExtractedPackage[]
): Promise<VulnerabilityResult[]> {
  if (packages.length === 0) return [];

  const results: VulnerabilityResult[] = [];

  for (const pkg of packages) {
    // Find package in database
    const { data: packageRecord } = await serviceClient
      .from("packages")
      .select("id, name")
      .eq("name", pkg.name)
      .eq("ecosystem", pkg.ecosystem)
      .single();

    if (!packageRecord) continue;

    // Find CVEs for this package
    const { data: cves } = await serviceClient
      .from("cve_records")
      .select("*")
      .eq("package_id", packageRecord.id)
      .order("severity", { ascending: true });

    if (!cves || cves.length === 0) continue;

    for (const cve of cves) {
      results.push({
        type: "security",
        severity: cve.severity,
        lineStart: pkg.line,
        lineEnd: pkg.line,
        description: `${pkg.name}: ${cve.description}`,
        cveId: cve.cve_id,
        suggestion: cve.patched_version
          ? `Upgrade to ${pkg.name}@${cve.patched_version} or later`
          : `Review and replace ${pkg.name} — no patched version available`,
      });
    }
  }

  return results;
}
