import React, { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Music, Ban, ChevronRight, Loader2, LineChart, Coins, Users, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Button } from './components/ui/Button';
import { CONTRACTS } from '../contracts';
import TokenManagement from './components/TokenManagement';
import Header from './components/Header';
import Footer from './components/Footer';

const Dashboard = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  // Vérifie si l'utilisateur est un artiste
  const { data: isArtist, isLoading: isCheckingArtist } = useReadContract({
    address: CONTRACTS?.ArtistSBT?.address,
    abi: CONTRACTS?.ArtistSBT?.abi,
    functionName: 'isArtist',
    args: [address],
    enabled: isConnected,
  });

  // Récupère tous les tokens de l'artiste
  const { data: artistTokens, isLoading: isLoadingTokens } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'getArtistTokens',
    args: [address],
    enabled: isConnected,
  });

  // Fonction utilitaire pour formater le pourcentage des royalties
  const formatRoyaltyPercentage = (royaltyInfo) => {
    if (!royaltyInfo) return "N/A";
    const royaltyPercentage = Number(royaltyInfo[1]);
    return `${(royaltyPercentage / 100).toFixed(2)}%`;
  };

  // Fonction utilitaire pour formater la date d'expiration
  const formatExpirationDate = (royaltyInfo) => {
    if (!royaltyInfo) return "N/A";
    const timestamp = Number(royaltyInfo[0]);
    if (isNaN(timestamp)) return "N/A";
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Artist Section Component
  const ArtistDashboard = () => {
    const TokenCard = ({ tokenAddress }) => {
      const [isManagementOpen, setIsManagementOpen] = useState(false);
      // Token contract reads
      const { data: tokenName } = useReadContract({
        address: tokenAddress,
        abi: CONTRACTS?.RoyaltyToken?.abi,
        functionName: 'name',
      });

      const { data: tokenSymbol } = useReadContract({
        address: tokenAddress,
        abi: CONTRACTS?.RoyaltyToken?.abi,
        functionName: 'symbol',
      });

      const { data: tokenPrice } = useReadContract({
        address: tokenAddress,
        abi: CONTRACTS?.RoyaltyToken?.abi,
        functionName: 'tokenPrice',
      });

      const { data: royaltyInfo } = useReadContract({
        address: tokenAddress,
        abi: CONTRACTS?.RoyaltyToken?.abi,
        functionName: 'royaltyInfo',
      });

      const { data: isListedForSale } = useReadContract({
        address: tokenAddress,
        abi: CONTRACTS?.RoyaltyToken?.abi,
        functionName: 'isListedForSale',
      });

      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tokenName || "Loading..."}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ${tokenSymbol || "..."}
              </span>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsManagementOpen(true)}
                >
                Manage
                <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Price</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {tokenPrice ? `${(Number(tokenPrice) / 1000000).toFixed(6)} USDC` : "N/A"}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Royalty Rate</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatRoyaltyPercentage(royaltyInfo)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg col-span-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Expiration</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatExpirationDate(royaltyInfo)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg col-span-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white flex items-center justify-between">
                {isListedForSale ? (
                  <span className="text-green-500">Listed for sale</span>
                ) : (
                  <span className="text-yellow-500">Not listed</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManagementOpen(true)}
                >
                  {isListedForSale ? 'Update Listing' : 'List for Sale'}
                </Button>
              </div>
            </div>
          </div>
          <TokenManagement 
            isOpen={isManagementOpen}
            onClose={() => setIsManagementOpen(false)}
            tokenAddress={tokenAddress}
            tokenName={tokenName}
            tokenSymbol={tokenSymbol}
            currentPrice={tokenPrice}
         />
        </div>
      );
    };

    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-purple-500/10">
            <Music className="w-8 h-8 text-purple-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Artist Dashboard</h2>
            <p className="text-gray-600 dark:text-gray-400">Manage your music tokens</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="stat-card">
            <Coins className="w-6 h-6 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your Tokens</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {artistTokens?.length || 0}
              </p>
            </div>
          </div>
          <div className="stat-card">
            <LineChart className="w-6 h-6 text-green-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.00</p>
            </div>
          </div>
          <div className="stat-card">
            <Users className="w-6 h-6 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Token Holders</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Tokens</h3>
            <Button onClick={() => navigate('/create')}>Create New Token</Button>
          </div>
          
          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : artistTokens?.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {artistTokens.map((tokenAddress) => (
                <TokenCard key={tokenAddress} tokenAddress={tokenAddress} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <Music className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No tokens yet</h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Create your first music token to start earning royalties
              </p>
              <Button 
                className="mt-4"
                onClick={() => navigate('/create')}
              >
                Create Token
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Investor Section Component
  const InvestorDashboard = () => {
    // Get investor's token balances and investments
    // This would need to be implemented based on your contracts
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-500/10">
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Investor Dashboard</h2>
            <p className="text-gray-600 dark:text-gray-400">Track your investments and earnings</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="stat-card">
            <Coins className="w-6 h-6 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tokens Owned</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
          </div>
          <div className="stat-card">
            <LineChart className="w-6 h-6 text-green-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.00</p>
            </div>
          </div>
          <div className="stat-card">
            <Users className="w-6 h-6 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Investments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Investments</h3>
            <Button onClick={() => navigate('/market')}>Explore Market</Button>
          </div>
          
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No investments yet</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Start investing in music tokens to earn royalties
            </p>
            <Button 
              className="mt-4"
              onClick={() => navigate('/market')}
            >
              Browse Marketplace
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Alert className="max-w-md mx-auto text-center">
            <div className="flex items-center justify-center gap-2">
              <Ban className="h-4 w-4" />
              <AlertDescription>
                Please connect your wallet to view your dashboard.
              </AlertDescription>
            </div>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      <main className="page-main">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
          {/* Artist Section */}
          {isArtist && <ArtistDashboard />}
          
          {/* Investor Section */}
          <InvestorDashboard />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;