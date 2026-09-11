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
  CHeader,
  CHeaderNav,
  CHeaderToggler,
} from '@coreui/react'

import CIcon from '@coreui/icons-react'

import {
  cilMenu,
} from '@coreui/icons'

import {
  AppHeaderDropdown,
} from './header/index'

// ======================================================
// HEADER PRINCIPAL
//
// Se conserva solamente:
//
// - botón lateral
// - avatar del usuario
//
// El selector de tema que estaba al lado del avatar
// se eliminó del header.
//
// Ahora Light / Dark / Auto aparecen únicamente
// al pulsar el avatar.
// ======================================================

const AppHeader = () => {
  // ====================================================
  // REFERENCIA DEL HEADER
  // ====================================================

  const headerRef =
    useRef()

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
          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
