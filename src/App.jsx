import React, {
  Suspense,
  useEffect,
} from 'react'

import {
  HashRouter,
  Route,
  Routes,
} from 'react-router-dom'

import {
  useSelector,
} from 'react-redux'

import {
  CSpinner,
  useColorModes,
} from '@coreui/react'

import './scss/style.scss'
import './scss/examples.scss'

// ======================================================
// LAYOUT PRINCIPAL
// ======================================================

const DefaultLayout =
  React.lazy(
    () =>
      import(
        './layout/DefaultLayout'
      ),
  )

// ======================================================
// AUTENTICACIÓN
// ======================================================

const Login =
  React.lazy(
    () =>
      import(
        './views/authentication/login/Login'
      ),
  )

const Register =
  React.lazy(
    () =>
      import(
        './views/authentication/register/Register'
      ),
  )

const CheckEmail =
  React.lazy(
    () =>
      import(
        './views/authentication/check-email/CheckEmail'
      ),
  )

const ResetPassword =
  React.lazy(
    () =>
      import(
        './views/authentication/reset-password/ResetPassword'
      ),
  )

const ChangePassword =
  React.lazy(
    () =>
      import(
        './views/authentication/change-password/ChangePassword'
      ),
  )

const PasswordChanged =
  React.lazy(
    () =>
      import(
        './views/authentication/password-changed/PasswordChanged'
      ),
  )

// ======================================================
// PÁGINAS DE ERROR
// ======================================================

const Page404 =
  React.lazy(
    () =>
      import(
        './views/error-pages/page404/Page404'
      ),
  )

const Page500 =
  React.lazy(
    () =>
      import(
        './views/error-pages/page500/Page500'
      ),
  )

// ======================================================
// ESCÁNER MÓVIL DE PLACAS
//
// IMPORTANTE:
//
// Esta ruta se carga FUERA de DefaultLayout.
//
// De esta manera, cuando el teléfono escanee el QR,
// solamente verá el escáner móvil.
//
// No aparecerán:
//
// - Sidebar
// - Header
// - Footer
//
// ======================================================

const ReconocimientoMovil =
  React.lazy(
    () =>
      import(
        './views/parqueadero/reconocimiento/ReconocimientoMovil'
      ),
  )

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

const App = () => {
  const {
    isColorModeSet,
    setColorMode,
  } =
    useColorModes(
      'coreui-free-react-admin-template-theme',
    )

  const storedTheme =
    useSelector(
      (state) =>
        state.theme,
    )

  // ====================================================
  // CONFIGURAR TEMA
  // ====================================================

  useEffect(() => {
    const urlParams =
      new URLSearchParams(
        window.location.href.split(
          '?',
        )[1],
      )

    const parametroTema =
      urlParams.get(
        'theme',
      )

    const theme =
      parametroTema
        ? parametroTema.match(
            /^[A-Za-z0-9\s]+/,
          )?.[0]
        : null

    if (theme) {
      setColorMode(
        theme,
      )
    }

    if (
      isColorModeSet()
    ) {
      return
    }

    setColorMode(
      storedTheme,
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <HashRouter>
      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner
              color="primary"
              variant="grow"
            />
          </div>
        }
      >
        <Routes>

          {/* ==========================================
              ESCÁNER MÓVIL

              EJEMPLO:

              /#/reconocimiento-movil?sesion=ABC123
          ========================================== */}

          <Route
            path="/reconocimiento-movil"
            element={
              <ReconocimientoMovil />
            }
          />

          {/* ==========================================
              AUTENTICACIÓN
          ========================================== */}

          <Route
            path="/authentication/login"
            element={
              <Login />
            }
          />

          <Route
            path="/authentication/register"
            element={
              <Register />
            }
          />

          <Route
            path="/authentication/check-email"
            element={
              <CheckEmail />
            }
          />

          <Route
            path="/authentication/reset-password"
            element={
              <ResetPassword />
            }
          />

          <Route
            path="/authentication/change-password"
            element={
              <ChangePassword />
            }
          />

          <Route
            path="/authentication/password-changed"
            element={
              <PasswordChanged />
            }
          />

          {/* ==========================================
              ERRORES
          ========================================== */}

          <Route
            path="/error-pages/404"
            element={
              <Page404 />
            }
          />

          <Route
            path="/error-pages/500"
            element={
              <Page500 />
            }
          />

          {/* ==========================================
              APLICACIÓN PRINCIPAL
          ========================================== */}

          <Route
            path="*"
            element={
              <DefaultLayout />
            }
          />

        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default App