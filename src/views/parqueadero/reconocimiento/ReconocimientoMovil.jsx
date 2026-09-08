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
  CContainer,
  CRow,
  CSpinner,
} from '@coreui/react'

import CIcon from '@coreui/icons-react'

import {
  cilCamera,
  cilCarAlt,
  cilCheckCircle,
  cilReload,
  cilUser,
} from '@coreui/icons'

import {
  useLocation,
} from 'react-router-dom'

import {
  createWorker,
  PSM,
} from 'tesseract.js'

import {
  supabase,
} from '../../../lib/supabase'

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
// COMPONENTE
// ======================================================

const ReconocimientoMovil = () => {
  const location =
    useLocation()

  const parametros =
    new URLSearchParams(
      location.search,
    )

  const sesion =
    parametros.get(
      'sesion',
    ) ?? ''

  // ====================================================
  // REFERENCIAS
  // ====================================================

  const archivoRef =
    useRef(null)

  const canvasRef =
    useRef(null)

  const workerRef =
    useRef(null)

  const canalRef =
    useRef(null)

  // ====================================================
  // ESTADOS
  // ====================================================

  const [
    conectado,
    setConectado,
  ] = useState(false)

  const [
    procesando,
    setProcesando,
  ] = useState(false)

  const [
    progreso,
    setProgreso,
  ] = useState(0)

  const [
    estadoOcr,
    setEstadoOcr,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  const [
    imagen,
    setImagen,
  ] = useState('')

  const [
    placaDetectada,
    setPlacaDetectada,
  ] = useState('')

  const [
    resultadoPc,
    setResultadoPc,
  ] = useState(null)

  const [
    esperandoPc,
    setEsperandoPc,
  ] = useState(false)

  // ====================================================
  // CONECTAR CON PC
  // ====================================================

  useEffect(() => {
    if (!sesion) {
      setError(
        'El código QR no contiene una sesión válida.',
      )

      return undefined
    }

    const canal =
      supabase.channel(
        `smartparking-placas-${sesion}`,
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

    // ================================================
    // RESULTADO ENVIADO POR LA PC
    // ================================================

    canal.on(
      'broadcast',
      {
        event:
          'resultado_busqueda',
      },
      ({
        payload,
      }) => {
        setEsperandoPc(false)

        setResultadoPc(
          payload ?? null,
        )
      },
    )

    canal.subscribe(
      async (estado) => {
        if (
          estado ===
          'SUBSCRIBED'
        ) {
          setConectado(true)

          setError('')

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
          'CHANNEL_ERROR'
        ) {
          setConectado(false)

          setError(
            'No se pudo conectar con la PC.',
          )
        }

        if (
          estado ===
          'TIMED_OUT'
        ) {
          setConectado(false)

          setError(
            'La conexión con la PC agotó el tiempo de espera.',
          )
        }
      },
    )

    return () => {
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
  }, [sesion])

  // ====================================================
  // OCR
  // ====================================================

  const obtenerWorker =
    async () => {
      if (
        workerRef.current
      ) {
        return workerRef.current
      }

      setEstadoOcr(
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

                  setEstadoOcr(
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
  // PROCESAR FOTO
  // ====================================================

  const procesarImagen =
    (archivo) => {
      return new Promise(
        (
          resolve,
          reject,
        ) => {
          const url =
            URL.createObjectURL(
              archivo,
            )

          const foto =
            new Image()

          foto.onload =
            () => {
              try {
                const canvas =
                  canvasRef.current

                if (!canvas) {
                  throw new Error(
                    'No se pudo preparar la imagen.',
                  )
                }

                const maximoAncho =
                  1600

                const escala =
                  Math.min(
                    1,
                    maximoAncho /
                      foto.width,
                  )

                const anchoImagen =
                  Math.round(
                    foto.width *
                      escala,
                  )

                const altoImagen =
                  Math.round(
                    foto.height *
                      escala,
                  )

                const anchoRecorte =
                  Math.round(
                    anchoImagen *
                      0.85,
                  )

                const altoRecorte =
                  Math.round(
                    altoImagen *
                      0.45,
                  )

                const x =
                  Math.round(
                    (
                      anchoImagen -
                      anchoRecorte
                    ) / 2,
                  )

                const y =
                  Math.round(
                    (
                      altoImagen -
                      altoRecorte
                    ) / 2,
                  )

                canvas.width =
                  anchoRecorte

                canvas.height =
                  altoRecorte

                const contexto =
                  canvas.getContext(
                    '2d',
                    {
                      willReadFrequently:
                        true,
                    },
                  )

                const temporal =
                  document.createElement(
                    'canvas',
                  )

                temporal.width =
                  anchoImagen

                temporal.height =
                  altoImagen

                const contextoTemporal =
                  temporal.getContext(
                    '2d',
                  )

                contextoTemporal.drawImage(
                  foto,
                  0,
                  0,
                  anchoImagen,
                  altoImagen,
                )

                contexto.drawImage(
                  temporal,

                  x,
                  y,
                  anchoRecorte,
                  altoRecorte,

                  0,
                  0,
                  anchoRecorte,
                  altoRecorte,
                )

                const datosImagen =
                  contexto.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                  )

                const datos =
                  datosImagen.data

                for (
                  let indice = 0;
                  indice <
                  datos.length;
                  indice += 4
                ) {
                  const rojo =
                    datos[
                      indice
                    ]

                  const verde =
                    datos[
                      indice + 1
                    ]

                  const azul =
                    datos[
                      indice + 2
                    ]

                  let gris =
                    0.299 *
                      rojo +
                    0.587 *
                      verde +
                    0.114 *
                      azul

                  gris =
                    (
                      gris -
                      128
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

                  datos[
                    indice
                  ] = gris

                  datos[
                    indice + 1
                  ] = gris

                  datos[
                    indice + 2
                  ] = gris
                }

                contexto.putImageData(
                  datosImagen,
                  0,
                  0,
                )

                const resultado =
                  canvas.toDataURL(
                    'image/jpeg',
                    0.92,
                  )

                URL.revokeObjectURL(
                  url,
                )

                resolve(
                  resultado,
                )
              } catch (err) {
                URL.revokeObjectURL(
                  url,
                )

                reject(err)
              }
            }

          foto.onerror =
            () => {
              URL.revokeObjectURL(
                url,
              )

              reject(
                new Error(
                  'No se pudo abrir la fotografía.',
                ),
              )
            }

          foto.src =
            url
        },
      )
    }

  // ====================================================
  // FOTO
  // ====================================================

  const seleccionarFoto =
    async (evento) => {
      const archivo =
        evento.target
          .files?.[0]

      if (!archivo) {
        return
      }

      try {
        setProcesando(true)

        setError('')

        setResultadoPc(null)

        setPlacaDetectada('')

        setEsperandoPc(false)

        setProgreso(0)

        setEstadoOcr(
          'Preparando fotografía...',
        )

        const captura =
          await procesarImagen(
            archivo,
          )

        setImagen(
          captura,
        )

        const worker =
          await obtenerWorker()

        setEstadoOcr(
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

        console.log(
          'OCR móvil:',
          texto,
        )

        const placa =
          extraerPlaca(
            texto,
          )

        if (!placa) {
          setError(
            'No se pudo reconocer una matrícula válida. Tome otra fotografía más cerca.',
          )

          return
        }

        setPlacaDetectada(
          placa,
        )

        if (
          !canalRef.current ||
          !conectado
        ) {
          setError(
            'La matrícula fue detectada, pero se perdió la conexión con la PC.',
          )

          return
        }

        setEstadoOcr(
          'Enviando matrícula a la PC...',
        )

        setEsperandoPc(
          true,
        )

        const respuesta =
          await canalRef.current.send({
            type:
              'broadcast',

            event:
              'placa_detectada',

            payload: {
              placa,

              textoOcr:
                texto,

              origen:
                'telefono',

              fecha:
                new Date()
                  .toISOString(),
            },
          })

        if (
          respuesta !==
          'ok'
        ) {
          setEsperandoPc(
            false,
          )

          setError(
            'No se pudo enviar la matrícula a la PC.',
          )
        }
      } catch (err) {
        console.error(
          'Error móvil:',
          err,
        )

        setError(
          err?.message ||
            'No se pudo procesar la fotografía.',
        )
      } finally {
        setProcesando(false)

        setEstadoOcr('')

        setProgreso(0)

        if (
          archivoRef.current
        ) {
          archivoRef.current.value =
            ''
        }
      }
    }

  // ====================================================
  // ABRIR CÁMARA
  // ====================================================

  const abrirCamara = () => {
    setError('')

    setResultadoPc(null)

    archivoRef.current
      ?.click()
  }

  // ====================================================
  // LIMPIAR
  // ====================================================

  const limpiar = () => {
    setImagen('')

    setPlacaDetectada('')

    setResultadoPc(null)

    setError('')

    setEsperandoPc(false)
  }

  // ====================================================
  // CERRAR OCR
  // ====================================================

  useEffect(() => {
    return () => {
      if (
        workerRef.current
      ) {
        workerRef.current
          .terminate()
          .catch(() => {})

        workerRef.current =
          null
      }
    }
  }, [])

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div
      style={{
        minHeight:
          '100vh',

        backgroundColor:
          '#111827',

        paddingTop:
          '24px',

        paddingBottom:
          '40px',
      }}
    >
      <CContainer>
        {/* ============================================
            CABECERA
        ============================================ */}

        <CCard className="mb-3">
          <CCardHeader>
            <div className="d-flex justify-content-between align-items-center gap-2">
              <div>
                <h5 className="mb-1">
                  Escáner móvil de placas
                </h5>

                <small className="text-body-secondary">
                  Smart Parking UTEQ
                </small>
              </div>

              <CBadge
                color={
                  conectado
                    ? 'success'
                    : 'danger'
                }
              >
                {conectado
                  ? 'Conectado'
                  : 'Sin conexión'}
              </CBadge>
            </div>
          </CCardHeader>

          <CCardBody>
            Utilice la cámara del teléfono para
            fotografiar la matrícula.
          </CCardBody>
        </CCard>

        {error && (
          <CAlert
            color="warning"
            dismissible
            onClose={() =>
              setError('')
            }
          >
            {error}
          </CAlert>
        )}

        {/* ============================================
            CÁMARA
        ============================================ */}

        <CCard>
          <CCardHeader>
            <CIcon
              icon={cilCamera}
              className="me-2"
            />

            <strong>
              Cámara del teléfono
            </strong>
          </CCardHeader>

          <CCardBody>
            <input
              ref={archivoRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={
                seleccionarFoto
              }
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

            {!imagen && (
              <div
                className="d-flex flex-column justify-content-center align-items-center text-center border rounded mb-3"
                style={{
                  minHeight:
                    '300px',
                }}
              >
                <CIcon
                  icon={cilCamera}
                  size="4xl"
                  className="text-body-secondary mb-3"
                />

                <h5>
                  Fotografiar matrícula
                </h5>

                <p className="text-body-secondary px-3">
                  Procure que la placa ocupe gran
                  parte de la fotografía.
                </p>
              </div>
            )}

            {imagen && (
              <div className="mb-3">
                <img
                  src={imagen}
                  alt="Matrícula"
                  className="img-fluid rounded border w-100"
                />
              </div>
            )}

            {procesando && (
              <CAlert color="info">
                <div className="d-flex align-items-center">
                  <CSpinner
                    size="sm"
                    className="me-2"
                  />

                  <div>
                    <strong>
                      {estadoOcr ||
                        'Procesando...'}
                    </strong>

                    {progreso > 0 && (
                      <div>
                        {progreso} %
                      </div>
                    )}
                  </div>
                </div>
              </CAlert>
            )}

            <div className="d-grid gap-2">
              <CButton
                color="success"
                size="lg"
                onClick={
                  abrirCamara
                }
                disabled={
                  procesando ||
                  !conectado
                }
              >
                <CIcon
                  icon={cilCamera}
                  className="me-2"
                />

                {imagen
                  ? 'Tomar otra fotografía'
                  : 'Abrir cámara'}
              </CButton>

              {imagen && (
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={
                    limpiar
                  }
                  disabled={
                    procesando
                  }
                >
                  <CIcon
                    icon={cilReload}
                    className="me-2"
                  />

                  Limpiar
                </CButton>
              )}
            </div>
          </CCardBody>
        </CCard>

        {/* ============================================
            MATRÍCULA
        ============================================ */}

        {placaDetectada && (
          <CCard className="mt-3">
            <CCardHeader>
              <strong>
                Matrícula detectada
              </strong>
            </CCardHeader>

            <CCardBody className="text-center">
              <h1 className="mb-2">
                {
                  placaDetectada
                }
              </h1>

              {esperandoPc && (
                <div className="text-body-secondary">
                  <CSpinner
                    size="sm"
                    className="me-2"
                  />

                  Consultando vehículo...
                </div>
              )}
            </CCardBody>
          </CCard>
        )}

        {/* ============================================
            RESULTADO
        ============================================ */}

        {resultadoPc && (
          <CCard className="mt-3">
            <CCardHeader>
              <strong>
                Resultado
              </strong>
            </CCardHeader>

            <CCardBody>
              {resultadoPc.encontrado ? (
                <>
                  {/* ==================================
                      VEHÍCULO REGISTRADO
                  ================================== */}

                  <CAlert color="success">
                    <CIcon
                      icon={
                        cilCheckCircle
                      }
                      className="me-2"
                    />

                    Vehículo registrado
                  </CAlert>

                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h2 className="mb-0">
                      {
                        resultadoPc.placa
                      }
                    </h2>

                    <CBadge
                      color={
                        resultadoPc
                          .vehiculo
                          ?.autorizado
                          ? 'success'
                          : 'danger'
                      }
                    >
                      {resultadoPc
                        .vehiculo
                        ?.autorizado
                        ? 'AUTORIZADO'
                        : 'NO AUTORIZADO'}
                    </CBadge>
                  </div>

                  <hr />

                  {/* ==================================
                      DATOS DEL VEHÍCULO
                  ================================== */}

                  <div className="d-flex align-items-center mb-3">
                    <CIcon
                      icon={
                        cilCarAlt
                      }
                      className="me-2"
                    />

                    <h5 className="mb-0">
                      Datos del vehículo
                    </h5>
                  </div>

                  <CRow className="g-3">
                    <CCol xs={6}>
                      <div className="text-body-secondary">
                        Marca
                      </div>

                      <strong>
                        {
                          resultadoPc
                            .vehiculo
                            ?.marca ||
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
                          resultadoPc
                            .vehiculo
                            ?.modelo ||
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
                          resultadoPc
                            .vehiculo
                            ?.anio ||
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
                          resultadoPc
                            .vehiculo
                            ?.color ||
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
                          resultadoPc
                            .vehiculo
                            ?.tipo ||
                          '-'
                        }
                      </strong>
                    </CCol>
                  </CRow>

                  {/* ==================================
                      FOTO VEHÍCULO
                  ================================== */}

                  {resultadoPc
                    .vehiculo
                    ?.foto_url && (
                    <>
                      <div className="mt-4 mb-2 fw-semibold">
                        Vehículo registrado
                      </div>

                      <img
                        src={
                          resultadoPc
                            .vehiculo
                            .foto_url
                        }
                        alt="Vehículo registrado"
                        className="img-fluid rounded border w-100"
                        style={{
                          maxHeight:
                            '350px',

                          objectFit:
                            'cover',
                        }}
                      />
                    </>
                  )}

                  <hr className="my-4" />

                  {/* ==================================
                      PROPIETARIO
                  ================================== */}

                  <div className="d-flex align-items-center mb-3">
                    <CIcon
                      icon={
                        cilUser
                      }
                      className="me-2"
                    />

                    <h5 className="mb-0">
                      Propietario / usuario
                    </h5>
                  </div>

                  <CRow className="g-3">
                    <CCol xs={12}>
                      <div className="text-body-secondary">
                        Nombre
                      </div>

                      <strong>
                        {
                          resultadoPc
                            .vehiculo
                            ?.propietario_nombre ||
                          '-'
                        }
                      </strong>
                    </CCol>

                    <CCol xs={12}>
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
                          resultadoPc
                            .vehiculo
                            ?.correo_institucional ||
                          '-'
                        }
                      </strong>
                    </CCol>

                    {resultadoPc
                      .vehiculo
                      ?.cedula_enmascarada && (
                      <CCol xs={12}>
                        <div className="text-body-secondary">
                          Identificación
                        </div>

                        <strong>
                          {
                            resultadoPc
                              .vehiculo
                              .cedula_enmascarada
                          }
                        </strong>
                      </CCol>
                    )}
                  </CRow>

                  {/* ==================================
                      FOTO PROPIETARIO
                  ================================== */}

                  {resultadoPc
                    .vehiculo
                    ?.foto_propietario_url && (
                    <>
                      <div className="mt-4 mb-2 fw-semibold">
                        Propietario registrado
                      </div>

                      <div className="text-center">
                        <img
                          src={
                            resultadoPc
                              .vehiculo
                              .foto_propietario_url
                          }
                          alt="Propietario registrado"
                          className="img-fluid rounded border"
                          style={{
                            width:
                              '100%',

                            maxHeight:
                              '400px',

                            objectFit:
                              'contain',
                          }}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <CAlert color="danger">
                    Vehículo no registrado
                  </CAlert>

                  <h2>
                    {
                      resultadoPc.placa
                    }
                  </h2>

                  <p className="mb-0">
                    La matrícula fue reconocida,
                    pero no existe en la base de datos.
                  </p>
                </>
              )}
            </CCardBody>
          </CCard>
        )}
      </CContainer>
    </div>
  )
}

export default ReconocimientoMovil