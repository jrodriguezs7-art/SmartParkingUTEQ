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
// CONFIGURACIÓN
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
  const placa =
    normalizarPlaca(valor)

  if (
    /^[A-Z]{3}[0-9]{4}$/.test(
      placa,
    )
  ) {
    return `${placa.slice(
      0,
      3,
    )}-${placa.slice(3)}`
  }

  if (
    /^[A-Z]{3}[0-9]{3}$/.test(
      placa,
    )
  ) {
    return `${placa.slice(
      0,
      3,
    )}-${placa.slice(3)}`
  }

  return placa
}

// ======================================================
// CORRECCIONES OCR
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
// EXTRAER PLACA
// ======================================================

const extraerPlaca = (texto = '') => {
  const limpio =
    normalizarPlaca(texto)

  const cuatroDigitos =
    limpio.match(
      /[A-Z]{3}[0-9]{4}/,
    )

  if (cuatroDigitos) {
    return formatearPlaca(
      cuatroDigitos[0],
    )
  }

  const tresDigitos =
    limpio.match(
      /[A-Z]{3}[0-9]{3}/,
    )

  if (tresDigitos) {
    return formatearPlaca(
      tresDigitos[0],
    )
  }

  for (
    const longitud
    of [7, 6]
  ) {
    for (
      let inicio = 0;
      inicio <=
      limpio.length - longitud;
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
          .map(
            convertirALetra,
          )
          .join('')

      const numeros =
        fragmento
          .slice(3)
          .split('')
          .map(
            convertirANumero,
          )
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
// GENERAR TOKEN PARA TELÉFONO
// ======================================================

const generarTokenSesion = () => {
  try {
    const datos =
      new Uint8Array(16)

    window.crypto.getRandomValues(
      datos,
    )

    return Array.from(
      datos,
    )
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
  // CÁMARA PC
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
  // RESULTADO PC
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
  // MÓVIL
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
  // ACTIVAR CÁMARA PC
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

        const stream =
          await navigator
            .mediaDevices
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

        if (
          videoRef.current
        ) {
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
    if (
      streamRef.current
    ) {
      streamRef.current
        .getTracks()
        .forEach(
          (track) =>
            track.stop(),
        )

      streamRef.current = null
    }

    if (
      videoRef.current
    ) {
      videoRef.current.srcObject =
        null
    }

    setCamaraActiva(false)
  }

  // ====================================================
  // WORKER OCR
  // ====================================================

  const obtenerWorker =
    async () => {
      if (
        workerRef.current
      ) {
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
  // CAPTURAR PLACA
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
        ancho *
          escala,
      )

    canvas.height =
      Math.round(
        alto *
          escala,
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
      if (
        !camaraActiva
      ) {
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
  // GENERAR QR
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
            'Ingrese la dirección Network de Vite.',
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

        // =============================================
        // CREAR CANAL
        // =============================================

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

        // =============================================
        // TELÉFONO CONECTADO
        // =============================================

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

        // =============================================
        // PLACA RECIBIDA DESDE TELÉFONO
        // =============================================

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

                vehiculo:
                  null,

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

            // =========================================
            // RESPUESTA COMPLETA HACIA EL TELÉFONO
            // =========================================

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
  // CERRAR SESIÓN MÓVIL
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
  // LIMPIAR
  // ====================================================

  const limpiarResultado =
    () => {
      setResultado(null)

      setImagenCapturada('')

      setErrorEscaneo('')
    }

  // ====================================================
  // LIMPIEZA FINAL
  // ====================================================

  useEffect(() => {
    return () => {
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

      if (
        workerRef.current
      ) {
        workerRef.current
          .terminate()
          .catch(() => {})
      }

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
  // ESTADO MÓVIL
  // ====================================================

  const colorEstadoMovil = () => {
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

  const textoEstadoMovil = () => {
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
      return 'Error de conexión'
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
          Coloque la matrícula dentro del recuadro
          para reconocerla desde esta PC o conecte
          un teléfono mediante código QR.
        </CCardBody>
      </CCard>

      {errorVehiculos && (
        <CAlert color="danger">
          Error consultando vehículos:{' '}
          {errorVehiculos}
        </CAlert>
      )}

      <CRow className="g-4">
        {/* ============================================
            CÁMARA PC
        ============================================ */}

        <CCol
          xs={12}
          lg={8}
        >
          <CCard>
            <CCardHeader>
              <CIcon
                icon={cilCamera}
                className="me-2"
              />

              <strong>
                Cámara de esta PC
              </strong>
            </CCardHeader>

            <CCardBody>
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
                    setErrorEscaneo('')
                  }
                >
                  {errorEscaneo}
                </CAlert>
              )}

              <div
                className="position-relative overflow-hidden rounded border mb-3"
                style={{
                  width: '100%',
                  aspectRatio:
                    '16 / 9',

                  backgroundColor:
                    '#080b10',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit:
                      'contain',

                    display:
                      camaraActiva
                        ? 'block'
                        : 'none',
                  }}
                />

                {!camaraActiva && (
                  <div className="position-absolute top-50 start-50 translate-middle text-center w-100">
                    <CIcon
                      icon={cilCamera}
                      size="4xl"
                      className="text-body-secondary mb-3"
                    />

                    <h5 className="text-body-secondary">
                      Cámara desactivada
                    </h5>

                    <div className="text-body-secondary">
                      Presione "Activar cámara".
                    </div>
                  </div>
                )}

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
                      className="position-absolute start-50 translate-middle-x text-white fw-semibold"
                      style={{
                        top:
                          '67%',

                        textShadow:
                          '0 2px 5px black',
                      }}
                    >
                      Coloque la placa dentro del recuadro
                    </div>
                  </>
                )}

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

                    {progreso > 0 && (
                      <div className="text-white mt-2">
                        {progreso} %
                      </div>
                    )}
                  </div>
                )}
              </div>

              <canvas
                ref={canvasRef}
                style={{
                  display:
                    'none',
                }}
              />

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
                        icon={cilCamera}
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
                  <CIcon
                    icon={cilCarAlt}
                    className="me-2"
                  />

                  Escanear placa
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
                    icon={cilMediaStop}
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
            </CCardBody>
          </CCard>
        </CCol>

        {/* ============================================
            TELÉFONO
        ============================================ */}

        <CCol
          xs={12}
          lg={4}
        >
          <CCard className="h-100">
            <CCardHeader>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <CIcon
                    icon={cilMobile}
                    className="me-2"
                  />

                  <strong>
                    Cámara del teléfono
                  </strong>
                </div>

                <CBadge
                  color={
                    colorEstadoMovil()
                  }
                >
                  {textoEstadoMovil()}
                </CBadge>
              </div>
            </CCardHeader>

            <CCardBody>
              {errorMovil && (
                <CAlert color="warning">
                  {errorMovil}
                </CAlert>
              )}

              {!urlQr && (
                <>
                  <div className="mb-3">
                    <label className="form-label">
                      Dirección de acceso desde el teléfono
                    </label>

                    <CFormInput
                      value={
                        urlBaseMovil
                      }
                      onChange={(e) =>
                        setUrlBaseMovil(
                          e.target.value,
                        )
                      }
                      placeholder="http://192.168.1.50:5173"
                    />
                  </div>

                  <div
                    className="d-flex flex-column justify-content-center align-items-center text-center rounded border mb-3"
                    style={{
                      minHeight:
                        '220px',
                    }}
                  >
                    <CIcon
                      icon={cilQrCode}
                      size="4xl"
                      className="text-body-secondary mb-3"
                    />

                    <h5>
                      Conectar teléfono
                    </h5>
                  </div>

                  <CButton
                    color="primary"
                    className="w-100"
                    onClick={
                      generarSesionMovil
                    }
                  >
                    <CIcon
                      icon={cilQrCode}
                      className="me-2"
                    />

                    Generar código QR
                  </CButton>
                </>
              )}

              {urlQr && (
                <>
                  <div
                    className="d-flex justify-content-center p-3 bg-white rounded mb-3"
                  >
                    <QRCodeSVG
                      value={
                        urlQr
                      }
                      size={220}
                      level="M"
                      marginSize={2}
                    />
                  </div>

                  <div className="text-center mb-3">
                    <strong>
                      Escanee el QR con el teléfono
                    </strong>
                  </div>

                  <CButton
                    color="secondary"
                    variant="outline"
                    className="w-100"
                    onClick={
                      cerrarSesionMovil
                    }
                  >
                    Cerrar sesión móvil
                  </CButton>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* ==============================================
          RESULTADO PC
      ============================================== */}

      <CCard className="mt-4">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center">
            <strong>
              Resultado del reconocimiento
            </strong>

            {resultado?.origen && (
              <CBadge color="info">
                {resultado.origen ===
                'telefono'
                  ? 'Cámara del teléfono'
                  : 'Cámara de PC'}
              </CBadge>
            )}
          </div>
        </CCardHeader>

        <CCardBody>
          {!resultado && (
            <div className="text-center py-4">
              <CIcon
                icon={cilCarAlt}
                size="3xl"
                className="text-body-secondary mb-3"
              />

              <h5 className="text-body-secondary">
                Ninguna placa detectada
              </h5>
            </div>
          )}

          {resultado?.tipo ===
            'ENCONTRADO' && (
            <CRow className="g-4">
              {imagenCapturada && (
                <CCol
                  xs={12}
                  md={5}
                >
                  <div className="fw-semibold mb-2">
                    Matrícula capturada
                  </div>

                  <img
                    src={
                      imagenCapturada
                    }
                    alt="Placa capturada"
                    className="img-fluid rounded border"
                  />
                </CCol>
              )}

              <CCol
                xs={12}
                md={
                  imagenCapturada
                    ? 7
                    : 12
                }
              >
                <CAlert color="success">
                  <strong>
                    Vehículo encontrado en la base de datos
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

                <hr />

                <CRow className="g-3">
                  <CCol sm={6}>
                    <div className="text-body-secondary">
                      Marca
                    </div>

                    <strong>
                      {
                        resultado
                          .vehiculo
                          .marca
                      }
                    </strong>
                  </CCol>

                  <CCol sm={6}>
                    <div className="text-body-secondary">
                      Modelo
                    </div>

                    <strong>
                      {
                        resultado
                          .vehiculo
                          .modelo
                      }
                    </strong>
                  </CCol>

                  <CCol sm={6}>
                    <div className="text-body-secondary">
                      Año
                    </div>

                    <strong>
                      {
                        resultado
                          .vehiculo
                          .anio ??
                        '-'
                      }
                    </strong>
                  </CCol>

                  <CCol sm={6}>
                    <div className="text-body-secondary">
                      Color
                    </div>

                    <strong>
                      {
                        resultado
                          .vehiculo
                          .color ??
                        '-'
                      }
                    </strong>
                  </CCol>

                  <CCol xs={12}>
                    <div className="text-body-secondary">
                      Propietario
                    </div>

                    <strong>
                      {
                        resultado
                          .vehiculo
                          .propietario_nombre
                      }
                    </strong>
                  </CCol>

                  <CCol xs={12}>
                    <div className="text-body-secondary">
                      Correo institucional
                    </div>

                    <strong>
                      {
                        resultado
                          .vehiculo
                          .correo_institucional ??
                        '-'
                      }
                    </strong>
                  </CCol>

                  <CCol xs={12}>
                    <CBadge
                      color={
                        resultado
                          .vehiculo
                          .autorizado
                          ? 'success'
                          : 'danger'
                      }
                    >
                      {resultado
                        .vehiculo
                        .autorizado
                        ? 'AUTORIZADO'
                        : 'NO AUTORIZADO'}
                    </CBadge>
                  </CCol>
                </CRow>

                {(resultado
                  .vehiculo
                  .foto_url ||
                  resultado
                    .vehiculo
                    .foto_propietario_url) && (
                  <>
                    <hr />

                    <CRow className="g-3">
                      {resultado
                        .vehiculo
                        .foto_url && (
                        <CCol md={6}>
                          <div className="fw-semibold mb-2">
                            Vehículo registrado
                          </div>

                          <img
                            src={
                              resultado
                                .vehiculo
                                .foto_url
                            }
                            alt="Vehículo"
                            className="img-fluid rounded border"
                            style={{
                              width:
                                '100%',

                              maxHeight:
                                '280px',

                              objectFit:
                                'cover',
                            }}
                          />
                        </CCol>
                      )}

                      {resultado
                        .vehiculo
                        .foto_propietario_url && (
                        <CCol md={6}>
                          <div className="fw-semibold mb-2">
                            Propietario registrado
                          </div>

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
                                '280px',

                              objectFit:
                                'contain',
                            }}
                          />
                        </CCol>
                      )}
                    </CRow>
                  </>
                )}
              </CCol>
            </CRow>
          )}

          {resultado?.tipo ===
            'NO_REGISTRADO' && (
            <CAlert color="danger">
              <h5>
                Vehículo no registrado
              </h5>

              <h2 className="mb-0">
                {
                  resultado.placa
                }
              </h2>
            </CAlert>
          )}

          {resultado?.tipo ===
            'NO_RECONOCIDA' && (
            <CAlert color="warning">
              No se pudo reconocer una matrícula válida.
            </CAlert>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default ReconocimientoPlacas