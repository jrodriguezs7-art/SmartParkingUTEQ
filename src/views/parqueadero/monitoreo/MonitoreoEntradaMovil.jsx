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
  CContainer,
  CRow,
  CCol,
  CSpinner,
} from '@coreui/react'

import CIcon from '@coreui/icons-react'

import {
  cilCamera,
  cilCarAlt,
  cilReload,
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
// NORMALIZAR PLACA
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

// ======================================================
// FORMATEAR PLACA
// ======================================================

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

// ======================================================
// COMPONENTE MÓVIL
// ======================================================

const MonitoreoEntradaMovil = ({
  sesion,
}) => {
  // ====================================================
  // VEHÍCULOS
  // ====================================================

  const {
    vehiculos,
  } = useVehiculos()

  // ====================================================
  // REFERENCIAS
  // ====================================================

  const canalRef =
    useRef(null)

  const inputCamaraRef =
    useRef(null)

  const inputGaleriaRef =
    useRef(null)

  const previewUrlRef =
    useRef('')

  // ====================================================
  // ESTADOS
  // ====================================================

  const [
    conectado,
    setConectado,
  ] = useState(false)

  const [
    archivoImagen,
    setArchivoImagen,
  ] = useState(null)

  const [
    previewImagen,
    setPreviewImagen,
  ] = useState('')

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
  // BUSCAR VEHÍCULO LOCAL
  // ====================================================

  const buscarVehiculo =
    (placa) => {
      const buscada =
        normalizarPlaca(
          placa,
        )

      return (
        vehiculos.find(
          (vehiculo) =>
            normalizarPlaca(
              vehiculo.placa,
            ) === buscada,
        ) ?? null
      )
    }

  // ====================================================
  // LIBERAR PREVIEW
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
  // ESTABLECER FOTOGRAFÍA
  // ====================================================

  const establecerImagen =
    (archivo) => {
      try {
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

        setError('')
      } catch (err) {
        setError(
          err?.message ||
            'La imagen no es válida.',
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

      establecerImagen(
        archivo,
      )

      evento.target.value =
        ''
    }

  // ====================================================
  // CONEXIÓN REALTIME
  // ====================================================

  useEffect(() => {
    if (!sesion) {
      setError(
        'La sesión QR no es válida.',
      )

      return undefined
    }

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

    canal.subscribe(
      async (estado) => {
        if (
          estado ===
          'SUBSCRIBED'
        ) {
          setConectado(
            true,
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
  // DETECTAR PLACA
  // ====================================================

  const detectarPlaca =
    async () => {
      if (!archivoImagen) {
        setError(
          'Primero tome o seleccione una fotografía.',
        )

        return
      }

      if (!conectado) {
        setError(
          'No existe conexión con la PC.',
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

        // =============================================
        // API AZURE
        // =============================================

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

        // =============================================
        // COMPLETAR VEHÍCULO
        // =============================================

        const vehiculoLocal =
          placa
            ? buscarVehiculo(
                placa,
              )
            : null

        let vehiculo =
          normalizado.vehiculo

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
          null
            ? normalizado
                .vehiculoEncontrado
            : Boolean(
                vehiculo,
              )

        const resultadoFinal = {
          estado:
            normalizado.estado,

          placa,

          confianza:
            normalizado.confianza,

          vehiculoEncontrado:
            encontrado,

          vehiculo,

          imagenMarcada:
            normalizado
              .imagenMarcada,

          bbox:
            normalizado.bbox,

          dimensiones:
            normalizado
              .dimensiones,

          mensaje:
            normalizado.mensaje,

          apiOk:
            true,
        }

        setResultado(
          resultadoFinal,
        )

        // =============================================
        // ENVIAR RESULTADO A PC
        //
        // La imagen Base64 solamente se envía si
        // no es excesivamente grande.
        // =============================================

        let imagenParaPc =
          normalizado
            .imagenMarcada ||
          ''

        if (
          imagenParaPc.length >
          450000
        ) {
          imagenParaPc = ''
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

              origen:
                'telefono',
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
  // LIMPIAR
  // ====================================================

  const limpiar =
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

      setError('')
    }

  // ====================================================
  // LIMPIEZA
  // ====================================================

  useEffect(() => {
    return () => {
      liberarPreview()
    }
  }, [])

  // ====================================================
  // DATOS RESULTADO
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

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div
      style={{
        minHeight:
          '100vh',

        paddingTop:
          '20px',

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
              <strong>
                Monitoreo de entrada
              </strong>

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
            Tome una fotografía del vehículo completo.
            El sistema localizará automáticamente la
            matrícula.
          </CCardBody>
        </CCard>

        {/* ============================================
            ERROR
        ============================================ */}

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

        {/* ============================================
            CAPTURA
        ============================================ */}

        <CCard className="mb-3">
          <CCardHeader>
            <CIcon
              icon={cilCamera}
              className="me-2"
            />

            <strong>
              Fotografía del vehículo
            </strong>
          </CCardHeader>

          <CCardBody>
            {/* ========================================
                INPUT CÁMARA NATIVA
            ======================================== */}

            <input
              ref={
                inputCamaraRef
              }
              type="file"
              accept="image/jpeg,image/png,image/*"
              capture="environment"
              onChange={
                seleccionarImagen
              }
              style={{
                display:
                  'none',
              }}
            />

            {/* ========================================
                INPUT GALERÍA
            ======================================== */}

            <input
              ref={
                inputGaleriaRef
              }
              type="file"
              accept="image/jpeg,image/png"
              onChange={
                seleccionarImagen
              }
              style={{
                display:
                  'none',
              }}
            />

            {/* ========================================
                PREVIEW
            ======================================== */}

            {previewImagen ? (
              <img
                src={
                  resultado
                    ?.imagenMarcada ||
                  previewImagen
                }
                alt="Vehículo"
                className="img-fluid rounded border w-100 mb-3"
                style={{
                  maxHeight:
                    '550px',

                  objectFit:
                    'contain',
                }}
              />
            ) : (
              <div
                className="d-flex flex-column justify-content-center align-items-center text-center border rounded mb-3"
                style={{
                  minHeight:
                    '340px',
                }}
              >
                <CIcon
                  icon={cilCamera}
                  size="4xl"
                  className="text-body-secondary mb-3"
                />

                <h5>
                  Sin fotografía
                </h5>

                <div className="text-body-secondary px-3">
                  Tome una fotografía del automóvil
                  completo.
                </div>
              </div>
            )}

            {/* ========================================
                BOTONES
            ======================================== */}

            {!resultado && (
              <div className="d-grid gap-2">
                <CButton
                  color="success"
                  size="lg"
                  disabled={
                    procesando
                  }
                  onClick={() =>
                    inputCamaraRef
                      .current
                      ?.click()
                  }
                >
                  <CIcon
                    icon={cilCamera}
                    className="me-2"
                  />

                  Tomar fotografía
                </CButton>

                <CButton
                  color="secondary"
                  variant="outline"
                  disabled={
                    procesando
                  }
                  onClick={() =>
                    inputGaleriaRef
                      .current
                      ?.click()
                  }
                >
                  Seleccionar de galería
                </CButton>

                <CButton
                  color="primary"
                  size="lg"
                  disabled={
                    !archivoImagen ||
                    procesando ||
                    !conectado
                  }
                  onClick={
                    detectarPlaca
                  }
                >
                  {procesando ? (
                    <>
                      <CSpinner
                        size="sm"
                        className="me-2"
                      />

                      Procesando...
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
            )}

            {resultado && (
              <CButton
                color="success"
                className="w-100"
                size="lg"
                onClick={
                  limpiar
                }
              >
                <CIcon
                  icon={cilReload}
                  className="me-2"
                />

                Nueva captura
              </CButton>
            )}
          </CCardBody>
        </CCard>

        {/* ============================================
            RESULTADO MÓVIL
        ============================================ */}

        {resultado && (
          <CCard>
            <CCardHeader>
              <strong>
                Resultado
              </strong>
            </CCardHeader>

            <CCardBody>
              {encontrado ? (
                <CAlert color="success">
                  VEHÍCULO REGISTRADO
                </CAlert>
              ) : (
                <CAlert color="danger">
                  VEHÍCULO NO REGISTRADO
                </CAlert>
              )}

              <CRow className="g-3">
                <CCol xs={6}>
                  <div className="text-body-secondary">
                    Placa
                  </div>

                  <h4>
                    {placa}
                  </h4>
                </CCol>

                <CCol xs={6}>
                  <div className="text-body-secondary">
                    Confianza OCR
                  </div>

                  <strong>
                    {confianza}
                  </strong>
                </CCol>
              </CRow>

              {encontrado &&
                vehiculo && (
                  <>
                    <hr />

                    <h5>
                      Datos del vehículo
                    </h5>

                    <CRow className="g-3 mt-1">
                      <CCol xs={6}>
                        <div className="text-body-secondary">
                          Marca
                        </div>

                        <strong>
                          {vehiculo.marca ||
                            '-'}
                        </strong>
                      </CCol>

                      <CCol xs={6}>
                        <div className="text-body-secondary">
                          Modelo
                        </div>

                        <strong>
                          {vehiculo.modelo ||
                            '-'}
                        </strong>
                      </CCol>

                      <CCol xs={12}>
                        <div className="text-body-secondary">
                          Propietario
                        </div>

                        <strong>
                          {vehiculo
                            .propietario_nombre ||
                            '-'}
                        </strong>
                      </CCol>
                    </CRow>

                    {vehiculo.foto_url && (
                      <img
                        src={
                          vehiculo.foto_url
                        }
                        alt="Vehículo registrado"
                        className="img-fluid rounded border w-100 mt-3"
                      />
                    )}

                    {vehiculo
                      .foto_propietario_url && (
                      <img
                        src={
                          vehiculo
                            .foto_propietario_url
                        }
                        alt="Propietario"
                        className="img-fluid rounded border w-100 mt-3"
                        style={{
                          maxHeight:
                            '350px',

                          objectFit:
                            'contain',
                        }}
                      />
                    )}
                  </>
                )}
            </CCardBody>
          </CCard>
        )}
      </CContainer>
    </div>
  )
}

export default MonitoreoEntradaMovil