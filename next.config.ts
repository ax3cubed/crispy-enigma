import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ltijs and its dependencies are CommonJS; exclude from Next.js bundling
  serverExternalPackages: ['ltijs', 'ltijs-sequelize', 'sequelize', 'sqlite3', 'better-sqlite3'],
}

export default nextConfig
