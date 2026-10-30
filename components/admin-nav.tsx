"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/admin", "Today"],
  ["/admin/authorize", "Authorise"],
  ["/admin/check-in", "Check-in"],
  ["/admin/vaccinations", "Vaccinations"],
  ["/admin/customers", "Customers"],
  ["/admin/requests", "Requests"],
  ["/admin/settings", "Settings"],
  ["/admin/qr", "QR & poster"],
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="nav-scroll" aria-label="Admin">
      {links.map(([href, label]) => {
        const on = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? "is-on" : ""}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
