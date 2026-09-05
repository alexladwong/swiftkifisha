import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
        host: "::",
        port: 5174,
        hmr: {
            overlay: false,
        },
        proxy: {
            // SwiftShip API (../backend) — default port 5001; 5000 is used by macOS AirPlay.
            "/api": {
                target: process.env.API_PROXY || "http://localhost:5001",
                changeOrigin: true,
            },
        },
    },
    plugins: [react()].filter(Boolean),
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
}));
