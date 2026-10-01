"use client";

import { Lock, UserRound } from "lucide-react";
import { EmployeeEditor } from "../admin/EmployeeEditor";
import { DataGate } from "../shell/Chrome";
import { PageHeader } from "../ui/primitives";
import { useUIStore } from "@/store/ui";
import { can } from "@/lib/rbac";

function RecordsInner() {
  const role = useUIStore((s) => s.session.role);
  const allowed = can(role, "upload_data");
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Employee records"
        icon={<UserRound />}
        subtitle={allowed ? "Add, edit or remove rows in the overall workforce dataset — every module updates instantly" : "Only HR Admin and HR Officer can edit employee records"}
      />
      {allowed ? (
        <EmployeeEditor />
      ) : (
        <div className="glass rounded-2xl p-10 text-center">
          <Lock className="mx-auto h-10 w-10 text-subtle" />
          <p className="mt-3 text-sm text-muted">Your role can view the workforce but cannot change records.</p>
        </div>
      )}
    </>
  );
}

export default function RecordsView() {
  return (
    <DataGate>
      <RecordsInner />
    </DataGate>
  );
}
