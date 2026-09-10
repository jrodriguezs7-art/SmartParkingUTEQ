import React, {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'react-router-dom'

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
  cilReload,
} from '@coreui/icons'

import {
  QRCodeSVG,
} from 'qrcode.react'

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

import MonitoreoEntradaMovil
  from './MonitoreoEntradaMovil'

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

// ======================================================
// GENERAR SESIÓN QR
// ======================================================

const generarTokenSesion =
  () => {
    try {
      const datos =
        new Uint8Array(16)

      window.crypto
        .getRandomValues(
          datos,
        )

      return Array.from(
        datos,
      )
        .map(
          (numero) =>
            numero
              .toString(16)
              .padStart(
                2,
                '0',
              ),
        )
        .join('')
    } catch {
      return (
        Date.now()
          .toString(36) +
        Math.random()
          .toString(36)
          .slice(2)
      )
    }
  }

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

const MonitoreoEntrada = () => {
  const [
    searchParams,
  ] = useSearchParams()

  const esMovil =
    searchParams.get(
      'movil',
    ) === '1'

  const sesion =
    searchParams.get(
      'sesion',
    ) || ''

  // ====================================================
  // SI ES EL QR DEL TELÉFONO
  // ====================================================

  if (esMovil) {
    return (
      <MonitoreoEntradaMovil
        sesion={sesion}
      />
    )
  }

  return (
    <MonitoreoEntradaEscritorio />
  )
}

// ======================================================
// VISTA DE ESCRITORIO
// ======================================================

const MonitoreoEntradaEscritorio =
  () => {
    // ==================================================
    // VEHÍCULOS
    // ==================================================

    const {
      vehiculos,

      error:
        errorVehiculos,
    } = useVehiculos()

    const vehiculosRef =
      useRef([])

    useEffect(() => {
      vehiculosRef.current =
        vehiculos
    }, [vehiculos])

    // ==================================================
    // REFERENCIAS
    // ==================================================

    const videoRef =
      useRef(null)

    const canvasRef =
      useRef(null)

    const streamRef =
      useRef(null)

    const archivoInputRef =
      useRef(null)

    const previewUrlRef =
      useRef('')

    const canalMovilRef =
      useRef(null)

    // ==================================================
    // CAMBIAR ENTRE CÁMARA Y QR
    // ==================================================

    const [
      modoVista,
      setModoVista,
    ] = useState(
      'CAMARA',
    )

    // ==================================================
    // CÁMARA
    // ==================================================

    const [
      camaraActiva,
      setCamaraActiva,
    ] = useState(false)

    const [
      iniciandoCamara,
      setIniciandoCamara,
    ] = useState(false)

    // ==================================================
    // IMAGEN
    // ==================================================

    const [
      archivoImagen,
      setArchivoImagen,
    ] = useState(null)

    const [
      previewImagen,
      setPreviewImagen,
    ] = useState('')

    const [
      origenImagen,
      setOrigenImagen,
    ] = useState('')

    // ==================================================
    // RESULTADO
    // ==================================================

    const [
      procesando,
      setProcesando,
    ] = useState(false)

    const [
      resultado,
      setResultado,
    ] = useState(null)

    // ==================================================
    // ERRORES
    // ==================================================

    const [
      error,
      setError,
    ] = useState('')

    // ==================================================
    // QR
    // ==================================================

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

      const hostname =
        window.location
          .hostname

      if (
        hostname ===
          'localhost' ||
        hostname ===
          '127.0.0.1'
      ) {
        return ''
      }

      return window.location
        .origin
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

    // ==================================================
    // BUSCAR VEHÍCULO
    // ==================================================

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

    // ==================================================
    // COMPLETAR RESULTADO
    // ==================================================

    const completarResultado =
      (datos) => {
        const placa =
          formatearPlaca(
            datos?.placa ||
              '',
          )

        const vehiculoLocal =
          placa
            ? buscarVehiculo(
                placa,
              )
            : null

        let vehiculo =
          datos?.vehiculo ||
          null

        if (
          datos
            ?.vehiculoEncontrado !==
            false &&
          vehiculoLocal
        ) {
          vehiculo = {
            ...vehiculoLocal,
            ...(vehiculo ?? {}),
          }
        }

        const encontrado =
          datos
            ?.vehiculoEncontrado !==
          null &&
          datos
            ?.vehiculoEncontrado !==
          undefined
            ? Boolean(
                datos
                  .vehiculoEncontrado,
              )
            : Boolean(
                vehiculo,
              )

        return {
          ...datos,

          placa,

          vehiculoEncontrado:
            encontrado,

          vehiculo,
        }
      }

    // ==================================================
    // PREVIEW
    // ==================================================

    const liberarPreview =
      () => {
        if (
          previewUrlRef
            .current
        ) {
          URL.revokeObjectURL(
            previewUrlRef
              .current,
          )

          previewUrlRef.current =
            ''
        }
      }

    const establecerImagen =
      (
        archivo,
        origen,
      ) => {
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

        setOrigenImagen(
          origen,
        )

        setResultado(
          null,
        )

        setError('')
      }

    // ==================================================
    // ACTIVAR CÁMARA
    // ==================================================

    const activarCamara =
      async () => {
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
              'El navegador no permite utilizar la cámara.',
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

          liberarPreview()

          setArchivoImagen(
            null,
          )

          setPreviewImagen(
            '',
          )

          setOrigenImagen(
            '',
          )

          setResultado(
            null,
          )

          setCamaraActiva(
            true,
          )
        } catch (err) {
          console.error(
            err,
          )

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

          setCamaraActiva(
            false,
          )
        } finally {
          setIniciandoCamara(
            false,
          )
        }
      }

    // ==================================================
    // DETENER CÁMARA
    // ==================================================

    const detenerCamara =
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

    // ==================================================
    // CAMBIAR CÁMARA / QR
    // ==================================================

    const cambiarModoVista =
      () => {
        if (
          modoVista ===
          'CAMARA'
        ) {
          detenerCamara()

          setModoVista(
            'QR',
          )

          return
        }

        setModoVista(
          'CAMARA',
        )
      }

    // ==================================================
    // CAPTURAR FOTO
    // ==================================================

    const capturarFotografia =
      async () => {
        try {
          setError('')

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
            'CAMARA',
          )
        } catch (err) {
          setError(
            err?.message ||
              'No se pudo capturar la fotografía.',
          )
        }
      }

    // ==================================================
    // SELECCIONAR ARCHIVO
    // ==================================================

    const seleccionarArchivo =
      (evento) => {
        const archivo =
          evento.target
            .files?.[0]

        if (!archivo) {
          return
        }

        try {
          detenerCamara()

          establecerImagen(
            archivo,
            'ARCHIVO',
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

    // ==================================================
    // DETECTAR DESDE PC
    // ==================================================

    const detectarPlaca =
      async () => {
        if (!archivoImagen) {
          setError(
            'Capture o seleccione una imagen.',
          )

          return
        }

        try {
          setProcesando(
            true,
          )

          setError('')

          setResultado(
            null,
          )

          const respuesta =
            await detectarPlacaApi(
              archivoImagen,
            )

          const normalizado =
            normalizarRespuestaOcr(
              respuesta,
            )

          const final =
            completarResultado({
              ...normalizado,

              apiOk:
                true,

              origen:
                'pc',
            })

          setResultado(
            final,
          )
        } catch (err) {
          console.error(
            'Error API:',
            err,
          )

          setError(
            err?.message ||
              'No se pudo procesar la imagen.',
          )
        } finally {
          setProcesando(
            false,
          )
        }
      }

    // ==================================================
    // GENERAR QR
    // ==================================================

    const generarSesionMovil =
      async () => {
        try {
          setErrorMovil(
            '',
          )

          const base =
            urlBaseMovil
              .trim()
              .replace(
                /\/+$/,
                '',
              )

          if (!base) {
            setErrorMovil(
              'Ingrese la dirección de acceso desde el teléfono.',
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

          // ===========================================
          // CERRAR CANAL ANTERIOR
          // ===========================================

          if (
            canalMovilRef
              .current
          ) {
            await supabase
              .removeChannel(
                canalMovilRef
                  .current,
              )

            canalMovilRef.current =
              null
          }

          const token =
            generarTokenSesion()

          const url =
            `${base}/#/parqueadero/monitoreo-entrada?movil=1&sesion=${encodeURIComponent(
              token,
            )}`

          setUrlQr(
            url,
          )

          setEstadoMovil(
            'CONECTANDO',
          )

          // ===========================================
          // REALTIME
          // ===========================================

          const canal =
            supabase.channel(
              `smartparking-monitoreo-${token}`,
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

          // ===========================================
          // TELÉFONO CONECTADO
          // ===========================================

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

          // ===========================================
          // RESULTADO DESDE TELÉFONO
          // ===========================================

          canal.on(
            'broadcast',

            {
              event:
                'resultado_monitoreo',
            },

            ({
              payload,
            }) => {
              const final =
                completarResultado({
                  ...payload,

                  origen:
                    'telefono',

                  apiOk:
                    true,
                })

              setResultado(
                final,
              )

              setEstadoMovil(
                'RESULTADO',
              )
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

              if (
                estado ===
                'TIMED_OUT'
              ) {
                setEstadoMovil(
                  'ERROR',
                )

                setErrorMovil(
                  'La conexión agotó el tiempo de espera.',
                )
              }
            },
          )
        } catch (err) {
          console.error(
            'Error QR:',
            err,
          )

          setEstadoMovil(
            'ERROR',
          )

          setErrorMovil(
            err?.message ||
              'No se pudo crear la sesión móvil.',
          )
        }
      }

    // ==================================================
    // CERRAR QR
    // ==================================================

    const cerrarSesionMovil =
      async () => {
        if (
          canalMovilRef
            .current
        ) {
          await supabase
            .removeChannel(
              canalMovilRef
                .current,
            )

          canalMovilRef.current =
            null
        }

        setUrlQr(
          '',
        )

        setEstadoMovil(
          'SIN_SESION',
        )

        setErrorMovil(
          '',
        )
      }

    // ==================================================
    // LIMPIAR
    // ==================================================

    const limpiarResultado =
      () => {
        setResultado(
          null,
        )

        setError('')
      }

    const limpiarImagen =
      () => {
        liberarPreview()

        setArchivoImagen(
          null,
        )

        setPreviewImagen(
          '',
        )

        setOrigenImagen(
          '',
        )

        setResultado(
          null,
        )

        setError('')
      }

    // ==================================================
    // CLEANUP
    // ==================================================

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
          previewUrlRef
            .current
        ) {
          URL.revokeObjectURL(
            previewUrlRef
              .current,
          )
        }

        if (
          canalMovilRef
            .current
        ) {
          supabase.removeChannel(
            canalMovilRef
              .current,
          )
        }
      }
    }, [])

    // ==================================================
    // ESTADO QR
    // ==================================================

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
          return 'Resultado recibido'
        }

        if (
          estadoMovil ===
          'CONECTANDO'
        ) {
          return 'Conectando...'
        }

        if (
          estadoMovil ===
          'ERROR'
        ) {
          return 'Error'
        }

        return 'Sin sesión'
      }

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

    // ==================================================
    // RESULTADO
    // ==================================================

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

    const registrado =
      Boolean(
        resultado
          ?.vehiculoEncontrado,
      )

    const vehiculo =
      resultado?.vehiculo

    const autorizado =
      vehiculo?.autorizado

    // ==================================================
    // INTERFAZ
    // ==================================================

    return (
      <>
        {/* ============================================
            TÍTULO
        ============================================ */}

        <CCard className="mb-4">
          <CCardHeader>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h4 className="mb-1">
                  Monitoreo de entrada
                </h4>

                <div className="text-body-secondary">
                  Reconocimiento automático de placas.
                </div>
              </div>

              <CBadge color="primary">
                API REST
              </CBadge>
            </div>
          </CCardHeader>
        </CCard>

        {/* ============================================
            ERRORES
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

        {errorVehiculos && (
          <CAlert color="warning">
            Error consultando vehículos:
            {' '}
            {errorVehiculos}
          </CAlert>
        )}

        <CRow className="g-4 align-items-stretch">
          {/* ==========================================
              IZQUIERDA
          ========================================== */}

          <CCol
            xs={12}
            lg={6}
          >
            <CCard className="h-100">
              {/* ======================================
                  HEADER CÁMARA / QR
              ====================================== */}

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
                        ? 'Cámara de este equipo'
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
                        {
                          textoEstadoMovil()
                        }
                      </CBadge>
                    )}

                    {/* ================================
                        BOTÓN PRINCIPAL
                    ================================ */}

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
                        procesando
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
                {/* ====================================
                    MODO CÁMARA
                ==================================== */}

                {modoVista ===
                  'CAMARA' && (
                  <>
                    <input
                      ref={
                        archivoInputRef
                      }
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={
                        seleccionarArchivo
                      }
                      style={{
                        display:
                          'none',
                      }}
                    />

                    <canvas
                      ref={
                        canvasRef
                      }
                      style={{
                        display:
                          'none',
                      }}
                    />

                    {/* ================================
                        IMAGEN PROCESADA
                    ================================ */}

                    {resultado
                      ?.imagenMarcada ? (
                      <img
                        src={
                          resultado
                            .imagenMarcada
                        }
                        alt="Imagen procesada"
                        className="img-fluid rounded border w-100 mb-3"
                        style={{
                          maxHeight:
                            '580px',

                          objectFit:
                            'contain',
                        }}
                      />
                    ) : previewImagen ? (
                      <div className="mb-3">
                        <img
                          src={
                            previewImagen
                          }
                          alt="Vehículo"
                          className="img-fluid rounded border w-100"
                          style={{
                            maxHeight:
                              '580px',

                            objectFit:
                              'contain',
                          }}
                        />

                        <div className="text-body-secondary mt-2">
                          {origenImagen ===
                          'CAMARA'
                            ? 'Fotografía capturada desde la cámara.'
                            : 'Imagen seleccionada desde el dispositivo.'}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="position-relative overflow-hidden rounded border mb-3"
                        style={{
                          width:
                            '100%',

                          aspectRatio:
                            '4 / 3',

                          backgroundColor:
                            '#080b10',
                        }}
                      >
                        <video
                          ref={
                            videoRef
                          }
                          autoPlay
                          muted
                          playsInline
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
                              Active la cámara o seleccione una imagen.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ================================
                        PROCESANDO
                    ================================ */}

                    {procesando && (
                      <CAlert color="info">
                        <CSpinner
                          size="sm"
                          className="me-2"
                        />

                        Procesando imagen mediante la API...
                      </CAlert>
                    )}

                    {/* ================================
                        CONTROLES
                    ================================ */}

                    {!resultado && (
                      <>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          <CButton
                            color="success"
                            onClick={
                              activarCamara
                            }
                            disabled={
                              camaraActiva ||
                              iniciandoCamara ||
                              procesando
                            }
                          >
                            <CIcon
                              icon={
                                cilCamera
                              }
                              className="me-2"
                            />

                            {iniciandoCamara
                              ? 'Activando...'
                              : 'Activar cámara'}
                          </CButton>

                          <CButton
                            color="primary"
                            onClick={
                              capturarFotografia
                            }
                            disabled={
                              !camaraActiva ||
                              procesando
                            }
                          >
                            Capturar fotografía
                          </CButton>

                          <CButton
                            color="danger"
                            variant="outline"
                            onClick={
                              detenerCamara
                            }
                            disabled={
                              !camaraActiva ||
                              procesando
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
                        </div>

                        <div className="d-grid gap-2">
                          <CButton
                            color="secondary"
                            variant="outline"
                            onClick={() =>
                              archivoInputRef
                                .current
                                ?.click()
                            }
                            disabled={
                              procesando
                            }
                          >
                            Seleccionar imagen JPG o PNG
                          </CButton>

                          <CButton
                            color="success"
                            size="lg"
                            onClick={
                              detectarPlaca
                            }
                            disabled={
                              !archivoImagen ||
                              procesando
                            }
                          >
                            {procesando
                              ? 'Detectando...'
                              : 'Detectar placa'}
                          </CButton>

                          {archivoImagen && (
                            <CButton
                              color="secondary"
                              variant="ghost"
                              onClick={
                                limpiarImagen
                              }
                            >
                              <CIcon
                                icon={
                                  cilReload
                                }
                                className="me-2"
                              />

                              Limpiar imagen
                            </CButton>
                          )}
                        </div>
                      </>
                    )}

                    {resultado && (
                      <CButton
                        color="success"
                        className="w-100"
                        onClick={
                          limpiarImagen
                        }
                      >
                        <CIcon
                          icon={
                            cilReload
                          }
                          className="me-2"
                        />

                        Nueva captura
                      </CButton>
                    )}
                  </>
                )}

                {/* ====================================
                    MODO QR
                ==================================== */}

                {modoVista ===
                  'QR' && (
                  <>
                    {errorMovil && (
                      <CAlert color="warning">
                        {errorMovil}
                      </CAlert>
                    )}

                    {!urlQr ? (
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
                            Coloque la dirección Network de esta PC.
                          </div>
                        </div>

                        <div
                          className="d-flex flex-column justify-content-center align-items-center text-center border rounded"
                          style={{
                            minHeight:
                              '430px',
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
                            Genere el código QR para utilizar
                            la cámara del teléfono.
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
                    ) : (
                      <div
                        className="d-flex flex-column justify-content-center align-items-center text-center border rounded p-4"
                        style={{
                          minHeight:
                            '500px',
                        }}
                      >
                        <div className="bg-white rounded p-3 mb-4">
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
                    )}
                  </>
                )}
              </CCardBody>
            </CCard>
          </CCol>

          {/* ==========================================
              DERECHA - RESULTADO
          ========================================== */}

          <CCol
            xs={12}
            lg={6}
          >
            <CCard className="h-100">
              <CCardHeader>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <CIcon
                      icon={
                        cilCarAlt
                      }
                      className="me-2"
                    />

                    <strong>
                      Resultado del reconocimiento
                    </strong>
                  </div>

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
                {/* ====================================
                    SIN RESULTADO
                ==================================== */}

                {!resultado &&
                  !procesando && (
                    <div
                      className="d-flex flex-column justify-content-center align-items-center text-center"
                      style={{
                        minHeight:
                          '470px',
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
                        Sin reconocimiento
                      </h5>

                      <div className="text-body-secondary">
                        Utilice la cámara de la PC o
                        conecte un teléfono mediante QR.
                      </div>
                    </div>
                  )}

                {/* ====================================
                    PROCESANDO
                ==================================== */}

                {procesando && (
                  <div
                    className="d-flex flex-column justify-content-center align-items-center text-center"
                    style={{
                      minHeight:
                        '470px',
                    }}
                  >
                    <CSpinner
                      color="success"
                      className="mb-3"
                    />

                    <h5>
                      Analizando vehículo
                    </h5>
                  </div>
                )}

                {/* ====================================
                    RESULTADO
                ==================================== */}

                {resultado &&
                  !procesando && (
                    <>
                      {/* ==============================
                          ESTADO
                      ============================== */}

                      {registrado ? (
                        <CAlert
                          color={
                            autorizado ===
                            false
                              ? 'warning'
                              : 'success'
                          }
                          className="text-center"
                        >
                          <h4 className="mb-0">
                            {autorizado ===
                            false
                              ? 'VEHÍCULO REGISTRADO - NO AUTORIZADO'
                              : 'VEHÍCULO REGISTRADO'}
                          </h4>
                        </CAlert>
                      ) : placa !==
                        '-' ? (
                        <CAlert
                          color="danger"
                          className="text-center"
                        >
                          <h4 className="mb-0">
                            VEHÍCULO NO REGISTRADO
                          </h4>
                        </CAlert>
                      ) : (
                        <CAlert
                          color="warning"
                          className="text-center"
                        >
                          <h4 className="mb-0">
                            PLACA NO RECONOCIDA
                          </h4>
                        </CAlert>
                      )}

                      {/* ==============================
                          RESUMEN
                      ============================== */}

                      <div className="border rounded overflow-hidden mb-3">
                        <div className="d-flex justify-content-between p-3 border-bottom">
                          <span className="text-body-secondary">
                            Placa detectada
                          </span>

                          <strong>
                            {placa}
                          </strong>
                        </div>

                        <div className="d-flex justify-content-between p-3 border-bottom">
                          <span className="text-body-secondary">
                            Confianza OCR
                          </span>

                          <strong>
                            {confianza}
                          </strong>
                        </div>

                        <div className="d-flex justify-content-between p-3 border-bottom">
                          <span className="text-body-secondary">
                            Estado
                          </span>

                          <strong>
                            {resultado.estado ||
                              (registrado
                                ? 'encontrado'
                                : 'no_registrado')}
                          </strong>
                        </div>

                        <div className="d-flex justify-content-between p-3">
                          <span className="text-body-secondary">
                            Vehículo encontrado
                          </span>

                          <strong
                            className={
                              registrado
                                ? 'text-success'
                                : 'text-danger'
                            }
                          >
                            {registrado
                              ? 'Sí'
                              : 'No'}
                          </strong>
                        </div>
                      </div>

                      {/* ==============================
                          NO REGISTRADO
                      ============================== */}

                      {!registrado &&
                        placa !==
                          '-' && (
                          <CAlert color="danger">
                            <strong>
                              Ingreso no autorizado
                            </strong>

                            <div>
                              La placa no existe en Supabase.
                            </div>
                          </CAlert>
                        )}

                      {/* ==============================
                          DATOS DEL VEHÍCULO
                      ============================== */}

                      {registrado &&
                        vehiculo && (
                          <>
                            <hr />

                            <h5 className="mb-3">
                              Datos del vehículo
                            </h5>

                            <CRow className="g-3">
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

                              <CCol xs={6}>
                                <div className="text-body-secondary">
                                  Año
                                </div>

                                <strong>
                                  {vehiculo.anio ||
                                    '-'}
                                </strong>
                              </CCol>

                              <CCol xs={6}>
                                <div className="text-body-secondary">
                                  Color
                                </div>

                                <strong>
                                  {vehiculo.color ||
                                    '-'}
                                </strong>
                              </CCol>

                              <CCol xs={12}>
                                <div className="text-body-secondary">
                                  Tipo
                                </div>

                                <strong>
                                  {vehiculo.tipo ||
                                    '-'}
                                </strong>
                              </CCol>
                            </CRow>

                            {vehiculo.foto_url && (
                              <>
                                <div className="fw-semibold mt-4 mb-2">
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
                              </>
                            )}

                            <hr className="my-4" />

                            <h5>
                              Propietario
                            </h5>

                            <div className="mt-3">
                              <div className="text-body-secondary">
                                Nombre
                              </div>

                              <strong>
                                {vehiculo
                                  .propietario_nombre ||
                                  '-'}
                              </strong>
                            </div>

                            <div className="mt-3">
                              <div className="text-body-secondary">
                                Cédula
                              </div>

                              <strong>
                                {vehiculo
                                  .cedula_enmascarada ||
                                  '-'}
                              </strong>
                            </div>

                            <div className="mt-3">
                              <div className="text-body-secondary">
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
                                    '320px',

                                  objectFit:
                                    'contain',
                                }}
                              />
                            )}
                          </>
                        )}

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
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </>
    )
  }

export default MonitoreoEntrada