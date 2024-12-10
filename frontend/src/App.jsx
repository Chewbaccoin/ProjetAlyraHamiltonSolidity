// src/App.jsx
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router } from 'react-router-dom'
import { config, chains } from './wagmi'
import { ThemeProvider } from 'next-themes'
import HomePage from './pages/HomePage'
import '@rainbow-me/rainbowkit/styles.css'
import './App.css'

const queryClient = new QueryClient()

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider chains={chains}>
            <Router>
              <HomePage />
            </Router>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}

export default App