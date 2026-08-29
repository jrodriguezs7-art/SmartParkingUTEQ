import React, {
  useMemo,
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
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

import CIcon from '@coreui/icons-react'

import {
  cilCarAlt,
  cilHistory,
  cilPencil,
  cilPlus,
  cilReload,
  cilTrash,
} from '@coreui/icons'

import { usePuestos } from '../../hooks/usePuestos'

const FORMULARIO_INICIAL = {
  codigo: '',
  columna: '',
  numero: '',
  sensor_id_rtdb: '',
}

const Puestos = () => {
  const {
    puestos,
    registros,
    cargando,
    error,
    recargar,
    crearPuesto,
    actualizarPuesto,
    eliminarPuesto,
  } = usePuestos()

  const [seccion, setSeccion] =
    useState('estado')

  const [busqueda, setBusqueda] =
    useState('')

  const [
    puestoHistorial,
    setPuestoHistorial,
  ] = useState(null)

  const [
    modalFormulario,
    setModalFormulario,
  ] = useState(false)

  const [
    puestoEditando,
    setPuestoEditando,
  ] = useState(null)

  const [
    puestoEliminar,
    setPuestoEliminar,
  ] = useState(null)

  const [
    modalEliminar,
    setModalEliminar,
  ] = useState(false)

  const [formulario, setFormulario] =
    useState(FORMULARIO_INICIAL)

  const [procesando, setProcesando] =
    useState(false)

  const [mensaje, setMensaje] =
    useState(null)

  // ==================================================
  // REGISTROS ACTIVOS
  // ==================================================

  const ocupacionesActuales =
    useMemo(() => {
      const mapa = new Map()

      registros.forEach(
        (registro) => {
          if (
            registro.estado ===
              'ACTIVO' &&
            registro.fecha_salida ===
              null &&
            !mapa.has(
              registro.puesto_id,
            )
          ) {
            mapa.set(
              registro.puesto_id,
              registro,
            )
          }
        },
      )

      return mapa
    }, [registros])

  // ==================================================
  // PUESTOS PROCESADOS
  // ==================================================

  const puestosProcesados =
    useMemo(() => {
      return puestos.map(
        (puesto) => ({
          ...puesto,

          ocupado:
            ocupacionesActuales.has(
              puesto.id,
            ),

          registro:
            ocupacionesActuales.get(
              puesto.id,
            ) ?? null,
        }),
      )
    }, [
      puestos,
      ocupacionesActuales,
    ])

  // ==================================================
  // BÚSQUEDA
  // ==================================================

  const puestosFiltrados =
    useMemo(() => {
      const texto =
        busqueda
          .trim()
          .toLowerCase()

      if (!texto) {
        return puestosProcesados
      }

      return puestosProcesados.filter(
        (puesto) => {
          const vehiculo =
            puesto.registro
              ?.vehiculos

          return [
            puesto.codigo,
            puesto.columna,
            puesto.numero,
            vehiculo?.placa,
            vehiculo?.marca,
            vehiculo?.modelo,
            vehiculo?.propietario_nombre,
          ].some((valor) =>
            String(valor ?? '')
              .toLowerCase()
              .includes(texto),
          )
        },
      )
    }, [
      puestosProcesados,
      busqueda,
    ])

  // ==================================================
  // CONTADORES
  // ==================================================

  const libres =
    puestosProcesados.filter(
      (puesto) =>
        !puesto.ocupado,
    ).length

  const ocupados =
    puestosProcesados.filter(
      (puesto) =>
        puesto.ocupado,
    ).length

  // ==================================================
  // HISTORIAL DEL PUESTO
  // ==================================================

  const historialSeleccionado =
    useMemo(() => {
      if (!puestoHistorial) {
        return []
      }

      return registros
        .filter(
          (registro) =>
            registro.puesto_id ===
            puestoHistorial.id,
        )
        .sort(
          (a, b) =>
            new Date(
              b.fecha_entrada,
            ) -
            new Date(
              a.fecha_entrada,
            ),
        )
    }, [
      registros,
      puestoHistorial,
    ])

  // ==================================================
  // DURACIÓN
  // ==================================================

  const calcularDuracion = (
    entrada,
    salida,
    duracionMinutos,
  ) => {
    /*
     * Si el registro ya terminó,
     * usamos la duración guardada
     * en Supabase.
     */
    if (
      duracionMinutos !== null &&
      duracionMinutos !==
        undefined
    ) {
      const minutos =
        Number(
          duracionMinutos,
        )

      const horas =
        Math.floor(
          minutos / 60,
        )

      const restantes =
        minutos % 60

      if (horas === 0) {
        return `${restantes} min`
      }

      if (restantes === 0) {
        return `${horas} h`
      }

      return `${horas} h ${restantes} min`
    }

    /*
     * Si sigue actualmente
     * estacionado, calculamos
     * cuánto lleva desde la entrada.
     */
    if (!entrada) {
      return '-'
    }

    const inicio =
      new Date(entrada)

    const fin = salida
      ? new Date(salida)
      : new Date()

    const diferencia =
      fin.getTime() -
      inicio.getTime()

    const minutos =
      Math.max(
        0,
        Math.floor(
          diferencia / 60000,
        ),
      )

    const horas =
      Math.floor(
        minutos / 60,
      )

    const restantes =
      minutos % 60

    if (horas === 0) {
      return `${restantes} min`
    }

    if (restantes === 0) {
      return `${horas} h`
    }

    return `${horas} h ${restantes} min`
  }

  // ==================================================
  // FECHAS
  // ==================================================

  const formatearFecha = (
    fecha,
    esSalida = false,
  ) => {
    if (!fecha) {
      return esSalida
        ? 'Actualmente estacionado'
        : '-'
    }

    return new Date(
      fecha,
    ).toLocaleString(
      'es-EC',
    )
  }

  // ==================================================
  // AGREGAR PUESTO
  // ==================================================

  const abrirAgregar = () => {
    if (
      puestos.length >= 80
    ) {
      setMensaje({
        color: 'warning',
        texto:
          'Ya existen los 80 puestos establecidos para el parqueadero.',
      })

      return
    }

    setPuestoEditando(null)

    setFormulario(
      FORMULARIO_INICIAL,
    )

    setModalFormulario(true)
  }

  // ==================================================
  // EDITAR PUESTO
  // ==================================================

  const abrirEditar = (
    puesto,
  ) => {
    setPuestoEditando(
      puesto,
    )

    setFormulario({
      codigo:
        puesto.codigo ?? '',

      columna:
        puesto.columna ?? '',

      numero:
        puesto.numero ?? '',

      sensor_id_rtdb:
        puesto.sensor_id_rtdb ??
        '',
    })

    setModalFormulario(true)
  }

  // ==================================================
  // CAMBIAR FORMULARIO
  // ==================================================

  const cambiarCampo = (
    evento,
  ) => {
    const {
      name,
      value,
    } = evento.target

    setFormulario(
      (anterior) => ({
        ...anterior,
        [name]: value,
      }),
    )
  }

  // ==================================================
  // GUARDAR PUESTO
  // ==================================================

  const guardarPuesto =
    async () => {
      if (
        !formulario.codigo.trim() ||
        !formulario.columna.trim() ||
        !formulario.numero
      ) {
        setMensaje({
          color: 'danger',
          texto:
            'Código, columna y número son obligatorios.',
        })

        return
      }

      setProcesando(true)

      const datos = {
        codigo:
          formulario.codigo
            .trim()
            .toUpperCase(),

        columna:
          formulario.columna
            .trim()
            .toUpperCase(),

        numero:
          Number(
            formulario.numero,
          ),

        sensor_id_rtdb:
          formulario
            .sensor_id_rtdb
            .trim() || null,
      }

      let resultado

      if (puestoEditando) {
        resultado =
          await actualizarPuesto(
            puestoEditando.id,
            datos,
          )
      } else {
        resultado =
          await crearPuesto(
            datos,
          )
      }

      setProcesando(false)

      if (resultado.ok) {
        setModalFormulario(
          false,
        )

        setFormulario(
          FORMULARIO_INICIAL,
        )

        setPuestoEditando(
          null,
        )
      }

      setMensaje({
        color:
          resultado.ok
            ? 'success'
            : 'danger',

        texto:
          resultado.mensaje,
      })
    }

  // ==================================================
  // ELIMINAR PUESTO
  // ==================================================

  const confirmarEliminar =
    async () => {
      if (!puestoEliminar) {
        return
      }

      if (
        ocupacionesActuales.has(
          puestoEliminar.id,
        )
      ) {
        setMensaje({
          color: 'danger',
          texto:
            'No puede eliminar un puesto que actualmente está ocupado.',
        })

        setModalEliminar(
          false,
        )

        return
      }

      setProcesando(true)

      const resultado =
        await eliminarPuesto(
          puestoEliminar.id,
        )

      setProcesando(false)

      if (resultado.ok) {
        setModalEliminar(
          false,
        )

        setPuestoEliminar(
          null,
        )
      }

      setMensaje({
        color:
          resultado.ok
            ? 'success'
            : 'danger',

        texto:
          resultado.mensaje,
      })
    }

  // ==================================================
  // INTERFAZ
  // ==================================================

  return (
    <>
      {mensaje && (
        <CAlert
          color={
            mensaje.color
          }
          dismissible
          onClose={() =>
            setMensaje(null)
          }
        >
          {mensaje.texto}
        </CAlert>
      )}

      <CCard className="mb-4">
        <CCardHeader>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">

            <div>
              <h5 className="mb-1">
                Gestión de puestos
              </h5>

              <div className="text-body-secondary">
                Smart Parking UTEQ
              </div>
            </div>

            <CButton
              color="success"
              onClick={recargar}
              disabled={cargando}
            >
              <CIcon
                icon={cilReload}
                className="me-2"
              />

              Actualizar
            </CButton>
          </div>
        </CCardHeader>

        <CCardBody>

          {/* CONTADORES */}

          <CRow className="mb-4 g-3">

            <CCol md={4}>
              <CCard>
                <CCardBody>
                  <div className="text-body-secondary">
                    Total de puestos
                  </div>

                  <h2 className="mb-0">
                    {puestos.length} / 80
                  </h2>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol md={4}>
              <CCard>
                <CCardBody>
                  <div className="text-body-secondary">
                    Puestos libres
                  </div>

                  <h2 className="text-success mb-0">
                    {libres}
                  </h2>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol md={4}>
              <CCard>
                <CCardBody>
                  <div className="text-body-secondary">
                    Puestos ocupados
                  </div>

                  <h2 className="text-danger mb-0">
                    {ocupados}
                  </h2>
                </CCardBody>
              </CCard>
            </CCol>

          </CRow>

          {/* BOTONES */}

          <div className="d-flex flex-wrap gap-2 mb-4">

            <CButton
              color={
                seccion ===
                'estado'
                  ? 'primary'
                  : 'secondary'
              }

              variant={
                seccion ===
                'estado'
                  ? undefined
                  : 'outline'
              }

              onClick={() =>
                setSeccion(
                  'estado',
                )
              }
            >
              <CIcon
                icon={cilCarAlt}
                className="me-2"
              />

              Estado actual
            </CButton>

            <CButton
              color={
                seccion ===
                'historial'
                  ? 'primary'
                  : 'secondary'
              }

              variant={
                seccion ===
                'historial'
                  ? undefined
                  : 'outline'
              }

              onClick={() =>
                setSeccion(
                  'historial',
                )
              }
            >
              <CIcon
                icon={cilHistory}
                className="me-2"
              />

              Historial
            </CButton>

            <CButton
              color={
                seccion ===
                'administrar'
                  ? 'primary'
                  : 'secondary'
              }

              variant={
                seccion ===
                'administrar'
                  ? undefined
                  : 'outline'
              }

              onClick={() =>
                setSeccion(
                  'administrar',
                )
              }
            >
              Administrar puestos
            </CButton>

          </div>

          {/* CARGA */}

          {cargando && (
            <div className="text-center py-5">

              <CSpinner />

              <p className="mt-3">
                Consultando puestos...
              </p>

            </div>
          )}

          {/* ERROR */}

          {!cargando &&
            error && (
              <CAlert color="danger">
                {error}
              </CAlert>
            )}

          {/* ==========================================
              ESTADO ACTUAL
          ========================================== */}

          {!cargando &&
            !error &&
            seccion ===
              'estado' && (
              <>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">

                  <CFormInput
                    type="search"
                    placeholder="Buscar puesto, placa, vehículo o propietario..."
                    value={
                      busqueda
                    }
                    onChange={(e) =>
                      setBusqueda(
                        e.target.value,
                      )
                    }
                    style={{
                      maxWidth:
                        '450px',
                    }}
                  />

                  <small className="text-body-secondary">
                    Rotación automática de vehículos cada 1 minuto
                  </small>

                </div>

                <CRow className="g-3">

                  {puestosFiltrados.map(
                    (puesto) => {
                      const vehiculo =
                        puesto
                          .registro
                          ?.vehiculos

                      return (
                        <CCol
                          xs={12}
                          sm={6}
                          lg={4}
                          xl={3}
                          key={
                            puesto.id
                          }
                        >
                          <CCard
                            className={
                              puesto.ocupado
                                ? 'border-danger h-100'
                                : 'border-success h-100'
                            }
                          >
                            <CCardHeader className="d-flex justify-content-between align-items-center">

                              <strong>
                                {
                                  puesto.codigo
                                }
                              </strong>

                              <CBadge
                                color={
                                  puesto.ocupado
                                    ? 'danger'
                                    : 'success'
                                }
                              >
                                {puesto.ocupado
                                  ? 'Ocupado'
                                  : 'Libre'}
                              </CBadge>

                            </CCardHeader>

                            <CCardBody>

                              <div className="mb-2">
                                <strong>
                                  Columna:
                                </strong>{' '}
                                {
                                  puesto.columna
                                }
                              </div>

                              <div className="mb-3">
                                <strong>
                                  Número:
                                </strong>{' '}
                                {
                                  puesto.numero
                                }
                              </div>

                              {puesto.ocupado &&
                              vehiculo ? (
                                <>
                                  <hr />

                                  <div>
                                    <strong>
                                      Vehículo
                                    </strong>
                                  </div>

                                  <div>
                                    {
                                      vehiculo.marca
                                    }{' '}
                                    {
                                      vehiculo.modelo
                                    }
                                  </div>

                                  <div className="mt-2">
                                    <strong>
                                      Placa:
                                    </strong>{' '}

                                    <CBadge color="dark">
                                      {
                                        vehiculo.placa
                                      }
                                    </CBadge>

                                  </div>

                                  <div className="mt-2">
                                    <strong>
                                      Propietario:
                                    </strong>

                                    <div>
                                      {
                                        vehiculo.propietario_nombre
                                      }
                                    </div>

                                  </div>
                                </>
                              ) : (
                                <div className="text-success">
                                  Disponible para estacionamiento
                                </div>
                              )}

                            </CCardBody>
                          </CCard>
                        </CCol>
                      )
                    },
                  )}

                </CRow>
              </>
            )}

          {/* ==========================================
              HISTORIAL
          ========================================== */}

          {!cargando &&
            !error &&
            seccion ===
              'historial' && (
              <>

                <h6>
                  Seleccione un puesto
                </h6>

                <div className="d-flex flex-wrap gap-2 mb-4">

                  {puestos.map(
                    (puesto) => (
                      <CButton
                        key={
                          puesto.id
                        }

                        size="sm"

                        color={
                          puestoHistorial?.id ===
                          puesto.id
                            ? 'primary'
                            : 'secondary'
                        }

                        variant={
                          puestoHistorial?.id ===
                          puesto.id
                            ? undefined
                            : 'outline'
                        }

                        onClick={() =>
                          setPuestoHistorial(
                            puesto,
                          )
                        }
                      >
                        {
                          puesto.codigo
                        }
                      </CButton>
                    ),
                  )}

                </div>

                {!puestoHistorial ? (
                  <CAlert color="info">
                    Seleccione un puesto para consultar su historial.
                  </CAlert>
                ) : (
                  <>

                    <h5 className="mb-3">
                      Historial del puesto{' '}
                      {
                        puestoHistorial.codigo
                      }
                    </h5>

                    <CTable
                      responsive
                      bordered
                      hover
                    >

                      <CTableHead color="dark">

                        <CTableRow>

                          <CTableHeaderCell>
                            Vehículo
                          </CTableHeaderCell>

                          <CTableHeaderCell>
                            Placa
                          </CTableHeaderCell>

                          <CTableHeaderCell>
                            Propietario
                          </CTableHeaderCell>

                          <CTableHeaderCell>
                            Entrada
                          </CTableHeaderCell>

                          <CTableHeaderCell>
                            Salida
                          </CTableHeaderCell>

                          <CTableHeaderCell>
                            Tiempo estacionado
                          </CTableHeaderCell>

                        </CTableRow>

                      </CTableHead>

                      <CTableBody>

                        {historialSeleccionado.length ===
                        0 ? (

                          <CTableRow>

                            <CTableDataCell
                              colSpan={
                                6
                              }
                              className="text-center py-4"
                            >
                              Este puesto todavía no tiene registros.
                            </CTableDataCell>

                          </CTableRow>

                        ) : (

                          historialSeleccionado.map(
                            (
                              registro,
                            ) => {
                              const vehiculo =
                                registro.vehiculos

                              return (
                                <CTableRow
                                  key={
                                    registro.id
                                  }
                                >

                                  <CTableDataCell>
                                    {vehiculo
                                      ? `${vehiculo.marca} ${vehiculo.modelo}`
                                      : '-'}
                                  </CTableDataCell>

                                  <CTableDataCell>
                                    {vehiculo?.placa ??
                                      registro.placa_detectada ??
                                      '-'}
                                  </CTableDataCell>

                                  <CTableDataCell>
                                    {vehiculo?.propietario_nombre ??
                                      '-'}
                                  </CTableDataCell>

                                  <CTableDataCell>
                                    {formatearFecha(
                                      registro.fecha_entrada,
                                      false,
                                    )}
                                  </CTableDataCell>

                                  <CTableDataCell>
                                    {formatearFecha(
                                      registro.fecha_salida,
                                      true,
                                    )}
                                  </CTableDataCell>

                                  <CTableDataCell>
                                    {calcularDuracion(
                                      registro.fecha_entrada,
                                      registro.fecha_salida,
                                      registro.duracion_minutos,
                                    )}
                                  </CTableDataCell>

                                </CTableRow>
                              )
                            },
                          )

                        )}

                      </CTableBody>

                    </CTable>
                  </>
                )}

              </>
            )}

          {/* ==========================================
              ADMINISTRAR
          ========================================== */}

          {!cargando &&
            !error &&
            seccion ===
              'administrar' && (
              <>

                <div className="d-flex justify-content-between align-items-center mb-3">

                  <h5>
                    Administración de puestos
                  </h5>

                  <CButton
                    color="primary"
                    onClick={
                      abrirAgregar
                    }
                    disabled={
                      puestos.length >=
                      80
                    }
                  >
                    <CIcon
                      icon={
                        cilPlus
                      }
                      className="me-2"
                    />

                    Agregar puesto
                  </CButton>

                </div>

                <CTable
                  responsive
                  bordered
                  hover
                >

                  <CTableHead color="dark">

                    <CTableRow>

                      <CTableHeaderCell>
                        Código
                      </CTableHeaderCell>

                      <CTableHeaderCell>
                        Columna
                      </CTableHeaderCell>

                      <CTableHeaderCell>
                        Número
                      </CTableHeaderCell>

                      <CTableHeaderCell>
                        Sensor
                      </CTableHeaderCell>

                      <CTableHeaderCell>
                        Estado
                      </CTableHeaderCell>

                      <CTableHeaderCell>
                        Acciones
                      </CTableHeaderCell>

                    </CTableRow>

                  </CTableHead>

                  <CTableBody>

                    {puestosProcesados.map(
                      (puesto) => (
                        <CTableRow
                          key={
                            puesto.id
                          }
                        >

                          <CTableDataCell>
                            <strong>
                              {
                                puesto.codigo
                              }
                            </strong>
                          </CTableDataCell>

                          <CTableDataCell>
                            {
                              puesto.columna
                            }
                          </CTableDataCell>

                          <CTableDataCell>
                            {
                              puesto.numero
                            }
                          </CTableDataCell>

                          <CTableDataCell>
                            {
                              puesto.sensor_id_rtdb ??
                              '-'
                            }
                          </CTableDataCell>

                          <CTableDataCell>
                            <CBadge
                              color={
                                puesto.ocupado
                                  ? 'danger'
                                  : 'success'
                              }
                            >
                              {puesto.ocupado
                                ? 'Ocupado'
                                : 'Libre'}
                            </CBadge>
                          </CTableDataCell>

                          <CTableDataCell>

                            <div className="d-flex gap-2">

                              <CButton
                                color="warning"
                                size="sm"
                                onClick={() =>
                                  abrirEditar(
                                    puesto,
                                  )
                                }
                              >
                                <CIcon
                                  icon={
                                    cilPencil
                                  }
                                />
                              </CButton>

                              <CButton
                                color="danger"
                                size="sm"
                                onClick={() => {
                                  setPuestoEliminar(
                                    puesto,
                                  )

                                  setModalEliminar(
                                    true,
                                  )
                                }}
                              >
                                <CIcon
                                  icon={
                                    cilTrash
                                  }
                                />
                              </CButton>

                            </div>

                          </CTableDataCell>

                        </CTableRow>
                      ),
                    )}

                  </CTableBody>

                </CTable>
              </>
            )}

        </CCardBody>
      </CCard>

      {/* ==========================================
          MODAL AGREGAR / EDITAR
      ========================================== */}

      <CModal
        visible={
          modalFormulario
        }

        onClose={() =>
          setModalFormulario(
            false,
          )
        }
      >

        <CModalHeader>

          <CModalTitle>
            {puestoEditando
              ? 'Editar puesto'
              : 'Agregar puesto'}
          </CModalTitle>

        </CModalHeader>

        <CModalBody>

          <CRow className="g-3">

            <CCol md={6}>

              <CFormLabel>
                Código *
              </CFormLabel>

              <CFormInput
                name="codigo"
                value={
                  formulario.codigo
                }
                onChange={
                  cambiarCampo
                }
                placeholder="A01"
              />

            </CCol>

            <CCol md={6}>

              <CFormLabel>
                Columna *
              </CFormLabel>

              <CFormInput
                name="columna"
                value={
                  formulario.columna
                }
                onChange={
                  cambiarCampo
                }
                placeholder="A"
              />

            </CCol>

            <CCol md={6}>

              <CFormLabel>
                Número *
              </CFormLabel>

              <CFormInput
                type="number"
                name="numero"
                value={
                  formulario.numero
                }
                onChange={
                  cambiarCampo
                }
                min={1}
                placeholder="1"
              />

            </CCol>

            <CCol md={6}>

              <CFormLabel>
                Sensor
              </CFormLabel>

              <CFormInput
                name="sensor_id_rtdb"
                value={
                  formulario.sensor_id_rtdb
                }
                onChange={
                  cambiarCampo
                }
                placeholder="parking_A_01"
              />

            </CCol>

          </CRow>

        </CModalBody>

        <CModalFooter>

          <CButton
            color="secondary"
            variant="outline"
            disabled={
              procesando
            }
            onClick={() =>
              setModalFormulario(
                false,
              )
            }
          >
            Cancelar
          </CButton>

          <CButton
            color="success"
            disabled={
              procesando
            }
            onClick={
              guardarPuesto
            }
          >

            {procesando && (
              <CSpinner
                size="sm"
                className="me-2"
              />
            )}

            {puestoEditando
              ? 'Guardar cambios'
              : 'Registrar'}

          </CButton>

        </CModalFooter>

      </CModal>

      {/* ==========================================
          MODAL ELIMINAR
      ========================================== */}

      <CModal
        visible={
          modalEliminar
        }

        onClose={() =>
          setModalEliminar(
            false,
          )
        }
      >

        <CModalHeader>

          <CModalTitle>
            Eliminar puesto
          </CModalTitle>

        </CModalHeader>

        <CModalBody>

          {puestoEliminar && (
            <>

              <p>
                ¿Está seguro de eliminar el puesto{' '}
                <strong>
                  {
                    puestoEliminar.codigo
                  }
                </strong>
                ?
              </p>

              <CAlert color="warning">
                Esta operación no se puede deshacer.
              </CAlert>

            </>
          )}

        </CModalBody>

        <CModalFooter>

          <CButton
            color="secondary"
            variant="outline"
            disabled={
              procesando
            }
            onClick={() =>
              setModalEliminar(
                false,
              )
            }
          >
            Cancelar
          </CButton>

          <CButton
            color="danger"
            disabled={
              procesando
            }
            onClick={
              confirmarEliminar
            }
          >

            {procesando && (
              <CSpinner
                size="sm"
                className="me-2"
              />
            )}

            Eliminar

          </CButton>

        </CModalFooter>

      </CModal>
    </>
  )
}

export default Puestos