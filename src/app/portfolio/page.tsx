import { PortfolioOverview } from "@/components/portfolio-overview";

export default function PortfolioPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-lg font-medium text-text-primary">พอร์ตของฉัน</h1>
      <PortfolioOverview />
    </div>
  );
}
