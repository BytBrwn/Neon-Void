import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: "/",
  },
  build: {
    rollupOptions: {
      input: ["./index.html", "./standalone.html"],
    },
  },
});
