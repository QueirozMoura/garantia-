import { AppLayout } from './layouts/AppLayout.tsx'
import { Dashboard } from './pages/Dashboard.tsx'

function App() {
  return (
    <AppLayout activeNavId="dashboard">
      <Dashboard />
    </AppLayout>
  )
}

export default App
