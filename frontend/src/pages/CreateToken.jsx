import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { Alert, AlertDescription} from './components/ui/Alert';
import { Button }  from './components/ui/Button';
import { Input }  from './components/ui/Input';
import { Label } from './components/ui/Label';

import { Music, AlertCircle, Loader2 } from 'lucide-react';

// Import des ABI (à placer dans un dossier séparé)
import { CONTRACTS } from '../contracts';
import Header from './components/Header';
import Footer from './components/Footer';

const CreateToken = () => {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    royaltyPercentage: '',
    duration: '365',
    tokenPrice: '',
  });

  // Vérification du statut d'artiste via SBT
  const { data: isArtist, isError: isArtistError } = useReadContract({
    address: CONTRACTS.ArtistSBT.address,
    abi: CONTRACTS.ArtistSBT.abi,
    functionName: 'isArtist',
    args: [address],
    enabled: !!address && isConnected,
  });

  // Création du token
  const { writeContract: createToken, data: createTokenData } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: createTokenData,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isConfirmed) {
      setIsSuccess(true);
      setIsCreating(false);
    }
  }, [isConfirmed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSuccess(false);
    
    try {
      setIsCreating(true);
      const args = [
        formData.name,
        formData.symbol,
        parseUnits(formData.royaltyPercentage, 2),
        BigInt(Number(formData.duration) * 24 * 60 * 60),
        parseUnits(formData.tokenPrice, 6),
        CONTRACTS.USDC.address
      ];

      createToken({
        address: CONTRACTS.TokenFactory.address,
        abi: CONTRACTS.TokenFactory.abi,
        functionName: 'createToken',
        args
      });
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="create-token-container min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex items-center justify-center flex-grow py-12">
          <Alert className="max-w-md">
          <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please connect your wallet to create a token.
              </AlertDescription>
            </div>
          </Alert>            
        </div>
        <Footer />
      </div>
    );
  }

  if (isConnected && isArtist === false) {
    return (
      <div className="create-token-container min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-grow flex items-center justify-center py-12">
          <Alert className="max-w-md" variant="destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You must be a verified artist to create tokens.
              </AlertDescription>
            </div>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="create-token-container min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex-grow py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="create-token-header flex items-center gap-2">
            <div className="create-token-icon">
              <Music className="w-8 h-8 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Your Music Token</h1>
              <p className="text-gray-600 dark:text-gray-400">Configure your royalty token parameters</p>
            </div>
          </div>

          {isSuccess ? (
            <Alert className="max-w-md" variant="success">
              <AlertDescription>
                Token created successfully!<br />You can now manage it in your dashboard.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="create-token-form">
              <div className="create-token-form-container">
                <div className="space-y-4">
                  <div>
                    <Label className="create-token-label">Token Name</Label>
                    <Input
                      type="text"
                      placeholder="e.g., Artist Token"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="create-token-input"
                      required
                    />
                  </div>

                  <div>
                    <Label className="create-token-label">Token Symbol</Label>
                    <Input
                      type="text"
                      placeholder="e.g., ARTK"
                      value={formData.symbol}
                      onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                      className="create-token-input"
                      required
                      maxLength={5}
                    />
                  </div>

                  <div>
                    <Label className="create-token-label">Royalty Percentage</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.01"
                        value={formData.royaltyPercentage}
                        onChange={(e) => setFormData({...formData, royaltyPercentage: e.target.value})}
                        className="create-token-input"
                        required
                      />
                      <span className="text-gray-400">%</span>
                    </div>
                  </div>

                  <div>
                    <Label className="create-token-label">Duration (days)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.duration}
                      onChange={(e) => setFormData({...formData, duration: e.target.value})}
                      className="create-token-input"
                      required
                    />
                  </div>

                  <div>
                    <Label className="create-token-label">Token Price (USDC)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        step="0.000001"
                        min="0"
                        placeholder="1.00"
                        value={formData.tokenPrice}
                        onChange={(e) => setFormData({...formData, tokenPrice: e.target.value})}
                        className="create-token-input"
                        required
                      />
                      <span className="text-gray-400">USDC</span>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Token...
                  </>
                ) : (
                  'Create Token'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CreateToken;