import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "10MS SEO Agent",
  description: "Memory-backed SEO agent for 10 Minute School course pages",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/courses/new", label: "New course" },
  { href: "/keywords", label: "Keywords" },
  { href: "/import", label: "Import" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-semibold text-brand-dark">
              10MS <span className="text-brand">SEO Agent</span>
            </Link>
            <nav className="flex gap-4 text-sm text-gray-600">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-brand-dark">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
