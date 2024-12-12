// src/components/TokenManagement.jsx
import React, { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Loader2 } from 'lucide-react';
import { CONTRACTS } from '../../contracts';

const TokenManagement = ({ isOpen, onClose, tokenAddress, tokenName, tokenSymbol, currentPrice }) => {
  const isAlreadyListed = currentPrice && Number(currentPrice) > 0;
  
  const [newPrice, setNewPrice] = useState('');
  const [royaltyAmount, setRoyaltyAmount] = useState('');
  const [isListed, setIsListed] = useState(false);

  const { writeContract: listForSale, data: listData } = useWriteContract();

  const { writeContract: distributeRoyalties, data: distributeData } = useWriteContract();

  const { isLoading: isListing } = useWaitForTransactionReceipt({
    hash: listData?.hash,
  });

  const { isLoading: isDistributing } = useWaitForTransactionReceipt({
    hash: distributeData?.hash,
  });

  const { data: isListedData } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS.RoyaltyToken.abi,
    functionName: 'isListedForSale',
  });

  const handleUpdatePrice = () => {
    if (!newPrice) return;
    listForSale({
      address: tokenAddress,
      abi: CONTRACTS.RoyaltyToken.abi,
      functionName: 'listTokensForSale',
      args: [parseUnits(newPrice, 6)]
    });
  };

  const handleDistributeRoyalties = () => {
    if (!royaltyAmount) return;
    distributeRoyalties({
      address: tokenAddress,
      abi: CONTRACTS.RoyaltyToken.abi,
      functionName: 'distributeRoyalties',
      args: [parseUnits(royaltyAmount, 18)]
    });
  };

  const handleListForSale = () => {
    const priceToUse = newPrice || (currentPrice ? (Number(currentPrice) / 1000000).toString() : '0');
    listForSale({
      address: tokenAddress,
      abi: CONTRACTS.RoyaltyToken.abi,
      functionName: 'listTokensForSale',
      args: [parseUnits(priceToUse, 6)]
    });
  };

  useEffect(() => {
    setIsListed(isListedData || isAlreadyListed);
  }, [isListedData, isAlreadyListed]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
            Manage {tokenName} (${tokenSymbol})
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Configure your token settings and manage royalties
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section de mise à jour du prix */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Token Price</h3>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={`Current: ${currentPrice ? (Number(currentPrice) / 1000000).toFixed(6) : '0'} USDC`}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleUpdatePrice} disabled={isListing || !newPrice}>
                {isListing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Update'
                )}
              </Button>
            </div>
          </div>

          {/* Section de distribution des redevances */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Distribute Royalties</h3>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount in ETH"
                value={royaltyAmount}
                onChange={(e) => setRoyaltyAmount(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleDistributeRoyalties} disabled={isDistributing || !royaltyAmount}>
                {isDistributing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Distribute'
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Note: 3% platform fee will be applied to distributions
            </p>
          </div>

          {/* Section de mise en vente du token */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">List Token for Sale</h3>
            <div className="flex gap-2">
              <Button 
                onClick={handleListForSale} 
                disabled={isListed}
                className="w-full"
              >
                {isListing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isListed ? (
                  'Already Listed'
                ) : (
                  'List for Sale'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TokenManagement;