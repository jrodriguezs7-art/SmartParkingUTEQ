// ======================================================
// API OCR - SMART PARKING UTEQ
//
// IMPORTANTE:
//
// El navegador NO llama directamente a Azure.
//
// Ahora llama a:
//
// /ocr-api
//
// y Vite se encarga de enviar la solicitud hacia
// la Azure Function configurada en vite.config.mjs.
// ======================================================

// ======================================================
// TAMAÑO MÁXIMO
// ======================================================

export const MAX_TAMANO_IMAGEN =
  10 * 1024 * 1024

// ======================================================
// TIPOS PERMITIDOS
// ======================================================

export const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'application/octet-stream',
]

// ======================================================
// PRIMER VALOR NO VACÍO
// ======================================================

const primero = (
  ...valores
) => {
  return valores.find(
    (valor) =>
      valor !==
        undefined &&
      valor !== null &&
      valor !== '',
  )
}

// ======================================================
// BOOLEANO
// ======================================================

const convertirBooleano =
  (valor) => {
    if (
      valor ===
        undefined ||
      valor === null ||
      valor === ''
    ) {
      return null
    }

    if (
      typeof valor ===
      'boolean'
    ) {
      return valor
    }

    if (
      typeof valor ===
      'number'
    ) {
      return valor !== 0
    }

    const texto =
      String(valor)
        .trim()
        .toLowerCase()

    if (
      [
        'true',
        '1',
        'si',
        'sí',
        'yes',
        'encontrado',
        'registrado',
      ].includes(
        texto,
      )
    ) {
      return true
    }

    if (
      [
        'false',
        '0',
        'no',
        'no_encontrado',
        'no_registrado',
      ].includes(
        texto,
      )
    ) {
      return false
    }

    return null
  }

// ======================================================
// CONFIANZA OCR
//
// Admite:
//
// 0.989
// 98.9
// "98.9%"
// ======================================================

const convertirConfianza =
  (valor) => {
    if (
      valor ===
        undefined ||
      valor === null ||
      valor === ''
    ) {
      return null
    }

    const numero =
      Number(
        String(valor)
          .replace(
            '%',
            '',
          )
          .replace(
            ',',
            '.',
          )
          .trim(),
      )

    if (
      Number.isNaN(
        numero,
      )
    ) {
      return null
    }

    if (
      numero >= 0 &&
      numero <= 1
    ) {
      return (
        numero * 100
      )
    }

    return numero
  }

// ======================================================
// NORMALIZAR IMAGEN
// ======================================================

const normalizarImagen =
  (
    valor,
    mime =
      'image/jpeg',
  ) => {
    if (
      !valor ||
      typeof valor !==
        'string'
    ) {
      return ''
    }

    const imagen =
      valor.trim()

    if (!imagen) {
      return ''
    }

    // ================================================
    // DATA URL
    // ================================================

    if (
      imagen.startsWith(
        'data:image/',
      )
    ) {
      return imagen
    }

    // ================================================
    // URL
    // ================================================

    if (
      imagen.startsWith(
        'http://',
      ) ||
      imagen.startsWith(
        'https://',
      )
    ) {
      return imagen
    }

    // ================================================
    // BASE64 PURO
    // ================================================

    const posibleBase64 =
      imagen.length >
        500 &&
      /^[A-Za-z0-9+/=\r\n]+$/.test(
        imagen,
      )

    if (
      posibleBase64
    ) {
      return `data:${mime};base64,${imagen.replace(
        /\s/g,
        '',
      )}`
    }

    return ''
  }

// ======================================================
// BUSCAR IMAGEN MARCADA
// ======================================================

const buscarImagenMarcada =
  (
    objeto,
    profundidad = 0,
  ) => {
    if (
      !objeto ||
      typeof objeto !==
        'object' ||
      profundidad > 6
    ) {
      return ''
    }

    const claves = [
      'imagen_marcada',

      'imagen_procesada',

      'imagen_anotada',

      'imagen_resultado',

      'imagen_con_placa',

      'imagen_con_bbox',

      'imagen_base64',

      'processed_image',

      'annotated_image',

      'marked_image',

      'image_base64',

      'output_image',
    ]

    // ================================================
    // BÚSQUEDA DIRECTA
    // ================================================

    for (
      const clave
      of claves
    ) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            objeto,
            clave,
          )
      ) {
        const imagen =
          normalizarImagen(
            objeto[
              clave
            ],
          )

        if (imagen) {
          return imagen
        }
      }
    }

    // ================================================
    // BÚSQUEDA POR NOMBRE
    // ================================================

    for (
      const [
        clave,
        valor,
      ]
      of Object.entries(
        objeto,
      )
    ) {
      const nombre =
        clave
          .toLowerCase()

      const pareceImagen =
        (
          nombre.includes(
            'imagen',
          ) ||
          nombre.includes(
            'image',
          )
        ) &&
        (
          nombre.includes(
            'proces',
          ) ||
          nombre.includes(
            'marc',
          ) ||
          nombre.includes(
            'anot',
          ) ||
          nombre.includes(
            'base64',
          ) ||
          nombre.includes(
            'result',
          ) ||
          nombre.includes(
            'detect',
          )
        )

      if (
        pareceImagen &&
        typeof valor ===
          'string'
      ) {
        const imagen =
          normalizarImagen(
            valor,
          )

        if (imagen) {
          return imagen
        }
      }
    }

    // ================================================
    // BÚSQUEDA RECURSIVA
    // ================================================

    for (
      const valor
      of Object.values(
        objeto,
      )
    ) {
      if (
        valor &&
        typeof valor ===
          'object'
      ) {
        const imagen =
          buscarImagenMarcada(
            valor,
            profundidad +
              1,
          )

        if (imagen) {
          return imagen
        }
      }
    }

    return ''
  }

// ======================================================
// NÚMERO
// ======================================================

const numeroValido =
  (valor) => {
    const numero =
      Number(valor)

    return Number.isFinite(
      numero,
    )
      ? numero
      : null
  }

// ======================================================
// NORMALIZAR BOUNDING BOX
// ======================================================

const normalizarBBox =
  (valor) => {
    if (!valor) {
      return null
    }

    // ================================================
    // ARRAY
    //
    // [x1, y1, x2, y2]
    // ================================================

    if (
      Array.isArray(
        valor,
      ) &&
      valor.length >= 4
    ) {
      const x1 =
        numeroValido(
          valor[0],
        )

      const y1 =
        numeroValido(
          valor[1],
        )

      const x2 =
        numeroValido(
          valor[2],
        )

      const y2 =
        numeroValido(
          valor[3],
        )

      if (
        x1 !== null &&
        y1 !== null &&
        x2 !== null &&
        y2 !== null &&
        x2 > x1 &&
        y2 > y1
      ) {
        return {
          x: x1,
          y: y1,

          width:
            x2 - x1,

          height:
            y2 - y1,
        }
      }
    }

    if (
      typeof valor !==
      'object'
    ) {
      return null
    }

    // ================================================
    // x y width height
    // ================================================

    const x =
      numeroValido(
        primero(
          valor.x,
          valor.left,
        ),
      )

    const y =
      numeroValido(
        primero(
          valor.y,
          valor.top,
        ),
      )

    const width =
      numeroValido(
        primero(
          valor.width,
          valor.w,
          valor.ancho,
        ),
      )

    const height =
      numeroValido(
        primero(
          valor.height,
          valor.h,
          valor.alto,
        ),
      )

    if (
      x !== null &&
      y !== null &&
      width !== null &&
      height !== null &&
      width > 0 &&
      height > 0
    ) {
      return {
        x,
        y,
        width,
        height,
      }
    }

    // ================================================
    // xmin ymin xmax ymax
    // ================================================

    const xmin =
      numeroValido(
        primero(
          valor.xmin,
          valor.x_min,
          valor.x1,
          valor.left,
        ),
      )

    const ymin =
      numeroValido(
        primero(
          valor.ymin,
          valor.y_min,
          valor.y1,
          valor.top,
        ),
      )

    const xmax =
      numeroValido(
        primero(
          valor.xmax,
          valor.x_max,
          valor.x2,
          valor.right,
        ),
      )

    const ymax =
      numeroValido(
        primero(
          valor.ymax,
          valor.y_max,
          valor.y2,
          valor.bottom,
        ),
      )

    if (
      xmin !== null &&
      ymin !== null &&
      xmax !== null &&
      ymax !== null &&
      xmax > xmin &&
      ymax > ymin
    ) {
      return {
        x: xmin,
        y: ymin,

        width:
          xmax - xmin,

        height:
          ymax - ymin,
      }
    }

    return null
  }

// ======================================================
// BUSCAR BBOX
// ======================================================

const buscarBBox =
  (
    objeto,
    profundidad = 0,
  ) => {
    if (
      !objeto ||
      typeof objeto !==
        'object' ||
      profundidad > 6
    ) {
      return null
    }

    const claves = [
      'bbox',

      'box',

      'bounding_box',

      'boundingBox',

      'plate_bbox',

      'plate_box',

      'placa_bbox',

      'coordenadas',

      'coordenadas_placa',

      'ubicacion_placa',

      'region_placa',

      'plate_region',
    ]

    for (
      const clave
      of claves
    ) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            objeto,
            clave,
          )
      ) {
        const bbox =
          normalizarBBox(
            objeto[
              clave
            ],
          )

        if (bbox) {
          return bbox
        }
      }
    }

    // El propio objeto podría
    // contener las coordenadas.

    const directo =
      normalizarBBox(
        objeto,
      )

    if (directo) {
      return directo
    }

    for (
      const valor
      of Object.values(
        objeto,
      )
    ) {
      if (
        valor &&
        typeof valor ===
          'object'
      ) {
        const bbox =
          buscarBBox(
            valor,
            profundidad +
              1,
          )

        if (bbox) {
          return bbox
        }
      }
    }

    return null
  }

// ======================================================
// DIMENSIONES
// ======================================================

const buscarDimensiones =
  (objeto) => {
    if (
      !objeto ||
      typeof objeto !==
        'object'
    ) {
      return null
    }

    const width =
      numeroValido(
        primero(
          objeto.image_width,
          objeto.imagen_ancho,
          objeto.ancho_imagen,
          objeto.width_image,
          objeto.original_width,
        ),
      )

    const height =
      numeroValido(
        primero(
          objeto.image_height,
          objeto.imagen_alto,
          objeto.alto_imagen,
          objeto.height_image,
          objeto.original_height,
        ),
      )

    if (
      width !== null &&
      height !== null &&
      width > 0 &&
      height > 0
    ) {
      return {
        width,
        height,
      }
    }

    return null
  }

// ======================================================
// NORMALIZAR VEHÍCULO
// ======================================================

const normalizarVehiculo =
  (fuente) => {
    if (
      !fuente ||
      typeof fuente !==
        'object'
    ) {
      return null
    }

    const vehiculo = {
      id:
        primero(
          fuente.id,
          fuente
            .vehiculo_id,
        ),

      placa:
        primero(
          fuente.placa,
          fuente.plate,
          fuente.matricula,
        ),

      marca:
        primero(
          fuente.marca,
          fuente.brand,
        ),

      modelo:
        primero(
          fuente.modelo,
          fuente.model,
        ),

      anio:
        primero(
          fuente.anio,
          fuente.año,
          fuente.year,
        ),

      color:
        primero(
          fuente.color,
        ),

      tipo:
        primero(
          fuente.tipo,
          fuente
            .tipo_vehiculo,
          fuente
            .vehicle_type,
        ),

      foto_url:
        primero(
          fuente.foto_url,
          fuente
            .foto_vehiculo,
          fuente
            .imagen_vehiculo,
          fuente
            .vehicle_image,
        ),

      propietario_nombre:
        primero(
          fuente
            .propietario_nombre,

          fuente
            .propietario,

          fuente
            .nombre_propietario,

          fuente
            .owner_name,
        ),

      correo_institucional:
        primero(
          fuente
            .correo_institucional,

          fuente.correo,

          fuente.email,
        ),

      cedula_enmascarada:
        primero(
          fuente
            .cedula_enmascarada,

          fuente.cedula,

          fuente
            .identificacion,
        ),

      foto_propietario_url:
        primero(
          fuente
            .foto_propietario_url,

          fuente
            .foto_propietario,

          fuente
            .imagen_propietario,

          fuente
            .owner_image,
        ),

      autorizado:
        convertirBooleano(
          primero(
            fuente
              .autorizado,

            fuente
              .authorized,
          ),
        ),
    }

    const tieneDatos =
      Object.values(
        vehiculo,
      ).some(
        (valor) =>
          valor !==
            undefined &&
          valor !== null &&
          valor !== '',
      )

    return tieneDatos
      ? vehiculo
      : null
  }

// ======================================================
// VALIDAR IMAGEN
// ======================================================

export const validarImagenOcr =
  (archivo) => {
    if (
      !(
        archivo instanceof
        Blob
      )
    ) {
      return {
        ok: false,

        mensaje:
          'No se ha seleccionado una imagen válida.',
      }
    }

    if (
      archivo.size <= 0
    ) {
      return {
        ok: false,

        mensaje:
          'La imagen está vacía.',
      }
    }

    if (
      archivo.size >
      MAX_TAMANO_IMAGEN
    ) {
      return {
        ok: false,

        mensaje:
          'La imagen supera el tamaño máximo permitido de 10 MB.',
      }
    }

    const tipo =
      String(
        archivo.type ||
          '',
      ).toLowerCase()

    if (
      tipo &&
      !TIPOS_PERMITIDOS.includes(
        tipo,
      )
    ) {
      return {
        ok: false,

        mensaje:
          'Formato no permitido. Utilice JPG o PNG.',
      }
    }

    return {
      ok: true,
      mensaje: '',
    }
  }

// ======================================================
// ENVIAR IMAGEN
//
// AHORA:
//
// navegador
//     ↓
// /ocr-api
//     ↓
// Vite Proxy
//     ↓
// Azure
//
// EL NAVEGADOR YA NO LLAMA DIRECTAMENTE A AZURE.
// ======================================================

export const detectarPlacaApi =
  async (
    archivo,
  ) => {
    const validacion =
      validarImagenOcr(
        archivo,
      )

    if (
      !validacion.ok
    ) {
      throw new Error(
        validacion.mensaje,
      )
    }

    const controlador =
      new AbortController()

    const temporizador =
      setTimeout(
        () => {
          controlador.abort()
        },
        45000,
      )

    try {
      const tipo =
        archivo.type &&
        TIPOS_PERMITIDOS.includes(
          archivo.type,
        )
          ? archivo.type
          : 'application/octet-stream'

      // ================================================
      // IMPORTANTE
      //
      // Ya NO utilizamos:
      //
      // import.meta.env.VITE_OCR_ENDPOINT
      //
      // desde el navegador.
      //
      // Solo llamamos al proxy local.
      // ================================================

      const response =
        await fetch(
          '/api/ocr',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                tipo,
            },

            body:
              archivo,

            signal:
              controlador.signal,
          },
        )

      const texto =
        await response.text()

      let resultado = {}

      if (texto) {
        try {
          resultado =
            JSON.parse(
              texto,
            )
        } catch {
          resultado = {
            mensaje:
              texto,
          }
        }
      }

      if (
        !response.ok
      ) {
        const mensaje =
          primero(
            resultado
              ?.mensaje,

            resultado
              ?.message,

            resultado
              ?.error,
          )

        throw new Error(
          mensaje ||
            `El servidor OCR respondió con HTTP ${response.status}.`,
        )
      }

      return resultado
    } catch (error) {
      if (
        error?.name ===
        'AbortError'
      ) {
        throw new Error(
          'El servicio OCR tardó demasiado en responder.',
        )
      }

      if (
        error instanceof
        TypeError
      ) {
        throw new Error(
          'No se pudo comunicar con el proxy OCR de la PC.',
        )
      }

      throw error
    } finally {
      clearTimeout(
        temporizador,
      )
    }
  }

// ======================================================
// NORMALIZAR RESPUESTA OCR
// ======================================================

export const normalizarRespuestaOcr =
  (
    respuesta = {},
  ) => {
    const resultadoInterno =
      respuesta
        ?.resultado &&
      typeof respuesta
        .resultado ===
        'object'
        ? respuesta
            .resultado
        : {}

    const dataInterna =
      respuesta?.data &&
      typeof respuesta
        .data ===
        'object'
        ? respuesta.data
        : {}

    const deteccionInterna =
      respuesta
        ?.deteccion &&
      typeof respuesta
        .deteccion ===
        'object'
        ? respuesta
            .deteccion
        : {}

    const base = {
      ...respuesta,

      ...resultadoInterno,

      ...dataInterna,

      ...deteccionInterna,
    }

    // ==================================================
    // PLACA
    // ==================================================

    const placa =
      primero(
        base
          .placa_detectada,

        base.placa,

        base.plate,

        base
          .numero_placa,

        base.matricula,

        base
          .numero_matricula,
      ) || ''

    // ==================================================
    // CONFIANZA
    // ==================================================

    const confianza =
      convertirConfianza(
        primero(
          base
            .confianza_ocr,

          base.confianza,

          base.confidence,

          base.score,

          base
            .ocr_confidence,

          base
            .plate_score,
        ),
      )

    // ==================================================
    // ESTADO
    // ==================================================

    const estado =
      String(
        primero(
          base.estado,

          base.status,

          base
            .resultado_estado,
        ) || '',
      )

    // ==================================================
    // VEHÍCULO ENCONTRADO
    // ==================================================

    const vehiculoEncontrado =
      convertirBooleano(
        primero(
          base
            .vehiculo_encontrado,

          base
            .vehiculoEncontrado,

          base.registrado,

          base.found,
        ),
      )

    // ==================================================
    // DATOS VEHÍCULO
    // ==================================================

    const fuenteVehiculo =
      primero(
        base.vehiculo,

        base.vehicle,

        base
          .datos_vehiculo,

        base
          .vehiculo_data,
      )

    const vehiculo =
      normalizarVehiculo(
        fuenteVehiculo,
      ) ||
      normalizarVehiculo(
        base,
      )

    // ==================================================
    // IMAGEN MARCADA
    // ==================================================

    const imagenMarcada =
      buscarImagenMarcada(
        respuesta,
      )

    // ==================================================
    // BBOX
    // ==================================================

    const bbox =
      buscarBBox(
        respuesta,
      )

    // ==================================================
    // DIMENSIONES
    // ==================================================

    const dimensiones =
      buscarDimensiones(
        respuesta,
      ) ||
      buscarDimensiones(
        base,
      )

    // ==================================================
    // RESULTADO
    // ==================================================

    return {
      estado,

      placa:
        String(placa)
          .trim()
          .toUpperCase(),

      confianza,

      vehiculoEncontrado,

      vehiculo,

      imagenMarcada,

      bbox,

      dimensiones,

      mensaje:
        primero(
          base.mensaje,

          base.message,

          base.detalle,
        ) || '',

      respuestaOriginal:
        respuesta,
    }
  }