import React, {
  Suspense,
} from 'react'

import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import {
  CContainer,
  CSpinner,
} from '@coreui/react'

import {
  routes,
} from '../routes'

// ======================================================
// CONTENIDO PRINCIPAL
// ======================================================

const AppContent = () => {
  // ====================================================
  // QUITAR DASHBOARD DE LAS RUTAS RENDERIZADAS
  //
  // Aunque routes.js todavía lo tenga,
  // AppContent ya NO lo mostrará.
  // ====================================================

  const rutasSinDashboard =
    routes.filter(
      (route) =>
        route.path !==
        '/dashboard',
    )

  return (
    <CContainer
      className="px-4 pt-4"
      lg
    >
      <Suspense
        fallback={
          <div className="d-flex justify-content-center py-5">
            <CSpinner
              color="primary"
            />
          </div>
        }
      >
        <Routes>
          {/* ==========================================
              RUTAS DEL PROYECTO
              EXCEPTO DASHBOARD
          ========================================== */}

          {rutasSinDashboard.map(
            (
              route,
              idx,
            ) => {
              return (
                route.element && (
                  <Route
                    key={idx}
                    path={
                      route.path
                    }
                    exact={
                      route.exact
                    }
                    name={
                      route.name
                    }
                    element={
                      <route.element />
                    }
                  />
                )
              )
            },
          )}

          {/* ==========================================
              SI ALGUIEN ENTRA A /dashboard
              REDIRIGIR A VEHÍCULOS
          ========================================== */}

          <Route
            path="/dashboard"
            element={
              <Navigate
                to="/parqueadero/vehiculos"
                replace
              />
            }
          />

          {/* ==========================================
              PÁGINA PRINCIPAL
          ========================================== */}

          <Route
            path="/"
            element={
              <Navigate
                to="/parqueadero/vehiculos"
                replace
              />
            }
          />

          {/* ==========================================
              CUALQUIER RUTA DESCONOCIDA
          ========================================== */}

          <Route
            path="*"
            element={
              <Navigate
                to="/parqueadero/vehiculos"
                replace
              />
            }
          />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(
  AppContent,
)