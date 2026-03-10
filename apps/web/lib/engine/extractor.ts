import type { ExtractedPackage, Ecosystem } from "@hwa/types";

// Matches:
// import x from "package"
// import { x } from "package"
// import * as x from "package"
// const x = require("package")
const IMPORT_PATTERNS = [
  /import\s+.*?\s+from\s+['"]([^'"./][^'"]*)['"]/g,
  /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
];

// Python patterns
// import package
// from package import x
const PYTHON_PATTERNS = [
  /^import\s+([a-zA-Z][a-zA-Z0-9_]*)/gm,
  /^from\s+([a-zA-Z][a-zA-Z0-9_]*)\s+import/gm,
];

// Go patterns
// import "package"
// import ( "package" )
const GO_PATTERNS = [
  /import\s+["']([^"']+)["']/g,
  /["']([^"']+)["']/g,
];

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

function extractNpmPackages(
  content: string
): Array<{ name: string; line: number }> {
  const packages: Array<{ name: string; line: number }> = [];

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const raw = match[1];
      if (!raw) continue;

      // Handle scoped packages like @org/package
      const name = raw.startsWith("@")
        ? raw.split("/").slice(0, 2).join("/")
        : raw.split("/")[0];

      if (!name) continue;

      packages.push({
        name,
        line: getLineNumber(content, match.index),
      });
    }
  }

  return packages;
}

function extractPythonPackages(
  content: string
): Array<{ name: string; line: number }> {
  const packages: Array<{ name: string; line: number }> = [];

  for (const pattern of PYTHON_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (!name) continue;
      packages.push({
        name,
        line: getLineNumber(content, match.index),
      });
    }
  }

  return packages;
}

function extractGoPackages(
  content: string
): Array<{ name: string; line: number }> {
  const packages: Array<{ name: string; line: number }> = [];
  const importBlock = content.match(/import\s*\(([\s\S]*?)\)/);

  if (importBlock?.[1]) {
    const lines = importBlock[1].split("\n");
    lines.forEach((line, i) => {
      const match = line.match(/["']([^"']+)["']/);
      if (match?.[1]) {
        packages.push({ name: match[1], line: i + 1 });
      }
    });
  }

  return packages;
}

export function extractPackages(
  content: string,
  language: string
): ExtractedPackage[] {
  const ecosystem = getEcosystem(language);
  let raw: Array<{ name: string; line: number }> = [];

  switch (language) {
    case "typescript":
    case "javascript":
      raw = extractNpmPackages(content);
      break;
    case "python":
      raw = extractPythonPackages(content);
      break;
    case "go":
      raw = extractGoPackages(content);
      break;
  }

  // Deduplicate by name, keep first occurrence
  const seen = new Set<string>();
  return raw
    .filter(({ name }) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map(({ name, line }) => ({
      name,
      version: null,
      ecosystem,
      line,
    }));
}

function getEcosystem(language: string): Ecosystem {
  switch (language) {
    case "python": return "pypi";
    case "go": return "go";
    default: return "npm";
  }
}
