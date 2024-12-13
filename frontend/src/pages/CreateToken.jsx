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
        parseUnits(formData.tokenPrice, 18),
        CONTRACTS.DAI.address
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Header />
        <main className="page-main">
          <div className="max-w-7xl mx-auto px-4 py-8">
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
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isConnected && isArtist === false) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Header />
        <main className="page-main">
          <div className="max-w-7xl mx-auto px-4 py-8">
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
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      <main className="page-main">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="create-token-wrapper">
            <div className="create-token-header" className="create-token-title-section">
              <div id="create-token-icon" className="create-token-icon-wrapper">
                <Music className="w-full h-full" />
              </div>
              <div>
                <h1 className="create-token-title">Create Your Music Token</h1>
                <p className="create-token-subtitle">Configure your royalty token parameters</p>
              </div>
            </div>

            {isSuccess ? (
              <Alert className="max-w-md mt-20" variant="success">
                <AlertDescription>
                  Token created successfully!<br />You can now manage it in your dashboard.
                </AlertDescription>
              </Alert>
            ) : (
              <form id="create-token-form" onSubmit={handleSubmit} className="create-token-form pt-10">
                <div id="create-token-form-container" className="create-token-form-section">
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
                      <Label className="create-token-label">Token Price (DAI)</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="1.00"
                          value={formData.tokenPrice}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.includes('.') && value.split('.')[1].length > 4) {
                              return;
                            }
                            setFormData({...formData, tokenPrice: value});
                          }}
                          className="create-token-input"
                          required
                        />
                        <span className="text-gray-400">DAI</span>
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
      </main>
      <Footer />
    </div>
  );
};

export default CreateToken;