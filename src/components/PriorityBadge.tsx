export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="badge-gray">—</span>;
  const map: Record<string, string> = {
    P0: "bg-airtel-red text-white",
    P1: "bg-airtel-redLight text-airtel-red border border-airtel-red",
    P2: "bg-airtel-surface text-airtel-black border border-airtel-border",
    P3: "bg-white text-airtel-gray border border-airtel-border"
  };
  return (
    <span className={`badge ${map[priority] ?? "badge-gray"}`}>{priority}</span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return <span className="badge-gray capitalize">{stage.replaceAll("_", " ")}</span>;
}
