import path from 'path';
import { fileURLToPath } from 'url';
import { fork, ChildProcess } from 'child_process';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to automatically start the backend Express server during Vite development
function backendServerPlugin(): Plugin {
  let backendProcess: ChildProcess | null = null;
  return {
    name: 'backend-server-runner',
    configureServer(server) {
      const serverPath = path.resolve(__dirname, 'backend/server.js');
      try {
        backendProcess = fork(serverPath, [], {
          env: { ...process.env, BACKEND_PORT: '5000', PORT: '5000' },
          stdio: 'inherit'
        });
      } catch (err) {
        console.warn('Could not automatically start backend process:', err);
      }

      server.httpServer?.on('close', () => {
        if (backendProcess) {
          backendProcess.kill();
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:5000',
            changeOrigin: true,
            secure: false,
            configure: (proxy) => {
              proxy.on('error', (_err, _req, res) => {
                if (res && !('headersSent' in res && res.headersSent) && typeof (res as any).writeHead === 'function') {
                  (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                  (res as any).end(JSON.stringify({ 
                    success: false, 
                    message: 'Backend service starting up or temporarily offline' 
                  }));
                }
              });
            }
          }
        }
      },
      plugins: [tailwindcss(), react(), backendServerPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.REACT_APP_API_URL': JSON.stringify(env.REACT_APP_API_URL || env.VITE_API_URL || ''),
        'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'es2020',
        sourcemap: false,
        chunkSizeWarningLimit: 600,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                  return 'vendor-react';
                }
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
                if (id.includes('socket.io-client')) {
                  return 'vendor-socket';
                }
                if (id.includes('axios')) {
                  return 'vendor-axios';
                }
              }
            }
          }
        }
      }
    };
});

