/** @type {import('next').NextConfig} */
const nextConfig = {
  // pglite is only used for local development without a Neon database.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/r/:slug/kamera",
        headers: [{ key: "Permissions-Policy", value: "camera=(self)" }],
      },
    ];
  },
};

export default nextConfig;
