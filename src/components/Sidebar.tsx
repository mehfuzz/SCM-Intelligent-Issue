"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tickets", label: "My Tickets" },
  { href: "/tickets/new", label: "Raise Issue" },
  { href: "/coe", label: "COE Workbench" },
  { href: "/leadership", label: "Leadership" },
  { href: "/admin", label: "Admin" }
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-airtel-border bg-white">
      <div className="px-5 py-4 border-b border-airtel-border">
        <Brand size="md" />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = path === item.href || path?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-airtel-redLight text-airtel-red"
                  : "text-airtel-black hover:bg-airtel-surface"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-xs text-airtel-gray border-t border-airtel-border">
        v1.0 · Phase 1
      </div>
    </aside>
  );
}
