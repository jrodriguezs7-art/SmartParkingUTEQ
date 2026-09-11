import React from 'react'

import {
  CAvatar,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  useColorModes,
} from '@coreui/react'

import {
  cilContrast,
  cilMoon,
  cilSun,
} from '@coreui/icons'

import CIcon from '@coreui/icons-react'

import avatar8 from './../../assets/images/avatars/8.jpeg'

// ======================================================
// MENÚ DEL AVATAR
// ======================================================

const AppHeaderDropdown = () => {
  // ====================================================
  // TEMA
  // ====================================================

  const {
    colorMode,
    setColorMode,
  } = useColorModes(
    'coreui-free-react-admin-template-theme',
  )

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <CDropdown
      variant="nav-item"
      placement="bottom-end"
    >
      {/* ==============================================
          NOMBRE + AVATAR
      ============================================== */}

      <CDropdownToggle
        className="py-0 pe-0 d-flex align-items-center gap-3"
        caret={false}
      >
        {/* ============================================
            NOMBRES Y APELLIDOS
        ============================================ */}

        <div
          className="text-end"
          style={{
            lineHeight: '1.2',
          }}
        >
          <div
            className="fw-semibold"
            style={{
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            RODRÍGUEZ SARMIENTO JEHIEL JEREMÍAS
          </div>
        </div>

        {/* ============================================
            AVATAR
        ============================================ */}

        <CAvatar
          src={avatar8}
          size="md"
        />
      </CDropdownToggle>

      {/* ==============================================
          MENÚ DE TEMA
      ============================================== */}

      <CDropdownMenu
        placement="bottom-end"
        style={{
          minWidth: '170px',
        }}
      >
        {/* ============================================
            LIGHT
        ============================================ */}

        <CDropdownItem
          active={
            colorMode === 'light'
          }
          className="d-flex align-items-center"
          as="button"
          type="button"
          onClick={() =>
            setColorMode(
              'light',
            )
          }
        >
          <CIcon
            icon={cilSun}
            className="me-2"
            size="lg"
          />

          Light
        </CDropdownItem>

        {/* ============================================
            DARK
        ============================================ */}

        <CDropdownItem
          active={
            colorMode === 'dark'
          }
          className="d-flex align-items-center"
          as="button"
          type="button"
          onClick={() =>
            setColorMode(
              'dark',
            )
          }
        >
          <CIcon
            icon={cilMoon}
            className="me-2"
            size="lg"
          />

          Dark
        </CDropdownItem>

        {/* ============================================
            AUTO
        ============================================ */}

        <CDropdownItem
          active={
            colorMode === 'auto'
          }
          className="d-flex align-items-center"
          as="button"
          type="button"
          onClick={() =>
            setColorMode(
              'auto',
            )
          }
        >
          <CIcon
            icon={cilContrast}
            className="me-2"
            size="lg"
          />

          Auto
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown