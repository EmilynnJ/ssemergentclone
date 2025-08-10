import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the SoulSeer frontend.
// This configuration enables React fast refresh and configures the
// development server to run on port 5173 by default. Adjust as needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // Ensure that environment variables prefaced with VITE_ are exposed to the client.
  envPrefix: 'VITE_',
});