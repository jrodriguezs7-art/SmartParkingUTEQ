import React from 'react'

import CIcon from '@coreui/icons-react'

import {
  cilCamera,
  cilCarAlt,
  cilGarage,
} from '@coreui/icons'

import {
  CNavItem,
  CNavTitle,
} from '@coreui/react'

const _nav = [
  // ====================================================
  // PARQUEADERO
  // ====================================================

  {
    component: CNavTitle,
    name: 'Parqueadero',
  },

  // ====================================================
  // VEHÍCULOS Y PROPIETARIOS
  // ====================================================

  {
    component: CNavItem,

    name:
      'Vehículos y propietarios',

    to:
      '/parqueadero/vehiculos',

    icon: (
      <CIcon
        icon={cilCarAlt}
        customClassName="nav-icon"
      />
    ),
  },

  // ====================================================
  // PUESTOS
  // ====================================================

  {
    component: CNavItem,

    name: 'Puestos',

    to:
      '/parqueadero/puestos',

    icon: (
      <CIcon
        icon={cilGarage}
        customClassName="nav-icon"
      />
    ),
  },

  // ====================================================
  // MONITOREO DE ENTRADA
  // ====================================================

  {
    component: CNavItem,

    name:
      'Monitoreo de entrada',

    to:
      '/parqueadero/monitoreo-entrada',

    icon: (
      <CIcon
        icon={cilCamera}
        customClassName="nav-icon"
      />
    ),
  },

  // ====================================================
  // RECONOCIMIENTO DE PLACAS
  // ====================================================

  {
    component: CNavItem,

    name:
      'Reconocimiento de placas',

    to:
      '/parqueadero/reconocimiento-placas',

    icon: (
      <CIcon
        icon={cilCamera}
        customClassName="nav-icon"
      />
    ),
  },
]

export default _nav