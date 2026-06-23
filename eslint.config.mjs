import next from "eslint-config-next";

// `next lint` was removed in Next.js 16; we run ESLint directly. eslint-config-next
// v16 ships a native flat config (its default export bundles core-web-vitals +
// typescript), so we spread it straight in — no FlatCompat shim needed.
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "drizzle/**",
      "next-env.d.ts",
    ],
  },
  ...next,
];

export default config;
