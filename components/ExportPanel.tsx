"use client";

import { useState } from "react";

export interface ExportData {
  name: string;
  productUrl: string | null;
  metaTitleBn: string | null;
  metaTitleEn: string | null;
  metaDescBn: string | null;
  metaDescEn: string | null;
  keywords: string[] | null;
  ogTitleBn: string | null;
  ogTitleEn: string | null;
  ogDescriptionBn: string | null;
  ogDescriptionEn: string | null;
  ogImage: string | null;
  ogImageAlt: string | null;
  schemaJsonld: Record<string, unknown> | null;
}

type Format = "html" | "json" | "plain";

function buildHtml(d: ExportData): string {
  const esc = (s: string | null) => (s ?? "").replace(/"/g, "&quot;");
  const lines = [
    `<title>${d.metaTitleEn ?? d.name}</title>`,
    `<meta name="description" content="${esc(d.metaDescEn)}" />`,
    d.keywords?.length ? `<meta name="keywords" content="${esc(d.keywords.join(", "))}" />` : "",
    `<meta property="og:locale" content="bn_BD" />`,
    `<meta property="og:locale:alternate" content="en_US" />`,
    `<!-- Open Graph -->`,
    `<meta property="og:title" content="${esc(d.ogTitleBn)}" />`,
    `<meta property="og:description" content="${esc(d.ogDescriptionBn)}" />`,
    d.ogTitleEn ? `<meta property="og:title:en" content="${esc(d.ogTitleEn)}" />` : "",
    d.ogDescriptionEn ? `<meta property="og:description:en" content="${esc(d.ogDescriptionEn)}" />` : "",
    d.ogImage ? `<meta property="og:image" content="${esc(d.ogImage)}" />` : "",
    d.ogImageAlt ? `<meta property="og:image:alt" content="${esc(d.ogImageAlt)}" />` : "",
    d.productUrl ? `<meta property="og:url" content="${esc(d.productUrl)}" />` : "",
    d.schemaJsonld
      ? `<script type="application/ld+json">\n${JSON.stringify(d.schemaJsonld, null, 2)}\n</script>`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function buildJson(d: ExportData): string {
  return JSON.stringify(
    {
      name: d.name,
      url: d.productUrl,
      metaTitle: { bn: d.metaTitleBn, en: d.metaTitleEn },
      metaDescription: { bn: d.metaDescBn, en: d.metaDescEn },
      keywords: d.keywords ?? [],
      openGraph: {
        title: { bn: d.ogTitleBn, en: d.ogTitleEn },
        description: { bn: d.ogDescriptionBn, en: d.ogDescriptionEn },
        image: d.ogImage,
        imageAlt: d.ogImageAlt,
      },
      jsonLd: d.schemaJsonld,
    },
    null,
    2
  );
}

function buildPlain(d: ExportData): string {
  return [
    `Meta title (BN): ${d.metaTitleBn ?? ""}`,
    `Meta title (EN): ${d.metaTitleEn ?? ""}`,
    `Meta description (BN): ${d.metaDescBn ?? ""}`,
    `Meta description (EN): ${d.metaDescEn ?? ""}`,
    `Keywords: ${(d.keywords ?? []).join(", ")}`,
    `og:title (BN): ${d.ogTitleBn ?? ""}`,
    `og:title (EN): ${d.ogTitleEn ?? ""}`,
    `og:description (BN): ${d.ogDescriptionBn ?? ""}`,
    `og:description (EN): ${d.ogDescriptionEn ?? ""}`,
    `og:image: ${d.ogImage ?? ""}`,
    `og:image:alt: ${d.ogImageAlt ?? ""}`,
  ].join("\n");
}

const EXT: Record<Format, string> = { html: "html", json: "json", plain: "txt" };

/** Copy-ready exports of the stored SEO record (no server round-trip). */
export function ExportPanel({ data }: { data: ExportData }) {
  const [format, setFormat] = useState<Format>("html");
  const [copied, setCopied] = useState(false);

  const content =
    format === "html" ? buildHtml(data) : format === "json" ? buildJson(data) : buildPlain(data);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable in some contexts */
    }
  }

  function download() {
    const slug = (data.productUrl?.split("/").pop() || "seo").replace(/[^a-z0-9-]/gi, "-");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.${EXT[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: Format; label: string }[] = [
    { id: "html", label: "HTML + JSON-LD" },
    { id: "json", label: "JSON" },
    { id: "plain", label: "Plain fields" },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-gray-500">Export</h3>
        <div className="flex gap-2">
          <button onClick={copy} className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={download} className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
            Download
          </button>
        </div>
      </div>

      <div className="mb-3 flex gap-2 text-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFormat(t.id)}
            className={`rounded-md px-3 py-1 ${
              format === t.id ? "bg-brand text-white" : "border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <pre className="max-h-80 overflow-auto rounded bg-gray-50 p-3 text-xs">{content}</pre>
    </div>
  );
}
