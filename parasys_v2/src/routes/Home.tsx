import { Link } from 'react-router-dom'
import styles from './home.module.css'

export function Home() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Parasys</h1>
      <p className={styles.lead}>Parametric product configurators for manufacturing clients.</p>
      <ul className={styles.actions}>
        <li>
          <Link to="/c/demo">Open demo configurator</Link>
        </li>
        <li>
          <Link to="/admin/login">Admin sign-in</Link>
        </li>
      </ul>
    </div>
  )
}
