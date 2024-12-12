import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';

const SwapTokens = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      <main className="page-main">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Swap Tokens</h1>
          {/* Ajoutez ici le contenu de votre page */}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SwapTokens;
