"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/profile", label: "Profile" },
  { href: "/my-logos", label: "My Logos" },
  { href: "/upload-logo", label: "Upload Logo" },
];

export default function ProfileSubNav() {
  const pathname = usePathname();

  return (
    <nav className="pg-subnav pg-glass">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`pg-subnav-link${pathname === l.href ? " active" : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}