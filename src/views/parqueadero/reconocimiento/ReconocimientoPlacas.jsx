import React, {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CRow,
  CSpinner,
} from '@coreui/react'

import CIcon from '@coreui/icons-react'

import {
  cilCamera,
  cilCarAlt,
  cilMediaStop,
  cilMobile,
  cilQrCode,
} from '@coreui/icons'

import {
  createWorker,
  PSM,
} from 'tesseract.js'

import {
  QRCodeSVG,
} from 'qrcode.react'

import {
  useVehiculos,
} from '../../../hooks/useVehiculos'

import {
  supabase,
} from '../../../lib/supabase'

// ======================================================
// CONFIGURACIÓN DE CÁMARA
// ======================================================

const ANCHO_RECORTE = 0.65
const ALTO_RECORTE = 0.28

// ======================================================
// NORMALIZAR PLACA
// ======================================================

const normalizarPlaca = (valor = '') => {
  return String(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

// ======================================================
// FORMATEAR PLACA
// ======================================================

const formatearPlaca = (valor = '') => {
  const placa = normalizarPlaca(valor)

  if (/^[A-Z]{3}[0-9]{4}$/.test(placa)) {
    return `${placa.slice(0, 3)}-${placa.slice(3)}`
  }

  if (/^[A-Z]{3}[0-9]{3}$/.test(placa)) {
    return `${placa.slice(0, 3)}-${placa.slice(3)}`
  }

  return placa
}

// ======================================================
// CORRECCIÓN DE ERRORES OCR
// ======================================================

const convertirALetra = (caracter) => {
  const mapa = {
    0: 'O',
    1: 'I',
    2: 'Z',
    5: 'S',
    6: 'G',
    8: 'B',
  }

  return mapa[caracter] ?? caracter
}

const convertirANumero = (caracter) => {
  const mapa = {
    O: '0',
    Q: '0',
    D: '0',

    I: '1',
    L: '1',

    Z: '2',

    S: '5',

    G: '6',

    T: '7',

    B: '8',
  }

  return mapa[caracter] ?? caracter
}

// ======================================================
// EXTRAER PLACA DEL TEXTO OCR
// ======================================================

const extraerPlaca = (texto = '') => {
  const limpio = normalizarPlaca(texto)

  // 3 letras + 4 números

  const cuatroDigitos =
    limpio.match(/[A-Z]{3}[0-9]{4}/)

  if (cuatroDigitos) {
    return formatearPlaca(
      cuatroDigitos[0],
    )
  }

  // 3 letras + 3 números

  const tresDigitos =
    limpio.match(/[A-Z]{3}[0-9]{3}/)

  if (tresDigitos) {
    return formatearPlaca(
      tresDigitos[0],
    )
  }

  // Corrección de errores frecuentes.

  for (const longitud of [7, 6]) {
    for (
      let inicio = 0;
      inicio <= limpio.length - longitud;
      inicio += 1
    ) {
      const fragmento =
        limpio.slice(
          inicio,
          inicio + longitud,
        )

      const letras =
        fragmento
          .slice(0, 3)
          .split('')
          .map(convertirALetra)
          .join('')

      const numeros =
        fragmento
          .slice(3)
          .split('')
          .map(convertirANumero)
          .join('')

      const resultado =
        `${letras}${numeros}`

      if (
        /^[A-Z]{3}[0-9]{3,4}$/.test(
          resultado,
        )
      ) {
        return formatearPlaca(
          resultado,
        )
      }
    }
  }

  return ''
}

// ======================================================
// GENERAR TOKEN PARA SESIÓN QR
// ======================================================

const generarTokenSesion = () => {
  try {
    const datos =
      new Uint8Array(16)

    window.crypto.getRandomValues(
      datos,
    )

    return Array.from(datos)
      .map((numero) =>
        numero
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  } catch {
    return (
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .slice(2)
    )
  }
}

// ======================================================
// COMPONENTE
// ======================================================

const ReconocimientoPlacas = () => {
  // ====================================================
  // VEHÍCULOS
  // ====================================================

  const {
    vehiculos,
    cargando: cargandoVehiculos,
    error: errorVehiculos,
  } = useVehiculos()

  const vehiculosRef =
    useRef([])

  useEffect(() => {
    vehiculosRef.current =
      vehiculos
  }, [vehiculos])

  // ====================================================
  // REFERENCIAS
  // ====================================================

  const videoRef =
    useRef(null)

  const canvasRef =
    useRef(null)

  const streamRef =
    useRef(null)

  const workerRef =
    useRef(null)

  const canalMovilRef =
    useRef(null)

  // ====================================================
  // VISTA PRINCIPAL
  //
  // CAMARA = cámara de PC
  // QR     = conexión móvil
  // ====================================================

  const [
    modoVista,
    setModoVista,
  ] = useState('CAMARA')

  // ====================================================
  // CÁMARA
  // ====================================================

  const [
    camaraActiva,
    setCamaraActiva,
  ] = useState(false)

  const [
    iniciandoCamara,
    setIniciandoCamara,
  ] = useState(false)

  const [
    errorCamara,
    setErrorCamara,
  ] = useState('')

  // ====================================================
  // OCR
  // ====================================================

  const [
    escaneando,
    setEscaneando,
  ] = useState(false)

  const [
    progreso,
    setProgreso,
  ] = useState(0)

  const [
    estadoEscaneo,
    setEstadoEscaneo,
  ] = useState('')

  const [
    errorEscaneo,
    setErrorEscaneo,
  ] = useState('')

  // ====================================================
  // RESULTADO
  // ====================================================

  const [
    resultado,
    setResultado,
  ] = useState(null)

  const [
    imagenCapturada,
    setImagenCapturada,
  ] = useState('')

  // ====================================================
  // QR / TELÉFONO
  // ====================================================

  const [
    urlBaseMovil,
    setUrlBaseMovil,
  ] = useState(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return ''
    }

    const host =
      window.location.hostname

    if (
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return ''
    }

    return window.location.origin
  })

  const [
    urlQr,
    setUrlQr,
  ] = useState('')

  const [
    estadoMovil,
    setEstadoMovil,
  ] = useState(
    'SIN_SESION',
  )

  const [
    errorMovil,
    setErrorMovil,
  ] = useState('')

  // ====================================================
  // BUSCAR VEHÍCULO
  // ====================================================

  const buscarVehiculoPorPlaca =
    (placa) => {
      const buscada =
        normalizarPlaca(
          placa,
        )

      return (
        vehiculosRef.current.find(
          (vehiculo) =>
            normalizarPlaca(
              vehiculo.placa,
            ) === buscada,
        ) ?? null
      )
    }

  // ====================================================
  // ACTIVAR CÁMARA
  // ====================================================

  const activarCamara =
    async () => {
      try {
        setErrorCamara('')
        setErrorEscaneo('')
        setIniciandoCamara(true)

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {
          throw new Error(
            'El navegador no permite acceder a la cámara.',
          )
        }

        if (streamRef.current) {
          streamRef.current
            .getTracks()
            .forEach(
              (track) =>
                track.stop(),
            )

          streamRef.current = null
        }

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                width: {
                  ideal: 1920,
                },

                height: {
                  ideal: 1080,
                },
              },

              audio: false,
            })

        streamRef.current =
          stream

        if (videoRef.current) {
          videoRef.current.srcObject =
            stream

          await videoRef.current.play()
        }

        setCamaraActiva(true)
      } catch (error) {
        console.error(
          'Error cámara:',
          error,
        )

        let mensaje =
          'No se pudo acceder a la cámara.'

        if (
          error?.name ===
          'NotAllowedError'
        ) {
          mensaje =
            'El navegador no tiene permiso para utilizar la cámara.'
        }

        if (
          error?.name ===
          'NotFoundError'
        ) {
          mensaje =
            'No se encontró ninguna cámara.'
        }

        if (
          error?.name ===
          'NotReadableError'
        ) {
          mensaje =
            'La cámara está siendo utilizada por otra aplicación.'
        }

        setErrorCamara(mensaje)

        setCamaraActiva(false)
      } finally {
        setIniciandoCamara(false)
      }
    }

  // ====================================================
  // DETENER CÁMARA
  // ====================================================

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach(
          (track) =>
            track.stop(),
        )

      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null
    }

    setCamaraActiva(false)
  }

  // ====================================================
  // CAMBIAR ENTRE CÁMARA Y QR
  // ====================================================

  const cambiarModoVista = () => {
    if (
      modoVista === 'CAMARA'
    ) {
      // Al pasar a QR apagamos la cámara de la PC
      // para no dejarla funcionando innecesariamente.

      detenerCamara()

      setModoVista('QR')

      return
    }

    // La sesión QR no se destruye automáticamente.
    // Si vuelve después, el mismo QR seguirá visible.

    setModoVista('CAMARA')
  }

  // ====================================================
  // CREAR WORKER OCR
  // ====================================================

  const obtenerWorker =
    async () => {
      if (workerRef.current) {
        return workerRef.current
      }

      setEstadoEscaneo(
        'Preparando reconocimiento...',
      )

      const worker =
        await createWorker(
          'eng',
          1,
          {
            logger:
              (mensaje) => {
                if (
                  mensaje.status ===
                    'recognizing text' &&
                  typeof mensaje.progress ===
                    'number'
                ) {
                  setProgreso(
                    Math.round(
                      mensaje.progress *
                        100,
                    ),
                  )

                  setEstadoEscaneo(
                    'Leyendo matrícula...',
                  )
                }
              },
          },
        )

      await worker.setParameters({
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',

        tessedit_pageseg_mode:
          PSM.SINGLE_LINE,

        preserve_interword_spaces:
          '0',
      })

      workerRef.current =
        worker

      return worker
    }

  // ====================================================
  // CAPTURAR ÁREA DE PLACA
  // ====================================================

  const capturarPlaca = () => {
    const video =
      videoRef.current

    const canvas =
      canvasRef.current

    if (
      !video ||
      !canvas
    ) {
      throw new Error(
        'No se puede capturar la imagen.',
      )
    }

    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {
      throw new Error(
        'La cámara todavía no está lista.',
      )
    }

    const anchoVideo =
      video.videoWidth

    const altoVideo =
      video.videoHeight

    const ancho =
      Math.round(
        anchoVideo *
          ANCHO_RECORTE,
      )

    const alto =
      Math.round(
        altoVideo *
          ALTO_RECORTE,
      )

    const x =
      Math.round(
        (
          anchoVideo -
          ancho
        ) / 2,
      )

    const y =
      Math.round(
        (
          altoVideo -
          alto
        ) / 2,
      )

    const escala =
      Math.max(
        2,
        1300 / ancho,
      )

    canvas.width =
      Math.round(
        ancho * escala,
      )

    canvas.height =
      Math.round(
        alto * escala,
      )

    const contexto =
      canvas.getContext(
        '2d',
        {
          willReadFrequently:
            true,
        },
      )

    contexto.drawImage(
      video,

      x,
      y,
      ancho,
      alto,

      0,
      0,
      canvas.width,
      canvas.height,
    )

    const imagen =
      contexto.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      )

    const datos =
      imagen.data

    // ==================================================
    // ESCALA DE GRISES + CONTRASTE
    // ==================================================

    for (
      let i = 0;
      i < datos.length;
      i += 4
    ) {
      const rojo =
        datos[i]

      const verde =
        datos[i + 1]

      const azul =
        datos[i + 2]

      let gris =
        0.299 * rojo +
        0.587 * verde +
        0.114 * azul

      gris =
        (
          gris - 128
        ) *
          1.7 +
        128

      gris =
        Math.max(
          0,
          Math.min(
            255,
            gris,
          ),
        )

      datos[i] =
        gris

      datos[i + 1] =
        gris

      datos[i + 2] =
        gris
    }

    contexto.putImageData(
      imagen,
      0,
      0,
    )

    return canvas.toDataURL(
      'image/png',
    )
  }

  // ====================================================
  // ESCANEAR DESDE PC
  // ====================================================

  const escanearPlaca =
    async () => {
      if (!camaraActiva) {
        return
      }

      if (
        cargandoVehiculos
      ) {
        setErrorEscaneo(
          'Espere mientras se cargan los vehículos.',
        )

        return
      }

      try {
        setEscaneando(true)

        setResultado(null)

        setErrorEscaneo('')

        setProgreso(0)

        setEstadoEscaneo(
          'Capturando matrícula...',
        )

        const captura =
          capturarPlaca()

        setImagenCapturada(
          captura,
        )

        const worker =
          await obtenerWorker()

        setEstadoEscaneo(
          'Analizando matrícula...',
        )

        const {
          data,
        } =
          await worker.recognize(
            captura,
          )

        const texto =
          data?.text ?? ''

        const placa =
          extraerPlaca(
            texto,
          )

        if (!placa) {
          setResultado({
            tipo:
              'NO_RECONOCIDA',

            textoOcr:
              texto,

            origen:
              'pc',
          })

          return
        }

        const vehiculo =
          buscarVehiculoPorPlaca(
            placa,
          )

        if (vehiculo) {
          setResultado({
            tipo:
              'ENCONTRADO',

            placa,

            vehiculo,

            textoOcr:
              texto,

            origen:
              'pc',
          })
        } else {
          setResultado({
            tipo:
              'NO_REGISTRADO',

            placa,

            vehiculo: null,

            textoOcr:
              texto,

            origen:
              'pc',
          })
        }
      } catch (error) {
        console.error(
          'Error OCR:',
          error,
        )

        setErrorEscaneo(
          error?.message ||
            'No se pudo reconocer la matrícula.',
        )
      } finally {
        setEscaneando(false)

        setEstadoEscaneo('')

        setProgreso(0)
      }
    }

  // ====================================================
  // GENERAR SESIÓN QR
  // ====================================================

  const generarSesionMovil =
    async () => {
      try {
        setErrorMovil('')

        const base =
          urlBaseMovil
            .trim()
            .replace(
              /\/+$/,
              '',
            )

        if (!base) {
          setErrorMovil(
            'Ingrese la dirección de acceso desde el teléfono, por ejemplo: http://192.168.0.198:3000',
          )

          return
        }

        if (
          !/^https?:\/\//i.test(
            base,
          )
        ) {
          setErrorMovil(
            'La dirección debe comenzar con http:// o https://',
          )

          return
        }

        // =================================================
        // CERRAR CANAL ANTERIOR
        // =================================================

        if (
          canalMovilRef.current
        ) {
          await supabase.removeChannel(
            canalMovilRef.current,
          )

          canalMovilRef.current =
            null
        }

        const token =
          generarTokenSesion()

        const url =
          `${base}/#/reconocimiento-movil?sesion=${encodeURIComponent(
            token,
          )}`

        setUrlQr(url)

        setEstadoMovil(
          'CONECTANDO',
        )

        // =================================================
        // CREAR CANAL
        // =================================================

        const canal =
          supabase.channel(
            `smartparking-placas-${token}`,
            {
              config: {
                broadcast: {
                  ack: true,
                },
              },
            },
          )

        canalMovilRef.current =
          canal

        // =================================================
        // TELÉFONO CONECTADO
        // =================================================

        canal.on(
          'broadcast',
          {
            event:
              'movil_conectado',
          },
          () => {
            setEstadoMovil(
              'CONECTADO',
            )
          },
        )

        // =================================================
        // PLACA DESDE EL TELÉFONO
        // =================================================

        canal.on(
          'broadcast',
          {
            event:
              'placa_detectada',
          },
          async ({
            payload,
          }) => {
            const placa =
              formatearPlaca(
                payload?.placa ??
                  '',
              )

            if (!placa) {
              return
            }

            const vehiculo =
              buscarVehiculoPorPlaca(
                placa,
              )

            // No recibimos la captura grande del teléfono.

            setImagenCapturada('')

            if (vehiculo) {
              setResultado({
                tipo:
                  'ENCONTRADO',

                placa,

                vehiculo,

                textoOcr:
                  payload?.textoOcr ??
                  '',

                origen:
                  'telefono',
              })
            } else {
              setResultado({
                tipo:
                  'NO_REGISTRADO',

                placa,

                vehiculo: null,

                textoOcr:
                  payload?.textoOcr ??
                  '',

                origen:
                  'telefono',
              })
            }

            setEstadoMovil(
              'RESULTADO',
            )

            // =================================================
            // DEVOLVER DATOS COMPLETOS AL TELÉFONO
            // =================================================

            await canal.send({
              type:
                'broadcast',

              event:
                'resultado_busqueda',

              payload: {
                encontrado:
                  Boolean(
                    vehiculo,
                  ),

                placa,

                vehiculo:
                  vehiculo
                    ? {
                        id:
                          vehiculo.id,

                        placa:
                          vehiculo.placa,

                        marca:
                          vehiculo.marca,

                        modelo:
                          vehiculo.modelo,

                        anio:
                          vehiculo.anio,

                        color:
                          vehiculo.color,

                        tipo:
                          vehiculo.tipo,

                        propietario_nombre:
                          vehiculo.propietario_nombre,

                        correo_institucional:
                          vehiculo.correo_institucional,

                        cedula_enmascarada:
                          vehiculo.cedula_enmascarada,

                        autorizado:
                          vehiculo.autorizado,

                        foto_url:
                          vehiculo.foto_url,

                        foto_propietario_url:
                          vehiculo.foto_propietario_url,
                      }
                    : null,
              },
            })
          },
        )

        // =================================================
        // SUSCRIBIRSE
        // =================================================

        canal.subscribe(
          (estado) => {
            if (
              estado ===
              'SUBSCRIBED'
            ) {
              setEstadoMovil(
                'ESPERANDO',
              )
            }

            if (
              estado ===
              'CHANNEL_ERROR'
            ) {
              setEstadoMovil(
                'ERROR',
              )

              setErrorMovil(
                'No se pudo iniciar la sesión móvil.',
              )
            }

            if (
              estado ===
              'TIMED_OUT'
            ) {
              setEstadoMovil(
                'ERROR',
              )

              setErrorMovil(
                'La conexión móvil agotó el tiempo de espera.',
              )
            }
          },
        )
      } catch (error) {
        console.error(
          'Error QR:',
          error,
        )

        setEstadoMovil(
          'ERROR',
        )

        setErrorMovil(
          error?.message ||
            'No se pudo generar la sesión móvil.',
        )
      }
    }

  // ====================================================
  // CERRAR SESIÓN QR
  // ====================================================

  const cerrarSesionMovil =
    async () => {
      if (
        canalMovilRef.current
      ) {
        await supabase.removeChannel(
          canalMovilRef.current,
        )

        canalMovilRef.current =
          null
      }

      setUrlQr('')

      setEstadoMovil(
        'SIN_SESION',
      )

      setErrorMovil('')
    }

  // ====================================================
  // LIMPIAR RESULTADO
  // ====================================================

  const limpiarResultado =
    () => {
      setResultado(null)

      setImagenCapturada('')

      setErrorEscaneo('')
    }

  // ====================================================
  // LIMPIEZA GENERAL
  // ====================================================

  useEffect(() => {
    return () => {
      // Cámara

      if (
        streamRef.current
      ) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop(),
          )
      }

      // OCR

      if (
        workerRef.current
      ) {
        workerRef.current
          .terminate()
          .catch(() => {})

        workerRef.current =
          null
      }

      // Realtime

      if (
        canalMovilRef.current
      ) {
        supabase.removeChannel(
          canalMovilRef.current,
        )
      }
    }
  }, [])

  // ====================================================
  // ESTADO DEL TELÉFONO
  // ====================================================

  const colorEstadoMovil =
    () => {
      if (
        estadoMovil ===
          'CONECTADO' ||
        estadoMovil ===
          'RESULTADO'
      ) {
        return 'success'
      }

      if (
        estadoMovil ===
        'ERROR'
      ) {
        return 'danger'
      }

      return 'secondary'
    }

  const textoEstadoMovil =
    () => {
      if (
        estadoMovil ===
        'ESPERANDO'
      ) {
        return 'Esperando teléfono'
      }

      if (
        estadoMovil ===
        'CONECTADO'
      ) {
        return 'Teléfono conectado'
      }

      if (
        estadoMovil ===
        'RESULTADO'
      ) {
        return 'Placa recibida'
      }

      if (
        estadoMovil ===
        'ERROR'
      ) {
        return 'Error'
      }

      if (
        estadoMovil ===
        'CONECTANDO'
      ) {
        return 'Conectando...'
      }

      return 'Sin sesión'
    }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <>
      {/* ==============================================
          CABECERA PRINCIPAL
      ============================================== */}

      <CCard className="mb-4">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h5 className="mb-1">
                Reconocimiento de placas
              </h5>

              <div className="text-body-secondary">
                Smart Parking UTEQ
              </div>
            </div>

            <div className="d-flex gap-2">
              <CBadge
                color={
                  camaraActiva
                    ? 'success'
                    : 'secondary'
                }
              >
                {camaraActiva
                  ? 'Cámara activa'
                  : 'Cámara desactivada'}
              </CBadge>

              <CBadge color="primary">
                {vehiculos.length}{' '}
                vehículos registrados
              </CBadge>
            </div>
          </div>
        </CCardHeader>

        <CCardBody>
          Reconozca una matrícula utilizando la cámara
          del dispositivo o conecte un teléfono mediante
          código QR.
        </CCardBody>
      </CCard>

      {/* ==============================================
          ERROR DE VEHÍCULOS
      ============================================== */}

      {errorVehiculos && (
        <CAlert color="danger">
          Error consultando vehículos:{' '}
          {errorVehiculos}
        </CAlert>
      )}

      {/* ==============================================
          DISTRIBUCIÓN PRINCIPAL

          IZQUIERDA = CÁMARA / QR
          DERECHA   = RESULTADO
      ============================================== */}

      <CRow className="g-4 align-items-stretch">
        {/* ============================================
            IZQUIERDA
        ============================================ */}

        <CCol
          xs={12}
          lg={8}
        >
          <CCard className="h-100">
            {/* ========================================
                CABECERA DINÁMICA
            ======================================== */}

            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <CIcon
                    icon={
                      modoVista ===
                      'CAMARA'
                        ? cilCamera
                        : cilQrCode
                    }
                    className="me-2"
                  />

                  <strong>
                    {modoVista ===
                    'CAMARA'
                      ? 'Cámara de esta PC'
                      : 'Conexión por código QR'}
                  </strong>
                </div>

                <div className="d-flex align-items-center gap-2">
                  {modoVista ===
                    'QR' && (
                    <CBadge
                      color={
                        colorEstadoMovil()
                      }
                    >
                      {textoEstadoMovil()}
                    </CBadge>
                  )}

                  {/* ==================================
                      BOTÓN PRINCIPAL DE CAMBIO
                  ================================== */}

                  <CButton
                    color={
                      modoVista ===
                      'CAMARA'
                        ? 'primary'
                        : 'success'
                    }
                    size="sm"
                    onClick={
                      cambiarModoVista
                    }
                    disabled={
                      escaneando
                    }
                  >
                    <CIcon
                      icon={
                        modoVista ===
                        'CAMARA'
                          ? cilQrCode
                          : cilCamera
                      }
                      className="me-2"
                    />

                    {modoVista ===
                    'CAMARA'
                      ? 'CONECTARSE POR QR'
                      : 'CÁMARA DEL DISPOSITIVO'}
                  </CButton>
                </div>
              </div>
            </CCardHeader>

            <CCardBody>
              {/* ======================================
                  MODO CÁMARA
              ====================================== */}

              {modoVista ===
                'CAMARA' && (
                <>
                  {errorCamara && (
                    <CAlert color="danger">
                      {errorCamara}
                    </CAlert>
                  )}

                  {errorEscaneo && (
                    <CAlert
                      color="warning"
                      dismissible
                      onClose={() =>
                        setErrorEscaneo(
                          '',
                        )
                      }
                    >
                      {errorEscaneo}
                    </CAlert>
                  )}

                  {/* ==================================
                      VISOR
                  ================================== */}

                  <div
                    className="position-relative overflow-hidden rounded border mb-3"
                    style={{
                      width:
                        '100%',

                      aspectRatio:
                        '16 / 9',

                      backgroundColor:
                        '#080b10',
                    }}
                  >
                    <video
                      ref={
                        videoRef
                      }
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width:
                          '100%',

                        height:
                          '100%',

                        objectFit:
                          'contain',

                        display:
                          camaraActiva
                            ? 'block'
                            : 'none',
                      }}
                    />

                    {/* ================================
                        CÁMARA APAGADA
                    ================================ */}

                    {!camaraActiva && (
                      <div className="position-absolute top-50 start-50 translate-middle text-center w-100">
                        <CIcon
                          icon={
                            cilCamera
                          }
                          size="4xl"
                          className="text-body-secondary mb-3"
                        />

                        <h5 className="text-body-secondary">
                          Cámara desactivada
                        </h5>

                        <div className="text-body-secondary">
                          Presione
                          {' '}
                          "Activar cámara".
                        </div>
                      </div>
                    )}

                    {/* ================================
                        RECUADRO DE PLACA
                    ================================ */}

                    {camaraActiva && (
                      <>
                        <div
                          className="position-absolute top-50 start-50 translate-middle"
                          style={{
                            width:
                              '65%',

                            height:
                              '28%',

                            border:
                              '3px solid white',

                            borderRadius:
                              '10px',

                            pointerEvents:
                              'none',
                          }}
                        />

                        <div
                          className="position-absolute start-50 translate-middle-x text-white fw-semibold text-center"
                          style={{
                            top:
                              '67%',

                            width:
                              '100%',

                            textShadow:
                              '0 2px 5px black',
                          }}
                        >
                          Coloque la placa dentro del recuadro
                        </div>
                      </>
                    )}

                    {/* ================================
                        PROCESANDO
                    ================================ */}

                    {escaneando && (
                      <div
                        className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center"
                        style={{
                          backgroundColor:
                            'rgba(0,0,0,0.75)',
                        }}
                      >
                        <CSpinner
                          color="light"
                          className="mb-3"
                        />

                        <strong className="text-white">
                          {estadoEscaneo ||
                            'Procesando...'}
                        </strong>

                        {progreso >
                          0 && (
                          <div className="text-white mt-2">
                            {
                              progreso
                            }{' '}
                            %
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CANVAS OCR */}

                  <canvas
                    ref={
                      canvasRef
                    }
                    style={{
                      display:
                        'none',
                    }}
                  />

                  {/* ==================================
                      BOTONES CÁMARA
                  ================================== */}

                  <div className="d-flex flex-wrap gap-2">
                    <CButton
                      color="success"
                      onClick={
                        activarCamara
                      }
                      disabled={
                        camaraActiva ||
                        iniciandoCamara
                      }
                    >
                      {iniciandoCamara ? (
                        <>
                          <CSpinner
                            size="sm"
                            className="me-2"
                          />

                          Activando...
                        </>
                      ) : (
                        <>
                          <CIcon
                            icon={
                              cilCamera
                            }
                            className="me-2"
                          />

                          Activar cámara
                        </>
                      )}
                    </CButton>

                    <CButton
                      color="primary"
                      onClick={
                        escanearPlaca
                      }
                      disabled={
                        !camaraActiva ||
                        escaneando ||
                        cargandoVehiculos
                      }
                    >
                      {escaneando ? (
                        <>
                          <CSpinner
                            size="sm"
                            className="me-2"
                          />

                          Escaneando...
                        </>
                      ) : (
                        <>
                          <CIcon
                            icon={
                              cilCarAlt
                            }
                            className="me-2"
                          />

                          Escanear placa
                        </>
                      )}
                    </CButton>

                    <CButton
                      color="danger"
                      variant="outline"
                      onClick={
                        detenerCamara
                      }
                      disabled={
                        !camaraActiva ||
                        escaneando
                      }
                    >
                      <CIcon
                        icon={
                          cilMediaStop
                        }
                        className="me-2"
                      />

                      Detener cámara
                    </CButton>

                    {resultado && (
                      <CButton
                        color="secondary"
                        variant="outline"
                        onClick={
                          limpiarResultado
                        }
                      >
                        Limpiar resultado
                      </CButton>
                    )}
                  </div>
                </>
              )}

              {/* ======================================
                  MODO QR
              ====================================== */}

              {modoVista ===
                'QR' && (
                <>
                  {errorMovil && (
                    <CAlert color="warning">
                      {errorMovil}
                    </CAlert>
                  )}

                  {/* ================================
                      TODAVÍA NO HAY QR
                  ================================ */}

                  {!urlQr && (
                    <>
                      <div className="mb-4">
                        <label className="form-label fw-semibold">
                          Dirección de acceso desde el teléfono
                        </label>

                        <CFormInput
                          value={
                            urlBaseMovil
                          }
                          onChange={(
                            evento,
                          ) =>
                            setUrlBaseMovil(
                              evento
                                .target
                                .value,
                            )
                          }
                          placeholder="http://192.168.0.198:3000"
                        />

                        <div className="text-body-secondary mt-2">
                          Ingrese la dirección Network
                          correspondiente a esta PC.
                        </div>
                      </div>

                      <div
                        className="d-flex flex-column justify-content-center align-items-center text-center border rounded mb-3"
                        style={{
                          minHeight:
                            '380px',
                        }}
                      >
                        <CIcon
                          icon={
                            cilMobile
                          }
                          size="4xl"
                          className="text-body-secondary mb-3"
                        />

                        <h4>
                          Conectar teléfono
                        </h4>

                        <p className="text-body-secondary px-4">
                          Genere el código QR y escanéelo
                          con el teléfono para conectar
                          el reconocimiento móvil.
                        </p>

                        <CButton
                          color="primary"
                          size="lg"
                          onClick={
                            generarSesionMovil
                          }
                        >
                          <CIcon
                            icon={
                              cilQrCode
                            }
                            className="me-2"
                          />

                          Generar código QR
                        </CButton>
                      </div>
                    </>
                  )}

                  {/* ================================
                      QR GENERADO
                  ================================ */}

                  {urlQr && (
                    <>
                      <div
                        className="d-flex flex-column justify-content-center align-items-center text-center border rounded p-4"
                        style={{
                          minHeight:
                            '450px',
                        }}
                      >
                        <div
                          className="bg-white rounded p-3 mb-4"
                        >
                          <QRCodeSVG
                            value={
                              urlQr
                            }
                            size={280}
                            level="M"
                            marginSize={2}
                          />
                        </div>

                        <h4>
                          Escanee el QR con el teléfono
                        </h4>

                        <div className="text-body-secondary mb-4">
                          Estado:
                          {' '}
                          <strong>
                            {
                              textoEstadoMovil()
                            }
                          </strong>
                        </div>

                        <CButton
                          color="danger"
                          variant="outline"
                          onClick={
                            cerrarSesionMovil
                          }
                        >
                          Cerrar sesión móvil
                        </CButton>
                      </div>
                    </>
                  )}
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* ============================================
            DERECHA
            RESULTADO DEL RECONOCIMIENTO
        ============================================ */}

        <CCol
          xs={12}
          lg={4}
        >
          <CCard className="h-100">
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center gap-2">
                <strong>
                  Resultado del reconocimiento
                </strong>

                {resultado?.origen && (
                  <CBadge color="info">
                    {resultado.origen ===
                    'telefono'
                      ? 'Teléfono'
                      : 'PC'}
                  </CBadge>
                )}
              </div>
            </CCardHeader>

            <CCardBody>
              {/* ======================================
                  SIN RESULTADO
              ====================================== */}

              {!resultado && (
                <div
                  className="d-flex flex-column justify-content-center align-items-center text-center"
                  style={{
                    minHeight:
                      '430px',
                  }}
                >
                  <CIcon
                    icon={
                      cilCarAlt
                    }
                    size="4xl"
                    className="text-body-secondary mb-3"
                  />

                  <h5 className="text-body-secondary">
                    Ninguna placa detectada
                  </h5>

                  <div className="text-body-secondary">
                    Utilice la cámara de la PC
                    o conecte un teléfono.
                  </div>
                </div>
              )}

              {/* ======================================
                  VEHÍCULO ENCONTRADO
              ====================================== */}

              {resultado?.tipo ===
                'ENCONTRADO' && (
                <>
                  <CAlert color="success">
                    <strong>
                      Vehículo encontrado
                    </strong>
                  </CAlert>

                  {/* ================================
                      PLACA
                  ================================ */}

                  <div className="text-body-secondary">
                    Placa detectada
                  </div>

                  <h2 className="mb-2">
                    {
                      resultado.placa
                    }
                  </h2>

                  <CBadge
                    color={
                      resultado
                        .vehiculo
                        .autorizado
                        ? 'success'
                        : 'danger'
                    }
                    className="mb-3"
                  >
                    {resultado
                      .vehiculo
                      .autorizado
                      ? 'AUTORIZADO'
                      : 'NO AUTORIZADO'}
                  </CBadge>

                  {/* ================================
                      IMAGEN DE PLACA CAPTURADA
                  ================================ */}

                  {imagenCapturada && (
                    <>
                      <div className="fw-semibold mt-2 mb-2">
                        Matrícula capturada
                      </div>

                      <img
                        src={
                          imagenCapturada
                        }
                        alt="Matrícula capturada"
                        className="img-fluid rounded border w-100 mb-3"
                        style={{
                          maxHeight:
                            '160px',

                          objectFit:
                            'contain',
                        }}
                      />
                    </>
                  )}

                  <hr />

                  {/* ================================
                      DATOS DEL VEHÍCULO
                  ================================ */}

                  <h6 className="mb-3">
                    <CIcon
                      icon={
                        cilCarAlt
                      }
                      className="me-2"
                    />

                    Datos del vehículo
                  </h6>

                  <CRow className="g-3">
                    <CCol xs={6}>
                      <div className="text-body-secondary">
                        Marca
                      </div>

                      <strong>
                        {
                          resultado
                            .vehiculo
                            .marca ||
                          '-'
                        }
                      </strong>
                    </CCol>

                    <CCol xs={6}>
                      <div className="text-body-secondary">
                        Modelo
                      </div>

                      <strong>
                        {
                          resultado
                            .vehiculo
                            .modelo ||
                          '-'
                        }
                      </strong>
                    </CCol>

                    <CCol xs={6}>
                      <div className="text-body-secondary">
                        Año
                      </div>

                      <strong>
                        {
                          resultado
                            .vehiculo
                            .anio ||
                          '-'
                        }
                      </strong>
                    </CCol>

                    <CCol xs={6}>
                      <div className="text-body-secondary">
                        Color
                      </div>

                      <strong>
                        {
                          resultado
                            .vehiculo
                            .color ||
                          '-'
                        }
                      </strong>
                    </CCol>

                    <CCol xs={12}>
                      <div className="text-body-secondary">
                        Tipo
                      </div>

                      <strong>
                        {
                          resultado
                            .vehiculo
                            .tipo ||
                          '-'
                        }
                      </strong>
                    </CCol>
                  </CRow>

                  {/* ================================
                      FOTO VEHÍCULO
                  ================================ */}

                  {resultado
                    .vehiculo
                    .foto_url && (
                    <>
                      <div className="fw-semibold mt-4 mb-2">
                        Vehículo registrado
                      </div>

                      <img
                        src={
                          resultado
                            .vehiculo
                            .foto_url
                        }
                        alt="Vehículo registrado"
                        className="img-fluid rounded border w-100"
                        style={{
                          maxHeight:
                            '220px',

                          objectFit:
                            'cover',
                        }}
                      />
                    </>
                  )}

                  <hr className="my-4" />

                  {/* ================================
                      PROPIETARIO
                  ================================ */}

                  <h6 className="mb-3">
                    Propietario / usuario
                  </h6>

                  <div className="mb-3">
                    <div className="text-body-secondary">
                      Nombre
                    </div>

                    <strong>
                      {
                        resultado
                          .vehiculo
                          .propietario_nombre ||
                        '-'
                      }
                    </strong>
                  </div>

                  <div className="mb-3">
                    <div className="text-body-secondary">
                      Correo institucional
                    </div>

                    <strong
                      style={{
                        wordBreak:
                          'break-word',
                      }}
                    >
                      {
                        resultado
                          .vehiculo
                          .correo_institucional ||
                        '-'
                      }
                    </strong>
                  </div>

                  {resultado
                    .vehiculo
                    .cedula_enmascarada && (
                    <div className="mb-3">
                      <div className="text-body-secondary">
                        Identificación
                      </div>

                      <strong>
                        {
                          resultado
                            .vehiculo
                            .cedula_enmascarada
                        }
                      </strong>
                    </div>
                  )}

                  {/* ================================
                      FOTO PROPIETARIO
                  ================================ */}

                  {resultado
                    .vehiculo
                    .foto_propietario_url && (
                    <>
                      <div className="fw-semibold mt-4 mb-2">
                        Propietario registrado
                      </div>

                      <div className="text-center">
                        <img
                          src={
                            resultado
                              .vehiculo
                              .foto_propietario_url
                          }
                          alt="Propietario"
                          className="img-fluid rounded border"
                          style={{
                            width:
                              '100%',

                            maxHeight:
                              '260px',

                            objectFit:
                              'contain',
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* ================================
                      LIMPIAR
                  ================================ */}

                  <CButton
                    color="secondary"
                    variant="outline"
                    className="w-100 mt-4"
                    onClick={
                      limpiarResultado
                    }
                  >
                    Limpiar resultado
                  </CButton>
                </>
              )}

              {/* ======================================
                  VEHÍCULO NO REGISTRADO
              ====================================== */}

              {resultado?.tipo ===
                'NO_REGISTRADO' && (
                <>
                  <CAlert color="danger">
                    <strong>
                      Vehículo no registrado
                    </strong>
                  </CAlert>

                  <div className="text-body-secondary">
                    Placa detectada
                  </div>

                  <h2>
                    {
                      resultado.placa
                    }
                  </h2>

                  <p className="text-body-secondary">
                    La matrícula fue reconocida,
                    pero no existe en la base de datos.
                  </p>

                  <CButton
                    color="secondary"
                    variant="outline"
                    className="w-100"
                    onClick={
                      limpiarResultado
                    }
                  >
                    Limpiar resultado
                  </CButton>
                </>
              )}

              {/* ======================================
                  NO RECONOCIDA
              ====================================== */}

              {resultado?.tipo ===
                'NO_RECONOCIDA' && (
                <>
                  <CAlert color="warning">
                    No se pudo reconocer una matrícula válida.
                  </CAlert>

                  {imagenCapturada && (
                    <img
                      src={
                        imagenCapturada
                      }
                      alt="Imagen analizada"
                      className="img-fluid rounded border w-100 mb-3"
                    />
                  )}

                  <div className="text-body-secondary mb-2">
                    Texto detectado por OCR
                  </div>

                  <pre
                    className="border rounded p-3"
                    style={{
                      whiteSpace:
                        'pre-wrap',

                      wordBreak:
                        'break-word',
                    }}
                  >
                    {resultado.textoOcr ||
                      'No se reconocieron caracteres.'}
                  </pre>

                  <CButton
                    color="secondary"
                    variant="outline"
                    className="w-100"
                    onClick={
                      limpiarResultado
                    }
                  >
                    Limpiar resultado
                  </CButton>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default ReconocimientoPlacas