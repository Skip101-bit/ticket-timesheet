import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["nodemailer"],
}

export default nextConfig
