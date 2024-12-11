import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utilitaire pour fusionner les classes Tailwind
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Utilitaire pour formater les adresses Ethereum
export function shortenAddress(address) {
  return `${address?.slice(0, 6)}...${address?.slice(-4)}`;
}

// Utilitaire pour formater les nombres avec décimales
export function formatAmount(amount, decimals = 18) {
  return (Number(amount) / 10 ** decimals).toFixed(decimals);
}