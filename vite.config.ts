import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * index.html에는 개발용 진입 파일(/src/main.tsx)을 적지 않습니다.
 * GitHub Pages는 index.html을 그대로 보여 주므로, 적어 두면 학생·교사 브라우저가
 * 없는 파일을 요청해 Console에 404 오류가 남기 때문입니다.
 * 대신 개발 실행(npm run dev)과 빌드(npm run build) 때만 이 플러그인이 진입 파일을 넣습니다.
 */
function injectDevEntry(): Plugin {
  return {
    name: 'inject-dev-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'script',
          attrs: {type: 'module', src: '/src/main.tsx'},
          injectTo: 'body',
        },
      ],
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [injectDevEntry(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
