import {
  defineConfig,
  loadEnv,
} from 'vite'

import react from '@vitejs/plugin-react'

import path from 'node:path'

import autoprefixer from 'autoprefixer'

// ======================================================
// CONFIGURACIÓN VITE
// ======================================================

export default defineConfig(
  ({ mode }) => {
    // ==================================================
    // CARGAR VARIABLES DE ENTORNO
    //
    // Se carga VITE_OCR_ENDPOINT únicamente
    // dentro del servidor Vite.
    //
    // El frontend ya NO utilizará directamente
    // la URL de Azure.
    // ==================================================

    const env =
      loadEnv(
        mode,
        process.cwd(),
        '',
      )

    const ocrEndpoint =
      env.VITE_OCR_ENDPOINT
        ?.trim()

    if (!ocrEndpoint) {
      throw new Error(
        'Falta VITE_OCR_ENDPOINT en el archivo .env.local',
      )
    }

    // ==================================================
    // VALIDAR URL DEL ENDPOINT
    // ==================================================

    let ocrUrl

    try {
      ocrUrl =
        new URL(
          ocrEndpoint,
        )
    } catch {
      throw new Error(
        'VITE_OCR_ENDPOINT no contiene una URL válida.',
      )
    }

    // ==================================================
    // ORIGEN AZURE
    //
    // Ejemplo:
    //
    // https://xxxxx.azurewebsites.net
    // ==================================================

    const ocrTarget =
      `${ocrUrl.protocol}//${ocrUrl.host}`

    // ==================================================
    // RUTA REAL DE AZURE
    //
    // Aquí también se conserva:
    //
    // ?code=...
    //
    // Esta información se utiliza en el servidor Vite.
    // ==================================================

    const ocrPath =
      `${ocrUrl.pathname}${ocrUrl.search}`

    return {
      // =================================================
      // BASE
      // =================================================

      base: './',

      // =================================================
      // BUILD
      // =================================================

      build: {
        outDir: 'build',
      },

      // =================================================
      // CSS
      // =================================================

      css: {
        postcss: {
          plugins: [
            autoprefixer({}),
          ],
        },
      },

      // =================================================
      // REACT
      // =================================================

      plugins: [
        react(),
      ],

      // =================================================
      // RESOLVE
      // =================================================

      resolve: {
        alias: [
          {
            find: 'src/',

            replacement:
              `${path.resolve(
                __dirname,
                'src',
              )}/`,
          },
        ],

        extensions: [
          '.mjs',
          '.js',
          '.ts',
          '.jsx',
          '.tsx',
          '.json',
          '.scss',
        ],
      },

      // =================================================
      // SERVIDOR
      // =================================================

      server: {
        // Permite acceder desde el teléfono
        // dentro de la misma red.

        host:
          '0.0.0.0',

        port: 3000,

        // ===============================================
        // PROXY OCR
        //
        // TELÉFONO:
        //
        // POST /ocr-api
        //
        //          ↓
        //
        // VITE
        //
        //          ↓
        //
        // AZURE
        // ===============================================

        proxy: {
          '/ocr-api': {
            target:
              ocrTarget,

            changeOrigin:
              true,

            secure:
              true,

            // ===========================================
            // REEMPLAZAR /ocr-api POR LA RUTA REAL
            // DE AZURE + SU CODE
            // ===========================================

            rewrite:
              () =>
                ocrPath,
          },
        },
      },
    }
  },
)