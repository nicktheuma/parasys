import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/admin/RequireAuth'
import { Home } from '@/routes/Home'
import { NotFound } from '@/routes/NotFound'

const AdminLogin = lazy(() =>
  import('@/routes/AdminLogin').then((m) => ({ default: m.AdminLogin })),
)
const AdminLayout = lazy(() =>
  import('@/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const AdminDashboard = lazy(() =>
  import('@/routes/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
)
const AdminOrders = lazy(() =>
  import('@/routes/AdminOrders').then((m) => ({ default: m.AdminOrders })),
)
const AdminParametricDesigner = lazy(() =>
  import('@/routes/AdminParametricDesigner').then((m) => ({
    default: m.AdminParametricDesigner,
  })),
)
const AdminMaterials = lazy(() =>
  import('@/routes/AdminMaterials').then((m) => ({ default: m.AdminMaterials })),
)
const ConfiguratorPublic = lazy(() =>
  import('@/routes/ConfiguratorPublic').then((m) => ({
    default: m.ConfiguratorPublic,
  })),
)

function PageLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', opacity: 0.5 }}>
      Loading&hellip;
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/c/:slug"
          element={<ConfiguratorPublic />}
        />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="designer" element={<AdminParametricDesigner />} />
          <Route path="materials" element={<AdminMaterials />} />
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  )
}
