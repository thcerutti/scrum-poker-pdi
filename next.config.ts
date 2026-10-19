import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Os termos do KLIPY exigem que a busca de GIFs saia do navegador, então a
  // chave precisa ir para o bundle do cliente (é inlined no build).
  env: {
    KLYPY_KEY: process.env.KLYPY_KEY ?? "",
  },
};

export default nextConfig;
