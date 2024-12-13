import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useConfig, useSimulateContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { Music, Search, Loader2 } from 'lucide-react';
import { readContract } from '@wagmi/core';
import { parseUnits } from 'viem';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/Dialog';
import { Input } from './components/ui/Input';
import { Button }  from './components/ui/Button';
import { CONTRACTS } from '../contracts';
import Header from './components/Header';
import Footer from './components/Footer';

const TokenMarket = () => {
  // Main states and hooks for token market management
  const { isConnected, address } = useAccount();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const config = useConfig(); 
  const { writeContract } = useWriteContract();

  // Check ABI availability on load
  useEffect(() => {
    if (!CONTRACTS?.RoyaltyToken?.abi) {
      console.error('ABI not available for PumpMusicRoyaltyToken');
    }
  }, []);

  const { data: approveSimulation } = useSimulateContract({
    address: CONTRACTS.DAI.address,
    abi: CONTRACTS.DAI.abi,
    functionName: 'approve',
    args: [selectedToken?.address ?? '0x', 0n], // Default values until actual execution
  });
  
  const { data: purchaseSimulation, refetch: simulatePurchase } = useSimulateContract({
    address: selectedToken?.address ?? '0x',
    abi: CONTRACTS.RoyaltyToken.abi,
    functionName: 'purchaseTokens',
    args: [parseUnits(purchaseAmount || '0', 18)],
    enabled: false, // Only simulate when explicitly requested
  });
  

  // Lecture des informations principales du contrat
  const { data: royaltyInfo, isLoading: isRoyaltyLoading } = useReadContract({
    address: CONTRACTS?.PumpMusicRoyaltyToken?.address,
    abi: CONTRACTS?.PumpMusicRoyaltyToken?.abi,
    functionName: 'royaltyInfo',
    enabled: !!(CONTRACTS?.PumpMusicRoyaltyToken?.address && CONTRACTS?.PumpMusicRoyaltyToken?.abi)
  });

  const { data: tokenPrice } = useReadContract({
    address: CONTRACTS?.RoyaltyToken?.address,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'tokenPrice',
    enabled: !!(CONTRACTS?.RoyaltyToken?.address && CONTRACTS?.RoyaltyToken?.abi)
  });

  const { data: isListed } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'isListedForSale',
    enabled: !!(CONTRACTS?.TokenFactory?.address && CONTRACTS?.TokenFactory?.abi)
  });

  const { data: totalSupply } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'totalSupply',
    enabled: !!(CONTRACTS?.TokenFactory?.address && CONTRACTS?.TokenFactory?.abi)
  });

  // Nouvelle lecture pour tous les tokens
  const { data: allTokens } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'getAllTokens',
    enabled: !!CONTRACTS?.TokenFactory
  });

  // Modifiez la partie du filtrage des tokens
  const filteredTokens = allTokens || [];
  const TokenCard = ({ tokenAddress, searchTerm }) => {
    // Composant pour afficher les informations d'un token individuel
    const [isLoading, setIsLoading] = useState(true);

    // Lecture des détails spécifiques au token
    const { data: tokenName } = useReadContract({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'name',
      enabled: !!tokenAddress && !!CONTRACTS?.RoyaltyToken?.abi,
    });

    const { data: tokenSymbol } = useReadContract({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'symbol',
      enabled: !!tokenAddress && !!CONTRACTS?.RoyaltyToken?.abi,
    });

    const { data: tokenRoyaltyInfo } = useReadContract({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'royaltyInfo',
      enabled: !!tokenAddress && !!CONTRACTS?.RoyaltyToken?.abi,
    });

    const { data: currentTokenPrice } = useReadContract({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'tokenPrice',
      enabled: !!tokenAddress && !!CONTRACTS?.RoyaltyToken?.abi,
    });

    const { data: isTokenListed } = useReadContract({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'isListedForSale',
      enabled: !!tokenAddress && !!CONTRACTS?.RoyaltyToken?.abi,
    });

    useEffect(() => {
      if (tokenAddress) {}
    }, [tokenAddress, tokenName, tokenSymbol, currentTokenPrice, isTokenListed]);

    // Fonction utilitaire pour formater le pourcentage des royalties
    const formatRoyaltyPercentage = (royaltyInfo) => {
      if (!royaltyInfo) return "Not available";
      const royaltyPercentage = Number(royaltyInfo[1]);
      return `${(royaltyPercentage / 100).toFixed(2)}%`;
    };

    // Fonction utilitaire pour formater la date d'expiration
    const formatExpirationDate = (royaltyInfo) => {
      if (!royaltyInfo) return "Not available";
      const timestamp = Number(royaltyInfo[0]);
      if (isNaN(timestamp)) return "Not available";
      return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    };

    // Cette fonction matchesSearch est déjà correcte et gère le filtrage
    const matchesSearch = () => {
      if (!searchTerm) return true;
      const searchTermLower = searchTerm.toLowerCase();
      return (
        tokenName?.toLowerCase().includes(searchTermLower) ||
        tokenSymbol?.toLowerCase().includes(searchTermLower)
      );
    };

    // Ne rendez la carte que si elle correspond aux critères de recherche
    if (!matchesSearch()) return null;

    return (
      <div className="token-card">
        <div className="token-card-content">
          <div className="token-card-header">
            <h3 className="token-name">
              {tokenName || "Loading..."}
            </h3>
            <span id={`token-symbol-${tokenAddress}`} className="token-symbol">
              {"$"+tokenSymbol || "..."}
            </span>
          </div>
          <div className="token-card-details">
            <div className="token-card-row">
              <span className="token-detail-label">Price</span>
              <span id={`token-price-${tokenAddress}`} className="token-detail-value">
                {currentTokenPrice ? `${(Number(currentTokenPrice) / 1e18).toFixed(8)} DAI` : "Not available"}
              </span>
            </div>
            <div className="token-card-row">
              <span className="token-detail-label">Royalties</span>
              <span id={`token-royalties-${tokenAddress}`} className="token-detail-value">
                {formatRoyaltyPercentage(tokenRoyaltyInfo)}
              </span>
            </div>
            <div className="token-card-row">
              <span className="token-detail-label">Expiration date</span>
              <span id={`token-expiration-${tokenAddress}`} className="token-detail-value">
                {formatExpirationDate(tokenRoyaltyInfo)}
              </span>
            </div>
            <div className="token-card-row">
              <span className="token-detail-label">Available</span>
              <span id={`token-supply-${tokenAddress}`} className="token-detail-value">
                {totalSupply ? Number(totalSupply).toLocaleString() : "Not available"}
              </span>
            </div>
          </div>
          <Button 
  className="token-buy-button"
  disabled={!isTokenListed || !isConnected || !currentTokenPrice}
  onClick={() => {
    if (!currentTokenPrice) {
      console.error("Prix du token non disponible");
      return;
    }
    
    setSelectedToken({
      address: tokenAddress,
      name: tokenName,
      price: currentTokenPrice.toString()
    });
    setShowBuyDialog(true);
  }}
>
  {isTokenListed ? "Buy Tokens" : "Not available"}
</Button>
        </div>
      </div>
    );
  };

  useEffect(() => {}, []);

  // Affiche un loader pendant le chargement des données
  if (isRoyaltyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Modified handleBuyTokens function
  const handleBuyTokens = async () => {
    try {
      if (!selectedToken?.address || !selectedToken?.price) {
        throw new Error('Invalid token selection or price information');
      }
      
      setIsPurchasing(true);
      
      // Add validation for purchaseAmount
      if (!purchaseAmount || isNaN(purchaseAmount) || purchaseAmount <= 0) {
        throw new Error('Please enter a valid purchase amount');
      }

      // Calculate exact amounts using BigInt to avoid precision issues
      const tokenAmount = parseUnits(purchaseAmount, 18);
      const pricePerToken = BigInt(selectedToken.price);
      const totalCost = (pricePerToken * tokenAmount) / BigInt(10**18);

      // First check DAI allowance and approve if needed
      const currentAllowance = await readContract(config, {
        address: CONTRACTS.DAI.address,
        abi: CONTRACTS.DAI.abi,
        functionName: 'allowance',
        args: [address, selectedToken.address],
      });

      if (currentAllowance < totalCost) {
        console.log('Approving DAI spend...');
        const approveHash = await writeContract({
          address: CONTRACTS.DAI.address,
          abi: CONTRACTS.DAI.abi,
          functionName: 'approve',
          args: [selectedToken.address, totalCost],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
      }

      // Now simulate the purchase
      const simulation = await simulatePurchase();
      if (!simulation?.request) {
        throw new Error('Purchase simulation failed. Please check your balance and try again.');
      }

      // Execute the purchase
      console.log('Executing purchase...');
      const purchaseHash = await writeContract(simulation.request);
      await waitForTransactionReceipt(config, { hash: purchaseHash });
      
      setShowBuyDialog(false);
      setPurchaseAmount('');
      
    } catch (error) {
      console.error('Error during purchase:', error);
      // Provide more specific error messages
      if (error.message.includes('insufficient')) {
        alert('Insufficient balance to complete the purchase');
      } else if (error.message.includes('user rejected')) {
        alert('Transaction was rejected');
      } else {
        alert(`Purchase failed: ${error.message}`);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      <main className="page-main">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* En-tête de la page */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Music className="w-8 h-8 text-purple-500" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Token Market</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  Discover and invest in music royalty tokens
                </p>
              </div>
            </div>
          </div>

          {/* Barre de recherche et filtres */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search by name, symbol, or artist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button 
                variant={filter === 'listed' ? 'default' : 'outline'}
                onClick={() => setFilter('listed')}
              >
                Recently Listed
              </Button>
              <Button 
                variant={filter === 'sold' ? 'default' : 'outline'}
                onClick={() => setFilter('sold')}
              >
                Most Sold
              </Button>
            </div>
          </div>

          {/* Grille des tokens disponibles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTokens?.map((tokenAddress) => (
              <TokenCard 
                key={tokenAddress} 
                tokenAddress={tokenAddress}
                searchTerm={searchTerm}
              />
            ))}
          </div>

          {/* Message affiché quand aucun token n'est trouvé */}
          {(!filteredTokens || filteredTokens.length === 0) && (
            <div className="text-center py-12">
              <Music className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No tokens found</h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy {selectedToken?.name} Tokens</DialogTitle>
            <DialogDescription>
              Enter the amount of tokens you want to purchase
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Input
              type="number"
              placeholder="Amount of tokens"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              step="0.000001"
              min="0"
              className="w-full"
            />
            <div className="mt-2 text-sm text-gray-500">
              Total cost: {purchaseAmount && selectedToken?.price 
                ? `${(Number(purchaseAmount) * Number(selectedToken.price) / 10**18).toFixed(8)} DAI` 
                : '0 DAI'}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBuyDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBuyTokens}
              disabled={!purchaseAmount || isPurchasing}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Purchase'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TokenMarket;