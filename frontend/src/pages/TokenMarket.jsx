import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useConfig, useSimulateContract } from 'wagmi';
import { waitForTransactionReceipt, readContract } from '@wagmi/core';
import { Music, Search, Loader2, X } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/Dialog';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { CONTRACTS } from '../contracts';
import Header from './components/Header';
import Footer from './components/Footer';

const TokenCard = ({ tokenAddress, searchTerm, showOnlyAvailable, onBuyClick }) => {
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
  });

  const { data: tokenRoyaltyInfo } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'royaltyInfo',
  });

  const { data: currentTokenPrice } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'tokenPrice',
  });

  const { data: isTokenListed } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'isListedForSale',
  });

  const { data: totalSupply } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'totalSupply',
  });

  const { data: availableSupply } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'balanceOf',
    args: [tokenAddress],
  });

  const { isConnected } = useAccount();

  const circulatingSupply = totalSupply && availableSupply 
    ? formatUnits(totalSupply - availableSupply, 18)
    : "N/A";

  if (showOnlyAvailable && !isTokenListed) {
    return null;
  }

  if (!tokenName?.toLowerCase().includes(searchTerm.toLowerCase()) && 
      !tokenSymbol?.toLowerCase().includes(searchTerm.toLowerCase())) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">{tokenName || "Loading..."}</h3>
        <span className="text-sm font-medium">{"$" + tokenSymbol || "..."}</span>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span>Price</span>
          <span>{currentTokenPrice ? `${formatUnits(currentTokenPrice, 18)} DAI` : "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span>Royalties</span>
          <span>{tokenRoyaltyInfo ? `${(Number(tokenRoyaltyInfo[1]) / 100).toFixed(2)}%` : "N/A"}</span>
        </div>
        <div className="flex justify-between" title="Total number of tokens that exist for this royalty token">
          <span className="border-b border-dashed">Total Supply</span>
          <span>{totalSupply ? formatUnits(totalSupply, 18) : "N/A"}</span>
        </div>
        <div className="flex justify-between" title="Number of tokens currently held by other users">
          <span className="border-b border-dashed">Circulating Supply</span>
          <span>{circulatingSupply}</span>
        </div>
        <div className="flex justify-between" title="Number of tokens available for purchase">
          <span className="border-b border-dashed">Available Supply</span>
          <span>{availableSupply ? formatUnits(availableSupply, 18) : "N/A"}</span>
        </div>
      </div>

      <Button 
        className="w-full mt-6"
        disabled={!isTokenListed || !isConnected || !currentTokenPrice}
        onClick={() => onBuyClick(tokenAddress, tokenName, currentTokenPrice?.toString())}
      >
        {isTokenListed ? "Buy Tokens" : "Not Available"}
      </Button>
    </div>
  );
};

const TokenMarket = () => {
  const { isConnected, address } = useAccount();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [dialogMessage, setDialogMessage] = useState({ type: '', content: '' });
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  const config = useConfig();
  const { writeContract } = useWriteContract();

  const { data: allTokens } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'getAllTokens',
  });

  const handleBuyTokens = async () => {
    if (!selectedToken?.address || !purchaseAmount || isNaN(purchaseAmount) || parseFloat(purchaseAmount) <= 0) return;
    
    try {
      setIsPurchasing(true);
      setDialogMessage({ type: '', content: '' });

      const tokenAmount = parseUnits(purchaseAmount, 18);
      const totalCost = (tokenAmount * BigInt(selectedToken.price)) / parseUnits('1', 18);

      const balance = await readContract(config, {
        address: CONTRACTS.DAI.address,
        abi: CONTRACTS.DAI.abi,
        functionName: 'balanceOf',
        args: [address],
      });

      if (balance < totalCost) return;

      const allowance = await readContract(config, {
        address: CONTRACTS.DAI.address,
        abi: CONTRACTS.DAI.abi,
        functionName: 'allowance',
        args: [address, selectedToken.address],
      });
      
      if (allowance < totalCost) {
        setIsApproving(true);
        const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        const approveHash = await writeContract({
          address: CONTRACTS.DAI.address,
          abi: CONTRACTS.DAI.abi,
          functionName: 'approve',
          args: [selectedToken.address, maxUint256],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
        setIsApproving(false);
        setDialogMessage({
          type: 'success',
          content: 'DAI approval successful! You can now proceed with the purchase.'
        });
        return;
      }

      const purchaseHash = await writeContract({
        address: selectedToken.address,
        abi: CONTRACTS.RoyaltyToken.abi,
        functionName: 'purchaseTokens',
        args: [tokenAmount],
      });
      
      await waitForTransactionReceipt(config, { hash: purchaseHash });
      setDialogMessage({
        type: 'success',
        content: `Successfully purchased ${purchaseAmount} ${selectedToken.name} tokens!`
      });
      setPurchaseAmount('');
      
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto pt-32 pb-20 px-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-full bg-purple-500/10">
              <Music className="h-8 w-8 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Market</h1>
              <p className="text-gray-600 dark:text-gray-400">Browse and purchase music royalty tokens</p>
            </div>
          </div>

          <div className="relative mb-8 flex gap-4">
            <div className="search-field-wrapper">
              <Search className="search-icon" />
              <Input
                type="text"
                placeholder="Search by name or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-field pl-10 pr-10 w-full"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="clear-search-button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant={showOnlyAvailable ? "default" : "outline"}
              onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
              className="whitespace-nowrap"
            >
              {showOnlyAvailable ? "Show All" : "Show Available"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allTokens?.map((tokenAddress) => (
              <TokenCard 
                key={tokenAddress} 
                tokenAddress={tokenAddress}
                searchTerm={searchTerm}
                showOnlyAvailable={showOnlyAvailable}
                onBuyClick={(address, name, price) => {
                  setSelectedToken({ address, name, price });
                  setShowBuyDialog(true);
                }}
              />
            ))}
          </div>

          <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buy {selectedToken?.name} Tokens</DialogTitle>
                <DialogDescription>Enter the amount of tokens you want to purchase</DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <div className="space-y-4">
                  <Input
                    type="number"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    min="0"
                    step="0.000001"
                    placeholder="Enter amount of tokens"
                  />
                  <Input
                    type="text"
                    value={`Total cost: ${purchaseAmount && selectedToken?.price 
                      ? `${formatUnits(BigInt(purchaseAmount) * BigInt(selectedToken.price), 18)} DAI`
                      : '0 DAI'}`}
                    disabled
                    placeholder="Total cost in DAI"
                  />
                  {dialogMessage.content && (
                    <div className={`mt-4 p-3 rounded ${
                      dialogMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {dialogMessage.content}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBuyDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBuyTokens}
                  disabled={!purchaseAmount || isPurchasing || isApproving}
                >
                  {isPurchasing 
                    ? 'Processing...' 
                    : isApproving 
                      ? 'Approving...' 
                      : dialogMessage.type === 'success' && dialogMessage.content.includes('approval')
                        ? 'Confirm Purchase'
                        : 'Approve DAI'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TokenMarket;