/**
 * AppSidebar Component
 *
 * Collapsible navigation sidebar with branding, menu items, and toggle controls.
 *
 * Features:
 * - Redux-controlled visibility state
 * - Unfoldable/narrow mode for more screen space
 * - Brand logo with full and narrow variants
 * - Close button for mobile devices
 * - Footer with toggle button
 * - Dark color scheme
 * - Fixed positioning
 *
 * @component
 * @example
 * return (
 *   <AppSidebar />
 * )
 */

/**
 * AppSidebar Component
 *
 * Sidebar principal del sistema Smart Parking UTEQ.
 */

import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react'

import { AppSidebarNav } from './AppSidebarNav'

// Logo Smart Parking UTEQ
import SmartParkingLogo from '../assets/brand/SmartParkingLogo'

// Configuración del menú lateral
import navigation from '../_nav'

const AppSidebar = () => {
  const dispatch = useDispatch()

  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)

  return (
    <CSidebar
      className="border-end"
      colorScheme="dark"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => {
        dispatch({
          type: 'set',
          sidebarShow: visible,
        })
      }}
    >
      <CSidebarHeader
        className="border-bottom"
        style={{
          minHeight: '72px',
          padding: '8px 10px',
        }}
      >
        <CSidebarBrand
          to="/"
          className="d-flex align-items-center justify-content-center w-100"
          style={{
            minHeight: '54px',
            overflow: 'hidden',
          }}
        >
          <SmartParkingLogo
            className="sidebar-brand-full"
            width={210}
            height={50}
            style={{
              color: '#ffffff',
              maxWidth: '100%',
            }}
          />

          <div
            className="sidebar-brand-narrow"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '9px',
              backgroundColor: '#00843D',
              color: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '25px',
              fontWeight: '800',
            }}
          >
            P
          </div>
        </CSidebarBrand>

        <CCloseButton
          className="d-lg-none"
          dark
          onClick={() =>
            dispatch({
              type: 'set',
              sidebarShow: false,
            })
          }
        />
      </CSidebarHeader>

      <AppSidebarNav items={navigation} />

      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler
          onClick={() =>
            dispatch({
              type: 'set',
              sidebarUnfoldable: !unfoldable,
            })
          }
        />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)