// src/App.jsx
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { config, chains } from './wagmi'
import { ThemeProvider } from 'next-themes'
import HomePage from './pages/HomePage'
import CreateToken from './pages/CreateToken'
import TokenMarket from './pages/TokenMarket'
import SwapTokens from './pages/SwapTokens'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import '@rainbow-me/rainbowkit/styles.css'
import './App.css'
import { useEffect } from 'react'

const queryClient = new QueryClient()

function App() {

  useEffect(() => {
    document.title = "Pump.Music"
  }, [])
  
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider chains={chains}>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/create" element={<CreateToken />} />
                <Route path="/market" element={<TokenMarket />} />
                <Route path="/swap" element={<SwapTokens />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </BrowserRouter>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}

export default App