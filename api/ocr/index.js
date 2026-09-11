// ======================================================
// SMART PARKING UTEQ
// PROXY OCR PARA AZURE STATIC WEB APPS
// ======================================================
//
// FLUJO:
//
// React
//   ↓
//
// POST /api/ocr
//   ↓
//
// Esta Azure Function
//   ↓
//
// Servidor OCR real
//   ↓
//
// Respuesta OCR
//
// ======================================================

module.exports =
  async function (
    context,
    req,
  ) {
    // ==================================================
    // HEADERS GENERALES
    // ==================================================

    const headersBase = {
      'Cache-Control':
        'no-store',

      'X-Content-Type-Options':
        'nosniff',
    }

    // ==================================================
    // OPTIONS
    // ==================================================

    if (
      String(
        req.method ||
          '',
      ).toUpperCase() ===
      'OPTIONS'
    ) {
      context.res = {
        status: 204,

        headers: {
          ...headersBase,

          'Access-Control-Allow-Methods':
            'POST, OPTIONS',

          'Access-Control-Allow-Headers':
            'Content-Type',
        },

        body: '',
      }

      return
    }

    // ==================================================
    // SOLO POST
    // ==================================================

    if (
      String(
        req.method ||
          '',
      ).toUpperCase() !==
      'POST'
    ) {
      context.res = {
        status: 405,

        headers: {
          ...headersBase,

          'Content-Type':
            'application/json; charset=utf-8',
        },

        body: {
          ok: false,

          mensaje:
            'Método no permitido. Utilice POST.',
        },
      }

      return
    }

    // ==================================================
    // OBTENER ENDPOINT OCR REAL
    //
    // Esta variable se configurará en:
    //
    // Azure
    // → SmartParkingUTEQ
    // → Variables de entorno
    //
    // Nombre:
    //
    // OCR_ENDPOINT
    //
    // ==================================================

    const endpoint =
      String(
        process.env
          .OCR_ENDPOINT ||
          '',
      ).trim()

    if (!endpoint) {
      context.res = {
        status: 500,

        headers: {
          ...headersBase,

          'Content-Type':
            'application/json; charset=utf-8',
        },

        body: {
          ok: false,

          mensaje:
            'No se ha configurado OCR_ENDPOINT en Azure Static Web Apps.',
        },
      }

      return
    }

    // ==================================================
    // VALIDAR URL
    // ==================================================

    try {
      new URL(
        endpoint,
      )
    } catch {
      context.res = {
        status: 500,

        headers: {
          ...headersBase,

          'Content-Type':
            'application/json; charset=utf-8',
        },

        body: {
          ok: false,

          mensaje:
            'OCR_ENDPOINT no contiene una URL válida.',
        },
      }

      return
    }

    // ==================================================
    // TIPO DE IMAGEN
    // ==================================================

    const contentType =
      req.headers?.[
        'content-type'
      ] ||
      req.headers?.[
        'Content-Type'
      ] ||
      'application/octet-stream'

    // ==================================================
    // OBTENER IMAGEN COMO BUFFER
    //
    // bufferBody evita corromper JPG/PNG.
    // ==================================================

    let imagen = null

    if (
      Buffer.isBuffer(
        req.bufferBody,
      )
    ) {
      imagen =
        req.bufferBody
    } else if (
      Buffer.isBuffer(
        req.body,
      )
    ) {
      imagen =
        req.body
    } else if (
      req.body &&
      req.body.type ===
        'Buffer' &&
      Array.isArray(
        req.body.data,
      )
    ) {
      imagen =
        Buffer.from(
          req.body.data,
        )
    }

    if (
      !imagen ||
      imagen.length === 0
    ) {
      context.res = {
        status: 400,

        headers: {
          ...headersBase,

          'Content-Type':
            'application/json; charset=utf-8',
        },

        body: {
          ok: false,

          mensaje:
            'No se recibió una imagen válida.',
        },
      }

      return
    }

    // ==================================================
    // LÍMITE DE SEGURIDAD
    // 10 MB
    // ==================================================

    const MAX_BYTES =
      10 * 1024 * 1024

    if (
      imagen.length >
      MAX_BYTES
    ) {
      context.res = {
        status: 413,

        headers: {
          ...headersBase,

          'Content-Type':
            'application/json; charset=utf-8',
        },

        body: {
          ok: false,

          mensaje:
            'La imagen supera el tamaño máximo permitido de 10 MB.',
        },
      }

      return
    }

    // ==================================================
    // ENVIAR IMAGEN AL SERVIDOR OCR REAL
    // ==================================================

    try {
      context.log(
        `Enviando imagen OCR: ${imagen.length} bytes`,
      )

      const respuesta =
        await fetch(
          endpoint,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                contentType,

              'Content-Length':
                String(
                  imagen.length,
                ),
            },

            body:
              imagen,
          },
        )

      // ================================================
      // RECIBIR RESPUESTA DEL OCR
      // ================================================

      const arrayBuffer =
        await respuesta
          .arrayBuffer()

      const contenido =
        Buffer.from(
          arrayBuffer,
        )

      const tipoRespuesta =
        respuesta.headers
          .get(
            'content-type',
          ) ||
        'application/json; charset=utf-8'

      context.log(
        `OCR respondió HTTP ${respuesta.status}`,
      )

      // ================================================
      // DEVOLVER EXACTAMENTE EL STATUS DEL OCR
      // ================================================

      context.res = {
        status:
          respuesta.status,

        headers: {
          ...headersBase,

          'Content-Type':
            tipoRespuesta,
        },

        body:
          contenido,
      }
    } catch (error) {
      context.log.error(
        'Error comunicando con OCR:',
        error,
      )

      context.res = {
        status: 502,

        headers: {
          ...headersBase,

          'Content-Type':
            'application/json; charset=utf-8',
        },

        body: {
          ok: false,

          mensaje:
            'Azure Static Web Apps no pudo comunicarse con el servidor OCR.',

          detalle:
            error instanceof
            Error
              ? error.message
              : String(
                  error,
                ),
        },
      }
    }
  }