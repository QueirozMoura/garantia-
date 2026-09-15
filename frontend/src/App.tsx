import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Purchases } from './pages/Purchases.tsx'
import { AddPurchase } from './pages/AddPurchase.tsx'
import { ConfirmExtraction } from './pages/ConfirmExtraction.tsx'
import { EditPurchase } from './pages/EditPurchase.tsx'
import { PurchaseDetails } from './pages/PurchaseDetails.tsx'
import { Warranties } from './pages/Warranties.tsx'
import { Documents } from './pages/Documents.tsx'
import { Alerts } from './pages/Alerts.tsx'
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
          <AppLayout activeNavId="dashboard">
            <Dashboard />
          </AppLayout>
        }
      />
      <Route
        path="/purchases"
        element={
          <AppLayout activeNavId="compras">
            <Purchases key="purchases-library-redesign" />
          </AppLayout>
        }
      />
      {/* Acessível para guest (rascunho local) e authenticated (fluxo atual). */}
      <Route
        path="/purchases/new"
        element={
          <AppLayout activeNavId="compras">
            <AddPurchase />
          </AppLayout>
        }
      />
      <Route
        path="/purchases/new/confirm"
        element={
          <RequireAuth>
            <AppLayout activeNavId="compras">
              <ConfirmExtraction />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/purchases/:id/edit"
        element={
          <RequireAuth>
            <AppLayout activeNavId="compras">
              <EditPurchase />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/purchases/:id"
        element={
          <RequireAuth>
            <AppLayout activeNavId="compras">
              <PurchaseDetails />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/warranties"
        element={
          <AppLayout activeNavId="garantias">
            <Warranties />
          </AppLayout>
        }
      />
      <Route
        path="/documents"
        element={
          <AppLayout activeNavId="documentos">
            <Documents />
          </AppLayout>
        }
      />
      <Route
        path="/alerts"
        element={
          <AppLayout activeNavId="alertas">
            <Alerts />
          </AppLayout>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
