import { serviceClient } from "@/lib/supabase/service";
import { extractPackages } from "./extractor";
import { matchCves } from "./matcher";
import { checkStaleness } from "./staleness";

export async function runScan(scanId: string): Promise<void> {
  // Mark scan as processing
  await serviceClient
    .from("scans")
    .update({ status: "processing" })
    .eq("id", scanId);

  try {
    // Fetch scan files
    const { data: files } = await serviceClient
      .from("scan_files")
      .select("*")
      .eq("scan_id", scanId);

    if (!files || files.length === 0) {
      await serviceClient
        .from("scans")
        .update({ status: "failed" })
        .eq("id", scanId);
      return;
    }

    const allVulnerabilities = [];

    for (const file of files) {
      // Extract packages from code
      const packages = extractPackages(file.content, file.language);

      // Run CVE matching and staleness checking in parallel
      const [cveResults, stalenessResults] = await Promise.all([
        matchCves(packages),
        checkStaleness(file.content, packages),
      ]);

      const combined = [...cveResults, ...stalenessResults];

      for (const vuln of combined) {
        allVulnerabilities.push({
          scan_id: scanId,
          file_id: file.id,
          type: vuln.type,
          severity: vuln.severity,
          line_start: vuln.lineStart,
          line_end: vuln.lineEnd,
          description: vuln.description,
          cve_id: vuln.cveId,
          suggestion: vuln.suggestion,
        });
      }
    }

    // Insert all vulnerabilities
    if (allVulnerabilities.length > 0) {
      await serviceClient
        .from("vulnerabilities")
        .insert(allVulnerabilities);
    }

    // Mark scan as completed
    await serviceClient
      .from("scans")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanId);

  } catch (error) {
    console.error("Scan failed:", error);
    await serviceClient
      .from("scans")
      .update({ status: "failed" })
      .eq("id", scanId);
  }
}
