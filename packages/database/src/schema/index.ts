import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const scanStatusEnum = pgEnum("scan_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const vulnerabilityTypeEnum = pgEnum("vulnerability_type", [
  "security",
  "staleness",
]);

export const severityEnum = pgEnum("severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const ecosystemEnum = pgEnum("ecosystem", [
  "npm",
  "pypi",
  "cargo",
  "go",
]);

export const cveSourceEnum = pgEnum("cve_source", ["nvd", "osv", "github"]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // references Supabase Auth user
  email: text("email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Scans ────────────────────────────────────────────────────────────────────

export const scans = pgTable("scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: scanStatusEnum("status").notNull().default("pending"),
  language: text("language").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  shareToken: text("share_token").unique(), // null = not shared, token = shareable link
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ─── Scan Files ───────────────────────────────────────────────────────────────

export const scanFiles = pgTable("scan_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id")
    .notNull()
    .references(() => scans.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Vulnerabilities ──────────────────────────────────────────────────────────

export const vulnerabilities = pgTable("vulnerabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id")
    .notNull()
    .references(() => scans.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => scanFiles.id, { onDelete: "cascade" }),
  type: vulnerabilityTypeEnum("type").notNull(),
  severity: severityEnum("severity").notNull(),
  lineStart: integer("line_start"),
  lineEnd: integer("line_end"),
  description: text("description").notNull(),
  cveId: text("cve_id"), // links to cve_records.cve_id
  suggestion: text("suggestion").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Packages ─────────────────────────────────────────────────────────────────

export const packages = pgTable(
  "packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ecosystem: ecosystemEnum("ecosystem").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("packages_name_ecosystem_idx").on(table.name, table.ecosystem),
  ],
);

// ─── Package Versions ─────────────────────────────────────────────────────────

export const packageVersions = pgTable(
  "package_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    publishedAt: timestamp("published_at").notNull(),
    isDeprecated: boolean("is_deprecated").notNull().default(false),
    deprecatedAt: timestamp("deprecated_at"),
    deprecationReason: text("deprecation_reason"),
    isLatest: boolean("is_latest").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("package_versions_package_id_version_idx").on(
      table.packageId,
      table.version,
    ),
  ],
);

// ─── CVE Records ──────────────────────────────────────────────────────────────

export const cveRecords = pgTable("cve_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  cveId: text("cve_id").notNull().unique(), // e.g. CVE-2023-1234
  packageId: uuid("package_id").references(() => packages.id),
  severity: severityEnum("severity").notNull(),
  cvssScore: decimal("cvss_score", { precision: 3, scale: 1 }),
  description: text("description").notNull(),
  publishedAt: timestamp("published_at").notNull(),
  lastModified: timestamp("last_modified").notNull(),
  patchedVersion: text("patched_version"),
  source: cveSourceEnum("source").notNull(),
  rawData: jsonb("raw_data"), // full original payload from source API
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Staleness Records ────────────────────────────────────────────────────────

export const stalenessRecords = pgTable("staleness_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(), // e.g. "use request for HTTP requests"
  becameStaleAt: timestamp("became_stale_at").notNull(), // when this became bad advice
  reason: text("reason").notNull(), // why it's stale
  replacement: text("replacement").notNull(), // what to use instead
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
