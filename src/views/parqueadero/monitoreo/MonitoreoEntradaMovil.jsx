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
// COMPONENTE MÓVIL
// ======================================================

const MonitoreoEntradaMovil = () => {
  const navigate =
    useNavigate()

  const [
    searchParams,
  ] = useSearchParams()

  const sesion =
    searchParams.get(
      'sesion',
    ) || ''

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
  // FINALIZAR SESIÓN DESDE LA PC
  // ====================================================

  const finalizarSesion =
    async () => {
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

      setError('')

      const canal =
        canalRef.current

      canalRef.current =
        null

      if (canal) {
        try {
          await supabase
            .removeChannel(
              canal,
            )
        } catch {
          // No hacemos nada: la sesión ya está cerrada.
        }
      }

      // Un navegador móvil no permite cerrar de forma fiable
      // una pestaña abierta por el usuario/QR con window.close().
      // La sustituimos por una página en blanco para sacar al
      // teléfono de Smart Parking. Si vuelve atrás, el QR antiguo
      // no recibirá una nueva confirmación desde la PC.
      window.setTimeout(
        () => {
          try {
            window.location.replace(
              'about:blank',
            )
          } catch {
            // Si el navegador no permite la redirección,
            // queda visible la pantalla de sesión cerrada.
          }
        },
        1600,
      )
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
      () => {
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
      },
    )

    // La PC cerró expresamente la sesión QR.
    canal.on(
      'broadcast',
      {
        event:
          'sesion_cerrada',
      },
      () => {
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
  }, [sesion]) // eslint-disable-line react-hooks/exhaustive-deps

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

        let imagenParaPc =
          normalizado
            .imagenMarcada ||
          ''

        if (
          imagenParaPc.length >
          450000
        ) {
          imagenParaPc =
            ''
        }

        await canalRef.current
          ?.send({
            type:
              'broadcast',

            event:
              'resultado_monitoreo',

            payload: {
              ...resultadoFinal,

              imagenMarcada:
                imagenParaPc,
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
    () => {
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

      // El componente ListaVehiculos ya abre automáticamente
      // el formulario cuando recibe agregar=1. Si existe una
      // placa reconocida también la precarga.
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
          className="text-center"
          style={{
            maxWidth:
              '420px',
          }}
        >
          <CIcon
            icon={cilMediaStop}
            size="4xl"
            className="text-danger mb-3"
          />

          <h3 className="text-white">
            Sesión finalizada
          </h3>

          <p className="text-body-secondary mb-0">
            La sesión QR fue cerrada desde la PC. La cámara ya no puede utilizarse con este código QR.
          </p>
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

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="mb-0 text-white">
              Escáner de entrada
            </h4>

            <small className="text-body-secondary">
              Cámara del teléfono
            </small>
          </div>

          <CBadge
            color={
              conectado
                ? 'success'
                : 'warning'
            }
          >
            {conectado
              ? 'Sesión activa'
              : canalListo
                ? 'Esperando PC'
                : 'Conectando'}
          </CBadge>
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
            RESULTADO COMPACTO
        ============================================ */}

        {resultado && (
          <CCard>
            <CCardBody>
              {encontrado ? (
                <CAlert
                  color="success"
                  className="text-center"
                >
                  <strong>
                    VEHÍCULO REGISTRADO
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

              <CRow className="g-3">
                <CCol xs={6}>
                  <div className="small text-body-secondary">
                    Placa
                  </div>

                  <strong>
                    {placa}
                  </strong>
                </CCol>

                <CCol xs={6}>
                  <div className="small text-body-secondary">
                    Confianza OCR
                  </div>

                  <strong>
                    {confianza}
                  </strong>
                </CCol>
              </CRow>

              {encontrado &&
                vehiculo && (
                  <div className="border rounded p-3 mt-3">
                    <strong>
                      {vehiculo.marca || '-'}{' '}
                      {vehiculo.modelo || ''}
                    </strong>

                    <div className="small text-body-secondary mt-1">
                      {vehiculo.propietario_nombre || '-'}
                    </div>
                  </div>
                )}

              {!encontrado && (
                <div className="mt-3">
                  {placa !== '-' ? (
                    <>
                      <p className="mb-2">
                        La placa <strong>{placa}</strong> no existe en Supabase. ¿Desea registrarla?
                      </p>

                      <CButton
                        color="primary"
                        className="w-100"
                        onClick={irARegistrarVehiculo}
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
                      <p className="mb-2">
                        El OCR no pudo obtener una placa. Puede abrir el formulario y escribirla manualmente.
                      </p>

                      <CButton
                        color="primary"
                        className="w-100"
                        onClick={irARegistrarVehiculo}
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

              <CButton
                color="secondary"
                variant="outline"
                className="w-100 mt-3"
                onClick={limpiarCaptura}
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
