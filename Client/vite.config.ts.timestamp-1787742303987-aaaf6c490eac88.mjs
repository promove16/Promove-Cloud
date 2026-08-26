// vite.config.ts
import { defineConfig } from "file:///C:/Charan%20Works/Other%20Projects/ProMove/Client/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Charan%20Works/Other%20Projects/ProMove/Client/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///C:/Charan%20Works/Other%20Projects/ProMove/Client/vite.config.ts";
var vendorChunks = {
  "vendor-react": ["react", "react-dom", "react-router-dom"],
  "vendor-state": ["zustand", "@tanstack/react-query"],
  "vendor-network": ["axios", "socket.io-client"],
  "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
  "vendor-ui": ["lucide-react", "clsx", "tailwind-merge"],
  "vendor-export": ["html2canvas", "jspdf"]
};
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("/node_modules/")) {
            return void 0;
          }
          for (const [chunkName, packages] of Object.entries(vendorChunks)) {
            if (packages.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`))) {
              return chunkName;
            }
          }
          return void 0;
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxDaGFyYW4gV29ya3NcXFxcT3RoZXIgUHJvamVjdHNcXFxcUHJvTW92ZVxcXFxDbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXENoYXJhbiBXb3Jrc1xcXFxPdGhlciBQcm9qZWN0c1xcXFxQcm9Nb3ZlXFxcXENsaWVudFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovQ2hhcmFuJTIwV29ya3MvT3RoZXIlMjBQcm9qZWN0cy9Qcm9Nb3ZlL0NsaWVudC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJztcblxuY29uc3QgdmVuZG9yQ2h1bmtzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXG4gICd2ZW5kb3Itc3RhdGUnOiBbJ3p1c3RhbmQnLCAnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXG4gICd2ZW5kb3ItbmV0d29yayc6IFsnYXhpb3MnLCAnc29ja2V0LmlvLWNsaWVudCddLFxuICAndmVuZG9yLWZvcm1zJzogWydyZWFjdC1ob29rLWZvcm0nLCAnQGhvb2tmb3JtL3Jlc29sdmVycycsICd6b2QnXSxcbiAgJ3ZlbmRvci11aSc6IFsnbHVjaWRlLXJlYWN0JywgJ2Nsc3gnLCAndGFpbHdpbmQtbWVyZ2UnXSxcbiAgJ3ZlbmRvci1leHBvcnQnOiBbJ2h0bWwyY2FudmFzJywgJ2pzcGRmJ10sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogJzAuMC4wLjAnLFxuICAgIHBvcnQ6IDUxNzMsXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICBtaW5pZnk6ICdlc2J1aWxkJyxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDYwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgY29uc3Qgbm9ybWFsaXplZElkID0gaWQucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXG4gICAgICAgICAgaWYgKCFub3JtYWxpemVkSWQuaW5jbHVkZXMoJy9ub2RlX21vZHVsZXMvJykpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZm9yIChjb25zdCBbY2h1bmtOYW1lLCBwYWNrYWdlc10gb2YgT2JqZWN0LmVudHJpZXModmVuZG9yQ2h1bmtzKSkge1xuICAgICAgICAgICAgaWYgKHBhY2thZ2VzLnNvbWUoKHBhY2thZ2VOYW1lKSA9PiBub3JtYWxpemVkSWQuaW5jbHVkZXMoYC9ub2RlX21vZHVsZXMvJHtwYWNrYWdlTmFtZX0vYCkpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBjaHVua05hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1VSxTQUFTLG9CQUFvQjtBQUNwVyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlLFdBQVc7QUFGd0ssSUFBTSwyQ0FBMkM7QUFJNVAsSUFBTSxlQUF5QztBQUFBLEVBQzdDLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxFQUN6RCxnQkFBZ0IsQ0FBQyxXQUFXLHVCQUF1QjtBQUFBLEVBQ25ELGtCQUFrQixDQUFDLFNBQVMsa0JBQWtCO0FBQUEsRUFDOUMsZ0JBQWdCLENBQUMsbUJBQW1CLHVCQUF1QixLQUFLO0FBQUEsRUFDaEUsYUFBYSxDQUFDLGdCQUFnQixRQUFRLGdCQUFnQjtBQUFBLEVBQ3RELGlCQUFpQixDQUFDLGVBQWUsT0FBTztBQUMxQztBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBLElBQ3REO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGFBQWEsSUFBSTtBQUNmLGdCQUFNLGVBQWUsR0FBRyxRQUFRLE9BQU8sR0FBRztBQUUxQyxjQUFJLENBQUMsYUFBYSxTQUFTLGdCQUFnQixHQUFHO0FBQzVDLG1CQUFPO0FBQUEsVUFDVDtBQUVBLHFCQUFXLENBQUMsV0FBVyxRQUFRLEtBQUssT0FBTyxRQUFRLFlBQVksR0FBRztBQUNoRSxnQkFBSSxTQUFTLEtBQUssQ0FBQyxnQkFBZ0IsYUFBYSxTQUFTLGlCQUFpQixXQUFXLEdBQUcsQ0FBQyxHQUFHO0FBQzFGLHFCQUFPO0FBQUEsWUFDVDtBQUFBLFVBQ0Y7QUFFQSxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
