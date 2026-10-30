import * as React from "react";
import { AmrCaseCollectionForm } from "@/components/amr-case-collection-form";
import { useLocation } from "wouter";

export default function AmrReportPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full min-h-screen bg-black -m-4 sm:-m-8 p-2 sm:p-6 text-slate-100">
      <AmrCaseCollectionForm onCancel={() => setLocation("/cases")} />
    </div>
  );
}
