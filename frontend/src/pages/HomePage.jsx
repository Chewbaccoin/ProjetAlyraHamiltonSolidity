import React from 'react';
import { useAccount } from 'wagmi';
import { 
  RotateCw, 
  Music, 
  DollarSign, 
  RefreshCw,
  TrendingUp,
  Shield,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

const HomePage = () => {
  const { isConnected, address } = useAccount();
  const navigate = useNavigate();

  const features = [
    {
      title: "Tokenize Your Music",
      description: "Convert your music royalties into tradeable tokens, giving you instant access to future earnings.",
      icon: <Music className="w-6 h-6 text-purple-400" />,
      path: '/create'
    },
    {
      title: "Trade Royalty Tokens",
      description: "Buy and sell music royalty tokens in our decentralized marketplace.",
      icon: <DollarSign className="w-6 h-6 text-purple-400" />,
      path: '/market'
    },
    {
      title: "Swap Tokens",
      description: "Easily swap between different artist tokens or convert to USDC.",
      icon: <RefreshCw className="w-6 h-6 text-purple-400" />,
      path: '/swap'
    },
    {
      title: "Earn Royalties",
      description: "Automatically receive your share of royalties based on token ownership.",
      icon: <RotateCw className="w-6 h-6 text-purple-400" />,
      path: '/dashboard'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto pt-24 pb-20 text-center px-6">
          <div className="animate-fade-in">
            <h1 className="hero-title">
              The Future of Music Finance
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Revolutionize music funding with blockchain technology. 
              Create, trade, and earn from music royalty tokens.
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-6 py-16 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-3xl mx-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                onClick={() => navigate(feature.path)}
                className="feature-card group"
              >
                <div className="flex items-center mb-4">
                  <div className="feature-icon-container">
                    {feature.icon}
                  </div>
                  <h3 className="ml-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="border-t border-gray-200/50 dark:border-gray-800/50 mt-16">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="stats-card">
                <h4 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  $1M+
                </h4>
                <p className="text-gray-600 dark:text-gray-300">Trading Volume</p>
              </div>
              <div className="stats-card">
                <h4 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  500+
                </h4>
                <p className="text-gray-600 dark:text-gray-300">Verified Artists</p>
              </div>
              <div className="stats-card">
                <h4 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  10K+
                </h4>
                <p className="text-gray-600 dark:text-gray-300">Token Holders</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;