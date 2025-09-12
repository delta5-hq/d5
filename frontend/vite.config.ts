import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import obfuscatorPlugin from "vite-plugin-javascript-obfuscator";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        tailwindcss(),
        svgr(),
        ...(mode === "production"
            ? [
                  obfuscatorPlugin({
                      options: {
                          compact: true,
                          numbersToExpressions: true,
                          simplify: true,
                          stringArrayShuffle: true,
                          splitStrings: true,
                          stringArrayThreshold: 1,
                          deadCodeInjection: true,
                          debugProtection: true,
                      },
                  }),
              ]
            : []),
    ],
    resolve: {
        alias: {
            "@app": path.resolve(__dirname, "src/app"),
            "@entities": path.resolve(__dirname, "src/entities"),
            "@features": path.resolve(__dirname, "src/features"),
            "@shared": path.resolve(__dirname, "src/shared"),
            "@pages": path.resolve(__dirname, "src/pages"),
            "@widgets": path.resolve(__dirname, "src/widgets"),
            "@processes": path.resolve(__dirname, "src/processes"),
            "@/components": path.resolve(__dirname, "src/shared/components"),
            "@": path.resolve(__dirname, "src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ["react", "react-dom"],
                    intl: ["react-intl"],
                    icons: ["lucide-react"],
                },
            },
        },
    },
}));
