import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { supabase } from '../lib/supabase'

// =====================================================
// CONFIGURACIÓN DE LA SIMULACIÓN
// =====================================================

// Cada 1 minuto real se ejecuta un nuevo ciclo.
const INTERVALO_SIMULACION = 60 * 1000

// Cantidad mínima y máxima de vehículos
// que se estacionarán en cada ciclo.
const MINIMO_OCUPADOS = 15
const MAXIMO_OCUPADOS = 25

// Duraciones ficticias que se mostrarán
// en el historial.
const DURACIONES_SIMULADAS = [
  30,  // 30 minutos
  45,  // 45 minutos
  60,  // 1 hora
  75,  // 1 hora 15 minutos
  90,  // 1 hora 30 minutos
  120, // 2 horas
  150, // 2 horas 30 minutos
  180, // 3 horas
]

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

const mezclar = (elementos) => {
  const copia = [...elementos]

  for (
    let i = copia.length - 1;
    i > 0;
    i -= 1
  ) {
    const j = Math.floor(
      Math.random() * (i + 1),
    )

    ;[copia[i], copia[j]] = [
      copia[j],
      copia[i],
    ]
  }

  return copia
}

const numeroAleatorio = (
  minimo,
  maximo,
) =>
  Math.floor(
    Math.random() *
      (maximo - minimo + 1),
  ) + minimo

const obtenerDuracionAleatoria =
  () =>
    DURACIONES_SIMULADAS[
      Math.floor(
        Math.random() *
          DURACIONES_SIMULADAS.length,
      )
    ]

// =====================================================
// CÓDIGO CORTO PARA varchar(12)
// =====================================================

const generarCodigoRegistro = (
  indice,
) => {
  /*
   * Ejemplo:
   *
   * Date.now():
   * 1756423987456
   *
   * Tomamos solamente los últimos 7:
   * 3987456
   *
   * Resultado:
   * S398745601
   *
   * Longitud total:
   * 10 caracteres
   *
   * Por lo tanto entra correctamente
   * en varchar(12).
   */

  const tiempo =
    String(
      Date.now(),
    ).slice(-7)

  const numero =
    String(
      indice + 1,
    ).padStart(
      2,
      '0',
    )

  return `S${tiempo}${numero}`
}

// =====================================================
// HOOK
// =====================================================

export const usePuestos = () => {
  const [puestos, setPuestos] =
    useState([])

  const [registros, setRegistros] =
    useState([])

  const [cargando, setCargando] =
    useState(true)

  const [error, setError] =
    useState('')

  const [simulando, setSimulando] =
    useState(false)

  // Evita que dos ciclos se ejecuten
  // al mismo tiempo.
  const simulacionEnCurso =
    useRef(false)

  // ===================================================
  // CARGAR PUESTOS
  // ===================================================

  const cargarPuestos =
    useCallback(async () => {
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
        .order(
          'id',
          {
            ascending: true,
          },
        )

      if (errorSupabase) {
        throw errorSupabase
      }

      return data ?? []
    }, [])

  // ===================================================
  // CARGAR REGISTROS
  // ===================================================

  const cargarRegistros =
    useCallback(async () => {
      const {
        data,
        error: errorSupabase,
      } = await supabase
        .from(
          'registros_estacionamiento',
        )
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
        .order(
          'fecha_entrada',
          {
            ascending: false,
          },
        )

      if (errorSupabase) {
        throw errorSupabase
      }

      return data ?? []
    }, [])

  // ===================================================
  // CARGAR TODOS LOS DATOS
  // ===================================================

  const cargarDatos =
    useCallback(async () => {
      try {
        setCargando(true)
        setError('')

        const [
          datosPuestos,
          datosRegistros,
        ] =
          await Promise.all([
            cargarPuestos(),
            cargarRegistros(),
          ])

        setPuestos(
          datosPuestos,
        )

        setRegistros(
          datosRegistros,
        )
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
  // CRUD DE PUESTOS
  // ===================================================

  const crearPuesto =
    async (datos) => {
      try {
        const {
          error:
            errorSupabase,
        } = await supabase
          .from('puestos')
          .insert([datos])

        if (
          errorSupabase
        ) {
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
          'Error al crear puesto:',
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

  const actualizarPuesto =
    async (
      id,
      datos,
    ) => {
      try {
        const {
          error:
            errorSupabase,
        } = await supabase
          .from('puestos')
          .update(datos)
          .eq(
            'id',
            id,
          )

        if (
          errorSupabase
        ) {
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
          'Error al actualizar puesto:',
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

  const eliminarPuesto =
    async (id) => {
      try {
        const {
          error:
            errorSupabase,
        } = await supabase
          .from('puestos')
          .delete()
          .eq(
            'id',
            id,
          )

        if (
          errorSupabase
        ) {
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
          'Error al eliminar puesto:',
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
  // FINALIZAR ESTACIONAMIENTOS ACTIVOS
  // ===================================================

  const finalizarEstacionamientos =
    async (
      registrosActivos,
    ) => {
      const salida =
        new Date()

      for (
        const registro of registrosActivos
      ) {
        const duracion =
          obtenerDuracionAleatoria()

        /*
         * El ciclo dura solamente
         * 1 minuto real.
         *
         * Sin embargo, generamos una
         * duración ficticia realista.
         *
         * Ejemplo:
         *
         * salida:
         * 20:00
         *
         * duración:
         * 90 minutos
         *
         * entrada:
         * 18:30
         */

        const entrada =
          new Date(
            salida.getTime() -
              duracion *
                60 *
                1000,
          )

        const {
          error:
            errorActualizacion,
        } = await supabase
          .from(
            'registros_estacionamiento',
          )
          .update({
            fecha_entrada:
              entrada.toISOString(),

            fecha_salida:
              salida.toISOString(),

            duracion_minutos:
              duracion,

            estado:
              'FINALIZADO',
          })
          .eq(
            'id',
            registro.id,
          )

        if (
          errorActualizacion
        ) {
          throw errorActualizacion
        }
      }
    }

  // ===================================================
  // OBTENER VEHÍCULOS
  // ===================================================

  const obtenerVehiculos =
    async () => {
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

      if (errorSupabase) {
        throw errorSupabase
      }

      return data ?? []
    }

  // ===================================================
  // CREAR NUEVOS ESTACIONAMIENTOS
  // ===================================================

  const crearNuevosEstacionamientos =
    async (
      datosPuestos,
      vehiculos,
      registrosAnteriores,
    ) => {
      if (
        datosPuestos.length ===
          0 ||
        vehiculos.length ===
          0
      ) {
        return
      }

      // -----------------------------------------------
      // PUESTOS DEL CICLO ANTERIOR
      // -----------------------------------------------

      const puestosUsadosAntes =
        new Set(
          registrosAnteriores.map(
            (
              registro,
            ) =>
              registro.puesto_id,
          ),
        )

      /*
       * Primero intentamos usar
       * espacios diferentes.
       */

      const puestosPreferidos =
        datosPuestos.filter(
          (puesto) =>
            !puestosUsadosAntes.has(
              puesto.id,
            ),
        )

      const puestosUsados =
        datosPuestos.filter(
          (puesto) =>
            puestosUsadosAntes.has(
              puesto.id,
            ),
        )

      const puestosDisponibles =
        [
          ...mezclar(
            puestosPreferidos,
          ),

          ...mezclar(
            puestosUsados,
          ),
        ]

      // -----------------------------------------------
      // VEHÍCULOS DEL CICLO ANTERIOR
      // -----------------------------------------------

      const vehiculosAnteriores =
        new Set(
          registrosAnteriores.map(
            (
              registro,
            ) =>
              registro.vehiculo_id,
          ),
        )

      /*
       * Primero intentamos utilizar
       * vehículos diferentes.
       */

      const vehiculosNuevos =
        vehiculos.filter(
          (vehiculo) =>
            !vehiculosAnteriores.has(
              vehiculo.id,
            ),
        )

      const vehiculosUsados =
        vehiculos.filter(
          (vehiculo) =>
            vehiculosAnteriores.has(
              vehiculo.id,
            ),
        )

      const vehiculosDisponibles =
        [
          ...mezclar(
            vehiculosNuevos,
          ),

          ...mezclar(
            vehiculosUsados,
          ),
        ]

      // -----------------------------------------------
      // CANTIDAD ALEATORIA
      // -----------------------------------------------

      let cantidad =
        numeroAleatorio(
          MINIMO_OCUPADOS,
          MAXIMO_OCUPADOS,
        )

      cantidad =
        Math.min(
          cantidad,
          puestosDisponibles.length,
          vehiculosDisponibles.length,
        )

      const ahora =
        new Date()

      const nuevosRegistros =
        []

      // -----------------------------------------------
      // GENERAR REGISTROS
      // -----------------------------------------------

      for (
        let i = 0;
        i < cantidad;
        i += 1
      ) {
        const puesto =
          puestosDisponibles[i]

        const vehiculo =
          vehiculosDisponibles[i]

        /*
         * IMPORTANTE
         *
         * codigo_registro está limitado
         * a varchar(12).
         *
         * Por eso usamos:
         *
         * S123456701
         *
         * en lugar de:
         *
         * SIM-1756423987456-1
         */

        const codigoRegistro =
          generarCodigoRegistro(
            i,
          )

        nuevosRegistros.push({
          codigo_registro:
            codigoRegistro,

          vehiculo_id:
            vehiculo.id,

          puesto_id:
            puesto.id,

          placa_detectada:
            vehiculo.placa,

          sensor_id_rtdb:
            puesto.sensor_id_rtdb,

          fecha_entrada:
            ahora.toISOString(),

          fecha_salida:
            null,

          duracion_minutos:
            null,

          estado:
            'ACTIVO',
        })
      }

      if (
        nuevosRegistros.length ===
        0
      ) {
        return
      }

      const {
        error:
          errorInsercion,
      } = await supabase
        .from(
          'registros_estacionamiento',
        )
        .insert(
          nuevosRegistros,
        )

      if (
        errorInsercion
      ) {
        throw errorInsercion
      }
    }

  // ===================================================
  // CICLO COMPLETO DE SIMULACIÓN
  // ===================================================

  const simularCiclo =
    useCallback(async () => {
      /*
       * Evita que se inicie otro
       * ciclo mientras uno anterior
       * todavía está trabajando.
       */

      if (
        simulacionEnCurso.current
      ) {
        return
      }

      simulacionEnCurso.current =
        true

      setSimulando(true)

      try {
        console.log(
          'Iniciando simulación de estacionamiento...',
        )

        // ---------------------------------------------
        // 1. OBTENER PUESTOS
        // ---------------------------------------------

        const datosPuestos =
          await cargarPuestos()

        // ---------------------------------------------
        // 2. OBTENER VEHÍCULOS
        // ---------------------------------------------

        const datosVehiculos =
          await obtenerVehiculos()

        // ---------------------------------------------
        // 3. OBTENER ESTACIONAMIENTOS ACTIVOS
        // ---------------------------------------------

        const {
          data:
            registrosActivos,
          error:
            errorActivos,
        } = await supabase
          .from(
            'registros_estacionamiento',
          )
          .select(`
            id,
            puesto_id,
            vehiculo_id,
            estado,
            fecha_salida
          `)
          .eq(
            'estado',
            'ACTIVO',
          )
          .is(
            'fecha_salida',
            null,
          )

        if (
          errorActivos
        ) {
          throw errorActivos
        }

        const activos =
          registrosActivos ??
          []

        console.log(
          `Vehículos activos antes del cambio: ${activos.length}`,
        )

        // ---------------------------------------------
        // 4. FINALIZAR LOS ACTUALES
        // ---------------------------------------------

        if (
          activos.length > 0
        ) {
          await finalizarEstacionamientos(
            activos,
          )
        }

        // ---------------------------------------------
        // 5. CREAR NUEVOS ESTACIONAMIENTOS
        // ---------------------------------------------

        await crearNuevosEstacionamientos(
          datosPuestos,
          datosVehiculos,
          activos,
        )

        // ---------------------------------------------
        // 6. VOLVER A LEER TODO EL HISTORIAL
        // ---------------------------------------------

        const nuevosRegistros =
          await cargarRegistros()

        /*
         * Actualizamos los estados
         * de React.
         */

        setPuestos(
          datosPuestos,
        )

        setRegistros(
          nuevosRegistros,
        )

        setError('')

        console.log(
          'Simulación completada correctamente.',
        )
      } catch (err) {
        console.error(
          'Error en simulación:',
          err,
        )

        /*
         * No vaciamos los registros
         * anteriores si ocurre un error.
         */

        setError(
          `Error en la simulación: ${
            err.message ||
            'Error desconocido'
          }`,
        )
      } finally {
        setSimulando(false)

        simulacionEnCurso.current =
          false
      }
    }, [
      cargarPuestos,
      cargarRegistros,
    ])

  // ===================================================
  // INICIAR APLICACIÓN Y TEMPORIZADOR
  // ===================================================

  useEffect(() => {
    /*
     * Al abrir la página:
     *
     * solamente consultamos los
     * datos que ya existen.
     */

    cargarDatos()

    /*
     * Después se ejecuta un
     * nuevo ciclo cada minuto.
     */

    const intervalo =
      setInterval(
        () => {
          simularCiclo()
        },
        INTERVALO_SIMULACION,
      )

    /*
     * Al salir de la página
     * eliminamos el temporizador.
     */

    return () => {
      clearInterval(
        intervalo,
      )
    }
  }, [
    cargarDatos,
    simularCiclo,
  ])

  // ===================================================
  // RETORNO
  // ===================================================

  return {
    puestos,
    registros,

    cargando,
    error,
    simulando,

    recargar:
      cargarDatos,

    simularCiclo,

    crearPuesto,
    actualizarPuesto,
    eliminarPuesto,
  }
}