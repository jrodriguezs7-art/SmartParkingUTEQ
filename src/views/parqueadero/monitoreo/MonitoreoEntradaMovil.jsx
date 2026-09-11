import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom'

import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CRow,
  CSpinner,
} from '@coreui/react'

import CIcon from '@coreui/icons-react'

import {
  cilCamera,
  cilCarAlt,
  cilMediaStop,
  cilPlus,
  cilQrCode,
} from '@coreui/icons'

import {
  useVehiculos,
} from '../../../hooks/useVehiculos'

import {
  detectarPlacaApi,
  normalizarRespuestaOcr,
  validarImagenOcr,
} from '../../../lib/ocr/ocrApi'

import {
  supabase,
} from '../../../lib/supabase'

// ======================================================
// UTILIDADES
// ======================================================

const normalizarPlaca = (
  valor = '',
) => {
  return String(valor)
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      '',
    )
}

const formatearPlaca = (
  valor = '',
) => {
  const placa =
    normalizarPlaca(
      valor,
    )

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

  return String(valor)
    .trim()
    .toUpperCase()
}

const numeroSeguro = (
  valor,
) => {
  const numero =
    Number(valor)

  return Number.isFinite(
    numero,
  )
    ? numero
    : null
}

const limitar = (
  valor,
  minimo,
  maximo,
) => {
  return Math.min(
    Math.max(
      valor,
      minimo,
    ),
    maximo,
  )
}

// ======================================================
// CALCULAR RECTÁNGULO VERDE
// ======================================================

const calcularRectangulo = (
  bbox,
  dimensiones,
  natural,
) => {
  if (!bbox) {
    return null
  }

  const x =
    numeroSeguro(
      bbox.x,
    )

  const y =
    numeroSeguro(
      bbox.y,
    )

  const width =
    numeroSeguro(
      bbox.width,
    )

  const height =
    numeroSeguro(
      bbox.height,
    )

  if (
    x === null ||
    y === null ||
    width === null ||
    height === null ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  // Coordenadas normalizadas 0..1
  const normalizado =
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x <= 1.05 &&
    y <= 1.05 &&
    width <= 1.05 &&
    height <= 1.05

  if (normalizado) {
    const left =
      limitar(
        x * 100,
        0,
        100,
      )

    const top =
      limitar(
        y * 100,
        0,
        100,
      )

    return {
      left,
      top,
      width:
        limitar(
          width * 100,
          0,
          100 - left,
        ),
      height:
        limitar(
          height * 100,
          0,
          100 - top,
        ),
    }
  }

  const anchoReferencia =
    numeroSeguro(
      dimensiones?.width,
    ) ||
    numeroSeguro(
      natural?.width,
    )

  const altoReferencia =
    numeroSeguro(
      dimensiones?.height,
    ) ||
    numeroSeguro(
      natural?.height,
    )

  if (
    !anchoReferencia ||
    !altoReferencia
  ) {
    return null
  }

  const left =
    limitar(
      (
        x /
        anchoReferencia
      ) * 100,
      0,
      100,
    )

  const top =
    limitar(
      (
        y /
        altoReferencia
      ) * 100,
      0,
      100,
    )

  return {
    left,
    top,
    width:
      limitar(
        (
          width /
          anchoReferencia
        ) * 100,
        0,
        100 - left,
      ),
    height:
      limitar(
        (
          height /
          altoReferencia
        ) * 100,
        0,
        100 - top,
      ),
  }
}

// ======================================================
// IDENTIDAD DEL DISPOSITIVO
// ======================================================

const crearHashSimple =
  (
    texto = '',
  ) => {
    let hash =
      2166136261

    for (
      let i = 0;
      i < texto.length;
      i += 1
    ) {
      hash ^=
        texto.charCodeAt(
          i,
        )

      hash =
        Math.imul(
          hash,
          16777619,
        )
    }

    return (
      hash >>> 0
    )
      .toString(16)
      .padStart(
        8,
        '0',
      )
  }

const obtenerIdDispositivo =
  () => {
    const clave =
      'smartparking-dispositivo-id'

    try {
      const existente =
        window.localStorage
          .getItem(
            clave,
          )

      if (existente) {
        return existente
      }

      const nuevoId =
        window.crypto
          ?.randomUUID
          ? window.crypto
              .randomUUID()
          : `disp-${crearHashSimple(
              [
                navigator.userAgent,
                navigator.platform,
                navigator.language,
                window.screen
                  ?.width,
                window.screen
                  ?.height,
                window.devicePixelRatio,
              ].join('|'),
            )}`

      window.localStorage
        .setItem(
          clave,
          nuevoId,
        )

      return nuevoId
    } catch {
      // Si localStorage no está disponible, usamos una
      // huella determinista. Así un refresh no crea un
      // dispositivo distinto.
      return `disp-${crearHashSimple(
        [
          navigator.userAgent,
          navigator.platform,
          navigator.language,
          window.screen
            ?.width,
          window.screen
            ?.height,
          window.devicePixelRatio,
        ].join('|'),
      )}`
    }
  }

// ======================================================
// NOMBRE APROXIMADO DEL TELÉFONO
//
// Los navegadores no siempre exponen el nombre comercial
// exacto del equipo. Cuando Android entrega el código de
// modelo, mostramos marca + código.
// ======================================================

const obtenerNombreDispositivo =
  () => {
    const ua =
      navigator.userAgent ||
      ''

    if (
      /iPhone/i.test(
        ua,
      )
    ) {
      return 'Apple iPhone'
    }

    if (
      /iPad/i.test(
        ua,
      )
    ) {
      return 'Apple iPad'
    }

    const samsung =
      ua.match(
        /\b(SM-[A-Z0-9-]+)\b/i,
      )

    if (samsung?.[1]) {
      return `Samsung ${samsung[1].toUpperCase()}`
    }

    const pixel =
      ua.match(
        /\b(Pixel [^;)]+)/i,
      )

    if (pixel?.[1]) {
      return `Google ${pixel[1].trim()}`
    }

    const redmi =
      ua.match(
        /\b(Redmi [^;)]+)/i,
      )

    if (redmi?.[1]) {
      return redmi[1]
        .trim()
    }

    const xiaomi =
      ua.match(
        /\b((?:MI|MIX|POCO) [^;)]+)/i,
      )

    if (xiaomi?.[1]) {
      return `Xiaomi ${xiaomi[1].trim()}`
    }

    const androidModelo =
      ua.match(
        /Android[^;]*;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?[;)]/i,
      )

    if (
      androidModelo?.[1]
    ) {
      const modelo =
        androidModelo[1]
          .replace(
            /\bwv\b/gi,
            '',
          )
          .trim()

      if (modelo) {
        return modelo
      }
    }

    if (
      /Android/i.test(
        ua,
      )
    ) {
      return 'Teléfono Android'
    }

    return (
      navigator.platform ||
      'Dispositivo móvil'
    )
  }

// ======================================================
// CONTROL PERSISTENTE DE SESIONES CERRADAS
// ======================================================

const obtenerClaveSesionCerrada =
  (
    sesion,
    dispositivoId,
  ) =>
    `smartparking-sesion-cerrada:${sesion}:${dispositivoId}`

const estaSesionCerrada =
  (
    sesion,
    dispositivoId,
  ) => {
    const clave =
      obtenerClaveSesionCerrada(
        sesion,
        dispositivoId,
      )

    try {
      if (
        window.localStorage
          .getItem(
            clave,
          ) === '1'
      ) {
        return true
      }
    } catch {
      // Continuamos con sessionStorage.
    }

    try {
      return (
        window.sessionStorage
          .getItem(
            clave,
          ) === '1'
      )
    } catch {
      return false
    }
  }

const marcarSesionCerrada =
  (
    sesion,
    dispositivoId,
  ) => {
    const clave =
      obtenerClaveSesionCerrada(
        sesion,
        dispositivoId,
      )

    try {
      window.localStorage
        .setItem(
          clave,
          '1',
        )
    } catch {
      // Ignoramos y probamos sessionStorage.
    }

    try {
      window.sessionStorage
        .setItem(
          clave,
          '1',
        )
    } catch {
      // El control del administrador seguirá bloqueando
      // la reconexión mientras el QR permanezca activo.
    }
  }

const permitirReingresoSesion =
  (
    sesion,
    dispositivoId,
  ) => {
    const clave =
      obtenerClaveSesionCerrada(
        sesion,
        dispositivoId,
      )

    try {
      window.localStorage
        .removeItem(
          clave,
        )
    } catch {
      // Sin acción.
    }

    try {
      window.sessionStorage
        .removeItem(
          clave,
        )
    } catch {
      // Sin acción.
    }
  }

// ======================================================
// COMPONENTE MÓVIL
// ======================================================

const MonitoreoEntradaMovil = () => {
  const navigate =
    useNavigate()

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams()

  const sesion =
    searchParams.get(
      'sesion',
    ) || ''

  const reingresoSolicitado =
    searchParams.get(
      'reingreso',
    ) === '1'

  const dispositivoId =
    useMemo(
      () =>
        obtenerIdDispositivo(),
      [],
    )

  const nombreDispositivo =
    useMemo(
      () =>
        obtenerNombreDispositivo(),
      [],
    )

  // ====================================================
  // VEHÍCULOS
  // ====================================================

  const {
    vehiculos,
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

  const canalRef =
    useRef(null)

  const videoRef =
    useRef(null)

  const canvasRef =
    useRef(null)

  const streamRef =
    useRef(null)

  const inputGaleriaRef =
    useRef(null)

  const previewUrlRef =
    useRef('')

  const cerrandoRef =
    useRef(false)

  const videoQrRef =
    useRef(null)

  const streamQrRef =
    useRef(null)

  const frameQrRef =
    useRef(null)

  const detectorQrRef =
    useRef(null)

  // ====================================================
  // ESTADOS DE SESIÓN
  // ====================================================

  const [
    canalListo,
    setCanalListo,
  ] = useState(false)

  const [
    conectado,
    setConectado,
  ] = useState(false)

  const [
    sesionCerrada,
    setSesionCerrada,
  ] = useState(false)

  const [
    escaneandoQr,
    setEscaneandoQr,
  ] = useState(false)

  const [
    errorQr,
    setErrorQr,
  ] = useState('')

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

  // ====================================================
  // IMAGEN
  // ====================================================

  const [
    archivoImagen,
    setArchivoImagen,
  ] = useState(null)

  const [
    previewImagen,
    setPreviewImagen,
  ] = useState('')

  const [
    dimensionesNaturales,
    setDimensionesNaturales,
  ] = useState({
    width: 0,
    height: 0,
  })

  // ====================================================
  // RESULTADO
  // ====================================================

  const [
    procesando,
    setProcesando,
  ] = useState(false)

  const [
    resultado,
    setResultado,
  ] = useState(null)

  const [
    error,
    setError,
  ] = useState('')

  // ====================================================
  // BUSCAR VEHÍCULO
  // ====================================================

  const buscarVehiculo =
    (placa) => {
      const buscada =
        normalizarPlaca(
          placa,
        )

      if (!buscada) {
        return null
      }

      return (
        vehiculosRef
          .current
          .find(
            (vehiculo) =>
              normalizarPlaca(
                vehiculo.placa,
              ) === buscada,
          ) ?? null
      )
    }

  // ====================================================
  // PREVIEW
  // ====================================================

  const liberarPreview =
    () => {
      if (
        previewUrlRef.current
      ) {
        URL.revokeObjectURL(
          previewUrlRef.current,
        )

        previewUrlRef.current =
          ''
      }
    }

  // ====================================================
  // DETENER STREAM DE CÁMARA
  // ====================================================

  const detenerStream =
    () => {
      if (
        streamRef.current
      ) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop(),
          )

        streamRef.current =
          null
      }

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null
      }

      setCamaraActiva(
        false,
      )
    }

  // ====================================================
  // LIMPIAR IMAGEN / RESULTADO
  // ====================================================

  const limpiarCaptura =
    () => {
      liberarPreview()

      setArchivoImagen(
        null,
      )

      setPreviewImagen(
        '',
      )

      setResultado(
        null,
      )

      setDimensionesNaturales({
        width: 0,
        height: 0,
      })

      setError('')
    }

  // ====================================================
  // DETENER ESCÁNER QR
  // ====================================================

  const detenerEscanerQr =
    () => {
      if (
        frameQrRef.current
      ) {
        window.cancelAnimationFrame(
          frameQrRef.current,
        )

        frameQrRef.current =
          null
      }

      if (
        streamQrRef.current
      ) {
        streamQrRef.current
          .getTracks()
          .forEach(
            (
              track,
            ) =>
              track.stop(),
          )

        streamQrRef.current =
          null
      }

      if (
        videoQrRef.current
      ) {
        videoQrRef.current.srcObject =
          null
      }

      detectorQrRef.current =
        null

      setEscaneandoQr(
        false,
      )
    }

  // ====================================================
  // ESCANEAR UN NUEVO QR
  // ====================================================

  const iniciarEscanerQr =
    async () => {
      try {
        setErrorQr('')

        if (
          !(
            'BarcodeDetector' in
            window
          )
        ) {
          throw new Error(
            'Este navegador no permite escanear QR dentro de la web. Abra la cámara principal del teléfono y escanee el QR desde allí.',
          )
        }

        detenerEscanerQr()

        const detector =
          new window
            .BarcodeDetector({
              formats: [
                'qr_code',
              ],
            })

        detectorQrRef.current =
          detector

        const stream =
          await navigator
            .mediaDevices
            .getUserMedia({
              video: {
                facingMode: {
                  ideal:
                    'environment',
                },
              },

              audio:
                false,
            })

        streamQrRef.current =
          stream

        setEscaneandoQr(
          true,
        )

        await new Promise(
          (
            resolve,
          ) =>
            window.setTimeout(
              resolve,
              50,
            ),
        )

        const video =
          videoQrRef.current

        if (!video) {
          throw new Error(
            'No se pudo iniciar la vista del escáner QR.',
          )
        }

        video.srcObject =
          stream

        await video.play()

        const revisar =
          async () => {
            if (
              !streamQrRef.current ||
              !detectorQrRef.current
            ) {
              return
            }

            try {
              const codigos =
                await detectorQrRef
                  .current
                  .detect(
                    video,
                  )

              if (
                codigos.length >
                0
              ) {
                const valor =
                  String(
                    codigos[0]
                      ?.rawValue ||
                      '',
                  ).trim()

                if (valor) {
                  const url =
                    new URL(
                      valor,
                    )

                  const mismaAplicacion =
                    url.origin ===
                    window.location
                      .origin

                  const hashValido =
                    url.hash
                      .startsWith(
                        '#/monitoreo-entrada-movil?',
                      )

                  const parametrosHash =
                    new URLSearchParams(
                      url.hash
                        .split(
                          '?',
                        )[1] ||
                        '',
                    )

                  const token =
                    parametrosHash
                      .get(
                        'sesion',
                      )

                  if (
                    !mismaAplicacion ||
                    !hashValido ||
                    !token
                  ) {
                    throw new Error(
                      'El QR leído no pertenece a una sesión válida de Smart Parking.',
                    )
                  }

                  permitirReingresoSesion(
                    token,
                    dispositivoId,
                  )

                  parametrosHash.set(
                    'reingreso',
                    '1',
                  )

                  url.hash =
                    `#/monitoreo-entrada-movil?${parametrosHash.toString()}`

                  detenerEscanerQr()

                  window.location
                    .assign(
                      url.toString(),
                    )

                  return
                }
              }
            } catch (
              err
            ) {
              if (
                err?.message
                  ?.includes(
                    'no pertenece',
                  )
              ) {
                setErrorQr(
                  err.message,
                )
              }
            }

            frameQrRef.current =
              window
                .requestAnimationFrame(
                  revisar,
                )
          }

        frameQrRef.current =
          window
            .requestAnimationFrame(
              revisar,
            )
      } catch (err) {
        detenerEscanerQr()

        setErrorQr(
          err?.message ||
            'No se pudo abrir el escáner QR.',
        )
      }
    }

  // ====================================================
  // FINALIZAR SESIÓN LOCAL
  // ====================================================

  const finalizarSesion =
    async ({
      notificarAdministrador =
        false,
    } = {}) => {
      if (
        cerrandoRef.current
      ) {
        return
      }

      cerrandoRef.current =
        true

      detenerStream()
      liberarPreview()

      setArchivoImagen(
        null,
      )

      setPreviewImagen(
        '',
      )

      setResultado(
        null,
      )

      setConectado(
        false,
      )

      setCanalListo(
        false,
      )

      setProcesando(
        false,
      )

      setSesionCerrada(
        true,
      )

      marcarSesionCerrada(
        sesion,
        dispositivoId,
      )

      setError('')

      const canal =
        canalRef.current

      if (
        canal &&
        notificarAdministrador
      ) {
        try {
          await canal.send({
            type:
              'broadcast',

            event:
              'movil_desconectado',

            payload: {
              dispositivoId,

              nombreDispositivo,

              fecha:
                new Date()
                  .toISOString(),
            },
          })

          await new Promise(
            (
              resolve,
            ) =>
              window.setTimeout(
                resolve,
                180,
              ),
          )
        } catch {
          // Aunque falle el aviso, cerramos la sesión local.
        }
      }

      canalRef.current =
        null

      if (canal) {
        try {
          await supabase
            .removeChannel(
              canal,
            )
        } catch {
          // La sesión local ya quedó cerrada.
        }
      }

      cerrandoRef.current =
        false
    }

  // ====================================================
  // CERRAR SESIÓN DESDE EL TELÉFONO
  // ====================================================

  const cerrarSesionDesdeMovil =
    async () => {
      await finalizarSesion({
        notificarAdministrador:
          true,
      })
    }

  // ====================================================
  // CONEXIÓN REALTIME
  // ====================================================

  useEffect(() => {
    if (!sesion) {
      setSesionCerrada(
        true,
      )

      setError(
        'La sesión QR no es válida.',
      )

      return undefined
    }

    if (
      reingresoSolicitado
    ) {
      permitirReingresoSesion(
        sesion,
        dispositivoId,
      )
    } else if (
      estaSesionCerrada(
        sesion,
        dispositivoId,
      )
    ) {
      setConectado(
        false,
      )

      setCanalListo(
        false,
      )

      setSesionCerrada(
        true,
      )

      setError('')

      return undefined
    }

    cerrandoRef.current =
      false

    const canal =
      supabase.channel(
        `smartparking-monitoreo-${sesion}`,
        {
          config: {
            broadcast: {
              ack: true,
            },
          },
        },
      )

    canalRef.current =
      canal

    // La PC confirma que este QR sigue vigente.
    canal.on(
      'broadcast',
      {
        event:
          'sesion_confirmada',
      },
      ({
        payload,
      }) => {
        const destino =
          String(
            payload
              ?.dispositivoId ||
              '',
          ).trim()

        if (
          destino &&
          destino !==
            dispositivoId
        ) {
          return
        }

        if (
          cerrandoRef.current
        ) {
          return
        }

        setConectado(
          true,
        )

        setSesionCerrada(
          false,
        )

        setError('')

        if (
          reingresoSolicitado
        ) {
          const nuevosParametros =
            new URLSearchParams(
              searchParams,
            )

          nuevosParametros.delete(
            'reingreso',
          )

          setSearchParams(
            nuevosParametros,
            {
              replace:
                true,
            },
          )
        }
      },
    )

    // La PC cerró expresamente la sesión QR.
    canal.on(
      'broadcast',
      {
        event:
          'sesion_cerrada',
      },
      ({
        payload,
      }) => {
        const alcance =
          String(
            payload
              ?.alcance ||
              'todos',
          )

        const destino =
          String(
            payload
              ?.dispositivoId ||
              '',
          ).trim()

        const corresponde =
          alcance ===
            'todos' ||
          !destino ||
          destino ===
            dispositivoId

        if (
          !corresponde
        ) {
          return
        }

        finalizarSesion()
      },
    )

    canal.subscribe(
      async (estado) => {
        if (
          estado ===
          'SUBSCRIBED'
        ) {
          setCanalListo(
            true,
          )

          setConectado(
            false,
          )

          await canal.send({
            type:
              'broadcast',

            event:
              'movil_conectado',

            payload: {
              conectado:
                true,

              dispositivoId,

              nombreDispositivo,

              reingreso:
                reingresoSolicitado,

              fecha:
                new Date()
                  .toISOString(),
            },
          })
        }

        if (
          estado ===
            'CHANNEL_ERROR' ||
          estado ===
            'TIMED_OUT'
        ) {
          setCanalListo(
            false,
          )

          setConectado(
            false,
          )

          setError(
            'No se pudo establecer comunicación con la PC.',
          )
        }
      },
    )

    return () => {
      detenerStream()
      detenerEscanerQr()
      liberarPreview()

      if (
        canalRef.current
      ) {
        supabase.removeChannel(
          canalRef.current,
        )

        canalRef.current =
          null
      }
    }
  }, [
    sesion,
    dispositivoId,
    nombreDispositivo,
    reingresoSolicitado,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  // ====================================================
  // ACTIVAR CÁMARA
  // ====================================================

  const activarCamara =
    async () => {
      if (
        !conectado ||
        sesionCerrada
      ) {
        setError(
          'La sesión QR no está activa.',
        )

        return
      }

      try {
        setError('')
        setIniciandoCamara(
          true,
        )

        if (
          !navigator
            .mediaDevices ||
          !navigator
            .mediaDevices
            .getUserMedia
        ) {
          throw new Error(
            'El navegador no permite utilizar la cámara en vivo.',
          )
        }

        detenerStream()
        limpiarCaptura()

        const stream =
          await navigator
            .mediaDevices
            .getUserMedia({
              video: {
                facingMode: {
                  ideal:
                    'environment',
                },

                width: {
                  ideal:
                    1920,
                },

                height: {
                  ideal:
                    1080,
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

          await videoRef.current
            .play()
        }

        setCamaraActiva(
          true,
        )
      } catch (err) {
        let mensaje =
          err?.message ||
          'No se pudo activar la cámara.'

        if (
          err?.name ===
          'NotAllowedError'
        ) {
          mensaje =
            'El permiso de la cámara fue rechazado.'
        }

        if (
          err?.name ===
          'NotFoundError'
        ) {
          mensaje =
            'No se encontró una cámara disponible.'
        }

        setError(
          mensaje,
        )

        detenerStream()
      } finally {
        setIniciandoCamara(
          false,
        )
      }
    }

  // ====================================================
  // DETENER CÁMARA
  // ====================================================

  const detenerCamara =
    () => {
      detenerStream()
    }

  // ====================================================
  // ESTABLECER IMAGEN
  // ====================================================

  const establecerImagen =
    (archivo) => {
      const validacion =
        validarImagenOcr(
          archivo,
        )

      if (!validacion.ok) {
        throw new Error(
          validacion.mensaje,
        )
      }

      liberarPreview()

      const url =
        URL.createObjectURL(
          archivo,
        )

      previewUrlRef.current =
        url

      setArchivoImagen(
        archivo,
      )

      setPreviewImagen(
        url,
      )

      setResultado(
        null,
      )

      setDimensionesNaturales({
        width: 0,
        height: 0,
      })

      setError('')
    }

  // ====================================================
  // CAPTURAR FOTOGRAFÍA
  // ====================================================

  const capturarFotografia =
    async () => {
      try {
        if (
          !conectado ||
          sesionCerrada
        ) {
          throw new Error(
            'La sesión QR no está activa.',
          )
        }

        const video =
          videoRef.current

        const canvas =
          canvasRef.current

        if (
          !video ||
          !canvas ||
          !camaraActiva
        ) {
          throw new Error(
            'Primero active la cámara.',
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

        canvas.width =
          video.videoWidth

        canvas.height =
          video.videoHeight

        const contexto =
          canvas.getContext(
            '2d',
          )

        contexto.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height,
        )

        const blob =
          await new Promise(
            (
              resolve,
              reject,
            ) => {
              canvas.toBlob(
                (
                  resultadoBlob,
                ) => {
                  if (
                    resultadoBlob
                  ) {
                    resolve(
                      resultadoBlob,
                    )
                  } else {
                    reject(
                      new Error(
                        'No se pudo generar la fotografía.',
                      ),
                    )
                  }
                },
                'image/jpeg',
                0.92,
              )
            },
          )

        establecerImagen(
          blob,
        )

        // Liberamos la cámara después de la captura para
        // evitar que siga consumiendo batería en segundo plano.
        detenerStream()
      } catch (err) {
        setError(
          err?.message ||
          'No se pudo capturar la fotografía.',
        )
      }
    }

  // ====================================================
  // SELECCIONAR IMAGEN
  // ====================================================

  const seleccionarImagen =
    (evento) => {
      const archivo =
        evento.target
          .files?.[0]

      if (!archivo) {
        return
      }

      try {
        if (
          !conectado ||
          sesionCerrada
        ) {
          throw new Error(
            'La sesión QR no está activa.',
          )
        }

        detenerStream()
        establecerImagen(
          archivo,
        )
      } catch (err) {
        setError(
          err?.message ||
          'La imagen no es válida.',
        )
      } finally {
        evento.target.value =
          ''
      }
    }

  // ====================================================
  // DETECTAR PLACA
  // ====================================================

  const detectarPlaca =
    async () => {
      if (
        !conectado ||
        sesionCerrada
      ) {
        setError(
          'La sesión QR no está activa.',
        )

        return
      }

      if (!archivoImagen) {
        setError(
          'Capture o seleccione una fotografía.',
        )

        return
      }

      try {
        setProcesando(
          true,
        )

        setResultado(
          null,
        )

        setError('')

        const respuesta =
          await detectarPlacaApi(
            archivoImagen,
          )

        const normalizado =
          normalizarRespuestaOcr(
            respuesta,
          )

        const placa =
          formatearPlaca(
            normalizado.placa,
          )

        const vehiculoLocal =
          placa
            ? buscarVehiculo(
                placa,
              )
            : null

        let vehiculo =
          normalizado.vehiculo ||
          null

        if (
          normalizado
            .vehiculoEncontrado !==
            false &&
          vehiculoLocal
        ) {
          vehiculo = {
            ...vehiculoLocal,
            ...(vehiculo ?? {}),
          }
        }

        const encontrado =
          normalizado
            .vehiculoEncontrado !==
            null &&
          normalizado
            .vehiculoEncontrado !==
            undefined
            ? Boolean(
                normalizado
                  .vehiculoEncontrado,
              )
            : Boolean(
                vehiculo,
              )

        const resultadoFinal = {
          ...normalizado,

          placa,

          vehiculoEncontrado:
            encontrado,

          vehiculo,

          origen:
            'telefono',

          apiOk:
            true,
        }

        setResultado(
          resultadoFinal,
        )

        // Enviamos a la PC solamente los datos necesarios.
        // Las fotos y la ficha completa del vehículo se
        // reconstruyen allí con Supabase usando la placa.
        // Esto evita que Realtime falle por payloads grandes.
        await canalRef.current
          ?.send({
            type:
              'broadcast',

            event:
              'resultado_monitoreo',

            payload: {
              dispositivoId,

              nombreDispositivo,

              placa:
                resultadoFinal
                  .placa,

              confianza:
                resultadoFinal
                  .confianza,

              estado:
                resultadoFinal
                  .estado,

              vehiculoEncontrado:
                resultadoFinal
                  .vehiculoEncontrado,

              bbox:
                resultadoFinal
                  .bbox ||
                null,

              dimensiones:
                resultadoFinal
                  .dimensiones ||
                null,

              fecha:
                new Date()
                  .toISOString(),
            },
          })
      } catch (err) {
        console.error(
          'Error monitoreo móvil:',
          err,
        )

        setError(
          err?.message ||
          'No se pudo procesar la fotografía.',
        )
      } finally {
        setProcesando(
          false,
        )
      }
    }

  // ====================================================
  // IR A REGISTRAR VEHÍCULO
  // ====================================================

  const irARegistrarVehiculo =
    async () => {
      const parametros =
        new URLSearchParams({
          agregar:
            '1',
        })

      if (
        resultado?.placa &&
        resultado.placa !== '-'
      ) {
        parametros.set(
          'placa',
          resultado.placa,
        )
      }

      // Al salir del escáner móvil quitamos únicamente
      // este teléfono de la lista del administrador.
      await finalizarSesion({
        notificarAdministrador:
          true,
      })

      // El componente ListaVehiculos abre automáticamente
      // el formulario cuando recibe agregar=1.
      navigate(
        `/parqueadero/vehiculos?${parametros.toString()}`,
      )
    }

  // ====================================================
  // DATOS DEL RESULTADO
  // ====================================================

  const placa =
    resultado?.placa ||
    '-'

  const confianza =
    typeof resultado
      ?.confianza ===
    'number'
      ? `${resultado.confianza.toFixed(
          1,
        )} %`
      : '-'

  const encontrado =
    Boolean(
      resultado
        ?.vehiculoEncontrado,
    )

  const vehiculo =
    resultado?.vehiculo

  const autorizado =
    vehiculo?.autorizado

  const rectangulo =
    useMemo(
      () =>
        calcularRectangulo(
          resultado?.bbox,
          resultado?.dimensiones,
          dimensionesNaturales,
        ),
      [
        resultado?.bbox,
        resultado?.dimensiones,
        dimensionesNaturales,
      ],
    )

  // ====================================================
  // SESIÓN CERRADA
  // ====================================================

  if (sesionCerrada) {
    return (
      <div
        className="d-flex align-items-center justify-content-center p-4"
        style={{
          minHeight:
            '100vh',
          backgroundColor:
            '#0d1117',
        }}
      >
        <div
          className="w-100"
          style={{
            maxWidth:
              '440px',
          }}
        >
          <div className="text-center mb-4">
            <CIcon
              icon={cilMediaStop}
              size="4xl"
              className="text-danger mb-3"
            />

            <h3 className="text-white">
              Sesión finalizada
            </h3>

            <p className="text-body-secondary">
              Este teléfono ya no tiene acceso a la sesión anterior.
            </p>
          </div>

          {errorQr && (
            <CAlert
              color="warning"
            >
              {errorQr}
            </CAlert>
          )}

          {escaneandoQr && (
            <div
              className="border rounded overflow-hidden mb-3"
              style={{
                backgroundColor:
                  '#05070a',
              }}
            >
              <video
                ref={videoQrRef}
                autoPlay
                muted
                playsInline
                style={{
                  width:
                    '100%',
                  aspectRatio:
                    '1 / 1',
                  objectFit:
                    'cover',
                  display:
                    'block',
                }}
              />

              <div className="text-center text-body-secondary p-2">
                Apunte la cámara al QR generado por el administrador.
              </div>
            </div>
          )}

          {!escaneandoQr ? (
            <CButton
              color="primary"
              size="lg"
              className="w-100"
              onClick={
                iniciarEscanerQr
              }
            >
              <CIcon
                icon={cilQrCode}
                className="me-2"
              />

              Escanear QR
            </CButton>
          ) : (
            <CButton
              color="secondary"
              variant="outline"
              size="lg"
              className="w-100"
              onClick={
                detenerEscanerQr
              }
            >
              Detener escáner QR
            </CButton>
          )}
        </div>
      </div>
    )
  }

  // ====================================================
  // INTERFAZ MÓVIL LIMPIA
  // ====================================================

  return (
    <div
      style={{
        minHeight:
          '100vh',
        backgroundColor:
          '#0d1117',
        paddingTop:
          '16px',
        paddingBottom:
          '30px',
      }}
    >
      <CContainer
        style={{
          maxWidth:
            '620px',
        }}
      >
        {/* ============================================
            ESTADO DE CONEXIÓN
        ============================================ */}

        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h4 className="mb-0 text-white">
              Escáner de entrada
            </h4>

            <small className="text-body-secondary d-block">
              {nombreDispositivo}
            </small>

            <CBadge
              color={
                conectado
                  ? 'success'
                  : 'warning'
              }
              className="mt-2"
            >
              {conectado
                ? 'Sesión activa'
                : canalListo
                  ? 'Esperando PC'
                  : 'Conectando'}
            </CBadge>
          </div>

          <CButton
            color="danger"
            variant="outline"
            size="sm"
            disabled={
              !canalListo
            }
            onClick={
              cerrarSesionDesdeMovil
            }
          >
            Cerrar sesión
          </CButton>
        </div>

        {error && (
          <CAlert
            color="danger"
            dismissible
            onClose={() =>
              setError('')
            }
          >
            {error}
          </CAlert>
        )}

        {/* Inputs ocultos */}

        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/jpeg,image/png,image/*"
          onChange={seleccionarImagen}
          style={{
            display:
              'none',
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            display:
              'none',
          }}
        />

        {/* ============================================
            CÁMARA / PREVIEW
        ============================================ */}

        <CCard className="mb-3">
          <CCardBody className="p-2">
            {!previewImagen && (
              <div
                className="position-relative overflow-hidden rounded"
                style={{
                  width:
                    '100%',
                  aspectRatio:
                    '3 / 4',
                  maxHeight:
                    '62vh',
                  backgroundColor:
                    '#05070a',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width:
                      '100%',
                    height:
                      '100%',
                    objectFit:
                      'cover',
                    display:
                      camaraActiva
                        ? 'block'
                        : 'none',
                  }}
                />

                {!camaraActiva && (
                  <div className="position-absolute top-50 start-50 translate-middle text-center w-100 px-3">
                    <CIcon
                      icon={cilCamera}
                      size="4xl"
                      className="text-body-secondary mb-3"
                    />

                    <div className="text-body-secondary">
                      Active la cámara o seleccione una imagen.
                    </div>
                  </div>
                )}
              </div>
            )}

            {previewImagen && (
              <div
                style={{
                  position:
                    'relative',
                  width:
                    '100%',
                  lineHeight:
                    0,
                }}
              >
                <img
                  src={
                    resultado
                      ?.imagenMarcada ||
                    previewImagen
                  }
                  alt="Vehículo"
                  className="rounded w-100"
                  onLoad={(
                    evento,
                  ) => {
                    setDimensionesNaturales({
                      width:
                        evento
                          .currentTarget
                          .naturalWidth,
                      height:
                        evento
                          .currentTarget
                          .naturalHeight,
                    })
                  }}
                  style={{
                    display:
                      'block',
                    width:
                      '100%',
                    height:
                      'auto',
                    maxHeight:
                      '62vh',
                    objectFit:
                      'contain',
                  }}
                />

                {!resultado?.imagenMarcada &&
                  rectangulo && (
                    <div
                      style={{
                        position:
                          'absolute',
                        left:
                          `${rectangulo.left}%`,
                        top:
                          `${rectangulo.top}%`,
                        width:
                          `${rectangulo.width}%`,
                        height:
                          `${rectangulo.height}%`,
                        border:
                          '3px solid #00d26a',
                        borderRadius:
                          '3px',
                        boxShadow:
                          '0 0 0 1px rgba(0,0,0,.55), 0 0 8px rgba(0,210,106,.65)',
                        pointerEvents:
                          'none',
                        boxSizing:
                          'border-box',
                        zIndex:
                          5,
                      }}
                    />
                  )}
              </div>
            )}
          </CCardBody>
        </CCard>

        {/* ============================================
            SOLO LOS CONTROLES NECESARIOS
        ============================================ */}

        <div className="d-grid gap-2 mb-3">
          <CButton
            color="success"
            size="lg"
            disabled={
              !conectado ||
              iniciandoCamara ||
              camaraActiva ||
              procesando
            }
            onClick={activarCamara}
          >
            <CIcon
              icon={cilCamera}
              className="me-2"
            />

            {iniciandoCamara
              ? 'Activando cámara...'
              : 'Activar cámara'}
          </CButton>

          <CButton
            color="primary"
            size="lg"
            disabled={
              !conectado ||
              !camaraActiva ||
              procesando
            }
            onClick={capturarFotografia}
          >
            Capturar fotografía
          </CButton>

          <CButton
            color="danger"
            variant="outline"
            size="lg"
            disabled={
              !camaraActiva ||
              procesando
            }
            onClick={detenerCamara}
          >
            <CIcon
              icon={cilMediaStop}
              className="me-2"
            />

            Detener cámara
          </CButton>

          <CButton
            color="secondary"
            variant="outline"
            size="lg"
            disabled={
              !conectado ||
              procesando
            }
            onClick={() => {
              detenerStream()
              inputGaleriaRef
                .current
                ?.click()
            }}
          >
            Seleccionar imagen
          </CButton>

          <CButton
            color="success"
            size="lg"
            disabled={
              !conectado ||
              !archivoImagen ||
              procesando
            }
            onClick={detectarPlaca}
          >
            {procesando ? (
              <>
                <CSpinner
                  size="sm"
                  className="me-2"
                />

                Detectando...
              </>
            ) : (
              <>
                <CIcon
                  icon={cilCarAlt}
                  className="me-2"
                />

                Detectar placa
              </>
            )}
          </CButton>
        </div>

        {/* ============================================
            RESULTADO COMPLETO
        ============================================ */}

        {resultado && (
          <CCard>
            <CCardBody>
              {/* ======================================
                  ESTADO GENERAL
              ====================================== */}

              {encontrado ? (
                <CAlert
                  color={
                    autorizado ===
                    false
                      ? 'warning'
                      : 'success'
                  }
                  className="text-center"
                >
                  <strong>
                    {autorizado ===
                    false
                      ? 'VEHÍCULO REGISTRADO - NO AUTORIZADO'
                      : 'VEHÍCULO REGISTRADO'}
                  </strong>
                </CAlert>
              ) : placa !== '-' ? (
                <CAlert
                  color="danger"
                  className="text-center"
                >
                  <strong>
                    VEHÍCULO NO REGISTRADO
                  </strong>
                </CAlert>
              ) : (
                <CAlert
                  color="warning"
                  className="text-center"
                >
                  <strong>
                    PLACA NO DETECTADA
                  </strong>
                </CAlert>
              )}

              {/* ======================================
                  VEHÍCULO + PROPIETARIO
              ====================================== */}

              {encontrado &&
                vehiculo && (
                  <>
                    <div className="border rounded p-3 mb-3">
                      <h5 className="mb-3">
                        Datos del vehículo
                      </h5>

                      <CRow className="g-3">
                        <CCol xs={6}>
                          <div className="small text-body-secondary">
                            Marca
                          </div>

                          <strong>
                            {vehiculo.marca ||
                              '-'}
                          </strong>
                        </CCol>

                        <CCol xs={6}>
                          <div className="small text-body-secondary">
                            Modelo
                          </div>

                          <strong>
                            {vehiculo.modelo ||
                              '-'}
                          </strong>
                        </CCol>

                        <CCol xs={6}>
                          <div className="small text-body-secondary">
                            Año
                          </div>

                          <strong>
                            {vehiculo.anio ||
                              '-'}
                          </strong>
                        </CCol>

                        <CCol xs={6}>
                          <div className="small text-body-secondary">
                            Color
                          </div>

                          <strong>
                            {vehiculo.color ||
                              '-'}
                          </strong>
                        </CCol>

                        <CCol xs={12}>
                          <div className="small text-body-secondary">
                            Tipo
                          </div>

                          <strong>
                            {vehiculo.tipo ||
                              '-'}
                          </strong>
                        </CCol>
                      </CRow>

                      {vehiculo.foto_url && (
                        <div className="mt-3">
                          <div className="small text-body-secondary mb-2">
                            Fotografía del vehículo
                          </div>

                          <img
                            src={
                              vehiculo.foto_url
                            }
                            alt="Vehículo"
                            className="img-fluid rounded border w-100"
                            style={{
                              maxHeight:
                                '280px',
                              objectFit:
                                'cover',
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="border rounded p-3 mb-3">
                      <h5 className="mb-3">
                        Propietario
                      </h5>

                      <div className="d-flex align-items-start gap-3">
                        {vehiculo
                          .foto_propietario_url ? (
                          <img
                            src={
                              vehiculo
                                .foto_propietario_url
                            }
                            alt="Propietario"
                            className="rounded border flex-shrink-0"
                            style={{
                              width:
                                '105px',
                              height:
                                '105px',
                              objectFit:
                                'cover',
                            }}
                          />
                        ) : (
                          <div
                            className="rounded border d-flex justify-content-center align-items-center text-body-secondary flex-shrink-0"
                            style={{
                              width:
                                '105px',
                              height:
                                '105px',
                            }}
                          >
                            Sin foto
                          </div>
                        )}

                        <div className="flex-grow-1">
                          <div className="mb-2">
                            <div className="small text-body-secondary">
                              Nombres
                            </div>

                            <strong>
                              {vehiculo
                                .propietario_nombre ||
                                '-'}
                            </strong>
                          </div>

                          <div className="mb-2">
                            <div className="small text-body-secondary">
                              Cédula
                            </div>

                            <strong>
                              {vehiculo
                                .cedula_enmascarada ||
                                '-'}
                            </strong>
                          </div>

                          <div className="mb-2">
                            <div className="small text-body-secondary">
                              Correo
                            </div>

                            <strong
                              style={{
                                wordBreak:
                                  'break-word',
                              }}
                            >
                              {vehiculo
                                .correo_institucional ||
                                '-'}
                            </strong>
                          </div>

                          <div>
                            <div className="small text-body-secondary mb-1">
                              Autorización
                            </div>

                            <CBadge
                              color={
                                vehiculo.autorizado
                                  ? 'success'
                                  : 'danger'
                              }
                            >
                              {vehiculo.autorizado
                                ? 'AUTORIZADO'
                                : 'NO AUTORIZADO'}
                            </CBadge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              {/* ======================================
                  NO REGISTRADO / REGISTRO MANUAL
              ====================================== */}

              {!encontrado && (
                <div className="border rounded p-3 mb-3">
                  {placa !== '-' ? (
                    <>
                      <p className="mb-3">
                        La placa
                        {' '}
                        <strong>
                          {placa}
                        </strong>
                        {' '}
                        no existe en Supabase.
                        ¿Desea registrarla?
                      </p>

                      <CButton
                        color="primary"
                        className="w-100"
                        onClick={
                          irARegistrarVehiculo
                        }
                      >
                        <CIcon
                          icon={cilPlus}
                          className="me-2"
                        />

                        Agregar vehículo
                      </CButton>
                    </>
                  ) : (
                    <>
                      <p className="mb-3">
                        El OCR no pudo obtener una placa.
                        ¿Desea abrir el formulario para
                        registrarla manualmente?
                      </p>

                      <CButton
                        color="primary"
                        className="w-100"
                        onClick={
                          irARegistrarVehiculo
                        }
                      >
                        <CIcon
                          icon={cilPlus}
                          className="me-2"
                        />

                        Registrar manualmente
                      </CButton>
                    </>
                  )}
                </div>
              )}

              {/* ======================================
                  INFORMACIÓN DEL RECONOCIMIENTO
              ====================================== */}

              <div className="border rounded overflow-hidden mb-3">
                <div className="px-3 py-2 border-bottom fw-semibold">
                  Información del reconocimiento
                </div>

                <CRow className="g-0">
                  <CCol
                    xs={6}
                    className="p-3 border-end border-bottom"
                  >
                    <div className="small text-body-secondary">
                      Placa detectada
                    </div>

                    <strong>
                      {placa}
                    </strong>
                  </CCol>

                  <CCol
                    xs={6}
                    className="p-3 border-bottom"
                  >
                    <div className="small text-body-secondary">
                      Confianza OCR
                    </div>

                    <strong>
                      {confianza}
                    </strong>
                  </CCol>

                  <CCol
                    xs={6}
                    className="p-3 border-end"
                  >
                    <div className="small text-body-secondary">
                      Estado
                    </div>

                    <strong>
                      {resultado.estado ||
                        (encontrado
                          ? 'encontrado'
                          : 'no_registrado')}
                    </strong>
                  </CCol>

                  <CCol
                    xs={6}
                    className="p-3"
                  >
                    <div className="small text-body-secondary">
                      Vehículo encontrado
                    </div>

                    <strong
                      className={
                        encontrado
                          ? 'text-success'
                          : 'text-danger'
                      }
                    >
                      {encontrado
                        ? 'Sí'
                        : 'No'}
                    </strong>
                  </CCol>
                </CRow>
              </div>

              <CButton
                color="secondary"
                variant="outline"
                className="w-100"
                onClick={
                  limpiarCaptura
                }
              >
                Limpiar resultado
              </CButton>
            </CCardBody>
          </CCard>
        )}

      </CContainer>
    </div>
  )
}

export default MonitoreoEntradaMovil
