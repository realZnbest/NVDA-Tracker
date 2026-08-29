import { AlertsManager } from "@/components/alerts-manager";

export default function AlertsPage() {
  return (
    <div className="page-container-reading flex flex-col gap-4">
      <h1 className="text-display-headline font-medium text-text-primary">การแจ้งเตือน</h1>
      <AlertsManager />
    </div>
  );
}
