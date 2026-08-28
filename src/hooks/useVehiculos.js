import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const COLUMNAS_PUBLICAS = `
  id,
  placa,
  marca,
  modelo,
  anio,
  color,
  tipo,
  foto_url,
  foto_fuente_url,
  foto_propietario_url,
  cedula_enmascarada,
  propietario_nombre,
  correo_institucional,
  autorizado
`

export const useVehiculos = () => {
  const [vehiculos, setVehiculos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // ==========================
  // LISTAR VEHÍCULOS
  // ==========================
  const cargarVehiculos = useCallback(async () => {
    try {
      setCargando(true)
      setError('')

      const { data, error: errorSupabase } = await supabase
        .from('vehiculos')
        .select(COLUMNAS_PUBLICAS)
        .order('propietario_nombre', { ascending: true })

      if (errorSupabase) {
        throw errorSupabase
      }

      setVehiculos(data ?? [])
    } catch (err) {
      console.error('Error al cargar vehículos:', err)

      setVehiculos([])
      setError(
        err.message ||
          'No se pudieron cargar los vehículos.',
      )
    } finally {
      setCargando(false)
    }
  }, [])

  // ==========================
  // CREAR VEHÍCULO
  // ==========================
  const crearVehiculo = async (datosVehiculo) => {
    try {
      const { data, error: errorSupabase } = await supabase
        .from('vehiculos')
        .insert([datosVehiculo])
        .select(COLUMNAS_PUBLICAS)
        .single()

      if (errorSupabase) {
        throw errorSupabase
      }

      await cargarVehiculos()

      return {
        ok: true,
        data,
        mensaje: 'Vehículo registrado correctamente.',
      }
    } catch (err) {
      console.error('Error al crear vehículo:', err)

      return {
        ok: false,
        data: null,
        mensaje:
          err.message ||
          'No se pudo registrar el vehículo.',
      }
    }
  }

  // ==========================
  // ACTUALIZAR VEHÍCULO
  // ==========================
  const actualizarVehiculo = async (
    id,
    datosVehiculo,
  ) => {
    try {
      const { data, error: errorSupabase } = await supabase
        .from('vehiculos')
        .update(datosVehiculo)
        .eq('id', id)
        .select(COLUMNAS_PUBLICAS)
        .single()

      if (errorSupabase) {
        throw errorSupabase
      }

      await cargarVehiculos()

      return {
        ok: true,
        data,
        mensaje: 'Vehículo actualizado correctamente.',
      }
    } catch (err) {
      console.error('Error al actualizar vehículo:', err)

      return {
        ok: false,
        data: null,
        mensaje:
          err.message ||
          'No se pudo actualizar el vehículo.',
      }
    }
  }

  // ==========================
  // ELIMINAR VEHÍCULO
  // ==========================
  const eliminarVehiculo = async (id) => {
    try {
      const { error: errorSupabase } = await supabase
        .from('vehiculos')
        .delete()
        .eq('id', id)

      if (errorSupabase) {
        throw errorSupabase
      }

      await cargarVehiculos()

      return {
        ok: true,
        mensaje: 'Vehículo eliminado correctamente.',
      }
    } catch (err) {
      console.error('Error al eliminar vehículo:', err)

      return {
        ok: false,
        mensaje:
          err.message ||
          'No se pudo eliminar el vehículo.',
      }
    }
  }

  // ==========================
  // CARGA INICIAL
  // ==========================
  useEffect(() => {
    cargarVehiculos()
  }, [cargarVehiculos])

  return {
    vehiculos,
    cargando,
    error,

    recargar: cargarVehiculos,
    crearVehiculo,
    actualizarVehiculo,
    eliminarVehiculo,
  }
}