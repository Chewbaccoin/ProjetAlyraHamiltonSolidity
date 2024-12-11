// src/components/Header.jsx
import { Music, Sun, Moon } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import '../../styles/Header.css';

const Header = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Évite les problèmes d'hydratation
  useEffect(() => {
    setMounted(true);
  }, []);

  const navigationItems = [
    { label: 'Home', path: '/' },
    { label: 'Create Token', path: '/create' },
    { label: 'Swap', path: '/market' },
    { label: 'Market', path: '/swap' }
  ];

  if (!mounted) {
    return null;
  }

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="flex items-center space-x-12">
            <div className="logo-container">
              <Music className="logo-icon" />
              <span className="logo-text">Pump Music</span>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              {navigationItems.map((item) => (
                <a
                  key={item.path}
                  href={item.path}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors duration-200"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="actions-container">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="theme-icon" />
              ) : (
                <Moon className="theme-icon" />
              )}
            </button>
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                return (
                  <div>
                    {(() => {
                      if (!mounted || !account || !chain) {
                        return (
                          <button
                            onClick={openConnectModal}
                            className="connect-button"
                          >
                            Connecter
                          </button>
                        );
                      }
                      return (
                        <div className="wallet-container">
                          <button
                            onClick={openChainModal}
                            className="chain-button"
                          >
                            {chain.name}
                          </button>
                          <button
                            onClick={openAccountModal}
                            className="connect-button"
                          >
                            {account.displayName}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;