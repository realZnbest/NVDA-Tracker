import { AlertsManager } from "@/components/alerts-manager";

export default function AlertsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-lg font-medium text-text-primary">การแจ้งเตือน</h1>
      <AlertsManager />
    </div>
  );
}
