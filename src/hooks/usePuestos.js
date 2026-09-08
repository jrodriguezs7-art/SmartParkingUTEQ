import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from '../lib/supabase'

// =====================================================
// CONFIGURACIÓN
// =====================================================

const INTERVALO_SIMULACION = 60 * 1000

const MINIMO_OCUPADOS_AUTOMATICO = 15
const MAXIMO_OCUPADOS_AUTOMATICO = 25

const MINIMO_VARIADO = 5
const MAXIMO_VARIADO = 10

const COLUMNAS = ['A', 'B', 'C', 'D']

const CLAVE_MODO_SIMULACION = 'smartparking_modo_simulacion'

const CLAVE_MODOS_COLUMNAS = 'smartparking_modos_columnas'

const CLAVE_OCUPACION_MANUAL = 'smartparking_ocupacion_manual'

const MODOS_COLUMNAS_INICIALES = {
  A: 'VARIADO',
  B: 'VARIADO',
  C: 'VARIADO',
  D: 'VARIADO',
}

const OCUPACION_MANUAL_INICIAL = {
  A: null,
  B: null,
  C: null,
  D: null,
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

const mezclar = (elementos = []) => {
  const copia = [...elementos]

  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))

    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }

  return copia
}

const numeroAleatorio = (minimo, maximo) => {
  return (
    Math.floor(
      Math.random() * (maximo - minimo + 1),
    ) + minimo
  )
}

const normalizarColumna = (columna) => {
  return String(columna ?? '')
    .trim()
    .toUpperCase()
}

// =====================================================
// CÓDIGO DE REGISTRO
// Máximo 12 caracteres
// =====================================================

const generarCodigoRegistro = (indice = 0) => {
  const tiempo = Date.now()
    .toString(36)
    .slice(-6)
    .toUpperCase()

  const numero = (indice % 1296)
    .toString(36)
    .padStart(2, '0')
    .toUpperCase()

  const aleatorio = Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()

  return `S${tiempo}${numero}${aleatorio}`.slice(0, 12)
}

// =====================================================
// LOCAL STORAGE
// =====================================================

const leerModoSimulacion = () => {
  try {
    if (typeof window === 'undefined') {
      return 'automatico'
    }

    const valor = window.localStorage.getItem(
      CLAVE_MODO_SIMULACION,
    )

    if (valor === 'automatico' || valor === 'manual') {
      return valor
    }
  } catch (error) {
    console.warn('No se pudo leer el modo:', error)
  }

  return 'automatico'
}

const leerModosColumnas = () => {
  try {
    if (typeof window === 'undefined') {
      return MODOS_COLUMNAS_INICIALES
    }

    const valor = window.localStorage.getItem(
      CLAVE_MODOS_COLUMNAS,
    )

    if (!valor) {
      return MODOS_COLUMNAS_INICIALES
    }

    return {
      ...MODOS_COLUMNAS_INICIALES,
      ...JSON.parse(valor),
    }
  } catch (error) {
    console.warn(
      'No se pudieron leer los modos de columnas:',
      error,
    )

    return MODOS_COLUMNAS_INICIALES
  }
}

const leerOcupacionManual = () => {
  try {
    if (typeof window === 'undefined') {
      return OCUPACION_MANUAL_INICIAL
    }

    const valor = window.localStorage.getItem(
      CLAVE_OCUPACION_MANUAL,
    )

    if (!valor) {
      return OCUPACION_MANUAL_INICIAL
    }

    return {
      ...OCUPACION_MANUAL_INICIAL,
      ...JSON.parse(valor),
    }
  } catch (error) {
    console.warn(
      'No se pudo leer la ocupación manual:',
      error,
    )

    return OCUPACION_MANUAL_INICIAL
  }
}

// =====================================================
// HOOK
// =====================================================

export const usePuestos = () => {
  const [puestos, setPuestos] = useState([])

  const [registros, setRegistros] = useState([])

  const [cargando, setCargando] = useState(true)

  const [error, setError] = useState('')

  const [simulando, setSimulando] = useState(false)

  const [modoSimulacion, setModoSimulacion] = useState(
    leerModoSimulacion,
  )

  const [modosColumnas, setModosColumnas] = useState(
    leerModosColumnas,
  )

  const [ocupacionManual, setOcupacionManual] = useState(
    leerOcupacionManual,
  )

  const simulacionEnCurso = useRef(false)

  const modoSimulacionRef = useRef(modoSimulacion)

  // ===================================================
  // SINCRONIZAR REFERENCIA DEL MODO
  // ===================================================

  useEffect(() => {
    modoSimulacionRef.current = modoSimulacion
  }, [modoSimulacion])

  // ===================================================
  // CARGAR PUESTOS
  // ===================================================

  const cargarPuestos = useCallback(async () => {
    const {
      data,
      error: errorSupabase,
    } = await supabase
      .from('puestos')
      .select(`
        id,
        codigo,
        columna,
        numero,
        sensor_id_rtdb
      `)
      .order('columna', {
        ascending: true,
      })
      .order('numero', {
        ascending: true,
      })

    if (errorSupabase) {
      throw errorSupabase
    }

    return data ?? []
  }, [])

  // ===================================================
  // CARGAR REGISTROS
  // ===================================================

  const cargarRegistros = useCallback(async () => {
    const {
      data,
      error: errorSupabase,
    } = await supabase
      .from('registros_estacionamiento')
      .select(`
        id,
        codigo_registro,
        vehiculo_id,
        puesto_id,
        placa_detectada,
        sensor_id_rtdb,
        fecha_entrada,
        fecha_salida,
        duracion_minutos,
        estado,
        vehiculos (
          id,
          placa,
          marca,
          modelo,
          propietario_nombre,
          correo_institucional,
          cedula_enmascarada
        )
      `)
      .order('fecha_entrada', {
        ascending: false,
      })

    if (errorSupabase) {
      throw errorSupabase
    }

    return data ?? []
  }, [])

  // ===================================================
  // OBTENER VEHÍCULOS
  // ===================================================

  const obtenerVehiculos = useCallback(async () => {
    const {
      data,
      error: errorSupabase,
    } = await supabase
      .from('vehiculos')
      .select(`
        id,
        placa,
        marca,
        modelo,
        propietario_nombre
      `)
      .order('id', {
        ascending: true,
      })

    if (errorSupabase) {
      throw errorSupabase
    }

    return data ?? []
  }, [])

  // ===================================================
  // OBTENER REGISTROS ACTIVOS
  // ===================================================

  const obtenerRegistrosActivos = useCallback(async () => {
    const {
      data,
      error: errorSupabase,
    } = await supabase
      .from('registros_estacionamiento')
      .select(`
        id,
        puesto_id,
        vehiculo_id,
        fecha_entrada,
        fecha_salida,
        estado
      `)
      .eq('estado', 'ACTIVO')
      .is('fecha_salida', null)

    if (errorSupabase) {
      throw errorSupabase
    }

    return data ?? []
  }, [])

  // ===================================================
  // CARGAR TODO
  // ===================================================

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true)

      setError('')

      const [
        datosPuestos,
        datosRegistros,
      ] = await Promise.all([
        cargarPuestos(),
        cargarRegistros(),
      ])

      setPuestos(datosPuestos)

      setRegistros(datosRegistros)
    } catch (err) {
      console.error(
        'Error cargando información:',
        err,
      )

      setError(
        err.message ||
          'No se pudo cargar la información.',
      )
    } finally {
      setCargando(false)
    }
  }, [
    cargarPuestos,
    cargarRegistros,
  ])

  // ===================================================
  // CRUD PUESTOS
  // ===================================================

  const crearPuesto = async (datos) => {
    try {
      const {
        error: errorSupabase,
      } = await supabase
        .from('puestos')
        .insert([datos])

      if (errorSupabase) {
        throw errorSupabase
      }

      await cargarDatos()

      return {
        ok: true,
        mensaje:
          'Puesto registrado correctamente.',
      }
    } catch (err) {
      console.error(
        'Error registrando puesto:',
        err,
      )

      return {
        ok: false,
        mensaje:
          err.message ||
          'No se pudo registrar el puesto.',
      }
    }
  }

  const actualizarPuesto = async (
    id,
    datos,
  ) => {
    try {
      const {
        error: errorSupabase,
      } = await supabase
        .from('puestos')
        .update(datos)
        .eq('id', id)

      if (errorSupabase) {
        throw errorSupabase
      }

      await cargarDatos()

      return {
        ok: true,
        mensaje:
          'Puesto actualizado correctamente.',
      }
    } catch (err) {
      console.error(
        'Error actualizando puesto:',
        err,
      )

      return {
        ok: false,
        mensaje:
          err.message ||
          'No se pudo actualizar el puesto.',
      }
    }
  }

  const eliminarPuesto = async (id) => {
    try {
      const {
        error: errorSupabase,
      } = await supabase
        .from('puestos')
        .delete()
        .eq('id', id)

      if (errorSupabase) {
        throw errorSupabase
      }

      await cargarDatos()

      return {
        ok: true,
        mensaje:
          'Puesto eliminado correctamente.',
      }
    } catch (err) {
      console.error(
        'Error eliminando puesto:',
        err,
      )

      return {
        ok: false,
        mensaje:
          err.message ||
          'No se pudo eliminar el puesto.',
      }
    }
  }

  // ===================================================
  // FINALIZAR REGISTROS
  // ===================================================

  const finalizarEstacionamientos = useCallback(
    async (registrosActivos = []) => {
      if (registrosActivos.length === 0) {
        return
      }

      const fechaSalida = new Date()

      for (const registro of registrosActivos) {
        let duracion = 1

        if (registro.fecha_entrada) {
          const entrada = new Date(
            registro.fecha_entrada,
          )

          duracion = Math.max(
            1,
            Math.floor(
              (
                fechaSalida.getTime() -
                entrada.getTime()
              ) / 60000,
            ),
          )
        }

        const {
          error: errorActualizacion,
        } = await supabase
          .from('registros_estacionamiento')
          .update({
            fecha_salida:
              fechaSalida.toISOString(),

            duracion_minutos:
              duracion,

            estado:
              'FINALIZADO',
          })
          .eq('id', registro.id)

        if (errorActualizacion) {
          throw errorActualizacion
        }
      }
    },
    [],
  )

  // ===================================================
  // CONSTRUIR REGISTRO
  // ===================================================

  const construirRegistro = (
    puesto,
    vehiculo,
    indice,
  ) => {
    return {
      codigo_registro:
        generarCodigoRegistro(indice),

      vehiculo_id:
        vehiculo?.id ?? null,

      puesto_id:
        puesto.id,

      placa_detectada:
        vehiculo?.placa ?? 'MANUAL',

      sensor_id_rtdb:
        puesto.sensor_id_rtdb ?? null,

      fecha_entrada:
        new Date().toISOString(),

      fecha_salida:
        null,

      duracion_minutos:
        null,

      estado:
        'ACTIVO',
    }
  }

  // ===================================================
  // CREAR REGISTROS
  //
  // IMPORTANTE:
  // NO limitamos la cantidad por número de vehículos.
  //
  // Si existen 10 vehículos y necesitamos 20 puestos,
  // los vehículos se reutilizan dentro de la simulación.
  // ===================================================

  const crearRegistrosParaPuestos = useCallback(
    async (
      puestosSeleccionados = [],
      vehiculos = [],
    ) => {
      if (puestosSeleccionados.length === 0) {
        return {
          solicitados: 0,
          creados: 0,
        }
      }

      if (vehiculos.length === 0) {
        console.warn(
          'No existen vehículos registrados. Se mantendrá el estado manual visual.',
        )

        return {
          solicitados:
            puestosSeleccionados.length,

          creados: 0,
        }
      }

      const vehiculosMezclados = mezclar(
        vehiculos,
      )

      const registrosNuevos =
        puestosSeleccionados.map(
          (puesto, indice) => {
            const vehiculo =
              vehiculosMezclados[
                indice %
                  vehiculosMezclados.length
              ]

            return construirRegistro(
              puesto,
              vehiculo,
              indice,
            )
          },
        )

      // -----------------------------------------------
      // PRIMER INTENTO:
      // insertar todos
      // -----------------------------------------------

      const {
        error: errorInsercion,
      } = await supabase
        .from('registros_estacionamiento')
        .insert(registrosNuevos)

      if (!errorInsercion) {
        return {
          solicitados:
            puestosSeleccionados.length,

          creados:
            registrosNuevos.length,
        }
      }

      // -----------------------------------------------
      // Si Supabase tiene alguna restricción que
      // impide reutilizar vehículos simultáneamente,
      // intentamos insertar individualmente.
      //
      // El estado MANUAL visual seguirá siendo exacto.
      // -----------------------------------------------

      console.warn(
        'No se pudo insertar todo el lote. Intentando registros individuales:',
        errorInsercion.message,
      )

      let creados = 0

      const cantidadIndividual =
        Math.min(
          puestosSeleccionados.length,
          vehiculosMezclados.length,
        )

      for (
        let indice = 0;
        indice < cantidadIndividual;
        indice += 1
      ) {
        const registro = construirRegistro(
          puestosSeleccionados[indice],
          vehiculosMezclados[indice],
          indice + 100,
        )

        const {
          error: errorIndividual,
        } = await supabase
          .from('registros_estacionamiento')
          .insert([registro])

        if (!errorIndividual) {
          creados += 1
        }
      }

      return {
        solicitados:
          puestosSeleccionados.length,

        creados,
      }
    },
    [],
  )

  // ===================================================
  // CAMBIAR AUTOMÁTICO / MANUAL
  // ===================================================

  const cambiarModoSimulacion = useCallback(
    (nuevoModo) => {
      if (
        nuevoModo !== 'automatico' &&
        nuevoModo !== 'manual'
      ) {
        return
      }

      modoSimulacionRef.current =
        nuevoModo

      setModoSimulacion(nuevoModo)

      try {
        window.localStorage.setItem(
          CLAVE_MODO_SIMULACION,
          nuevoModo,
        )
      } catch (errorStorage) {
        console.warn(
          'No se pudo guardar el modo:',
          errorStorage,
        )
      }

      // -----------------------------------------------
      // Al regresar a automático quitamos todos los
      // controles manuales para volver a utilizar
      // exclusivamente los registros de Supabase.
      // -----------------------------------------------

      if (nuevoModo === 'automatico') {
        const ocupacionLimpia = {
          ...OCUPACION_MANUAL_INICIAL,
        }

        setOcupacionManual(
          ocupacionLimpia,
        )

        setModosColumnas({
          ...MODOS_COLUMNAS_INICIALES,
        })

        try {
          window.localStorage.removeItem(
            CLAVE_OCUPACION_MANUAL,
          )

          window.localStorage.setItem(
            CLAVE_MODOS_COLUMNAS,
            JSON.stringify(
              MODOS_COLUMNAS_INICIALES,
            ),
          )
        } catch (errorStorage) {
          console.warn(
            'No se pudo limpiar el estado manual:',
            errorStorage,
          )
        }
      }
    },
    [],
  )

  // ===================================================
  // CONTROL MANUAL DE UNA COLUMNA
  // ===================================================

  const aplicarModoManualColumna = useCallback(
    async (
      columnaSolicitada,
      modoColumna,
    ) => {
      const columna = normalizarColumna(
        columnaSolicitada,
      )

      if (!COLUMNAS.includes(columna)) {
        return {
          ok: false,
          mensaje:
            'La columna seleccionada no es válida.',
        }
      }

      if (
        ![
          'TODO_OCUPADO',
          'VARIADO',
          'TODO_LIBRE',
        ].includes(modoColumna)
      ) {
        return {
          ok: false,
          mensaje:
            'El estado seleccionado no es válido.',
        }
      }

      if (
        modoSimulacionRef.current !==
        'manual'
      ) {
        return {
          ok: false,
          mensaje:
            'Debe activar primero el modo manual.',
        }
      }

      if (simulacionEnCurso.current) {
        return {
          ok: false,
          mensaje:
            'Existe otra operación en ejecución.',
        }
      }

      simulacionEnCurso.current = true

      setSimulando(true)

      try {
        const [
          datosPuestos,
          datosVehiculos,
          registrosActivos,
        ] = await Promise.all([
          cargarPuestos(),
          obtenerVehiculos(),
          obtenerRegistrosActivos(),
        ])

        // ---------------------------------------------
        // PUESTOS DE LA COLUMNA
        // ---------------------------------------------

        const puestosColumna =
          datosPuestos
            .filter(
              (puesto) =>
                normalizarColumna(
                  puesto.columna,
                ) === columna,
            )
            .sort(
              (a, b) =>
                Number(a.numero) -
                Number(b.numero),
            )

        if (puestosColumna.length === 0) {
          return {
            ok: false,
            mensaje:
              `No existen puestos en la columna ${columna}.`,
          }
        }

        // ---------------------------------------------
        // DECIDIR QUÉ PUESTOS DEBEN QUEDAR OCUPADOS
        // ---------------------------------------------

        let puestosSeleccionados = []

        // TODO OCUPADO
        if (modoColumna === 'TODO_OCUPADO') {
          puestosSeleccionados = [
            ...puestosColumna,
          ]
        }

        // TODO LIBRE
        if (modoColumna === 'TODO_LIBRE') {
          puestosSeleccionados = []
        }

        // VARIADO
        if (modoColumna === 'VARIADO') {
          const minimo = Math.min(
            MINIMO_VARIADO,
            puestosColumna.length,
          )

          const maximo = Math.min(
            MAXIMO_VARIADO,
            puestosColumna.length,
          )

          const cantidad =
            numeroAleatorio(
              minimo,
              maximo,
            )

          puestosSeleccionados =
            mezclar(
              puestosColumna,
            ).slice(0, cantidad)
        }

        // ---------------------------------------------
        // GUARDAR ESTADO MANUAL INMEDIATAMENTE
        //
        // Esto es lo que garantiza:
        //
        // TODO OCUPADO -> 20 / 20
        // TODO LIBRE   -> 0 / 20
        // VARIADO      -> 5 a 10 / 20
        //
        // independientemente del número de vehículos.
        // ---------------------------------------------

        const idsOcupados =
          puestosSeleccionados.map(
            (puesto) => puesto.id,
          )

        setOcupacionManual((anterior) => {
          const siguiente = {
            ...anterior,
            [columna]:
              idsOcupados,
          }

          try {
            window.localStorage.setItem(
              CLAVE_OCUPACION_MANUAL,
              JSON.stringify(
                siguiente,
              ),
            )
          } catch (errorStorage) {
            console.warn(
              'No se pudo guardar la ocupación manual:',
              errorStorage,
            )
          }

          return siguiente
        })

        setModosColumnas((anterior) => {
          const siguiente = {
            ...anterior,
            [columna]:
              modoColumna,
          }

          try {
            window.localStorage.setItem(
              CLAVE_MODOS_COLUMNAS,
              JSON.stringify(
                siguiente,
              ),
            )
          } catch (errorStorage) {
            console.warn(
              'No se pudo guardar el modo de la columna:',
              errorStorage,
            )
          }

          return siguiente
        })

        // ---------------------------------------------
        // OBTENER REGISTROS ACTIVOS DE ESA COLUMNA
        // ---------------------------------------------

        const idsPuestosColumna =
          new Set(
            puestosColumna.map(
              (puesto) => puesto.id,
            ),
          )

        const activosColumna =
          registrosActivos.filter(
            (registro) =>
              idsPuestosColumna.has(
                registro.puesto_id,
              ),
          )

        // ---------------------------------------------
        // LIBERAR LOS ESTADOS ANTERIORES
        // ---------------------------------------------

        if (activosColumna.length > 0) {
          await finalizarEstacionamientos(
            activosColumna,
          )
        }

        // ---------------------------------------------
        // CREAR LOS NUEVOS
        // ---------------------------------------------

        await crearRegistrosParaPuestos(
          puestosSeleccionados,
          datosVehiculos,
        )

        // ---------------------------------------------
        // RECARGAR DATOS
        // ---------------------------------------------

        const nuevosRegistros =
          await cargarRegistros()

        setPuestos(datosPuestos)

        setRegistros(nuevosRegistros)

        setError('')

        return {
          ok: true,
        }
      } catch (err) {
        console.error(
          `Error aplicando control manual a columna ${columna}:`,
          err,
        )

        return {
          ok: false,
          mensaje:
            err.message ||
            'No se pudo aplicar el estado manual.',
        }
      } finally {
        setSimulando(false)

        simulacionEnCurso.current = false
      }
    },
    [
      cargarPuestos,
      cargarRegistros,
      obtenerVehiculos,
      obtenerRegistrosActivos,
      finalizarEstacionamientos,
      crearRegistrosParaPuestos,
    ],
  )

  // ===================================================
  // SIMULACIÓN AUTOMÁTICA
  // ===================================================

  const simularCiclo = useCallback(async () => {
    if (
      modoSimulacionRef.current !==
      'automatico'
    ) {
      return
    }

    if (simulacionEnCurso.current) {
      return
    }

    simulacionEnCurso.current = true

    setSimulando(true)

    try {
      const [
        datosPuestos,
        datosVehiculos,
        registrosActivos,
      ] = await Promise.all([
        cargarPuestos(),
        obtenerVehiculos(),
        obtenerRegistrosActivos(),
      ])

      // ---------------------------------------------
      // PUESTOS UTILIZADOS ANTERIORMENTE
      // ---------------------------------------------

      const idsAnteriores =
        new Set(
          registrosActivos.map(
            (registro) =>
              registro.puesto_id,
          ),
        )

      // ---------------------------------------------
      // FINALIZAR ACTUALES
      // ---------------------------------------------

      if (registrosActivos.length > 0) {
        await finalizarEstacionamientos(
          registrosActivos,
        )
      }

      // ---------------------------------------------
      // PREFERIR PUESTOS DIFERENTES
      // ---------------------------------------------

      const puestosNuevos =
        datosPuestos.filter(
          (puesto) =>
            !idsAnteriores.has(
              puesto.id,
            ),
        )

      const puestosAnteriores =
        datosPuestos.filter(
          (puesto) =>
            idsAnteriores.has(
              puesto.id,
            ),
        )

      const puestosDisponibles = [
        ...mezclar(puestosNuevos),
        ...mezclar(puestosAnteriores),
      ]

      // ---------------------------------------------
      // CANTIDAD AUTOMÁTICA
      // ---------------------------------------------

      const cantidad = Math.min(
        numeroAleatorio(
          MINIMO_OCUPADOS_AUTOMATICO,
          MAXIMO_OCUPADOS_AUTOMATICO,
        ),
        puestosDisponibles.length,
      )

      const seleccion =
        puestosDisponibles.slice(
          0,
          cantidad,
        )

      await crearRegistrosParaPuestos(
        seleccion,
        datosVehiculos,
      )

      const nuevosRegistros =
        await cargarRegistros()

      setPuestos(datosPuestos)

      setRegistros(nuevosRegistros)

      setError('')
    } catch (err) {
      console.error(
        'Error en simulación automática:',
        err,
      )

      setError(
        `Error en la simulación: ${
          err.message ||
          'Error desconocido'
        }`,
      )
    } finally {
      setSimulando(false)

      simulacionEnCurso.current = false
    }
  }, [
    cargarPuestos,
    cargarRegistros,
    obtenerVehiculos,
    obtenerRegistrosActivos,
    finalizarEstacionamientos,
    crearRegistrosParaPuestos,
  ])

  // ===================================================
  // CARGA INICIAL
  // ===================================================

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ===================================================
  // TEMPORIZADOR AUTOMÁTICO
  // ===================================================

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (
        modoSimulacionRef.current ===
        'automatico'
      ) {
        simularCiclo()
      }
    }, INTERVALO_SIMULACION)

    return () => {
      clearInterval(intervalo)
    }
  }, [simularCiclo])

  // ===================================================
  // RETORNO
  // ===================================================

  return {
    puestos,
    registros,

    cargando,
    error,
    simulando,

    modoSimulacion,

    modosColumnas,

    ocupacionManual,

    recargar:
      cargarDatos,

    cambiarModoSimulacion,

    aplicarModoManualColumna,

    simularCiclo,

    crearPuesto,

    actualizarPuesto,

    eliminarPuesto,
  }
}