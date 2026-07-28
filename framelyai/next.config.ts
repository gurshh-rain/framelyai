import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // config options here
  reactCompiler: true,
  // Turbopack auto-detects the project root from the nearest lockfile, but a
  // pnpm-lock.yaml in /Users/gurshaangill was being picked first, making
  // Turbopack scan the entire home directory and hang on "Compiling proxy".
  // Pin the root to this directory so it compiles only the project's files.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
