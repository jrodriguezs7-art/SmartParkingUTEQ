import React from 'react'

import {
  AppContent,
  AppSidebar,
  AppFooter,
  AppHeader,
} from '../components/index'

// ======================================================
// LAYOUT PRINCIPAL
// ======================================================

const DefaultLayout = () => {
  return (
    <div>
      {/* ==============================================
          MENÚ LATERAL
      ============================================== */}

      <AppSidebar />

      {/* ==============================================
          ÁREA PRINCIPAL
      ============================================== */}

      <div className="wrapper d-flex flex-column min-vh-100">
        {/* ============================================
            HEADER
            Tema + usuario + botón lateral
        ============================================ */}

        <AppHeader />

        {/* ============================================
            CONTENIDO
        ============================================ */}

        <div className="body flex-grow-1">
          <AppContent />
        </div>

        {/* ============================================
            PIE DE PÁGINA
        ============================================ */}

        <AppFooter />
      </div>
    </div>
  )
}

export default DefaultLayout