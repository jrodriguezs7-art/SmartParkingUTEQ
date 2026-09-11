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
    // VARIABLES DE ENTORNO
    // ==================================================
    //
    // VITE_OCR_ENDPOINT es OPCIONAL.
    //
    // Actualmente el reconocimiento de placas utiliza
    // Tesseract.js directamente desde el navegador.
    //
    // El proxy solamente se habilitará cuando exista:
    //
    // VITE_OCR_ENDPOINT
    //
    // Esto permite conservar compatibilidad con un
    // servicio OCR externo en el futuro sin obligar
    // a Azure Static Web Apps a tener esta variable.
    //
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

    // ==================================================
    // CONFIGURACIÓN OPCIONAL DEL PROXY OCR
    // ==================================================

    let proxyOcr = {}

    if (ocrEndpoint) {
      try {
        const ocrUrl =
          new URL(
            ocrEndpoint,
          )

        const ocrTarget =
          `${ocrUrl.protocol}//${ocrUrl.host}`

        const ocrPath =
          `${ocrUrl.pathname}${ocrUrl.search}`

        proxyOcr = {
          '/api/ocr': {
            target:
              ocrTarget,

            changeOrigin:
              true,

            secure:
              true,

            rewrite:
              () =>
                ocrPath,
          },
        }
      } catch {
        console.warn(
          'VITE_OCR_ENDPOINT existe, pero no contiene una URL válida. El proxy OCR será deshabilitado.',
        )
      }
    }

    // ==================================================
    // CONFIGURACIÓN PRINCIPAL
    // ==================================================

    return {
      // ================================================
      // BASE
      // ================================================

      base: './',

      // ================================================
      // BUILD
      //
      // Azure Static Web Apps está configurado para
      // publicar esta carpeta.
      // ================================================

      build: {
        outDir:
          'build',
      },

      // ================================================
      // CSS
      // ================================================

      css: {
        postcss: {
          plugins: [
            autoprefixer({}),
          ],
        },
      },

      // ================================================
      // REACT
      // ================================================

      plugins: [
        react(),
      ],

      // ================================================
      // ALIAS Y EXTENSIONES
      // ================================================

      resolve: {
        alias: [
          {
            find:
              'src/',

            replacement:
              `${path.resolve(
                process.cwd(),
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

      // ================================================
      // SERVIDOR DE DESARROLLO
      // ================================================

      server: {
        // Permite acceder desde otros dispositivos
        // dentro de la misma red local.

        host:
          '0.0.0.0',

        port:
          3000,

        // El proxy solamente estará disponible
        // cuando VITE_OCR_ENDPOINT exista.

        proxy:
          proxyOcr,
      },
    }
  },
)