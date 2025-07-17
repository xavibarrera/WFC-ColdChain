import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
	const repoName = 'WFC-ColdChain'; // <-- ¡Reemplaza con el nombre exacto de tu repositorio!
    return {
	 // Esta es la propiedad 'base' que necesitas añadir.
		// Debe ser '/nombre-de-tu-repositorio/' para GitHub Pages.
		base: `/${repoName}/`,
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
