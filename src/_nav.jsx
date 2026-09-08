import React from 'react'

import CIcon from '@coreui/icons-react'

import {
  cilCamera,
  cilCarAlt,
  cilGarage,
  cilSpeedometer,
} from '@coreui/icons'

import {
  CNavItem,
  CNavTitle,
} from '@coreui/react'

const _nav = [
  // ====================================================
  // DASHBOARD
  // ====================================================

  {
    component: CNavItem,

    name: 'Dashboard',

    to: '/dashboard',

    icon: (
      <CIcon
        icon={cilSpeedometer}
        customClassName="nav-icon"
      />
    ),

    badge: {
      color: 'info',
      text: 'NEW',
    },
  },

  // ====================================================
  // PARQUEADERO
  // ====================================================

  {
    component: CNavTitle,

    name: 'Parqueadero',
  },

  // ====================================================
  // VEHÍCULOS
  // ====================================================

  {
    component: CNavItem,

    name: 'Vehículos y propietarios',

    to: '/parqueadero/vehiculos',

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

    to: '/parqueadero/puestos',

    icon: (
      <CIcon
        icon={cilGarage}
        customClassName="nav-icon"
      />
    ),
  },

  // ====================================================
  // RECONOCIMIENTO DE PLACAS
  // ====================================================

  {
    component: CNavItem,

    name: 'Reconocimiento de placas',

    to: '/parqueadero/reconocimiento-placas',

    icon: (
      <CIcon
        icon={cilCamera}
        customClassName="nav-icon"
      />
    ),
  },
]

export default _nav