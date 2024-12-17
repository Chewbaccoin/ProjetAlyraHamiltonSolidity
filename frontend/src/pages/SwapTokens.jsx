import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useConfig } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { ArrowDownUp, RefreshCcw, Loader2, Ban, Droplet } from 'lucide-react';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/Select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/Tabs';
import Header from './components/Header';
import Footer from './components/Footer';
import { CONTRACTS } from '../contracts';

const SwapTokens = () => {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { writeContract } = useWriteContract();
  
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lpFromAmount, setLpFromAmount] = useState('');
  const [lpToAmount, setLpToAmount] = useState('');
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [activeTab, setActiveTab] = useState("swap");

  // Get all available tokens
  const { data: allTokens, isError: isTokensError } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'getAllTokens',
    onError: (error) => {
      console.error('Error fetching tokens:', error);
      setError('Failed to load tokens');
    },
  });

  // Get token names for display
  const { data: tokenNames } = useReadContracts({
    contracts: allTokens?.map(token => ({
      address: token,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'name',
    })) || [],
  });

  // Get estimated output amount
  const { data: estimatedOutput } = useReadContract({
    address: CONTRACTS?.PumpMusicSwap?.address,
    abi: CONTRACTS?.PumpMusicSwap?.abi,
    functionName: 'getSwapAmount',
    args: fromAmount && [
      parseUnits(fromAmount || '0', 18),
      fromToken,
      toToken,
    ],
    enabled: !!(fromAmount && fromToken && toToken),
  });

  // Update estimated output when inputs change
  useEffect(() => {
    if (estimatedOutput) {
      setToAmount(formatUnits(estimatedOutput, 18));
    }
  }, [estimatedOutput]);

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) return;
    
    try {
      setError('');
      setIsSwapping(true);

      const amountIn = parseUnits(fromAmount, 18);
      
      // Check if swapping with DAI
      const isFromBase = fromToken === CONTRACTS.DAI.address;
      const isToBase = toToken === CONTRACTS.DAI.address;

      // Set up approval
      const tokenToApprove = isFromBase ? fromToken : toToken;
      const allowance = await readContract(config, {
        address: tokenToApprove,
        abi: CONTRACTS.RoyaltyToken.abi,
        functionName: 'allowance',
        args: [address, CONTRACTS.PumpMusicSwap.address],
      });

      if (allowance < amountIn) {
        setIsApproving(true);
        const approveHash = await writeContract({
          address: tokenToApprove,
          abi: CONTRACTS.RoyaltyToken.abi,
          functionName: 'approve',
          args: [CONTRACTS.PumpMusicSwap.address, amountIn],
        });
        await waitForTransactionReceipt(config, { hash: approveHash });
        setIsApproving(false);
      }

      // Execute swap based on token types
      let swapHash;
      if (isFromBase && !isToBase) {
        // DAI to royalty token
        swapHash = await writeContract({
          address: CONTRACTS.PumpMusicSwap.address,
          abi: CONTRACTS.PumpMusicSwap.abi,
          functionName: 'swapDAIForToken',
          args: [
            toToken,
            amountIn,
            parseUnits(toAmount, 18).mul(95).div(100), // 5% slippage
          ],
        });
      } else if (!isFromBase && isToBase) {
        // Royalty token to DAI
        swapHash = await writeContract({
          address: CONTRACTS.PumpMusicSwap.address,
          abi: CONTRACTS.PumpMusicSwap.abi,
          functionName: 'swapTokenForDAI',
          args: [
            fromToken,
            amountIn,
            parseUnits(toAmount, 18).mul(95).div(100), // 5% slippage
          ],
        });
      } else {
        // Token to token
        swapHash = await writeContract({
          address: CONTRACTS.PumpMusicSwap.address,
          abi: CONTRACTS.PumpMusicSwap.abi,
          functionName: 'swapTokenForToken',
          args: [
            fromToken,
            toToken,
            amountIn,
            parseUnits(toAmount, 18).mul(95).div(100), // 5% slippage
          ],
        });
      }
      
      await waitForTransactionReceipt(config, { hash: swapHash });
      
      // Clear form
      setFromAmount('');
      setToAmount('');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!fromToken || !toToken || !lpFromAmount || !lpToAmount) return;
    
    try {
        setError('');
        setIsAddingLiquidity(true);

        const fromAmountIn = parseUnits(lpFromAmount, 18);
        const toAmountIn = parseUnits(lpToAmount, 18);

        // Approve both tokens
        const approveToken = await writeContract({
            address: fromToken,
            abi: CONTRACTS.RoyaltyToken.abi,
            functionName: 'approve',
            args: [CONTRACTS.PumpMusicSwap.address, fromAmountIn],
        });
        await waitForTransactionReceipt(config, { hash: approveToken });

        const approveDAI = await writeContract({
            address: CONTRACTS.DAI.address,
            abi: CONTRACTS.DAI.abi,
            functionName: 'approve',
            args: [CONTRACTS.PumpMusicSwap.address, toAmountIn],
        });
        await waitForTransactionReceipt(config, { hash: approveDAI });

        // Add liquidity
        const addLiquidityHash = await writeContract({
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'addLiquidity',
            args: [fromToken, fromAmountIn, toAmountIn],
        });
        
        await waitForTransactionReceipt(config, { hash: addLiquidityHash });
        
        // Clear form
        setLpFromAmount('');
        setLpToAmount('');
        
    } catch (err) {
        console.error('Add Liquidity Error:', err);
        setError(err.message);
    } finally {
        setIsAddingLiquidity(false);
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleTabChange = (value) => {
    console.log('Tab changed to:', value);
    setActiveTab(value);
  };

  // Add a base token selector component
  const BaseTokenSelector = () => (
    <Select value={selectedBase} onValueChange={setSelectedBase}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select base token" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="DAI">DAI</SelectItem>
      </SelectContent>
    </Select>
  );

  const getTokenName = (address) => {
    if (address === CONTRACTS.DAI.address) return 'DAI';
    return tokenNames?.[allTokens?.indexOf(address)]?.result || 'Loading...';
  };

  if (!isConnected) {
    return (
      <div className="swap-container">
        <Header />
        <main className="swap-main">
          <div className="swap-content">
            <h1 className="swap-title">
              Swap Platform
            </h1>
            
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="swap-tabs-list">
                <TabsTrigger value="swap" className="swap-tab-trigger">
                  <RefreshCcw className="h-4 w-4" />
                  Token Exchange
                </TabsTrigger>
                <TabsTrigger value="liquidity" className="swap-tab-trigger">
                  <Droplet className="h-4 w-4" />
                  Liquidity Pool
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="swap">
                <Card className="swap-card">
                  <div className="swap-card-gradient" />
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Token Exchange
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Swap your royalty tokens instantly with other available tokens
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">From</label>
                          <div className="swap-input-group">
                            <Select value={fromToken} onValueChange={setFromToken} className="relative z-20">
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={fromAmount}
                              onChange={(e) => setFromAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={switchTokens}
                            className="rounded-full transition-all duration-200"
                          >
                            <ArrowDownUp className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">To</label>
                          <div className="swap-input-group">
                            <Select value={toToken} onValueChange={setToToken}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={toAmount}
                              disabled
                              className="swap-input"
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="swap-button"
                        onClick={handleSwap}
                        disabled={!fromToken || !toToken || !fromAmount || isSwapping || isApproving}
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Approving...
                          </>
                        ) : isSwapping ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Swapping...
                          </>
                        ) : (
                          'Swap Tokens'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="liquidity">
                <Card className="swap-card">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Liquidity Pool
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Provide liquidity to earn trading fees
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Token</label>
                          <div className="swap-input-group">
                            <Select value={fromToken} onValueChange={setFromToken}>
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={lpFromAmount}
                              onChange={(e) => setLpFromAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Second Token</label>
                          <div className="swap-input-group">
                            <Select value={toToken} onValueChange={setToToken}>
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={lpToAmount}
                              onChange={(e) => setLpToAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-red-200">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="swap-button"
                        onClick={handleAddLiquidity}
                        disabled={!fromToken || !toToken || !lpFromAmount || !lpToAmount || isAddingLiquidity}
                      >
                        {isAddingLiquidity ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Adding Liquidity...
                          </>
                        ) : (
                          'Add Liquidity'
                        )}
                      </Button>

                      <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                          Liquidity Provider Benefits
                        </h4>
                        <ul className="liquidity-info-list space-y-3">
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Earn fees from trades in this pool
                          </li>
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Withdraw your liquidity at any time
                          </li>
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Support the ecosystem's liquidity
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!CONTRACTS?.TokenFactory?.address) {
    return (
      <div className="swap-container">
        <Header />
        <main className="swap-main">
          <div className="swap-content">
            <h1 className="swap-title">
              Swap Platform
            </h1>
            
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="swap-tabs-list">
                <TabsTrigger value="swap" className="swap-tab-trigger">
                  <RefreshCcw className="h-4 w-4" />
                  Token Exchange
                </TabsTrigger>
                <TabsTrigger value="liquidity" className="swap-tab-trigger">
                  <Droplet className="h-4 w-4" />
                  Liquidity Pool
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="swap">
                <Card className="swap-card">
                  <div className="swap-card-gradient" />
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Token Exchange
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Swap your royalty tokens instantly with other available tokens
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">From</label>
                          <div className="swap-input-group">
                            <Select value={fromToken} onValueChange={setFromToken} className="relative z-20">
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={fromAmount}
                              onChange={(e) => setFromAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={switchTokens}
                            className="rounded-full transition-all duration-200"
                          >
                            <ArrowDownUp className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">To</label>
                          <div className="swap-input-group">
                            <Select value={toToken} onValueChange={setToToken}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={toAmount}
                              disabled
                              className="swap-input"
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="swap-button"
                        onClick={handleSwap}
                        disabled={!fromToken || !toToken || !fromAmount || isSwapping || isApproving}
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Approving...
                          </>
                        ) : isSwapping ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Swapping...
                          </>
                        ) : (
                          'Swap Tokens'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="liquidity">
                <Card className="swap-card">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Liquidity Pool
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Provide liquidity to earn trading fees
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Token</label>
                          <div className="swap-input-group">
                            <Select value={fromToken} onValueChange={setFromToken}>
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={lpFromAmount}
                              onChange={(e) => setLpFromAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Second Token</label>
                          <div className="swap-input-group">
                            <Select value={toToken} onValueChange={setToToken}>
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={lpToAmount}
                              onChange={(e) => setLpToAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-red-200">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="swap-button"
                        onClick={handleAddLiquidity}
                        disabled={!fromToken || !toToken || !lpFromAmount || !lpToAmount || isAddingLiquidity}
                      >
                        {isAddingLiquidity ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Adding Liquidity...
                          </>
                        ) : (
                          'Add Liquidity'
                        )}
                      </Button>

                      <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                          Liquidity Provider Benefits
                        </h4>
                        <ul className="liquidity-info-list space-y-3">
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Earn fees from trades in this pool
                          </li>
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Withdraw your liquidity at any time
                          </li>
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Support the ecosystem's liquidity
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isTokensError) {
    return (
      <div className="swap-container">
        <Header />
        <main className="swap-main">
          <div className="swap-content">
            <h1 className="swap-title">
              Swap Platform
            </h1>
            
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="swap-tabs-list">
                <TabsTrigger value="swap" className="swap-tab-trigger">
                  <RefreshCcw className="h-4 w-4" />
                  Token Exchange
                </TabsTrigger>
                <TabsTrigger value="liquidity" className="swap-tab-trigger">
                  <Droplet className="h-4 w-4" />
                  Liquidity Pool
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="swap">
                <Card className="swap-card">
                  <div className="swap-card-gradient" />
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Token Exchange
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Swap your royalty tokens instantly with other available tokens
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">From</label>
                          <div className="swap-input-group">
                            <Select value={fromToken} onValueChange={setFromToken} className="relative z-20">
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={fromAmount}
                              onChange={(e) => setFromAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={switchTokens}
                            className="rounded-full transition-all duration-200"
                          >
                            <ArrowDownUp className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">To</label>
                          <div className="swap-input-group">
                            <Select value={toToken} onValueChange={setToToken}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={toAmount}
                              disabled
                              className="swap-input"
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="swap-button"
                        onClick={handleSwap}
                        disabled={!fromToken || !toToken || !fromAmount || isSwapping || isApproving}
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Approving...
                          </>
                        ) : isSwapping ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Swapping...
                          </>
                        ) : (
                          'Swap Tokens'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="liquidity">
                <Card className="swap-card">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Liquidity Pool
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Provide liquidity to earn trading fees
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Token</label>
                          <div className="swap-input-group">
                            <Select value={fromToken} onValueChange={setFromToken}>
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={lpFromAmount}
                              onChange={(e) => setLpFromAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Second Token</label>
                          <div className="swap-input-group">
                            <Select value={toToken} onValueChange={setToToken}>
                              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token, index) => (
                                  <SelectItem 
                                    key={token} 
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[index]?.result || 'Loading...'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={lpToAmount}
                              onChange={(e) => setLpToAmount(e.target.value)}
                              className="swap-input"
                            />
                          </div>
                        </div>
                      </div>

                      {error && (
                        <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-red-200">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="swap-button"
                        onClick={handleAddLiquidity}
                        disabled={!fromToken || !toToken || !lpFromAmount || !lpToAmount || isAddingLiquidity}
                      >
                        {isAddingLiquidity ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Adding Liquidity...
                          </>
                        ) : (
                          'Add Liquidity'
                        )}
                      </Button>

                      <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                          Liquidity Provider Benefits
                        </h4>
                        <ul className="liquidity-info-list space-y-3">
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Earn fees from trades in this pool
                          </li>
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Withdraw your liquidity at any time
                          </li>
                          <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                            <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                            Support the ecosystem's liquidity
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="swap-container">
      <Header />
      <main className="swap-main">
        <div className="swap-content">
          <h1 className="swap-title">
            Swap Platform
          </h1>
          
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="swap-tabs-list">
              <TabsTrigger value="swap" className="swap-tab-trigger">
                <RefreshCcw className="h-4 w-4" />
                Token Exchange
              </TabsTrigger>
              <TabsTrigger value="liquidity" className="swap-tab-trigger">
                <Droplet className="h-4 w-4" />
                Liquidity Pool
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="swap">
              <Card className="swap-card">
                <div className="swap-card-gradient" />
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Token Exchange
                  </CardTitle>
                  <CardDescription className="text-base text-gray-400">
                    Swap your royalty tokens instantly with other available tokens
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">From</label>
                        <div className="swap-input-group">
                          <Select value={fromToken} onValueChange={setFromToken} className="relative z-20">
                            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                              <SelectValue placeholder="Select token" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                              <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                DAI
                              </SelectItem>
                              {allTokens?.map((token, index) => (
                                <SelectItem 
                                  key={token} 
                                  value={token} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {tokenNames?.[index]?.result || 'Loading...'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            className="swap-input"
                          />
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={switchTokens}
                          className="rounded-full transition-all duration-200"
                        >
                          <ArrowDownUp className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">To</label>
                        <div className="swap-input-group">
                          <Select value={toToken} onValueChange={setToToken}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select token" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                              <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                DAI
                              </SelectItem>
                              {allTokens?.map((token, index) => (
                                <SelectItem 
                                  key={token} 
                                  value={token} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {tokenNames?.[index]?.result || 'Loading...'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={toAmount}
                            disabled
                            className="swap-input"
                          />
                        </div>
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      className="swap-button"
                      onClick={handleSwap}
                      disabled={!fromToken || !toToken || !fromAmount || isSwapping || isApproving}
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Approving...
                        </>
                      ) : isSwapping ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Swapping...
                        </>
                      ) : (
                        'Swap Tokens'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="liquidity">
              <Card className="swap-card">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Liquidity Pool
                  </CardTitle>
                  <CardDescription className="text-base text-gray-400">
                    Provide liquidity to earn trading fees
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Token</label>
                        <div className="swap-input-group">
                          <Select value={fromToken} onValueChange={setFromToken}>
                            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                              <SelectValue placeholder="Select token" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                              <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                DAI
                              </SelectItem>
                              {allTokens?.map((token, index) => (
                                <SelectItem 
                                  key={token} 
                                  value={token} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {tokenNames?.[index]?.result || 'Loading...'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={lpFromAmount}
                            onChange={(e) => setLpFromAmount(e.target.value)}
                            className="swap-input"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Second Token</label>
                        <div className="swap-input-group">
                          <Select value={toToken} onValueChange={setToToken}>
                            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl">
                              <SelectValue placeholder="Select token" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                              <SelectItem value={CONTRACTS.DAI.address} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                DAI
                              </SelectItem>
                              {allTokens?.map((token, index) => (
                                <SelectItem 
                                  key={token} 
                                  value={token} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {tokenNames?.[index]?.result || 'Loading...'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={lpToAmount}
                            onChange={(e) => setLpToAmount(e.target.value)}
                            className="swap-input"
                          />
                        </div>
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-red-200">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      className="swap-button"
                      onClick={handleAddLiquidity}
                      disabled={!fromToken || !toToken || !lpFromAmount || !lpToAmount || isAddingLiquidity}
                    >
                      {isAddingLiquidity ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Adding Liquidity...
                        </>
                      ) : (
                        'Add Liquidity'
                      )}
                    </Button>

                    <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                        Liquidity Provider Benefits
                      </h4>
                      <ul className="liquidity-info-list space-y-3">
                        <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                          <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                          Earn fees from trades in this pool
                        </li>
                        <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                          <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                          Withdraw your liquidity at any time
                        </li>
                        <li className="liquidity-info-item flex items-center text-black dark:text-gray-300">
                          <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                          Support the ecosystem's liquidity
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SwapTokens;