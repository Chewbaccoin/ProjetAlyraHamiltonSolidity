import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress } from 'viem';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Label } from './components/ui/Label';

import { UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import { CONTRACTS } from '../contracts';
import Header from './components/Header';
import Footer from './components/Footer';

const Admin = () => {
  const { address, isConnected } = useAccount();
  const isAdmin = address?.toLowerCase() === import.meta.env.VITE_ADMIN_ADDRESS?.toLowerCase() && 
                 import.meta.env.VITE_ADMIN_ADDRESS !== undefined;
  const [artistAddress, setArtistAddress] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(true);
  const [verifiedArtists, setVerifiedArtists] = useState([]);
  const [revokedArtists, setRevokedArtists] = useState([]);
  const [revokingArtist, setRevokingArtist] = useState('');

  // Check if current user is the owner
  const { data: owner } = useReadContract({
    address: CONTRACTS.ArtistSBT.address,
    abi: CONTRACTS.ArtistSBT.abi,
    functionName: 'owner',
    enabled: isConnected,
  });

  // Verify artist function
  const { writeContract: verifyArtist, data: verifyData } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: verifyData,
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Add revoke contract function
  const { writeContract: revokeArtist, data: revokeData } = useWriteContract();
  const { isLoading: isRevokeConfirming, isSuccess: isRevokeConfirmed } = useWaitForTransactionReceipt({
    hash: revokeData,
  });

  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState(false);

  const { data: artistsList } = useReadContract({
    address: CONTRACTS.ArtistSBT.address,
    abi: CONTRACTS.ArtistSBT.abi,
    functionName: 'getVerifiedArtists',
    enabled: isConnected,
  });

  const { data: revokedArtistsList } = useReadContract({
    address: CONTRACTS.ArtistSBT.address,
    abi: CONTRACTS.ArtistSBT.abi,
    functionName: 'getRevokedArtists',
    enabled: isConnected,
  });

  useEffect(() => {
    if (artistsList) {
      setVerifiedArtists(artistsList);
    }
  }, [artistsList]);

  useEffect(() => {
    if (revokedArtistsList) {
      setRevokedArtists(revokedArtistsList);
    }
  }, [revokedArtistsList]);

  useEffect(() => {
    if (isConfirmed) {
      setIsSuccess(true);
      setIsVerifying(false);
      setArtistAddress('');
    }
  }, [isConfirmed]);

  useEffect(() => {
    if (isRevokeConfirmed) {
      setRevokeSuccess(true);
      setIsRevoking(false);
      setRevokingArtist('');
    }
  }, [isRevokeConfirmed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSuccess(false);
    
    try {
      setIsVerifying(true);
      verifyArtist({
        address: CONTRACTS.ArtistSBT.address,
        abi: CONTRACTS.ArtistSBT.abi,
        functionName: 'verifyArtist',
        args: [artistAddress]
      });
    } catch (err) {
      console.error(err);
      setIsVerifying(false);
    }
  };

  const handleAddressChange = (e) => {
    const value = e.target.value;
    setArtistAddress(value);
    setIsValidAddress(value === '' || isAddress(value));
  };

  const handleRevoke = async (artistAddress) => {
    setRevokeSuccess(false);
    
    try {
      setIsRevoking(true);
      setRevokingArtist(artistAddress);
      revokeArtist({
        address: CONTRACTS.ArtistSBT.address,
        abi: CONTRACTS.ArtistSBT.abi,
        functionName: 'revokeVerification',
        args: [artistAddress]
      });
    } catch (err) {
      console.error(err);
      setIsRevoking(false);
      setRevokingArtist('');
    }
  };

  const handleVerify = async (artistAddress) => {
    setIsSuccess(false);
    
    try {
      setIsVerifying(true);
      setRevokingArtist(artistAddress);
      verifyArtist({
        address: CONTRACTS.ArtistSBT.address,
        abi: CONTRACTS.ArtistSBT.abi,
        functionName: 'verifyArtist',
        args: [artistAddress]
      });
    } catch (err) {
      console.error(err);
      setIsVerifying(false);
      setRevokingArtist('');
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
                    Please connect your wallet to access admin panel.
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

  if (isConnected && (!isAdmin || owner !== address)) {
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
                    You must be the authorized admin to access this page.
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
            <div className="create-token-header">
              <div className="create-token-icon-wrapper">
                <UserCheck className="w-full h-full" />
              </div>
              <div>
                <h1 className="create-token-title">Verify Artist</h1>
                <p className="create-token-subtitle">Grant artist verification SoulBound Token</p>
              </div>
            </div>

            {isSuccess ? (
              <Alert className="max-w-md mt-20" variant="success">
                <AlertDescription>
                  Artist verified successfully!
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="create-token-form pt-10">
                <div className="create-token-form-section">
                  <div className="space-y-4">
                    <div>
                      <Label className="create-token-label">Artist Address</Label>
                      <Input
                        type="text"
                        placeholder="Enter artist's wallet address"
                        value={artistAddress}
                        onChange={handleAddressChange}
                        className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${!isValidAddress ? 'border-red-500' : ''}`}
                      />
                      {!isValidAddress && (
                        <p className="text-red-500 text-sm mt-1">Please enter a valid Ethereum address</p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      disabled={!isValidAddress || isVerifying || artistAddress === ''}
                      className="w-full"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying Artist...
                        </>
                      ) : (
                        'Verify Artist'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-4">Verified Artists</h2>
              {verifiedArtists.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <ul className="space-y-2">
                    {verifiedArtists.map((artist, index) => (
                      <li key={index} className="font-mono text-sm flex justify-between items-center p-2">
                        <span>{artist}</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(artist)}
                          disabled={isRevoking}
                          className="ml-4 bg-red-600 hover:bg-red-700 text-white font-semibold"
                        >
                          {isRevoking && revokingArtist === artist ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Revoking...
                            </>
                          ) : (
                            'Revoke'
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-500">No verified artists yet</p>
              )}
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-4">Revoked Artists</h2>
              {revokedArtists.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <ul className="space-y-2">
                    {revokedArtists.map((artist, index) => (
                      <li key={index} className="font-mono text-sm flex justify-between items-center">
                        <span>{artist}</span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleVerify(artist)}
                          disabled={isVerifying}
                          className="ml-4"
                        >
                          {isVerifying && revokingArtist === artist ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            'Verify Again'
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-500">No revoked artists</p>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
