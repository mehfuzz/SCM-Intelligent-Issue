export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-9" : size === "sm" ? "h-6" : "h-7";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center justify-center ${dim} aspect-square rounded-md bg-airtel-red text-white font-bold`}>
        a
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-airtel-black">airtel</span>
        <span className="text-[10px] uppercase tracking-wider text-airtel-gray">
          SCM Issue Portal
        </span>
      </div>
    </div>
  );
}
