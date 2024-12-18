import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { Music, Ban, ChevronRight, Loader2, LineChart, Coins, Users, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Button } from './components/ui/Button';
import { CONTRACTS } from '../contracts';
import TokenManagement from './components/TokenManagement';
import Header from './components/Header';
import Footer from './components/Footer';
import { parseEther, formatEther } from 'ethers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/Tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/Card';

// Add these utility functions at the top level, after imports
const formatRoyaltyPercentage = (royaltyInfo) => {
  if (!royaltyInfo) return "N/A";
  const royaltyPercentage = Number(royaltyInfo[1]);
  return `${(royaltyPercentage / 100).toFixed(2)}%`;
};

const formatExpirationDate = (royaltyInfo) => {
  if (!royaltyInfo) return "N/A";
  const timestamp = Number(royaltyInfo[0]);
  if (isNaN(timestamp)) return "N/A";
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Add this calculation function
const calculateUserRoyaltyShare = (totalRoyalties, userInvestment, totalInvested) => {
  if (!totalRoyalties || !userInvestment || !totalInvested) return "0";
  
  try {
    const royaltiesBig = BigInt(totalRoyalties);
    const userInvestmentBig = BigInt(userInvestment);
    const totalInvestedBig = BigInt(totalInvested);
    
    const share = (royaltiesBig * userInvestmentBig) / totalInvestedBig;
    
    return share.toString();
  } catch {
    return "0";
  }
};

const TokenCard = ({ tokenAddress, isArtistView }) => {
  const { address } = useAccount();
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [claimError, setClaimError] = useState(null);

  // Use useContractWrite directly
  const { writeContract, isLoading: isClaimingRoyalties } = useWriteContract();

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
    watch: true,
  });

  const { data: isListedForSale } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'isListedForSale',
  });

  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'balanceOf',
    args: [address],
  });

  const { data: totalHolders, isError, error, isLoading } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'totalHolders',
    watch: true,
  });

  const { data: amountRaised, isError: amountRaisedError } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'getTotalAmountRaised',
    watch: true,
  });

  const formattedBalance = balance ? Number(balance) / 1e18 : 0;
  const owningValue = balance && tokenPrice 
    ? ((Number(balance) / 1e18) * (Number(tokenPrice) / 1e18)).toFixed(2)
    : "0.00";

  // Add new contract reads and writes
  const { data: availableRoyalties } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'getRoyaltiesReceived',
    watch: true,
  });

  // In the TokenCard component, add a new contract read for total supply
  const { data: totalSupply } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'totalSupply',
  });

  // Add a new contract read for total amount raised in DAI
  const { data: totalAmountRaised } = useReadContract({
    address: tokenAddress,
    abi: CONTRACTS?.RoyaltyToken?.abi,
    functionName: 'getTotalAmountRaised',
  });

  // Calculate user's investment (tokens owned * token price)
  const userInvestment = balance && tokenPrice 
    ? BigInt(balance) * BigInt(tokenPrice) / BigInt(10)**BigInt(18)  // Adjust for 18 decimals
    : BigInt(0);

  // Calculate user's share of royalties
  const userRoyaltyShare = calculateUserRoyaltyShare(
    royaltyInfo?.[2], // total undistributed royalties
    userInvestment,   // user's investment in DAI
    totalAmountRaised // total amount invested in DAI
  );

  // Update the handleClaim function
  const handleClaim = async () => {
    try {
      setClaimError(null);
      setIsTransactionPending(true);
      
      await writeContract({
        address: tokenAddress,
        abi: CONTRACTS.RoyaltyToken.abi,
        functionName: 'claimRoyalties',
      });

    } catch (error) {
      setClaimError(error.message);
    } finally {
      setIsTransactionPending(false);
    }
  };

  // Update the condition checks to use array indices
  const hasRoyalties = royaltyInfo && royaltyInfo[2] && BigInt(royaltyInfo[2]) > BigInt(0);
  const isInvestor = !isArtistView;
  const hasBalance = balance && BigInt(balance) > BigInt(0);

  const isButtonDisabled = isClaimingRoyalties || isTransactionPending;

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
        {isArtistView && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setIsManagementOpen(true)}
          >
            Manage
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400">Price</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {tokenPrice ? `${(Number(tokenPrice) / 1e18).toFixed(8)} DAI` : "N/A"}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400">Royalty Rate</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatRoyaltyPercentage(royaltyInfo)}
          </div>
        </div>
        {isArtistView && (
          <>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Token Holders</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {totalHolders ? Number(totalHolders).toString() : "0"}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Amount Raised</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {amountRaised 
                  ? `${Number(formatEther(amountRaised)).toFixed(2)} DAI`
                  : "0.00 DAI"}
              </div>
            </div>
          </>
        )}
        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg col-span-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">Royalties Expiration</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatExpirationDate(royaltyInfo)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg col-span-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {isListedForSale ? (
              <span className="text-green-500">Listed for sale</span>
            ) : (
              <span className="text-yellow-500">Not listed</span>
            )}
          </div>
        </div>
        {!isArtistView && (
          <>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Tokens Owned</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formattedBalance.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Owning Value</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {`${owningValue} DAI`}
              </div>
            </div>
          </>
        )}
        {isInvestor && hasRoyalties && hasBalance && (
          <div className="mt-4 col-span-2">
            <Button 
              className="w-full"
              onClick={handleClaim}
              disabled={isClaimingRoyalties || isTransactionPending}
            >
              {isClaimingRoyalties || isTransactionPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isClaimingRoyalties ? 'Claiming...' : 'Processing...'}
                </>
              ) : (
                `Claim Available Royalties (${Number(formatEther(userRoyaltyShare)).toFixed(4)} ETH)`
              )}
            </Button>
            {claimError && (
              <div className="mt-2 text-red-500 text-sm">
                Error: {claimError}
              </div>
            )}
          </div>
        )}
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

const ArtistDashboard = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  // Check if the user is an artist (was: Vérifie si l'utilisateur est un artiste)
  const { data: isArtist, isLoading: isCheckingArtist } = useReadContract({
    address: CONTRACTS?.ArtistSBT?.address,
    abi: CONTRACTS?.ArtistSBT?.abi,
    functionName: 'isArtist',
    args: [address],
    enabled: isConnected,
  });

  // Get all artist tokens (was: Récupère tous les tokens de l'artiste)
  const { data: artistTokens, isLoading: isLoadingTokens } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'getArtistTokens',
    args: [address],
    enabled: isConnected,
  });

  // Get total amount raised for all tokens
  const { data: tokenAmounts } = useReadContracts({
    contracts: artistTokens?.map(tokenAddress => ({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'getTotalAmountRaised',
    })) || [],
  });

  // Calculate total amount raised
  const totalAmountRaised = tokenAmounts?.reduce((total, current) => {
    if (current.status === 'success') {
      return total + Number(formatEther(current.result));
    }
    return total;
  }, 0) || 0;

  // Add this new contract read for total holders
  const { data: totalHoldersData } = useReadContracts({
    contracts: artistTokens?.map(tokenAddress => ({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'totalHolders',
    })) || [],
  });

  // Calculate total holders
  const totalHoldersCount = totalHoldersData?.reduce((sum, data) => {
    if (data.status === 'success') {
      return sum + Number(data.result);
    }
    return sum;
  }, 0) || 0;

  return (
    <div className="space-y-8">
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
          <Users className="w-6 h-6 text-purple-500" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Holders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalHoldersCount}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <LineChart className="w-6 h-6 text-green-500" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount Raised</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {`${totalAmountRaised.toFixed(2)} DAI`}
            </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artistTokens.map((tokenAddress) => (
              <TokenCard key={tokenAddress} tokenAddress={tokenAddress} isArtistView={true} />
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

const InvestorDashboard = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [totalEarnings, setTotalEarnings] = useState(0);

  // Get all tokens from TokenFactory
  const { data: allTokens } = useReadContract({
    address: CONTRACTS?.TokenFactory?.address,
    abi: CONTRACTS?.TokenFactory?.abi,
    functionName: 'getAllTokens',
  });

  // State to store token balances
  const [ownedTokens, setOwnedTokens] = useState([]);
  
  // Get token balances for each token
  const { data: tokenBalances } = useReadContracts({
    contracts: allTokens?.map(tokenAddress => ({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'balanceOf',
      args: [address],
    })) || [],
  });

  // Replace the royalties calculation with claimed royalties
  const { data: claimedRoyaltiesData } = useReadContracts({
    contracts: ownedTokens?.map(tokenAddress => ({
      address: tokenAddress,
      abi: CONTRACTS?.RoyaltyToken?.abi,
      functionName: 'getTotalRoyaltiesClaimed',
      args: [address],
    })) || [],
  });

  // Update ownedTokens when balances are fetched
  useEffect(() => {
    if (allTokens && tokenBalances) {
      const owned = allTokens.filter((tokenAddress, index) => {
        const balance = tokenBalances[index];
        return balance && balance.status === 'success' && BigInt(balance.result) > BigInt(0);
      });
      setOwnedTokens(owned);
    }
  }, [allTokens, tokenBalances]);

  // Update the total earnings calculation
  useEffect(() => {
    if (claimedRoyaltiesData) {
      const total = claimedRoyaltiesData.reduce((sum, data) => {
        if (data.status === 'success') {
          return sum + Number(formatEther(data.result));
        }
        return sum;
      }, 0);
      setTotalEarnings(total);
    }
  }, [claimedRoyaltiesData]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-6">
        <div className="stat-card">
          <Coins className="w-6 h-6 text-blue-500" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tokens Owned</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {ownedTokens?.length || 0}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <LineChart className="w-6 h-6 text-green-500" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Earnings</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {`${totalEarnings.toFixed(4)} ETH`}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Investments</h3>
          <Button onClick={() => navigate('/market')}>Explore Market</Button>
        </div>
        
        {ownedTokens?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ownedTokens.map((tokenAddress) => (
              <TokenCard key={tokenAddress} tokenAddress={tokenAddress} isArtistView={false} />
            ))}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('investor');

  // Add isArtist check
  const { data: isArtist } = useReadContract({
    address: CONTRACTS?.ArtistSBT?.address,
    abi: CONTRACTS?.ArtistSBT?.abi,
    functionName: 'isArtist',
    args: [address],
    enabled: isConnected,
  });

  useEffect(() => {
    // Set active tab to artist if user is an artist
    if (isArtist) {
      setActiveTab('artist');
    }
  }, [isArtist]);

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
      <main className="flex-grow">
        <div className="max-w-[1600px] mx-auto pt-32 pb-20 px-4">
          <h1 className="swap-title">
            Dashboard
          </h1>
          
          {isArtist ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="swap-tabs-list">
                <TabsTrigger value="artist" className="swap-tab-trigger">
                  <Music className="h-4 w-4" />
                  Artist
                </TabsTrigger>
                <TabsTrigger value="investor" className="swap-tab-trigger">
                  <DollarSign className="h-4 w-4" />
                  Investor
                </TabsTrigger>
              </TabsList>

              <TabsContent value="artist">
                <Card className="swap-card">
                  <div className="swap-card-gradient" />
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Artist
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Manage your music tokens and track your earnings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ArtistDashboard />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="investor">
                <Card className="swap-card">
                  <div className="swap-card-gradient" />
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      Investor
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      Track your investments and earnings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <InvestorDashboard />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="swap-card">
              <div className="swap-card-gradient" />
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Investor
                </CardTitle>
                <CardDescription className="text-base text-gray-400">
                  Track your investments and earnings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InvestorDashboard />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;