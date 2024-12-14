import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useConfig, useSimulateContract } from 'wagmi';
import { waitForTransactionReceipt, readContract } from '@wagmi/core';
import { Music, Search, Loader2 } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/Dialog';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { CONTRACTS } from '../contracts';
import Header from './components/Header';
import Footer from './components/Footer';

const TokenMarket = () => {
  const { isConnected, address } = useAccount();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');
  const config = useConfig();
  const { writeContract } = useWriteContract();
  const [isSimulating, setIsSimulating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const { data: allTokens } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'getAllTokens',
    enabled: !!CONTRACTS?.TokenFactory
  });

  const checkAllowance = async (tokenAddress) => {
    if (!address || !tokenAddress) return BigInt(0);
    try {
      return await readContract(config, {
        address: CONTRACTS.DAI.address,
        abi: CONTRACTS.DAI.abi,
        functionName: 'allowance',
        args: [address, tokenAddress],
      });
    } catch (error) {
      return BigInt(0);
    }
  };

  const calculatePurchaseCost = (amount, tokenPrice) => {
    if (!amount || !tokenPrice) return BigInt(0);
    try {
      const tokenAmount = parseUnits(amount, 18);
      return (tokenAmount * BigInt(tokenPrice)) / parseUnits('1', 18);
    } catch (error) {
      return BigInt(0);
    }
  };

  const { data: simulateData, error: simulateError } = useSimulateContract({
    address: selectedToken?.address,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'purchaseTokens',
    args: purchaseAmount ? [parseUnits(purchaseAmount, 18)] : undefined,
    enabled: !!selectedToken?.address && !!purchaseAmount
  });

  const { request } = simulateData || {};

  useEffect(() => {
  }, [simulateError]);

  const handleBuyTokens = async () => {
    try {
      if (!selectedToken?.address || !selectedToken?.price) {
        throw new Error('Invalid token selection');
      }
      
      setError('');
      setIsPurchasing(true);

      if (!purchaseAmount || isNaN(purchaseAmount) || parseFloat(purchaseAmount) <= 0) {
        throw new Error('Please enter a valid purchase amount');
      }

      const tokenAmount = parseUnits(purchaseAmount, 18);
      const totalCost = calculatePurchaseCost(purchaseAmount, selectedToken.price);

      // Check balance first
      const balance = await readContract(config, {
        address: CONTRACTS.DAI.address,
        abi: CONTRACTS.DAI.abi,
        functionName: 'balanceOf',
        args: [address],
      });

      if (balance < totalCost) {
        throw new Error('Insufficient DAI balance');
      }

      // Handle allowance
      const currentAllowance = await checkAllowance(selectedToken.address);
      
      if (currentAllowance < totalCost) {
        const approveHash = await writeContract({
          address: CONTRACTS.DAI.address,
          abi: CONTRACTS.DAI.abi,
          functionName: 'approve',
          args: [selectedToken.address, totalCost],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
        
        // Close dialog and show approval success message
        setShowBuyDialog(false);
        setSuccessMessage('DAI approval successful! You can now proceed with the purchase.');
        setPurchaseAmount('');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
          // Reopen dialog after showing approval success
          setShowBuyDialog(true);
        }, 3000);
        
        return; // Exit function after approval
      }

      if (simulateError) {
        throw new Error(simulateError.message || 'Transaction simulation failed');
      }

      if (!simulateData || !request) {
        throw new Error('Transaction simulation in progress. Please try again in a moment.');
      }

      const purchaseHash = await writeContract(request);
      await waitForTransactionReceipt(config, { hash: purchaseHash });
      
      // Close dialog and show purchase success message
      setShowBuyDialog(false);
      setPurchaseAmount('');
      setSuccessMessage(`Successfully purchased ${purchaseAmount} ${selectedToken.name} tokens!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      
      if (error.message.includes('simulation failed')) {
        setError('Transaction simulation failed. Please check your inputs and try again.');
      } else if (error.message.includes('TokensNotListed')) {
        setError('These tokens are not currently listed for sale');
      } else if (error.message.includes('InsufficientBalance')) {
        setError('Insufficient DAI balance');
      } else if (error.message.includes('InsufficientAllowance')) {
        setError('Please approve DAI spending first');
      } else if (error.message.includes('InvalidAmount')) {
        setError('Invalid purchase amount');
      } else {
        setError(error.message);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const TokenCard = ({ tokenAddress, searchTerm }) => {
    const [isLoading, setIsLoading] = useState(true);

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

    const { data: totalSupply } = useReadContract({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'totalSupply',
      enabled: !!tokenAddress && !!CONTRACTS?.RoyaltyToken?.abi,
    });

    useEffect(() => {
      if (tokenAddress && tokenName && tokenSymbol && currentTokenPrice && isTokenListed) {
        setIsLoading(false);
      }
    }, [tokenAddress, tokenName, tokenSymbol, currentTokenPrice, isTokenListed]);

    const formatRoyaltyPercentage = (royaltyInfo) => {
      if (!royaltyInfo) return "Not available";
      const royaltyPercentage = Number(royaltyInfo[1]);
      return `${(royaltyPercentage / 100).toFixed(2)}%`;
    };

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

    const matchesSearch = () => {
      if (!searchTerm) return true;
      const searchTermLower = searchTerm.toLowerCase();
      return (
        tokenName?.toLowerCase().includes(searchTermLower) ||
        tokenSymbol?.toLowerCase().includes(searchTermLower)
      );
    };

    if (!matchesSearch()) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {tokenName || "Loading..."}
            </h3>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {"$" + tokenSymbol || "..."}
            </span>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Price</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {currentTokenPrice ? `${formatUnits(currentTokenPrice, 18)} DAI` : "Not available"}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Royalties</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatRoyaltyPercentage(tokenRoyaltyInfo)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Expiration</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatExpirationDate(tokenRoyaltyInfo)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Supply</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {totalSupply ? formatUnits(totalSupply, 18) : "Not available"}
              </span>
            </div>
          </div>

          <Button 
            className="w-full mt-6"
            disabled={!isTokenListed || !isConnected || !currentTokenPrice}
            onClick={() => {
              if (!currentTokenPrice) {
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
            {isTokenListed ? "Buy Tokens" : "Not Available"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      
      <main className="page-main">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Music className="h-8 w-8 text-purple-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Token Market
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Discover and invest in music royalty tokens
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search by name or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
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
                Listed
              </Button>
              <Button 
                variant={filter === 'popular' ? 'default' : 'outline'}
                onClick={() => setFilter('popular')}
              >
                Popular
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allTokens?.map((tokenAddress) => (
              <TokenCard 
                key={tokenAddress} 
                tokenAddress={tokenAddress}
                searchTerm={searchTerm}
              />
            ))}
          </div>

          {(!allTokens || allTokens.length === 0) && (
            <div className="text-center py-12">
              <Music className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                No tokens found
              </h3>
              <p className="mt-2 text-gray-500">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>
      </main>

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
              onChange={(e) => {
                setPurchaseAmount(e.target.value);
                setError('');
              }}
              step="0.000001"
              min="0"
              className="w-full"
            />
            <div className="mt-2 text-sm text-gray-500">
              Total cost: {purchaseAmount && selectedToken?.price 
                ? `${formatUnits(calculatePurchaseCost(purchaseAmount, selectedToken.price), 18)} DAI`
                : '0 DAI'}
            </div>
          </div>

          <DialogFooter>
          <Button
              variant="outline"
              onClick={() => {
                setShowBuyDialog(false);
                setError('');
                setPurchaseAmount('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBuyTokens}
              disabled={!purchaseAmount || isPurchasing || isSimulating || parseFloat(purchaseAmount) <= 0}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : isSimulating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                'Confirm Purchase'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />

      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 animate-fade-in">
          <span className="block sm:inline">{successMessage}</span>
        </div>
      )}
    </div>
  );
};

export default TokenMarket;