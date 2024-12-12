// src/Router.jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreateToken from './pages/CreateToken'
import TokenMarket from './pages/TokenMarket'
import SwapTokens from './pages/SwapTokens'
import Dashboard from './pages/Dashboard'
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/create",
    element: <CreateToken />,
  },
  {
    path: "/swap",
    element: <SwapTokens />,
  },
  {
    path: "/market",
    element: <TokenMarket />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  }
])

export default function Router() {
  return <RouterProvider router={router} />
}
