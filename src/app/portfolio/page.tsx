import { PortfolioOverview } from "@/components/portfolio-overview";

export default function PortfolioPage() {
  return (
    <div className="page-container-reading flex flex-col gap-4">
      <h1 className="text-display-headline font-medium text-text-primary">พอร์ตของฉัน</h1>
      <PortfolioOverview />
    </div>
  );
}
