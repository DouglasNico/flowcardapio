import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  define: mode === 'teste' ? { 'import.meta.env.VITE_AMBIENTE_TESTE': '"true"' } : {},
  server: { port: 5173 },
  preview: { port: 4173 }
}));