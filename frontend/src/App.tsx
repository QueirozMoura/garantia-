import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Purchases } from './pages/Purchases.tsx'
import { AddPurchase } from './pages/AddPurchase.tsx'
import { Login } from './pages/Login.tsx'
import { Register } from './pages/Register.tsx'
import { RequireAuth, RequireGuest } from './components/auth/RouteGuards.tsx'

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RequireGuest>
            <Login />
          </RequireGuest>
        }
      />
      <Route
        path="/register"
        element={
          <RequireGuest>
            <Register />
          </RequireGuest>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <AppLayout activeNavId="dashboard">
              <Dashboard />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/purchases"
        element={
          <RequireAuth>
            <AppLayout activeNavId="compras">
              <Purchases />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/purchases/new"
        element={
          <RequireAuth>
            <AppLayout activeNavId="compras">
              <AddPurchase />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
