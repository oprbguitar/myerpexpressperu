import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      devOptions: { enabled: true, type: "module" },
      includeAssets: ["icons/icon-1024.png"],
      manifest: {
        name: "ERP Express Perú",
        short_name: "ERP Express",
        description: "Núcleo portable para la gestión empresarial peruana",
        theme_color: "#072f55",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "es-PE",
        icons: [
          { src: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: { cacheName: "erp-shell-v1", networkTimeoutSeconds: 3 }
          }
        ]
      }
    })
  ],
  server: {
    port: 5273
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 500
  }
});
