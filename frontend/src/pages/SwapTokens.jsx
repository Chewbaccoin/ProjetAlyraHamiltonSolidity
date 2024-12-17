import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useConfig } from 'wagmi';
import { parseUnits, formatUnits, isAddress, zeroAddress } from 'viem';
import { ArrowDownUp, RefreshCcw, Loader2, Ban, Droplet, Check, Trash2 } from 'lucide-react';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
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
  const [lpFromAmount, setLpFromAmount] = useState('');
  const [lpToAmount, setLpToAmount] = useState('');
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [activeTab, setActiveTab] = useState("swap");
  const [firstTokenAllowance, setFirstTokenAllowance] = useState(false);
  const [secondTokenAllowance, setSecondTokenAllowance] = useState(false);
  const [isApprovingFirst, setIsApprovingFirst] = useState(false);
  const [isApprovingSecond, setIsApprovingSecond] = useState(false);
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState(false);
  const [lpTokenBalance, setLpTokenBalance] = useState('0');
  const [selectedPool, setSelectedPool] = useState('');
  const [userLPHoldings, setUserLPHoldings] = useState([]);
  const [selectedLPToken, setSelectedLPToken] = useState('');
  const [lpTokenAmount, setLpTokenAmount] = useState('');
  const [isLPTokenApproved, setIsLPTokenApproved] = useState(false);
  const [isApprovingLPToken, setIsApprovingLPToken] = useState(false);
  const [lpTokenMappings, setLpTokenMappings] = useState({});
  const [tokenToLPMap, setTokenToLPMap] = useState({});
  const [lpToTokenMap, setLpToTokenMap] = useState({});

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

  // Get pool reserves for the selected tokens
  const { data: poolReserves } = useReadContract({
    address: CONTRACTS?.PumpMusicSwap?.address,
    abi: CONTRACTS?.PumpMusicSwap?.abi,
    functionName: 'liquidityPools',
    args: [toToken],
    enabled: !!toToken && !!CONTRACTS?.PumpMusicSwap?.address,
  });

  // Get estimated output amount
  const { data: estimatedOutput } = useReadContract({
    address: CONTRACTS?.PumpMusicSwap?.address,
    abi: CONTRACTS?.PumpMusicSwap?.abi,
    functionName: 'getSwapAmount',
    args: fromAmount && fromToken && toToken && poolReserves ? [
      parseUnits(fromAmount || '0', 18),
      poolReserves.tokenReserve,    // reserveIn
      poolReserves.daiReserve,      // reserveOut
    ] : undefined,
    enabled: !!(fromAmount && fromToken && toToken && poolReserves && 
      poolReserves.tokenReserve && poolReserves.daiReserve),
  });

  // Update estimated output when inputs change
  useEffect(() => {
    if (estimatedOutput) {
      const formattedAmount = formatUnits(estimatedOutput, 18);
      setToAmount(formattedAmount);
    } else {
      setToAmount('');
    }
  }, [estimatedOutput, poolReserves]);

  // Add new function to check allowances
  const checkAllowance = async (token, amount) => {
    if (!token || !amount) return false;
    const amountBigInt = parseUnits(amount, 18);
    const allowance = await readContract(config, {
      address: token,
      abi: CONTRACTS.RoyaltyToken.abi,
      functionName: 'allowance',
      args: [address, CONTRACTS.PumpMusicSwap.address],
    });
    return allowance >= amountBigInt;
  };

  // Add effect to check allowances when amounts change
  useEffect(() => {
    const updateAllowances = async () => {
      if (fromToken && lpFromAmount) {
        const hasAllowance = await checkAllowance(fromToken, lpFromAmount);
        setFirstTokenAllowance(hasAllowance);
      }
      if (toToken && lpToAmount) {
        const hasAllowance = await checkAllowance(toToken, lpToAmount);
        setSecondTokenAllowance(hasAllowance);
      }
    };
    updateAllowances();
  }, [fromToken, toToken, lpFromAmount, lpToAmount]);

  // Add function to handle token approvals
  const handleApproveToken = async (token, amount, isFirst = true) => {
    try {
      if (isFirst) {
        setIsApprovingFirst(true);
      } else {
        setIsApprovingSecond(true);
      }
      
      const amountToApprove = parseUnits(amount, 18);
      const approveHash = await writeContract({
        address: token,
        abi: CONTRACTS.RoyaltyToken.abi,
        functionName: 'approve',
        args: [CONTRACTS.PumpMusicSwap.address, amountToApprove],
      });
      
      await waitForTransactionReceipt(config, { hash: approveHash });
      
      if (isFirst) {
        setFirstTokenAllowance(true);
      } else {
        setSecondTokenAllowance(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (isFirst) {
        setIsApprovingFirst(false);
      } else {
        setIsApprovingSecond(false);
      }
    }
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) return;
    
    try {
      setError('');
      setIsSwapping(true);

      const amountIn = parseUnits(fromAmount, 18);
      const minAmountOut = parseUnits(toAmount, 18) * 95n / 100n; // Changed to use native bigint operations
      
      // Check if swapping with DAI
      const isFromBase = fromToken === CONTRACTS.DAI.address;
      const isToBase = toToken === CONTRACTS.DAI.address;

      // Always check allowance for the fromToken
      const allowance = await readContract(config, {
        address: fromToken,
        abi: CONTRACTS.RoyaltyToken.abi,
        functionName: 'allowance',
        args: [address, CONTRACTS.PumpMusicSwap.address],
      });

      if (allowance < amountIn) {
        setIsApproving(true);
        const approveHash = await writeContract({
          address: fromToken,
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
          args: [toToken, amountIn, minAmountOut],
        });
      } else if (!isFromBase && isToBase) {
        // Royalty token to DAI
        swapHash = await writeContract({
          address: CONTRACTS.PumpMusicSwap.address,
          abi: CONTRACTS.PumpMusicSwap.abi,
          functionName: 'swapTokenForDAI',
          args: [fromToken, amountIn, minAmountOut],
        });
      } else {
        // Token to token
        swapHash = await writeContract({
          address: CONTRACTS.PumpMusicSwap.address,
          abi: CONTRACTS.PumpMusicSwap.abi,
          functionName: 'swapTokenForToken',
          args: [fromToken, toToken, amountIn, minAmountOut],
        });
      }
      
      await waitForTransactionReceipt(config, { hash: swapHash });
      
      // Clear form
      setFromAmount('');
      setToAmount('');
      
    } catch (err) {
      console.error('Swap error:', err);
      setError(err.message);
    } finally {
      setIsSwapping(false);
    }
  };

  // Update handleAddLiquidity to remove approval logic
  const handleAddLiquidity = async () => {
    if (!fromToken || !toToken || !lpFromAmount || !lpToAmount) {
      setError('Please fill in all fields');
      return;
    }

    if (!firstTokenAllowance || !secondTokenAllowance) {
      setError('Please approve both tokens first');
      return;
    }
    
    try {
      setError('');
      setIsAddingLiquidity(true);

      const fromAmountIn = parseUnits(lpFromAmount, 18);
      const toAmountIn = parseUnits(lpToAmount, 18);

      const isFromDAI = fromToken === CONTRACTS.DAI.address;
      const isToDAI = toToken === CONTRACTS.DAI.address;

      if (!isFromDAI && !isToDAI) {
        setError('One token must be DAI');
        return;
      }

      const royaltyToken = isFromDAI ? toToken : fromToken;
      const royaltyAmount = isFromDAI ? toAmountIn : fromAmountIn;
      const daiAmount = isFromDAI ? fromAmountIn : toAmountIn;

      const hash = await writeContract({
        address: CONTRACTS.PumpMusicSwap.address,
        abi: CONTRACTS.PumpMusicSwap.abi,
        functionName: 'addLiquidity',
        args: [royaltyToken, royaltyAmount, daiAmount],
      });

      if (!hash) {
        throw new Error('Transaction failed to initiate');
      }

      await waitForTransactionReceipt(config, { hash });
      
      setLpFromAmount('');
      setLpToAmount('');
      
    } catch (err) {
      setError(err.message || 'Failed to add liquidity');
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

  // Add new query to get LP token balance
  const { data: lpBalance } = useReadContract({
    address: selectedPool ? lpTokens?.[selectedPool] : undefined,
    abi: CONTRACTS?.LPToken?.abi,
    functionName: 'balanceOf',
    args: [address],
    enabled: !!(selectedPool && lpTokens?.[selectedPool] && isAddress(selectedPool)),
  });

  // Update LP token balance when pool changes
  useEffect(() => {
    if (lpBalance) {
      setLpTokenBalance(formatUnits(lpBalance, 18));
    }
  }, [lpBalance]);

  // Add new query to get user's LP holdings
  const { data: lpHoldings } = useReadContract({
    address: CONTRACTS?.PumpMusicSwap?.address,
    abi: CONTRACTS?.PumpMusicSwap?.abi,
    functionName: 'getLPTokenHoldings',
    args: [address],
    enabled: !!address,
  });

  // Add effect to process LP holdings data
  useEffect(() => {
    if (lpHoldings) {
      const [tokens, balances] = lpHoldings;
      const holdings = tokens.map((token, index) => ({
        address: token,
        balance: formatUnits(balances[index], 18),
      })).filter(holding => parseFloat(holding.balance) > 0);
      setUserLPHoldings(holdings);
    }
  }, [lpHoldings]);

  // Add function to check LP token allowance
  const checkLPTokenAllowance = async (lpTokenAddress, amount) => {
    if (!lpTokenAddress || !amount) return false;
    
    try {
      const amountBigInt = parseUnits(amount, 18);
      const allowance = await readContract(config, {
        address: lpTokenAddress, // Use the LP token address directly
        abi: CONTRACTS.LPToken.abi,
        functionName: 'allowance',
        args: [address, CONTRACTS.PumpMusicSwap.address],
      });
      return allowance >= amountBigInt;
    } catch (err) {
      console.error('Error checking LP token allowance:', err);
      return false;
    }
  };

  // Add effect to check LP token allowance when amount changes
  useEffect(() => {
    const updateLPTokenAllowance = async () => {
      if (selectedLPToken && lpTokenAmount) {
        const hasAllowance = await checkLPTokenAllowance(selectedLPToken, lpTokenAmount);
        setIsLPTokenApproved(hasAllowance);
      }
    };
    updateLPTokenAllowance();
  }, [selectedLPToken, lpTokenAmount]);

  // Add function to get the LP token address for a given token
  const getLPTokenAddress = async (tokenAddress) => {
    try {
      const lpTokenAddress = await readContract(config, {
        address: CONTRACTS.PumpMusicSwap.address,
        abi: CONTRACTS.PumpMusicSwap.abi,
        functionName: 'lpTokens',
        args: [tokenAddress],
      });
      return lpTokenAddress;
    } catch (err) {
      console.error('Error getting LP token address:', err);
      return null;
    }
  };

  // Update handleApproveLPToken to use the correct mapping
  const handleApproveLPToken = async () => {
    try {
      setIsApprovingLPToken(true);
      
      // Get the original token from our mapping
      const originalToken = lpToTokenMap[selectedLPToken];
      if (!originalToken) {
        throw new Error('Could not find original token');
      }

      const amountToApprove = parseUnits(lpTokenAmount, 18);
      
      const approveHash = await writeContract({
        address: selectedLPToken,
        abi: CONTRACTS.LPToken.abi,
        functionName: 'approve',
        args: [CONTRACTS.PumpMusicSwap.address, amountToApprove],
      });
      
      await waitForTransactionReceipt(config, { hash: approveHash });
      setIsLPTokenApproved(true);
    } catch (err) {
      console.error('LP token approval error:', err);
      setError(err.message || 'Failed to approve LP token');
    } finally {
      setIsApprovingLPToken(false);
    }
  };

  // Update fetchUserLPHoldings to create both mappings
  const fetchUserLPHoldings = async () => {
    try {
      // Get user's LP holdings
      const [lpTokens, balances] = await readContract(config, {
        address: CONTRACTS.PumpMusicSwap.address,
        abi: CONTRACTS.PumpMusicSwap.abi,
        functionName: 'getLPTokenHoldings',
        args: [address],
      });

      // Get all available tokens
      const allTokens = await readContract(config, {
        address: CONTRACTS.TokenFactory.address,
        abi: CONTRACTS.TokenFactory.abi,
        functionName: 'getAllTokens',
      });

      // Create mappings
      const tokenToLP = {};
      const lpToToken = {};

      // For each token, get its LP token and create mappings
      for (const token of allTokens) {
        const lpToken = await readContract(config, {
          address: CONTRACTS.PumpMusicSwap.address,
          abi: CONTRACTS.PumpMusicSwap.abi,
          functionName: 'lpTokens',
          args: [token],
        });
        
        if (lpToken !== zeroAddress) { // Use viem's zeroAddress instead of ethers.ZeroAddress
          tokenToLP[token] = lpToken;
          lpToToken[lpToken] = token;
        }
      }

      setTokenToLPMap(tokenToLP);
      setLpToTokenMap(lpToToken);

      // Filter and set holdings
      const holdings = lpTokens
        .map((lpToken, index) => ({
          lpToken,
          originalToken: lpToToken[lpToken],
          balance: balances[index].toString(),
        }))
        .filter(h => BigInt(h.balance) > 0n);

      setUserLPHoldings(holdings);

    } catch (err) {
      console.error('Error fetching LP holdings:', err);
      setError('Failed to fetch LP holdings');
    }
  };

  // Update handleRemoveLiquidity to use the correct mapping and validation
  const handleRemoveLiquidity = async () => {
    if (!selectedLPToken || !lpTokenAmount || !isLPTokenApproved) {
      setError('Please select LP token, enter amount, and approve first');
      return;
    }
    
    try {
      setError('');
      setIsRemovingLiquidity(true);

      // Get the original token from our mapping
      const originalToken = lpToTokenMap[selectedLPToken];
      if (!originalToken) {
        throw new Error('Could not find original token');
      }

      const amount = parseUnits(lpTokenAmount, 18);
      
      const hash = await writeContract({
        address: CONTRACTS.PumpMusicSwap.address,
        abi: CONTRACTS.PumpMusicSwap.abi,
        functionName: 'removeLiquidity',
        args: [originalToken, amount],
      });

      await waitForTransactionReceipt(config, { hash });
      
      // Clear form after successful removal
      setSelectedLPToken('');
      setLpTokenAmount('');
      setIsLPTokenApproved(false); // Reset approval state
      
      // Refresh LP holdings
      fetchUserLPHoldings();
      
    } catch (err) {
      console.error('Remove liquidity error:', err);
      setError(err.message || 'Failed to remove liquidity');
    } finally {
      setIsRemovingLiquidity(false);
    }
  };

  // Add useEffect to fetch data when component mounts
  useEffect(() => {
    if (address && CONTRACTS.PumpMusicSwap.address) {
      fetchUserLPHoldings();
    }
  }, [address, CONTRACTS.PumpMusicSwap.address]);

  // Add this query to get pool reserves
  const { data: fromPool } = useReadContract({
    address: CONTRACTS.PumpMusicSwap.address,
    abi: CONTRACTS.PumpMusicSwap.abi,
    functionName: 'liquidityPools',
    args: [fromToken],
    enabled: !!fromToken && !!CONTRACTS?.PumpMusicSwap?.address,
  });

  const { data: toPool } = useReadContract({
    address: CONTRACTS.PumpMusicSwap.address,
    abi: CONTRACTS.PumpMusicSwap.abi,
    functionName: 'liquidityPools',
    args: [toToken],
    enabled: !!toToken && !!CONTRACTS?.PumpMusicSwap?.address,
  });

  // Update effect to calculate swap amount
  useEffect(() => {
    const calculateSwapAmount = async () => {
      if (!fromToken || !toToken || !fromAmount) {
        setToAmount('');
        return;
      }

      try {
        let fromTokenReserve, fromDaiReserve, fromPoolActive;
        let toTokenReserve, toDaiReserve, toPoolActive;

        if (fromToken === CONTRACTS.DAI.address) {
          const toPoolData = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'liquidityPools',
            args: [toToken],
          });
          [toTokenReserve, fromDaiReserve, toPoolActive] = toPoolData;
          fromTokenReserve = fromDaiReserve;
          fromPoolActive = toPoolActive;
        } else if (toToken === CONTRACTS.DAI.address) {
          const fromPoolData = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'liquidityPools',
            args: [fromToken],
          });
          [fromTokenReserve, toDaiReserve, fromPoolActive] = fromPoolData;
          toTokenReserve = toDaiReserve;
          toPoolActive = fromPoolActive;
        } else {
          const fromPoolData = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'liquidityPools',
            args: [fromToken],
          });
          const toPoolData = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'liquidityPools',
            args: [toToken],
          });
          [fromTokenReserve, fromDaiReserve, fromPoolActive] = fromPoolData;
          [toTokenReserve, toDaiReserve, toPoolActive] = toPoolData;
        }

        if (!fromPoolActive || !toPoolActive) {
          const inactivePool = !fromPoolActive ? getTokenName(fromToken) : getTokenName(toToken);
          setError(`No liquidity available for ${inactivePool}. Please add liquidity first.`);
          setToAmount('');
          return;
        }

        if (fromTokenReserve === 0n || fromDaiReserve === 0n || 
            toTokenReserve === 0n || toDaiReserve === 0n) {
          setError('Insufficient liquidity in one or both pools');
          setToAmount('');
          return;
        }

        const amountIn = parseUnits(fromAmount, 18);
        let expectedOutput;

        if (fromToken === CONTRACTS.DAI.address) {
          expectedOutput = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'getSwapAmount',
            args: [amountIn, fromDaiReserve, toTokenReserve],
          });
        } else if (toToken === CONTRACTS.DAI.address) {
          expectedOutput = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'getSwapAmount',
            args: [amountIn, fromTokenReserve, toDaiReserve],
          });
        } else {
          const daiAmount = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'getSwapAmount',
            args: [amountIn, fromTokenReserve, fromDaiReserve],
          });

          expectedOutput = await readContract(config, {
            address: CONTRACTS.PumpMusicSwap.address,
            abi: CONTRACTS.PumpMusicSwap.abi,
            functionName: 'getSwapAmount',
            args: [daiAmount, toDaiReserve, toTokenReserve],
          });
        }

        if (expectedOutput) {
          setToAmount(formatUnits(expectedOutput, 18));
          setError('');
        } else {
          setToAmount('');
          setError('Failed to calculate swap amount');
        }

      } catch (err) {
        setError(err.message || 'Failed to calculate swap amount');
        setToAmount('');
      }
    };

    calculateSwapAmount();
  }, [fromToken, toToken, fromAmount, config]);

  // Add helper function to check if pool is active and has liquidity
  const isPoolActive = async (tokenAddress) => {
    try {
      const poolData = await readContract(config, {
        address: CONTRACTS.PumpMusicSwap.address,
        abi: CONTRACTS.PumpMusicSwap.abi,
        functionName: 'liquidityPools',
        args: [tokenAddress],
      });
      
      return poolData.isActive && 
             poolData.tokenReserve > 0n && 
             poolData.daiReserve > 0n;
    } catch (err) {
      console.error('Error checking pool status:', err);
      return false;
    }
  };

  // Update token selectors to show liquidity status
  const TokenSelectItem = ({ token, name }) => {
    const [hasLiquidity, setHasLiquidity] = useState(null);

    useEffect(() => {
      const checkLiquidity = async () => {
        const active = await isPoolActive(token);
        setHasLiquidity(active);
      };
      checkLiquidity();
    }, [token]);

    return (
      <SelectItem 
        key={token}
        value={token} 
        className="hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <div className="flex items-center justify-between w-full">
          <span>{name}</span>
          {hasLiquidity === false && 
            <span className="text-xs text-red-500">(No liquidity)</span>
          }
        </div>
      </SelectItem>
    );
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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

                      <div className="space-y-4">
                        {/* Approval buttons */}
                        <div className="flex gap-4">
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(fromToken, lpFromAmount, true)}
                            disabled={!fromToken || !lpFromAmount || firstTokenAllowance || isApprovingFirst}
                          >
                            {isApprovingFirst ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving First Token...
                              </>
                            ) : firstTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                First Token Approved
                              </>
                            ) : (
                              'Approve First Token'
                            )}
                          </Button>
                          
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(toToken, lpToAmount, false)}
                            disabled={!toToken || !lpToAmount || secondTokenAllowance || isApprovingSecond}
                          >
                            {isApprovingSecond ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving Second Token...
                              </>
                            ) : secondTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Second Token Approved
                              </>
                            ) : (
                              'Approve Second Token'
                            )}
                          </Button>
                        </div>

                        {/* Add Liquidity button */}
                        <Button
                          className="w-full swap-button"
                          onClick={handleAddLiquidity}
                          disabled={
                            !fromToken || 
                            !toToken || 
                            !lpFromAmount || 
                            !lpToAmount || 
                            isAddingLiquidity || 
                            !firstTokenAllowance || 
                            !secondTokenAllowance
                          }
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
                      </div>

                      {userLPHoldings.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Your Liquidity Positions
                          </h3>
                          
                          <div className="space-y-4">
                            <Select value={selectedLPToken} onValueChange={setSelectedLPToken}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select LP Token" />
                              </SelectTrigger>
                              <SelectContent>
                                {userLPHoldings.map((holding) => (
                                  <SelectItem 
                                    key={`lp-${holding.lpToken}`}  // Added prefix to ensure uniqueness
                                    value={holding.lpToken}
                                  >
                                    {`LP Token Balance: ${Number(formatUnits(holding.balance, 18)).toLocaleString('en-US', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 8
                                    })}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selectedLPToken && (
                              <>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    placeholder="Amount to remove"
                                    value={lpTokenAmount}
                                    onChange={(e) => setLpTokenAmount(e.target.value)}
                                    className="w-full pr-16"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs font-medium"
                                    onClick={() => {
                                      const selectedHolding = userLPHoldings.find(h => h.lpToken === selectedLPToken);
                                      if (selectedHolding) {
                                        // Use the actual balance string instead of parsing/formatting
                                        setLpTokenAmount(formatUnits(selectedHolding.balance, 18));
                                      }
                                    }}
                                  >
                                    MAX
                                  </Button>
                                </div>

                                <Button
                                  className="w-full"
                                  onClick={handleApproveLPToken}
                                  disabled={!lpTokenAmount || isLPTokenApproved || isApprovingLPToken}
                                >
                                  {isApprovingLPToken ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Approving LP Token...
                                    </>
                                  ) : isLPTokenApproved ? (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      LP Token Approved
                                    </>
                                  ) : (
                                    'Approve LP Token'
                                  )}
                                </Button>

                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={handleRemoveLiquidity}
                                  disabled={!selectedLPToken || !lpTokenAmount || !isLPTokenApproved || isRemovingLiquidity}
                                >
                                  {isRemovingLiquidity ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Removing Liquidity...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove Liquidity
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                          Liquidity Provider Benefits
                        </h4>
                        <ul className="liquidity-info-list space-y-3">
                          {[
                            { id: 'fees', text: 'Earn fees from trades in this pool' },
                            { id: 'withdraw', text: 'Withdraw your liquidity at any time' },
                            { id: 'support', text: 'Support the ecosystem\'s liquidity' }
                          ].map(item => (
                            <li 
                              key={`benefit-${item.id}`}  // Added prefix to ensure uniqueness
                              className="liquidity-info-item flex items-center text-black dark:text-gray-300"
                            >
                              <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                              {item.text}
                            </li>
                          ))}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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

                      <div className="space-y-4">
                        {/* Approval buttons */}
                        <div className="flex gap-4">
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(fromToken, lpFromAmount, true)}
                            disabled={!fromToken || !lpFromAmount || firstTokenAllowance || isApprovingFirst}
                          >
                            {isApprovingFirst ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving First Token...
                              </>
                            ) : firstTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                First Token Approved
                              </>
                            ) : (
                              'Approve First Token'
                            )}
                          </Button>
                          
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(toToken, lpToAmount, false)}
                            disabled={!toToken || !lpToAmount || secondTokenAllowance || isApprovingSecond}
                          >
                            {isApprovingSecond ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving Second Token...
                              </>
                            ) : secondTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Second Token Approved
                              </>
                            ) : (
                              'Approve Second Token'
                            )}
                          </Button>
                        </div>

                        {/* Add Liquidity button */}
                        <Button
                          className="w-full swap-button"
                          onClick={handleAddLiquidity}
                          disabled={
                            !fromToken || 
                            !toToken || 
                            !lpFromAmount || 
                            !lpToAmount || 
                            isAddingLiquidity || 
                            !firstTokenAllowance || 
                            !secondTokenAllowance
                          }
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
                      </div>

                      {userLPHoldings.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Your Liquidity Positions
                          </h3>
                          
                          <div className="space-y-4">
                            <Select value={selectedLPToken} onValueChange={setSelectedLPToken}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select LP Token" />
                              </SelectTrigger>
                              <SelectContent>
                                {userLPHoldings.map((holding) => (
                                  <SelectItem 
                                    key={`lp-${holding.lpToken}`}  // Added prefix to ensure uniqueness
                                    value={holding.lpToken}
                                  >
                                    {`LP Token Balance: ${Number(formatUnits(holding.balance, 18)).toLocaleString('en-US', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 8
                                    })}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selectedLPToken && (
                              <>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    placeholder="Amount to remove"
                                    value={lpTokenAmount}
                                    onChange={(e) => setLpTokenAmount(e.target.value)}
                                    className="w-full pr-16"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs font-medium"
                                    onClick={() => {
                                      const selectedHolding = userLPHoldings.find(h => h.lpToken === selectedLPToken);
                                      if (selectedHolding) {
                                        // Use the actual balance string instead of parsing/formatting
                                        setLpTokenAmount(formatUnits(selectedHolding.balance, 18));
                                      }
                                    }}
                                  >
                                    MAX
                                  </Button>
                                </div>

                                <Button
                                  className="w-full"
                                  onClick={handleApproveLPToken}
                                  disabled={!lpTokenAmount || isLPTokenApproved || isApprovingLPToken}
                                >
                                  {isApprovingLPToken ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Approving LP Token...
                                    </>
                                  ) : isLPTokenApproved ? (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      LP Token Approved
                                    </>
                                  ) : (
                                    'Approve LP Token'
                                  )}
                                </Button>

                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={handleRemoveLiquidity}
                                  disabled={!selectedLPToken || !lpTokenAmount || !isLPTokenApproved || isRemovingLiquidity}
                                >
                                  {isRemovingLiquidity ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Removing Liquidity...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove Liquidity
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                          Liquidity Provider Benefits
                        </h4>
                        <ul className="liquidity-info-list space-y-3">
                          {[
                            { id: 'fees', text: 'Earn fees from trades in this pool' },
                            { id: 'withdraw', text: 'Withdraw your liquidity at any time' },
                            { id: 'support', text: 'Support the ecosystem\'s liquidity' }
                          ].map(item => (
                            <li 
                              key={`benefit-${item.id}`}  // Added prefix to ensure uniqueness
                              className="liquidity-info-item flex items-center text-black dark:text-gray-300"
                            >
                              <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                              {item.text}
                            </li>
                          ))}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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

                      <div className="space-y-4">
                        {/* Approval buttons */}
                        <div className="flex gap-4">
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(fromToken, lpFromAmount, true)}
                            disabled={!fromToken || !lpFromAmount || firstTokenAllowance || isApprovingFirst}
                          >
                            {isApprovingFirst ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving First Token...
                              </>
                            ) : firstTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                First Token Approved
                              </>
                            ) : (
                              'Approve First Token'
                            )}
                          </Button>
                          
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(toToken, lpToAmount, false)}
                            disabled={!toToken || !lpToAmount || secondTokenAllowance || isApprovingSecond}
                          >
                            {isApprovingSecond ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving Second Token...
                              </>
                            ) : secondTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Second Token Approved
                              </>
                            ) : (
                              'Approve Second Token'
                            )}
                          </Button>
                        </div>

                        {/* Add Liquidity button */}
                        <Button
                          className="w-full swap-button"
                          onClick={handleAddLiquidity}
                          disabled={
                            !fromToken || 
                            !toToken || 
                            !lpFromAmount || 
                            !lpToAmount || 
                            isAddingLiquidity || 
                            !firstTokenAllowance || 
                            !secondTokenAllowance
                          }
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
                      </div>

                      {userLPHoldings.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Your Liquidity Positions
                          </h3>
                          
                          <div className="space-y-4">
                            <Select value={selectedLPToken} onValueChange={setSelectedLPToken}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select LP Token" />
                              </SelectTrigger>
                              <SelectContent>
                                {userLPHoldings.map((holding) => (
                                  <SelectItem 
                                    key={`lp-${holding.lpToken}`}  // Added prefix to ensure uniqueness
                                    value={holding.lpToken}
                                  >
                                    {`LP Token Balance: ${Number(formatUnits(holding.balance, 18)).toLocaleString('en-US', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 8
                                    })}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selectedLPToken && (
                              <>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    placeholder="Amount to remove"
                                    value={lpTokenAmount}
                                    onChange={(e) => setLpTokenAmount(e.target.value)}
                                    className="w-full pr-16"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs font-medium"
                                    onClick={() => {
                                      const selectedHolding = userLPHoldings.find(h => h.lpToken === selectedLPToken);
                                      if (selectedHolding) {
                                        // Use the actual balance string instead of parsing/formatting
                                        setLpTokenAmount(formatUnits(selectedHolding.balance, 18));
                                      }
                                    }}
                                  >
                                    MAX
                                  </Button>
                                </div>

                                <Button
                                  className="w-full"
                                  onClick={handleApproveLPToken}
                                  disabled={!lpTokenAmount || isLPTokenApproved || isApprovingLPToken}
                                >
                                  {isApprovingLPToken ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Approving LP Token...
                                    </>
                                  ) : isLPTokenApproved ? (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      LP Token Approved
                                    </>
                                  ) : (
                                    'Approve LP Token'
                                  )}
                                </Button>

                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={handleRemoveLiquidity}
                                  disabled={!selectedLPToken || !lpTokenAmount || !isLPTokenApproved || isRemovingLiquidity}
                                >
                                  {isRemovingLiquidity ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Removing Liquidity...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove Liquidity
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                          Liquidity Provider Benefits
                        </h4>
                        <ul className="liquidity-info-list space-y-3">
                          {[
                            { id: 'fees', text: 'Earn fees from trades in this pool' },
                            { id: 'withdraw', text: 'Withdraw your liquidity at any time' },
                            { id: 'support', text: 'Support the ecosystem\'s liquidity' }
                          ].map(item => (
                            <li 
                              key={`benefit-${item.id}`}  // Added prefix to ensure uniqueness
                              className="liquidity-info-item flex items-center text-black dark:text-gray-300"
                            >
                              <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                              {item.text}
                            </li>
                          ))}
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
                              <SelectItem 
                                key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                value={CONTRACTS.DAI.address} 
                                className="hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                DAI
                              </SelectItem>
                              {allTokens?.map((token) => (
                                <SelectItem 
                                  key={token}  // Using token address as key
                                  value={token} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                              <SelectItem 
                                key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                value={CONTRACTS.DAI.address} 
                                className="hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                DAI
                              </SelectItem>
                              {allTokens?.map((token) => (
                                <SelectItem 
                                  key={token}  // Using token address as key
                                  value={token} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                              <SelectItem 
                                key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                value={CONTRACTS.DAI.address} 
                                className="hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                DAI
                              </SelectItem>
                              {allTokens?.map((token) => (
                                <SelectItem 
                                  key={token}  // Using token address as key
                                  value={token} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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
                                <SelectItem 
                                  key={CONTRACTS.DAI.address}  // Changed from "dai" to actual address
                                  value={CONTRACTS.DAI.address} 
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  DAI
                                </SelectItem>
                                {allTokens?.map((token) => (
                                  <SelectItem 
                                    key={token}  // Using token address as key
                                    value={token} 
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    {tokenNames?.[allTokens.indexOf(token)]?.result || 'Loading...'}
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

                      <div className="space-y-4">
                        {/* Approval buttons */}
                        <div className="flex gap-4">
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(fromToken, lpFromAmount, true)}
                            disabled={!fromToken || !lpFromAmount || firstTokenAllowance || isApprovingFirst}
                          >
                            {isApprovingFirst ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving First Token...
                              </>
                            ) : firstTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                First Token Approved
                              </>
                            ) : (
                              'Approve First Token'
                            )}
                          </Button>
                          
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveToken(toToken, lpToAmount, false)}
                            disabled={!toToken || !lpToAmount || secondTokenAllowance || isApprovingSecond}
                          >
                            {isApprovingSecond ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Approving Second Token...
                              </>
                            ) : secondTokenAllowance ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Second Token Approved
                              </>
                            ) : (
                              'Approve Second Token'
                            )}
                          </Button>
                        </div>

                        {/* Add Liquidity button */}
                        <Button
                          className="w-full swap-button"
                          onClick={handleAddLiquidity}
                          disabled={
                            !fromToken || 
                            !toToken || 
                            !lpFromAmount || 
                            !lpToAmount || 
                            isAddingLiquidity || 
                            !firstTokenAllowance || 
                            !secondTokenAllowance
                          }
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
                      </div>

                      {userLPHoldings.length > 0 && (
                        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Your Liquidity Positions
                          </h3>
                          
                          <div className="space-y-4">
                            <Select value={selectedLPToken} onValueChange={setSelectedLPToken}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select LP Token" />
                              </SelectTrigger>
                              <SelectContent>
                                {userLPHoldings.map((holding) => (
                                  <SelectItem 
                                    key={`lp-${holding.lpToken}`}  // Added prefix to ensure uniqueness
                                    value={holding.lpToken}
                                  >
                                    {`LP Token Balance: ${Number(formatUnits(holding.balance, 18)).toLocaleString('en-US', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 8
                                    })}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selectedLPToken && (
                              <>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    placeholder="Amount to remove"
                                    value={lpTokenAmount}
                                    onChange={(e) => setLpTokenAmount(e.target.value)}
                                    className="w-full pr-16"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs font-medium"
                                    onClick={() => {
                                      const selectedHolding = userLPHoldings.find(h => h.lpToken === selectedLPToken);
                                      if (selectedHolding) {
                                        // Use the actual balance string instead of parsing/formatting
                                        setLpTokenAmount(formatUnits(selectedHolding.balance, 18));
                                      }
                                    }}
                                  >
                                    MAX
                                  </Button>
                                </div>

                                <Button
                                  className="w-full"
                                  onClick={handleApproveLPToken}
                                  disabled={!lpTokenAmount || isLPTokenApproved || isApprovingLPToken}
                                >
                                  {isApprovingLPToken ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Approving LP Token...
                                    </>
                                  ) : isLPTokenApproved ? (
                                    <>
                                      <Check className="mr-2 h-4 w-4" />
                                      LP Token Approved
                                    </>
                                  ) : (
                                    'Approve LP Token'
                                  )}
                                </Button>

                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={handleRemoveLiquidity}
                                  disabled={!selectedLPToken || !lpTokenAmount || !isLPTokenApproved || isRemovingLiquidity}
                                >
                                  {isRemovingLiquidity ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Removing Liquidity...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove Liquidity
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="liquidity-info p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="liquidity-info-title text-black dark:text-white font-bold mb-3 text-lg">
                          Liquidity Provider Benefits
                        </h4>
                        <ul className="liquidity-info-list space-y-3">
                          {[
                            { id: 'fees', text: 'Earn fees from trades in this pool' },
                            { id: 'withdraw', text: 'Withdraw your liquidity at any time' },
                            { id: 'support', text: 'Support the ecosystem\'s liquidity' }
                          ].map(item => (
                            <li 
                              key={`benefit-${item.id}`}  // Added prefix to ensure uniqueness
                              className="liquidity-info-item flex items-center text-black dark:text-gray-300"
                            >
                              <div className="liquidity-info-bullet w-2 h-2 rounded-full bg-indigo-600 mr-2" />
                              {item.text}
                            </li>
                          ))}
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