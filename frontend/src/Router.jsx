// src/Router.jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreateToken from './pages/CreateToken'
import TokenMarket from './pages/TokenMarket'
import SwapTokens from './pages/SwapTokens'

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
    path: "/market",
    element: <TokenMarket />,
  },
  {
    path: "/swap",
    element: <SwapTokens />,
  }
])

export default function Router() {
  return <RouterProvider router={router} />
}
