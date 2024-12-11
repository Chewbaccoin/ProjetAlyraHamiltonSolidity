// src/App.jsx
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { config, chains } from './wagmi'
import { ThemeProvider } from 'next-themes'
import HomePage from './pages/HomePage'
import CreateToken from './pages/CreateToken'
import '@rainbow-me/rainbowkit/styles.css'
import './App.css'

const queryClient = new QueryClient()

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider chains={chains}>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/create" element={<CreateToken />} />
              </Routes>
            </BrowserRouter>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}

export default App