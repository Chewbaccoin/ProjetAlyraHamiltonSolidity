// src/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { hardhat, baseSepolia } from 'wagmi/chains'
import { http } from 'viem'

if (!import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID) {
  throw new Error('Missing VITE_WALLET_CONNECT_PROJECT_ID')
}

export const config = getDefaultConfig({
  appName: 'Pump Music',
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
  chains: [ hardhat, baseSepolia],
  transports: {
    [baseSepolia.id]: http(`https://base-sepolia.infura.io/v3/${import.meta.env.VITE_INFURA_API_KEY}`)
  }
})

export const { chains } = config