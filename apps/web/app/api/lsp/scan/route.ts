import { extractPackages } from "@/lib/engine/extractor";
import { checkStaleness } from "@/lib/engine/staleness";
import { matchCves } from "@/lib/engine/matcher";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.LSP_API_KEY;

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, language } = await request.json() as {
    content: string;
    language: string;
  };

  if (!content || !language) {
    return NextResponse.json({ error: "content and language are required" }, { status: 400 });
  }

  try {
    const packages = extractPackages(content, language);

    const [cveVulns, stalenessVulns] = await Promise.all([
      matchCves(packages),
      checkStaleness(content, packages, language),
    ]);

    const vulnerabilities = [...cveVulns, ...stalenessVulns].map((v) => ({
      severity: v.severity,
      description: v.description,
      suggestion: v.suggestion,
      lineStart: v.lineStart ?? 1,
      lineEnd: v.lineEnd ?? 1,
      cveId: v.cveId ?? null,
    }));

    return NextResponse.json({ vulnerabilities });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
