import React, { useEffect, useMemo, useState } from 'react'

import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
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
import { cilPencil, cilPlus, cilTrash } from '@coreui/icons'

import { useVehiculos } from '../../hooks/useVehiculos'

const FORMULARIO_INICIAL = {
  placa: '',
  marca: '',
  modelo: '',
  anio: '',
  color: '',
  tipo: 'AUTOMOVIL',
  foto_url: '',
  foto_fuente_url: '',
  foto_propietario_url: '',
  cedula_propietario: '',
  propietario_nombre: '',
  correo_institucional: '',
  autorizado: true,
}

const ListaVehiculos = () => {
  const {
    vehiculos,
    cargando,
    error,
    recargar,
    crearVehiculo,
    actualizarVehiculo,
    eliminarVehiculo,
  } = useVehiculos()

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const [modalFormulario, setModalFormulario] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)

  const [vehiculoEditando, setVehiculoEditando] = useState(null)
  const [vehiculoAEliminar, setVehiculoAEliminar] = useState(null)

  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)
  const [errores, setErrores] = useState({})

  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const vehiculosPorPagina = 10

  useEffect(() => {
    setPagina(1)
  }, [busqueda])

  const vehiculosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    if (!texto) {
      return vehiculos
    }

    return vehiculos.filter((vehiculo) =>
      [
        vehiculo.placa,
        vehiculo.marca,
        vehiculo.modelo,
        vehiculo.color,
        vehiculo.propietario_nombre,
        vehiculo.correo_institucional,
      ].some((valor) =>
        String(valor ?? '')
          .toLowerCase()
          .includes(texto),
      ),
    )
  }, [vehiculos, busqueda])

  const totalPaginas = Math.max(
    1,
    Math.ceil(vehiculosFiltrados.length / vehiculosPorPagina),
  )

  const paginaActual = Math.min(pagina, totalPaginas)

  const vehiculosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * vehiculosPorPagina

    return vehiculosFiltrados.slice(
      inicio,
      inicio + vehiculosPorPagina,
    )
  }, [vehiculosFiltrados, paginaActual])

  const abrirAgregar = () => {
    setVehiculoEditando(null)
    setFormulario(FORMULARIO_INICIAL)
    setErrores({})
    setMensaje(null)
    setModalFormulario(true)
  }

  const abrirEditar = (vehiculo) => {
    setVehiculoEditando(vehiculo)

    setFormulario({
      placa: vehiculo.placa ?? '',
      marca: vehiculo.marca ?? '',
      modelo: vehiculo.modelo ?? '',
      anio: vehiculo.anio ?? '',
      color: vehiculo.color ?? '',
      tipo: vehiculo.tipo ?? 'AUTOMOVIL',
      foto_url: vehiculo.foto_url ?? '',
      foto_fuente_url: vehiculo.foto_fuente_url ?? '',
      foto_propietario_url: vehiculo.foto_propietario_url ?? '',

      // La cédula real no se consulta desde el navegador.
      // Si queda vacía al editar, se conserva la cédula actual.
      cedula_propietario: '',

      propietario_nombre: vehiculo.propietario_nombre ?? '',
      correo_institucional: vehiculo.correo_institucional ?? '',
      autorizado: Boolean(vehiculo.autorizado),
    })

    setErrores({})
    setMensaje(null)
    setModalFormulario(true)
  }

  const abrirEliminar = (vehiculo) => {
    setVehiculoAEliminar(vehiculo)
    setModalEliminar(true)
  }

  const cambiarCampo = (evento) => {
    const { name, value, type, checked } = evento.target

    let nuevoValor = type === 'checkbox' ? checked : value

    // En la cédula solo permitimos números.
    // No existe límite de cantidad de dígitos.
    if (name === 'cedula_propietario') {
      nuevoValor = value.replace(/\D/g, '')
    }

    setFormulario((anterior) => ({
      ...anterior,
      [name]: nuevoValor,
    }))

    if (errores[name]) {
      setErrores((anterior) => ({
        ...anterior,
        [name]: '',
      }))
    }
  }

  const validarFormulario = () => {
    const nuevosErrores = {}

    const placa = formulario.placa.trim().toUpperCase()

    if (!placa) {
      nuevosErrores.placa = 'La placa es obligatoria.'
    } else if (!/^[A-Z]{3}-[0-9]{4}$/.test(placa)) {
      nuevosErrores.placa =
        'La placa debe tener el formato ABC-1234.'
    }

    if (!formulario.marca.trim()) {
      nuevosErrores.marca = 'La marca es obligatoria.'
    }

    if (!formulario.modelo.trim()) {
      nuevosErrores.modelo = 'El modelo es obligatorio.'
    }

    if (!formulario.anio) {
      nuevosErrores.anio = 'El año es obligatorio.'
    } else {
      const anio = Number(formulario.anio)

      if (anio < 1990 || anio > 2035) {
        nuevosErrores.anio =
          'Ingrese un año entre 1990 y 2035.'
      }
    }

    if (!formulario.color.trim()) {
      nuevosErrores.color = 'El color es obligatorio.'
    }

    if (!formulario.propietario_nombre.trim()) {
      nuevosErrores.propietario_nombre =
        'El nombre del propietario es obligatorio.'
    }

    /*
     * Al agregar:
     * la cédula es obligatoria.
     *
     * Al editar:
     * puede quedar vacía para conservar la cédula actual.
     */
    if (
      !vehiculoEditando &&
      !formulario.cedula_propietario.trim()
    ) {
      nuevosErrores.cedula_propietario =
        'La cédula del propietario es obligatoria.'
    } else if (
      formulario.cedula_propietario.trim() &&
      !/^[0-9]+$/.test(formulario.cedula_propietario.trim())
    ) {
      nuevosErrores.cedula_propietario =
        'La cédula solo puede contener números.'
    }

    if (!formulario.correo_institucional.trim()) {
      nuevosErrores.correo_institucional =
        'El correo institucional es obligatorio.'
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formulario.correo_institucional.trim(),
      )
    ) {
      nuevosErrores.correo_institucional =
        'Ingrese un correo electrónico válido.'
    }

    /*
     * En tu tabla estas columnas tienen NOT NULL.
     */
    if (!formulario.foto_url.trim()) {
      nuevosErrores.foto_url =
        'La URL de la foto del vehículo es obligatoria.'
    }

    if (!formulario.foto_fuente_url.trim()) {
      nuevosErrores.foto_fuente_url =
        'La URL fuente de la foto es obligatoria.'
    }

    if (!formulario.foto_propietario_url.trim()) {
      nuevosErrores.foto_propietario_url =
        'La URL de la foto del propietario es obligatoria.'
    }

    setErrores(nuevosErrores)

    return Object.keys(nuevosErrores).length === 0
  }

  const prepararDatos = () => {
    const datos = {
      placa: formulario.placa.trim().toUpperCase(),
      marca: formulario.marca.trim(),
      modelo: formulario.modelo.trim(),
      anio: Number(formulario.anio),
      color: formulario.color.trim(),
      tipo: formulario.tipo,

      foto_url: formulario.foto_url.trim(),
      foto_fuente_url: formulario.foto_fuente_url.trim(),
      foto_propietario_url:
        formulario.foto_propietario_url.trim(),

      propietario_nombre:
        formulario.propietario_nombre.trim().toUpperCase(),

      correo_institucional:
        formulario.correo_institucional.trim().toLowerCase(),

      autorizado: formulario.autorizado,
    }

    /*
     * IMPORTANTE:
     * Nunca enviamos cedula_enmascarada.
     *
     * PostgreSQL genera automáticamente ese campo.
     */
    if (formulario.cedula_propietario.trim()) {
      datos.cedula_propietario =
        formulario.cedula_propietario.trim()
    }

    return datos
  }

  const guardar = async () => {
    if (!validarFormulario()) {
      return
    }

    setProcesando(true)
    setMensaje(null)

    let resultado

    if (vehiculoEditando) {
      resultado = await actualizarVehiculo(
        vehiculoEditando.id,
        prepararDatos(),
      )
    } else {
      resultado = await crearVehiculo(
        prepararDatos(),
      )
    }

    setProcesando(false)

    if (resultado.ok) {
      setModalFormulario(false)
      setVehiculoEditando(null)
      setFormulario(FORMULARIO_INICIAL)

      setMensaje({
        color: 'success',
        texto: resultado.mensaje,
      })
    } else {
      setMensaje({
        color: 'danger',
        texto: resultado.mensaje,
      })
    }
  }

  const confirmarEliminar = async () => {
    if (!vehiculoAEliminar) {
      return
    }

    setProcesando(true)
    setMensaje(null)

    const resultado =
      await eliminarVehiculo(vehiculoAEliminar.id)

    setProcesando(false)

    if (resultado.ok) {
      setModalEliminar(false)
      setVehiculoAEliminar(null)

      setMensaje({
        color: 'success',
        texto: resultado.mensaje,
      })
    } else {
      setMensaje({
        color: 'danger',
        texto: resultado.mensaje,
      })
    }
  }

  return (
    <>
      {mensaje && (
        <CAlert
          color={mensaje.color}
          dismissible
          onClose={() => setMensaje(null)}
        >
          {mensaje.texto}
        </CAlert>
      )}

      <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong>Vehículos y propietarios</strong>

            <div className="small text-body-secondary">
              Vehículos autorizados en UTEQ Smart Parking
            </div>
          </div>

          <div className="d-flex gap-2">
            <CButton
              color="primary"
              onClick={abrirAgregar}
              disabled={cargando}
            >
              <CIcon icon={cilPlus} className="me-2" />
              Agregar
            </CButton>

            <CButton
              color="success"
              onClick={recargar}
              disabled={cargando}
            >
              {cargando ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Actualizando...
                </>
              ) : (
                'Actualizar'
              )}
            </CButton>
          </div>
        </CCardHeader>

        <CCardBody>
          <div className="d-flex justify-content-between align-items-center mb-3 gap-3 flex-wrap">
            <CFormInput
              type="search"
              placeholder="Buscar placa, vehículo o propietario..."
              value={busqueda}
              onChange={(evento) =>
                setBusqueda(evento.target.value)
              }
              style={{ maxWidth: '420px' }}
            />

            <span className="text-body-secondary">
              {vehiculosFiltrados.length} vehículos
            </span>
          </div>

          {cargando && (
            <div className="text-center py-5">
              <CSpinner color="success" />
              <p className="mt-3">
                Cargando vehículos...
              </p>
            </div>
          )}

          {!cargando && error && (
            <CAlert color="danger">
              No se pudieron cargar los vehículos: {error}
            </CAlert>
          )}

          {!cargando && !error && (
            <>
              <CTable
                align="middle"
                bordered
                hover
                responsive
                striped
              >
                <CTableHead color="dark">
                  <CTableRow>
                    <CTableHeaderCell>
                      Foto del vehículo
                    </CTableHeaderCell>

                    <CTableHeaderCell>
                      Placa
                    </CTableHeaderCell>

                    <CTableHeaderCell>
                      Vehículo
                    </CTableHeaderCell>

                    <CTableHeaderCell>
                      Año / color
                    </CTableHeaderCell>

                    <CTableHeaderCell>
                      Foto del propietario
                    </CTableHeaderCell>

                    <CTableHeaderCell>
                      Propietario
                    </CTableHeaderCell>

                    <CTableHeaderCell>
                      Cédula
                    </CTableHeaderCell>

                    <CTableHeaderCell>
                      Correo
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
                  {vehiculosPaginados.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell
                        colSpan={10}
                        className="text-center py-4"
                      >
                        No se encontraron vehículos.
                      </CTableDataCell>
                    </CTableRow>
                  ) : (
                    vehiculosPaginados.map((vehiculo) => (
                      <CTableRow key={vehiculo.id}>
                        <CTableDataCell>
                          {vehiculo.foto_url ? (
                            <a
                              href={
                                vehiculo.foto_fuente_url ||
                                vehiculo.foto_url
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={vehiculo.foto_url}
                                alt={`${vehiculo.marca} ${vehiculo.modelo}`}
                                width="100"
                                height="65"
                                style={{
                                  objectFit: 'cover',
                                  borderRadius: '8px',
                                }}
                              />
                            </a>
                          ) : (
                            <span className="text-body-secondary">
                              Sin imagen
                            </span>
                          )}
                        </CTableDataCell>

                        <CTableDataCell>
                          <CBadge
                            color="dark"
                            className="fs-6"
                          >
                            {vehiculo.placa}
                          </CBadge>
                        </CTableDataCell>

                        <CTableDataCell>
                          <strong>
                            {vehiculo.marca}
                          </strong>

                          <div className="small text-body-secondary">
                            {vehiculo.modelo}
                          </div>
                        </CTableDataCell>

                        <CTableDataCell>
                          {vehiculo.anio}

                          <div className="small text-body-secondary">
                            {vehiculo.color}
                          </div>
                        </CTableDataCell>

                        <CTableDataCell className="text-center">
                          {vehiculo.foto_propietario_url ? (
                            <img
                              src={
                                vehiculo.foto_propietario_url
                              }
                              alt={`Fotografía de ${vehiculo.propietario_nombre}`}
                              width="60"
                              height="60"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              style={{
                                objectFit: 'cover',
                                borderRadius: '50%',
                                border:
                                  '2px solid var(--cui-border-color)',
                              }}
                            />
                          ) : (
                            <span className="text-body-secondary">
                              Sin foto
                            </span>
                          )}
                        </CTableDataCell>

                        <CTableDataCell>
                          {vehiculo.propietario_nombre}
                        </CTableDataCell>

                        <CTableDataCell>
                          {vehiculo.cedula_enmascarada}
                        </CTableDataCell>

                        <CTableDataCell>
                          <a
                            href={`mailto:${vehiculo.correo_institucional}`}
                          >
                            {
                              vehiculo.correo_institucional
                            }
                          </a>
                        </CTableDataCell>

                        <CTableDataCell>
                          <CBadge
                            color={
                              vehiculo.autorizado
                                ? 'success'
                                : 'danger'
                            }
                          >
                            {vehiculo.autorizado
                              ? 'Autorizado'
                              : 'No autorizado'}
                          </CBadge>
                        </CTableDataCell>

                        <CTableDataCell>
                          <div className="d-flex gap-2">
                            <CButton
                              color="warning"
                              size="sm"
                              title="Editar"
                              onClick={() =>
                                abrirEditar(vehiculo)
                              }
                            >
                              <CIcon icon={cilPencil} />
                            </CButton>

                            <CButton
                              color="danger"
                              size="sm"
                              title="Eliminar"
                              onClick={() =>
                                abrirEliminar(vehiculo)
                              }
                            >
                              <CIcon icon={cilTrash} />
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  )}
                </CTableBody>
              </CTable>

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <small className="text-body-secondary">
                  Página {paginaActual} de {totalPaginas}
                </small>

                <div className="d-flex gap-2">
                  <CButton
                    color="secondary"
                    variant="outline"
                    disabled={paginaActual === 1}
                    onClick={() =>
                      setPagina((valor) =>
                        Math.max(1, valor - 1),
                      )
                    }
                  >
                    Anterior
                  </CButton>

                  <CButton
                    color="success"
                    variant="outline"
                    disabled={
                      paginaActual === totalPaginas
                    }
                    onClick={() =>
                      setPagina((valor) =>
                        Math.min(
                          totalPaginas,
                          valor + 1,
                        ),
                      )
                    }
                  >
                    Siguiente
                  </CButton>
                </div>
              </div>
            </>
          )}
        </CCardBody>
      </CCard>

      {/* MODAL AGREGAR / EDITAR */}

      <CModal
        visible={modalFormulario}
        onClose={() => {
          if (!procesando) {
            setModalFormulario(false)
          }
        }}
        size="lg"
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>
            {vehiculoEditando
              ? 'Editar vehículo y propietario'
              : 'Agregar vehículo y propietario'}
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <h6 className="mb-3">
            Datos del vehículo
          </h6>

          <CRow className="g-3">
            <CCol md={4}>
              <CFormLabel>
                Placa *
              </CFormLabel>

              <CFormInput
                name="placa"
                value={formulario.placa}
                onChange={cambiarCampo}
                invalid={Boolean(errores.placa)}
                placeholder="RAA-1001"
              />

              {errores.placa && (
                <div className="invalid-feedback">
                  {errores.placa}
                </div>
              )}
            </CCol>

            <CCol md={4}>
              <CFormLabel>
                Marca *
              </CFormLabel>

              <CFormInput
                name="marca"
                value={formulario.marca}
                onChange={cambiarCampo}
                invalid={Boolean(errores.marca)}
                placeholder="Toyota"
              />

              {errores.marca && (
                <div className="invalid-feedback">
                  {errores.marca}
                </div>
              )}
            </CCol>

            <CCol md={4}>
              <CFormLabel>
                Modelo *
              </CFormLabel>

              <CFormInput
                name="modelo"
                value={formulario.modelo}
                onChange={cambiarCampo}
                invalid={Boolean(errores.modelo)}
                placeholder="Corolla LE"
              />

              {errores.modelo && (
                <div className="invalid-feedback">
                  {errores.modelo}
                </div>
              )}
            </CCol>

            <CCol md={4}>
              <CFormLabel>
                Año *
              </CFormLabel>

              <CFormInput
                type="number"
                name="anio"
                value={formulario.anio}
                onChange={cambiarCampo}
                invalid={Boolean(errores.anio)}
                min={1990}
                max={2035}
                placeholder="2024"
              />

              {errores.anio && (
                <div className="invalid-feedback">
                  {errores.anio}
                </div>
              )}
            </CCol>

            <CCol md={4}>
              <CFormLabel>
                Color *
              </CFormLabel>

              <CFormInput
                name="color"
                value={formulario.color}
                onChange={cambiarCampo}
                invalid={Boolean(errores.color)}
                placeholder="Blanco"
              />

              {errores.color && (
                <div className="invalid-feedback">
                  {errores.color}
                </div>
              )}
            </CCol>

            <CCol md={4}>
              <CFormLabel>
                Tipo
              </CFormLabel>

              <CFormSelect
                name="tipo"
                value={formulario.tipo}
                onChange={cambiarCampo}
              >
                <option value="AUTOMOVIL">
                  Automóvil
                </option>

                <option value="CAMIONETA">
                  Camioneta
                </option>

                <option value="SUV">
                  SUV
                </option>

                <option value="MOTOCICLETA">
                  Motocicleta
                </option>
              </CFormSelect>
            </CCol>

            <CCol md={6}>
              <CFormLabel>
                URL foto del vehículo *
              </CFormLabel>

              <CFormInput
                name="foto_url"
                value={formulario.foto_url}
                onChange={cambiarCampo}
                invalid={Boolean(errores.foto_url)}
                placeholder="https://..."
              />

              {errores.foto_url && (
                <div className="invalid-feedback">
                  {errores.foto_url}
                </div>
              )}
            </CCol>

            <CCol md={6}>
              <CFormLabel>
                URL fuente de la foto *
              </CFormLabel>

              <CFormInput
                name="foto_fuente_url"
                value={formulario.foto_fuente_url}
                onChange={cambiarCampo}
                invalid={Boolean(
                  errores.foto_fuente_url,
                )}
                placeholder="https://..."
              />

              {errores.foto_fuente_url && (
                <div className="invalid-feedback">
                  {errores.foto_fuente_url}
                </div>
              )}
            </CCol>
          </CRow>

          <hr className="my-4" />

          <h6 className="mb-3">
            Datos del propietario
          </h6>

          <CRow className="g-3">
            <CCol md={6}>
              <CFormLabel>
                Propietario *
              </CFormLabel>

              <CFormInput
                name="propietario_nombre"
                value={
                  formulario.propietario_nombre
                }
                onChange={cambiarCampo}
                invalid={Boolean(
                  errores.propietario_nombre,
                )}
                placeholder="APELLIDOS NOMBRES"
              />

              {errores.propietario_nombre && (
                <div className="invalid-feedback">
                  {
                    errores.propietario_nombre
                  }
                </div>
              )}
            </CCol>

            <CCol md={6}>
              <CFormLabel>
                Cédula del propietario{' '}
                {vehiculoEditando ? '' : '*'}
              </CFormLabel>

              <CFormInput
                type="text"
                inputMode="numeric"
                name="cedula_propietario"
                value={
                  formulario.cedula_propietario
                }
                onChange={cambiarCampo}
                invalid={Boolean(
                  errores.cedula_propietario,
                )}
                placeholder={
                  vehiculoEditando
                    ? 'Dejar vacío para conservar la actual'
                    : 'Ingrese cualquier número'
                }
              />

              {errores.cedula_propietario && (
                <div className="invalid-feedback">
                  {
                    errores.cedula_propietario
                  }
                </div>
              )}

              {vehiculoEditando && (
                <div className="small text-body-secondary mt-1">
                  Cédula actual:{' '}
                  {
                    vehiculoEditando.cedula_enmascarada
                  }
                </div>
              )}
            </CCol>

            <CCol md={6}>
              <CFormLabel>
                Correo institucional *
              </CFormLabel>

              <CFormInput
                type="email"
                name="correo_institucional"
                value={
                  formulario.correo_institucional
                }
                onChange={cambiarCampo}
                invalid={Boolean(
                  errores.correo_institucional,
                )}
                placeholder="usuario@uteq.edu.ec"
              />

              {errores.correo_institucional && (
                <div className="invalid-feedback">
                  {
                    errores.correo_institucional
                  }
                </div>
              )}
            </CCol>

            <CCol md={6}>
              <CFormLabel>
                URL foto del propietario *
              </CFormLabel>

              <CFormInput
                name="foto_propietario_url"
                value={
                  formulario.foto_propietario_url
                }
                onChange={cambiarCampo}
                invalid={Boolean(
                  errores.foto_propietario_url,
                )}
                placeholder="https://..."
              />

              {errores.foto_propietario_url && (
                <div className="invalid-feedback">
                  {
                    errores.foto_propietario_url
                  }
                </div>
              )}
            </CCol>

            <CCol xs={12}>
              <CFormCheck
                id="autorizado"
                name="autorizado"
                label="Vehículo autorizado"
                checked={formulario.autorizado}
                onChange={cambiarCampo}
              />
            </CCol>
          </CRow>
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            disabled={procesando}
            onClick={() =>
              setModalFormulario(false)
            }
          >
            Cancelar
          </CButton>

          <CButton
            color="success"
            disabled={procesando}
            onClick={guardar}
          >
            {procesando && (
              <CSpinner
                size="sm"
                className="me-2"
              />
            )}

            {vehiculoEditando
              ? 'Guardar cambios'
              : 'Registrar'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* MODAL ELIMINAR */}

      <CModal
        visible={modalEliminar}
        onClose={() => {
          if (!procesando) {
            setModalEliminar(false)
          }
        }}
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>
            Confirmar eliminación
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {vehiculoAEliminar && (
            <>
              <p>
                ¿Está seguro de que desea eliminar este registro?
              </p>

              <div className="border rounded p-3">
                <div>
                  <strong>
                    Placa:
                  </strong>{' '}
                  {vehiculoAEliminar.placa}
                </div>

                <div>
                  <strong>
                    Vehículo:
                  </strong>{' '}
                  {vehiculoAEliminar.marca}{' '}
                  {vehiculoAEliminar.modelo}
                </div>

                <div>
                  <strong>
                    Propietario:
                  </strong>{' '}
                  {
                    vehiculoAEliminar.propietario_nombre
                  }
                </div>
              </div>

              <CAlert
                color="warning"
                className="mt-3 mb-0"
              >
                Esta operación no se puede deshacer.
              </CAlert>
            </>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            disabled={procesando}
            onClick={() =>
              setModalEliminar(false)
            }
          >
            Cancelar
          </CButton>

          <CButton
            color="danger"
            disabled={procesando}
            onClick={confirmarEliminar}
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

export default ListaVehiculos