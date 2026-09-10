import React, {
  useEffect,
  useRef,
} from 'react'

import {
  useDispatch,
  useSelector,
} from 'react-redux'

import {
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  useColorModes,
} from '@coreui/react'

import CIcon from '@coreui/icons-react'

import {
  cilContrast,
  cilMenu,
  cilMoon,
  cilSun,
} from '@coreui/icons'

import {
  AppHeaderDropdown,
} from './header/index'

// ======================================================
// HEADER PRINCIPAL
//
// Conservamos solamente:
//
// - botón lateral
// - selector de tema
// - usuario
//
// Eliminamos:
//
// - buscador
// - notificaciones
// - mensajes
// - listas
// - breadcrumb
// ======================================================

const AppHeader = () => {
  // ====================================================
  // REFERENCIA DEL HEADER
  // ====================================================

  const headerRef =
    useRef()

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
  // SIDEBAR
  // ====================================================

  const dispatch =
    useDispatch()

  const sidebarShow =
    useSelector(
      (state) =>
        state.sidebarShow,
    )

  // ====================================================
  // SOMBRA AL HACER SCROLL
  // ====================================================

  useEffect(() => {
    const handleScroll =
      () => {
        if (
          headerRef.current
        ) {
          headerRef.current
            .classList
            .toggle(
              'shadow-sm',
              document
                .documentElement
                .scrollTop > 0,
            )
        }
      }

    document.addEventListener(
      'scroll',
      handleScroll,
    )

    return () => {
      document.removeEventListener(
        'scroll',
        handleScroll,
      )
    }
  }, [])

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <CHeader
      position="sticky"
      className="p-0"
      ref={headerRef}
    >
      <CContainer
        className="border-bottom px-4"
        fluid
      >
        {/* ============================================
            BOTÓN SIDEBAR
        ============================================ */}

        <CHeaderToggler
          onClick={() =>
            dispatch({
              type: 'set',

              sidebarShow:
                !sidebarShow,
            })
          }
          style={{
            marginInlineStart:
              '-14px',
          }}
        >
          <CIcon
            icon={cilMenu}
            size="lg"
          />
        </CHeaderToggler>

        {/* ============================================
            ESPACIO FLEXIBLE
        ============================================ */}

        <div className="ms-auto" />

        {/* ============================================
            CONTROLES DERECHA
        ============================================ */}

        <CHeaderNav>
          {/* ==========================================
              SELECTOR DE TEMA
          ========================================== */}

          <CDropdown
            variant="nav-item"
            placement="bottom-end"
          >
            <CDropdownToggle
              caret={false}
            >
              {colorMode ===
              'dark' ? (
                <CIcon
                  icon={cilMoon}
                  size="lg"
                />
              ) : colorMode ===
                'auto' ? (
                <CIcon
                  icon={
                    cilContrast
                  }
                  size="lg"
                />
              ) : (
                <CIcon
                  icon={cilSun}
                  size="lg"
                />
              )}
            </CDropdownToggle>

            <CDropdownMenu>
              {/* ======================================
                  LIGHT
              ====================================== */}

              <CDropdownItem
                active={
                  colorMode ===
                  'light'
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
                  className="me-2"
                  icon={cilSun}
                  size="lg"
                />

                Light
              </CDropdownItem>

              {/* ======================================
                  DARK
              ====================================== */}

              <CDropdownItem
                active={
                  colorMode ===
                  'dark'
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
                  className="me-2"
                  icon={cilMoon}
                  size="lg"
                />

                Dark
              </CDropdownItem>

              {/* ======================================
                  AUTO
              ====================================== */}

              <CDropdownItem
                active={
                  colorMode ===
                  'auto'
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
                  className="me-2"
                  icon={
                    cilContrast
                  }
                  size="lg"
                />

                Auto
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>

          {/* ==========================================
              SEPARADOR
          ========================================== */}

          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75" />
          </li>

          {/* ==========================================
              USUARIO
          ========================================== */}

          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>
    </CHeader>
  )
}

export default AppHeader