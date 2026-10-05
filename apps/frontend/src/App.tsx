import { useEffect, useState } from 'react'
import './App.css'
import AdminPage from './pages/AdminPage'
import MenuPage from './pages/MenuPage'
import OrdersPage from './pages/OrdersPage'

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return pathname
}

function App() {
  const pathname = usePathname()
  if (pathname === '/orders') return <OrdersPage />
  if (pathname === '/admin') return <AdminPage />
  return <MenuPage />
}

export default App
