import React, { useMemo, useState } from 'react'

import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
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

// ======================================================
// CONFIGURACIÓN
// ======================================================

const COLUMNAS_PARQUEADERO = [
  'A',
  'B',
  'C',
  'D',
]

const FORMULARIO_INICIAL = {
  codigo: '',
  columna: '',
  numero: '',
  sensor_id_rtdb: '',
}

const ETIQUETAS_MODO_COLUMNA = {
  TODO_OCUPADO: 'Todo ocupado',
  VARIADO: 'Variado',
  TODO_LIBRE: 'Todo libre',
}

// ======================================================
// ORDENAR PUESTOS
// ======================================================

const ordenarPuestos = (lista = []) => {
  return [...lista].sort((a, b) => {
    const columnaA = String(
      a.columna ?? '',
    )
      .trim()
      .toUpperCase()

    const columnaB = String(
      b.columna ?? '',
    )
      .trim()
      .toUpperCase()

    let indiceA =
      COLUMNAS_PARQUEADERO.indexOf(
        columnaA,
      )

    let indiceB =
      COLUMNAS_PARQUEADERO.indexOf(
        columnaB,
      )

    if (indiceA === -1) {
      indiceA = 999
    }

    if (indiceB === -1) {
      indiceB = 999
    }

    if (indiceA !== indiceB) {
      return indiceA - indiceB
    }

    return (
      Number(a.numero ?? 0) -
      Number(b.numero ?? 0)
    )
  })
}

// ======================================================
// COMPONENTE
// ======================================================

const Puestos = () => {
  const {
    puestos,
    registros,

    cargando,
    error,
    simulando,

    modoSimulacion,

    modosColumnas,

    ocupacionManual,

    recargar,

    cambiarModoSimulacion,

    aplicarModoManualColumna,

    crearPuesto,
    actualizarPuesto,
    eliminarPuesto,
  } = usePuestos()

  // ====================================================
  // ESTADOS DE LA PÁGINA
  // ====================================================

  const [seccion, setSeccion] = useState(
    'estado',
  )

  const [busqueda, setBusqueda] = useState(
    '',
  )

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

  const [
    formulario,
    setFormulario,
  ] = useState(FORMULARIO_INICIAL)

  const [
    procesando,
    setProcesando,
  ] = useState(false)

  const [
    procesandoColumna,
    setProcesandoColumna,
  ] = useState(null)

  const [
    mensaje,
    setMensaje,
  ] = useState(null)

  // ====================================================
  // REGISTROS ACTIVOS DE SUPABASE
  // ====================================================

  const ocupacionesActuales =
    useMemo(() => {
      const mapa = new Map()

      registros.forEach((registro) => {
        if (
          registro.estado === 'ACTIVO' &&
          registro.fecha_salida === null &&
          !mapa.has(
            String(registro.puesto_id),
          )
        ) {
          mapa.set(
            String(registro.puesto_id),
            registro,
          )
        }
      })

      return mapa
    }, [registros])

  // ====================================================
  // COMPROBAR SI UN PUESTO ESTÁ FORZADO MANUALMENTE
  // ====================================================

  const estaOcupadoManual = (
    puesto,
  ) => {
    if (
      modoSimulacion !== 'manual'
    ) {
      return null
    }

    const columna = String(
      puesto.columna ?? '',
    )
      .trim()
      .toUpperCase()

    const configuracion =
      ocupacionManual?.[columna]

    // null significa:
    // esa columna todavía no ha sido modificada
    // manualmente.
    if (
      !Array.isArray(
        configuracion,
      )
    ) {
      return null
    }

    return configuracion.some(
      (id) =>
        String(id) ===
        String(puesto.id),
    )
  }

  // ====================================================
  // PUESTOS PROCESADOS
  //
  // EN MANUAL:
  // el control manual tiene prioridad.
  //
  // EN AUTOMÁTICO:
  // Supabase tiene prioridad.
  // ====================================================

  const puestosProcesados =
    useMemo(() => {
      const procesados =
        puestos.map((puesto) => {
          const registroBD =
            ocupacionesActuales.get(
              String(puesto.id),
            ) ?? null

          const estadoManual =
            estaOcupadoManual(
              puesto,
            )

          let ocupado

          if (
            estadoManual !== null
          ) {
            ocupado =
              estadoManual
          } else {
            ocupado =
              registroBD !== null
          }

          return {
            ...puesto,

            ocupado,

            registro:
              ocupado
                ? registroBD
                : null,

            ocupadoSoloManual:
              ocupado &&
              !registroBD &&
              estadoManual === true,
          }
        })

      return ordenarPuestos(
        procesados,
      )
    }, [
      puestos,
      ocupacionesActuales,
      ocupacionManual,
      modoSimulacion,
    ])

  // ====================================================
  // PUESTOS ORDENADOS
  // ====================================================

  const puestosOrdenados =
    useMemo(() => {
      return ordenarPuestos(
        puestos,
      )
    }, [puestos])

  // ====================================================
  // BÚSQUEDA
  // ====================================================

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
            vehiculo
              ?.propietario_nombre,
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

  // ====================================================
  // AGRUPAR COLUMNAS
  // ====================================================

  const puestosPorColumna =
    useMemo(() => {
      const grupos = {
        A: [],
        B: [],
        C: [],
        D: [],
      }

      puestosFiltrados.forEach(
        (puesto) => {
          const columna = String(
            puesto.columna ?? '',
          )
            .trim()
            .toUpperCase()

          if (grupos[columna]) {
            grupos[columna].push(
              puesto,
            )
          }
        },
      )

      COLUMNAS_PARQUEADERO.forEach(
        (columna) => {
          grupos[columna].sort(
            (a, b) =>
              Number(a.numero) -
              Number(b.numero),
          )
        },
      )

      return grupos
    }, [puestosFiltrados])

  // ====================================================
  // CONTADORES GENERALES
  // ====================================================

  const ocupados =
    puestosProcesados.filter(
      (puesto) =>
        puesto.ocupado,
    ).length

  const libres =
    puestosProcesados.filter(
      (puesto) =>
        !puesto.ocupado,
    ).length

  // ====================================================
  // CONTADORES POR COLUMNA
  // ====================================================

  const resumenColumnas =
    useMemo(() => {
      const resultado = {
        A: {
          total: 0,
          ocupados: 0,
          libres: 0,
        },

        B: {
          total: 0,
          ocupados: 0,
          libres: 0,
        },

        C: {
          total: 0,
          ocupados: 0,
          libres: 0,
        },

        D: {
          total: 0,
          ocupados: 0,
          libres: 0,
        },
      }

      puestosProcesados.forEach(
        (puesto) => {
          const columna = String(
            puesto.columna ?? '',
          )
            .trim()
            .toUpperCase()

          if (
            !resultado[columna]
          ) {
            return
          }

          resultado[
            columna
          ].total += 1

          if (
            puesto.ocupado
          ) {
            resultado[
              columna
            ].ocupados += 1
          } else {
            resultado[
              columna
            ].libres += 1
          }
        },
      )

      return resultado
    }, [puestosProcesados])

  // ====================================================
  // HISTORIAL
  // ====================================================

  const historialSeleccionado =
    useMemo(() => {
      if (!puestoHistorial) {
        return []
      }

      return registros
        .filter(
          (registro) =>
            String(
              registro.puesto_id,
            ) ===
            String(
              puestoHistorial.id,
            ),
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

  // ====================================================
  // DURACIÓN
  // ====================================================

  const calcularDuracion = (
    entrada,
    salida,
    duracionMinutos,
  ) => {
    if (
      duracionMinutos !== null &&
      duracionMinutos !== undefined
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

    if (!entrada) {
      return '-'
    }

    const inicio =
      new Date(entrada)

    const fin =
      salida
        ? new Date(salida)
        : new Date()

    const minutos =
      Math.max(
        0,
        Math.floor(
          (
            fin.getTime() -
            inicio.getTime()
          ) / 60000,
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

  // ====================================================
  // FORMATEAR FECHA
  // ====================================================

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

  // ====================================================
  // AUTOMÁTICO
  //
  // YA NO MOSTRAMOS MENSAJE.
  // ====================================================

  const activarAutomatico = () => {
    setMensaje(null)

    cambiarModoSimulacion(
      'automatico',
    )
  }

  // ====================================================
  // MANUAL
  //
  // YA NO MOSTRAMOS MENSAJE.
  // ====================================================

  const activarManual = () => {
    setMensaje(null)

    cambiarModoSimulacion(
      'manual',
    )
  }

  // ====================================================
  // CAMBIAR COLUMNA
  //
  // LOS MENSAJES DE ÉXITO FUERON ELIMINADOS.
  //
  // Solo aparece un mensaje si ocurre un error.
  // ====================================================

  const cambiarModoColumna =
    async (
      columna,
      modo,
    ) => {
      if (
        modoSimulacion !==
        'manual'
      ) {
        return
      }

      setMensaje(null)

      setProcesandoColumna(
        columna,
      )

      const resultado =
        await aplicarModoManualColumna(
          columna,
          modo,
        )

      setProcesandoColumna(
        null,
      )

      if (!resultado.ok) {
        setMensaje({
          color: 'danger',

          texto:
            resultado.mensaje,
        })
      }
    }

  // ====================================================
  // AGREGAR
  // ====================================================

  const abrirAgregar = () => {
    if (puestos.length >= 80) {
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

  // ====================================================
  // EDITAR
  // ====================================================

  const abrirEditar = (puesto) => {
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

  // ====================================================
  // CAMBIAR FORMULARIO
  // ====================================================

  const cambiarCampo = (evento) => {
    const {
      name,
      value,
    } = evento.target

    setFormulario(
      (anterior) => ({
        ...anterior,

        [name]:
          value,
      }),
    )
  }

  // ====================================================
  // GUARDAR
  // ====================================================

  const guardarPuesto = async () => {
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

    const columna =
      formulario.columna
        .trim()
        .toUpperCase()

    const numero =
      Number(
        formulario.numero,
      )

    if (
      !COLUMNAS_PARQUEADERO.includes(
        columna,
      )
    ) {
      setMensaje({
        color: 'danger',

        texto:
          'La columna solamente puede ser A, B, C o D.',
      })

      return
    }

    if (
      numero < 1 ||
      numero > 20
    ) {
      setMensaje({
        color: 'danger',

        texto:
          'El número debe estar entre 1 y 20.',
      })

      return
    }

    setProcesando(true)

    const datos = {
      codigo:
        formulario.codigo
          .trim()
          .toUpperCase(),

      columna,

      numero,

      sensor_id_rtdb:
        formulario.sensor_id_rtdb
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
      setModalFormulario(false)

      setPuestoEditando(null)

      setFormulario(
        FORMULARIO_INICIAL,
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

  // ====================================================
  // ELIMINAR
  // ====================================================

  const confirmarEliminar = async () => {
    if (!puestoEliminar) {
      return
    }

    const puestoProcesado =
      puestosProcesados.find(
        (puesto) =>
          String(puesto.id) ===
          String(
            puestoEliminar.id,
          ),
      )

    if (
      puestoProcesado?.ocupado
    ) {
      setMensaje({
        color: 'danger',

        texto:
          'No puede eliminar un puesto ocupado.',
      })

      setModalEliminar(false)

      return
    }

    setProcesando(true)

    const resultado =
      await eliminarPuesto(
        puestoEliminar.id,
      )

    setProcesando(false)

    if (resultado.ok) {
      setModalEliminar(false)

      setPuestoEliminar(null)
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

  // ====================================================
  // COLOR DEL CONTROL MANUAL
  // ====================================================

  const obtenerColorModoColumna =
    (modo) => {
      if (
        modo ===
        'TODO_OCUPADO'
      ) {
        return 'danger'
      }

      if (
        modo ===
        'TODO_LIBRE'
      ) {
        return 'success'
      }

      return 'warning'
    }

  // ====================================================
  // TARJETA DE PUESTO
  // ====================================================

  const renderizarPuesto = (puesto) => {
    const vehiculo =
      puesto.registro
        ?.vehiculos

    return (
      <CCard
        key={puesto.id}
        className={
          puesto.ocupado
            ? 'border-danger'
            : 'border-success'
        }
      >
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>
            {puesto.codigo}
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
            {puesto.columna}
          </div>

          <div className="mb-3">
            <strong>
              Número:
            </strong>{' '}
            {puesto.numero}
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
                {vehiculo.marca}{' '}
                {vehiculo.modelo}
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
          ) : puesto.ocupado ? (
            <div className="text-danger">
              Puesto ocupado
            </div>
          ) : (
            <div className="text-success">
              Disponible para estacionamiento
            </div>
          )}
        </CCardBody>
      </CCard>
    )
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <>
      {/* ==============================================
          MENSAJES

          Aquí solamente aparecerán errores,
          advertencias o mensajes CRUD.

          YA NO aparece:

          "Columna D: distribución variada..."

          ni ningún mensaje al cambiar manual.
      ============================================== */}

      {mensaje && (
        <CAlert
          color={mensaje.color}
          dismissible
          onClose={() =>
            setMensaje(null)
          }
        >
          {mensaje.texto}
        </CAlert>
      )}

      <CCard className="mb-4">
        {/* ============================================
            CABECERA
        ============================================ */}

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

            <div className="d-flex align-items-center flex-wrap gap-2">
              {/* ======================================
                  AUTOMÁTICO / MANUAL
              ====================================== */}

              <CButtonGroup>
                <CButton
                  color={
                    modoSimulacion ===
                    'automatico'
                      ? 'success'
                      : 'secondary'
                  }
                  variant={
                    modoSimulacion ===
                    'automatico'
                      ? undefined
                      : 'outline'
                  }
                  disabled={simulando}
                  onClick={
                    activarAutomatico
                  }
                >
                  Automático
                </CButton>

                <CButton
                  color={
                    modoSimulacion ===
                    'manual'
                      ? 'warning'
                      : 'secondary'
                  }
                  variant={
                    modoSimulacion ===
                    'manual'
                      ? undefined
                      : 'outline'
                  }
                  disabled={simulando}
                  onClick={
                    activarManual
                  }
                >
                  Manual
                </CButton>
              </CButtonGroup>

              <CButton
                color="success"
                onClick={recargar}
                disabled={
                  cargando ||
                  simulando
                }
              >
                <CIcon
                  icon={cilReload}
                  className="me-2"
                />

                Actualizar
              </CButton>
            </div>
          </div>
        </CCardHeader>

        <CCardBody>
          {/* ==========================================
              CONTADORES GENERALES
          ========================================== */}

          <CRow className="mb-4 g-3">
            <CCol md={4}>
              <CCard>
                <CCardBody>
                  <div className="text-body-secondary">
                    Total de puestos
                  </div>

                  <h2 className="mb-0">
                    {
                      puestos.length
                    }{' '}
                    / 80
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

          {/* ==========================================
              SECCIONES
          ========================================== */}

          <div className="d-flex flex-wrap gap-2 mb-4">
            <CButton
              color={
                seccion === 'estado'
                  ? 'primary'
                  : 'secondary'
              }
              variant={
                seccion === 'estado'
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

          {/* ==========================================
              EL MENSAJE AMARILLO DE:

              "Modo manual: la rotación automática..."

              FUE ELIMINADO COMPLETAMENTE.
          ========================================== */}

          {/* ==========================================
              CARGANDO
          ========================================== */}

          {cargando && (
            <div className="text-center py-5">
              <CSpinner />

              <p className="mt-3">
                Consultando puestos...
              </p>
            </div>
          )}

          {/* ==========================================
              ERROR
          ========================================== */}

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
                    value={busqueda}
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
                    {modoSimulacion ===
                    'automatico'
                      ? 'Rotación automática de vehículos cada 1 minuto'
                      : 'Control manual por columnas activado'}
                  </small>
                </div>

                {/* ====================================
                    COLUMNAS
                ==================================== */}

                <CRow className="g-3 align-items-start">
                  {COLUMNAS_PARQUEADERO.map(
                    (columna) => {
                      const modo =
                        modosColumnas?.[
                          columna
                        ] ||
                        'VARIADO'

                      const resumen =
                        resumenColumnas[
                          columna
                        ]

                      const procesandoEstaColumna =
                        procesandoColumna ===
                        columna

                      const tieneConfiguracionManual =
                        modoSimulacion ===
                          'manual' &&
                        Array.isArray(
                          ocupacionManual?.[
                            columna
                          ],
                        )

                      let textoBoton =
                        'Control manual'

                      if (
                        modoSimulacion ===
                        'manual'
                      ) {
                        textoBoton =
                          tieneConfiguracionManual
                            ? ETIQUETAS_MODO_COLUMNA[
                                modo
                              ]
                            : 'Seleccionar estado'
                      }

                      return (
                        <CCol
                          xs={12}
                          md={6}
                          lg={3}
                          key={
                            columna
                          }
                        >
                          {/* ==========================
                              CABECERA COLUMNA
                          ========================== */}

                          <CCard className="mb-3">
                            <CCardHeader>
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <strong>
                                  Columna{' '}
                                  {
                                    columna
                                  }
                                </strong>

                                <CBadge color="primary">
                                  {
                                    resumen.total
                                  }{' '}
                                  puestos
                                </CBadge>
                              </div>

                              {/* ======================
                                  CONTADORES COLUMNA
                              ====================== */}

                              <div className="d-flex justify-content-between small mb-2">
                                <span className="text-success">
                                  Libres:{' '}
                                  {
                                    resumen.libres
                                  }
                                </span>

                                <span className="text-danger">
                                  Ocupados:{' '}
                                  {
                                    resumen.ocupados
                                  }
                                </span>
                              </div>

                              {/* ======================
                                  OPCIONES
                              ====================== */}

                              <CDropdown className="w-100">
                                <CDropdownToggle
                                  color={
                                    modoSimulacion ===
                                      'manual' &&
                                    tieneConfiguracionManual
                                      ? obtenerColorModoColumna(
                                          modo,
                                        )
                                      : 'secondary'
                                  }
                                  size="sm"
                                  className="w-100"
                                  disabled={
                                    modoSimulacion !==
                                      'manual' ||
                                    simulando
                                  }
                                >
                                  {procesandoEstaColumna ? (
                                    <>
                                      <CSpinner
                                        size="sm"
                                        className="me-2"
                                      />

                                      Aplicando...
                                    </>
                                  ) : (
                                    textoBoton
                                  )}
                                </CDropdownToggle>

                                <CDropdownMenu className="w-100">
                                  {/* ==================
                                      TODO OCUPADO
                                  ================== */}

                                  <CDropdownItem
                                    active={
                                      tieneConfiguracionManual &&
                                      modo ===
                                        'TODO_OCUPADO'
                                    }
                                    onClick={() =>
                                      cambiarModoColumna(
                                        columna,
                                        'TODO_OCUPADO',
                                      )
                                    }
                                  >
                                    🚫 Todo ocupado
                                  </CDropdownItem>

                                  {/* ==================
                                      VARIADO
                                  ================== */}

                                  <CDropdownItem
                                    active={
                                      tieneConfiguracionManual &&
                                      modo ===
                                        'VARIADO'
                                    }
                                    onClick={() =>
                                      cambiarModoColumna(
                                        columna,
                                        'VARIADO',
                                      )
                                    }
                                  >
                                    🔄 Variado
                                  </CDropdownItem>

                                  {/* ==================
                                      TODO LIBRE
                                  ================== */}

                                  <CDropdownItem
                                    active={
                                      tieneConfiguracionManual &&
                                      modo ===
                                        'TODO_LIBRE'
                                    }
                                    onClick={() =>
                                      cambiarModoColumna(
                                        columna,
                                        'TODO_LIBRE',
                                      )
                                    }
                                  >
                                    ✅ Todo libre
                                  </CDropdownItem>
                                </CDropdownMenu>
                              </CDropdown>
                            </CCardHeader>
                          </CCard>

                          {/* ==========================
                              TARJETAS DE PUESTOS
                          ========================== */}

                          <div className="d-flex flex-column gap-3">
                            {puestosPorColumna[
                              columna
                            ].length ===
                            0 ? (
                              <CAlert
                                color="secondary"
                                className="mb-0"
                              >
                                No hay resultados.
                              </CAlert>
                            ) : (
                              puestosPorColumna[
                                columna
                              ].map(
                                (puesto) =>
                                  renderizarPuesto(
                                    puesto,
                                  ),
                              )
                            )}
                          </div>
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
                <h6 className="mb-3">
                  Seleccione un puesto
                </h6>

                {COLUMNAS_PARQUEADERO.map(
                  (columna) => {
                    const puestosColumna =
                      puestosOrdenados.filter(
                        (puesto) =>
                          String(
                            puesto.columna ??
                              '',
                          )
                            .trim()
                            .toUpperCase() ===
                          columna,
                      )

                    return (
                      <div
                        key={
                          columna
                        }
                        className="mb-3"
                      >
                        <div className="fw-semibold mb-2">
                          Columna{' '}
                          {
                            columna
                          }
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                          {puestosColumna.map(
                            (puesto) => (
                              <CButton
                                key={
                                  puesto.id
                                }
                                size="sm"
                                color={
                                  puestoHistorial
                                    ?.id ===
                                  puesto.id
                                    ? 'primary'
                                    : 'secondary'
                                }
                                variant={
                                  puestoHistorial
                                    ?.id ===
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
                      </div>
                    )
                  },
                )}

                {!puestoHistorial ? (
                  <CAlert color="info">
                    Seleccione un puesto para consultar su historial.
                  </CAlert>
                ) : (
                  <>
                    <h5 className="mb-3 mt-4">
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
                              colSpan={6}
                              className="text-center py-4"
                            >
                              Este puesto todavía no tiene registros.
                            </CTableDataCell>
                          </CTableRow>
                        ) : (
                          historialSeleccionado.map(
                            (registro) => {
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
                                    {vehiculo
                                      ?.placa ??
                                      registro.placa_detectada ??
                                      '-'}
                                  </CTableDataCell>

                                  <CTableDataCell>
                                    {vehiculo
                                      ?.propietario_nombre ??
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
                  <h5 className="mb-0">
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
                      icon={cilPlus}
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

      {/* ==============================================
          MODAL AGREGAR / EDITAR
      ============================================== */}

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
                maxLength={1}
              />

              <small className="text-body-secondary">
                A, B, C o D
              </small>
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
                max={20}
                placeholder="1"
              />

              <small className="text-body-secondary">
                Del 1 al 20
              </small>
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

      {/* ==============================================
          MODAL ELIMINAR
      ============================================== */}

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