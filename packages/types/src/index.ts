// Scan types
export type ScanStatus = "pending" | "processing" | "completed" | "failed";
export type VulnerabilityType = "security" | "staleness";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Ecosystem = "npm" | "pypi" | "cargo" | "go";

export interface ExtractedPackage {
  name: string;
  version: string | null;
  ecosystem: Ecosystem;
  line: number;
}

export interface VulnerabilityResult {
  type: VulnerabilityType;
  severity: Severity;
  lineStart: number | null;
  lineEnd: number | null;
  description: string;
  cveId: string | null;
  suggestion: string;
}

export interface OsvVulnerability {
  id: string;
  summary: string;
  severity?: Array<{ type: string; score: string }>;
  affected: Array<{
    package: { name: string; ecosystem: string };
    ranges?: Array<{
      type: string;
      events: Array<{ introduced?: string; fixed?: string }>;
    }>;
    versions?: string[];
  }>;
  published: string;
  modified: string;
}

export interface OsvQueryResponse {
  vulns?: OsvVulnerability[];
}
