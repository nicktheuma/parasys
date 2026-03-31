import { NavLink, Outlet } from 'react-router-dom'
import styles from './admin.module.css'

export function AdminLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>Parasys · Admin</div>
        <nav className={styles.nav}>
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Configurators
          </NavLink>
          <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Orders
          </NavLink>
          <NavLink to="/admin/designer" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Graph
          </NavLink>
          <NavLink to="/admin/materials" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Materials
          </NavLink>
          <NavLink to="/admin/props" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Props
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
