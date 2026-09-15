import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// Legion Web — Phase 3 (CRA -> Vite). `envPrefix` keeps existing REACT_APP_*-prefixed
// .env/.env.local values working unchanged (see src/lib/env.js), so nobody has to touch their
// existing .env.local — VITE_* is also accepted for new code going forward.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Replicates CRA's built-in `import { ReactComponent as X } from "./file.svg"` (SVGR) so the
    // two components using it don't need rewriting; plain `import logo from "./file.svg"` (a URL)
    // keeps working unchanged since this plugin only intercepts the named ReactComponent export.
    svgr(),
  ],
  envPrefix: ["VITE_", "REACT_APP_"],
  base: process.env.VITE_PUBLIC_BASE || "/",
  // Deliberately NOT setting a custom `define` for process.env.NODE_ENV: Vite already replaces it
  // automatically (and its dependency pre-bundler relies on that exact automatic handling to
  // statically eliminate react-dom/client's `if (NODE_ENV === 'production') {...} else { require(...) }`
  // branch during optimizeDeps — a manual override here left a literal `require(...)` in the
  // pre-bundled output, crashing at runtime with "require is not defined"). `setupProcessEnv.js`
  // (imported first in src/index.jsx) still covers any transitive dep that merely expects a
  // `process` global object to exist for other env checks.
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
    alias: {
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: "build",
    sourcemap: mode !== "production",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
  },
}));
