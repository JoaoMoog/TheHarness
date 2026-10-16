import type { NextConfig } from 'next';
const config: NextConfig = { output: 'standalone', turbopack: { root: process.cwd() }, devIndicators: false };
export default config;
