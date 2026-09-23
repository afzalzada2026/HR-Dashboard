import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { DataQuality, FieldKey } from "@/lib/types";

/** Uploaded / generated workforce datasets (metadata only — rows live in dataset_records). */
export const datasets = pgTable("datasets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  rowCount: integer("row_count").notNull().default(0),
  columnCount: integer("column_count").notNull().default(0),
  mapping: jsonb("mapping").$type<Partial<Record<FieldKey, string>>>().notNull().default({}),
  quality: jsonb("quality").$type<DataQuality | null>(),
  source: text("source").notNull().default("upload"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedRole: text("uploaded_role").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Normalized employee records for a dataset (JSONB array for fast whole-dataset loads). */
export const datasetRecords = pgTable("dataset_records", {
  datasetId: uuid("dataset_id")
    .primaryKey()
    .references(() => datasets.id, { onDelete: "cascade" }),
  employees: jsonb("employees").$type<unknown[]>().notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    category: text("category").notNull(),
    details: text("details").notNull().default(""),
    userName: text("user_name").notNull(),
    userEmail: text("user_email").notNull().default(""),
    role: text("role").notNull(),
    ip: text("ip").notNull().default(""),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)]
);

export const scheduledReports = pgTable("scheduled_reports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull(),
  format: text("format").notNull(),
  recipients: text("recipients").notNull().default(""),
  sections: jsonb("sections").$type<string[]>().notNull().default([]),
  timeOfDay: text("time_of_day").notNull().default("08:00"),
  dayOfWeek: integer("day_of_week").notNull().default(1),
  dayOfMonth: integer("day_of_month").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  runCount: integer("run_count").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
