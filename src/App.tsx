/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Fund, Transaction, TPair, NAVPoint } from './types';
import { 
  PREDEFINED_FUNDS, 
  generateNavHistory, 
  getDefaultDemoData,
  PredefinedFund
} from './data/mockFunds';
import FundSelector from './components/FundSelector';
import DashboardStats from './components/DashboardStats';
import TChart from './components/TChart';
import TransactionForm from './components/TransactionForm';
import TPairingManager from './components/TPairingManager';
import TransactionList from './components/TransactionList';
import { 
  ShieldCheck, 
  TrendingUp, 
  Coins, 
  Wallet,
  Compass
} from 'lucide-react';

const LOCAL_STORAGE_KEYS = {
  FUNDS: 'tplus0_funds_v1',
  TRANSACTIONS: 'tplus0_txs_v1',
  PAIRS: 'tplus0_pairs_v1',
  SELECTED_ID: 'tplus0_sel_id_v1',
};

export default function App() {
  // --- 1. State Declarations ---
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tpairs, setTpairs] = useState<TPair[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [fundHistoryCache, setFundHistoryCache] = useState<Record<string, { points: NAVPoint[], isReal: boolean }>>({});
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // --- 2. Load Core Data from Local Storage / Fallback to beautiful default Demo ---
  useEffect(() => {
    try {
      const storedFunds = localStorage.getItem(LOCAL_STORAGE_KEYS.FUNDS);
      const storedTxs = localStorage.getItem(LOCAL_STORAGE_KEYS.TRANSACTIONS);
      const storedPairs = localStorage.getItem(LOCAL_STORAGE_KEYS.PAIRS);
      const storedSelectedId = localStorage.getItem(LOCAL_STORAGE_KEYS.SELECTED_ID);

      let activeFunds: Fund[] = [];
      let activeTxs: Transaction[] = [];
      let activePairs: TPair[] = [];
      let activeId = 'white-liquor'; // Default to volatile white liquor demo

      // Load or Initialize Funds
      if (storedFunds) {
        activeFunds = JSON.parse(storedFunds);
      } else {
        // Map predefined metadata into the DB schema
        activeFunds = PREDEFINED_FUNDS.map(f => ({
          id: f.id,
          name: f.name,
          code: f.code,
          initialCostNav: f.initialCostNav,
          initialShares: f.initialShares,
          createdAt: new Date().toISOString()
        }));
      }

      // Load Selected Fund ID
      if (storedSelectedId && activeFunds.some(f => f.id === storedSelectedId)) {
        activeId = storedSelectedId;
      } else if (activeFunds.length > 0) {
        activeId = activeFunds[0].id;
      }

      // Load Transactions & Pairs
      if (storedTxs && storedPairs) {
        activeTxs = JSON.parse(storedTxs);
        activePairs = JSON.parse(storedPairs);
      } else {
        // First load: pre-load the exquisite multi-pair sample of white liquor
        const demo = getDefaultDemoData();
        activeTxs = demo.demoTransactions;
        activePairs = demo.demoTPairs;
      }

      // Update States
      setFunds(activeFunds);
      setSelectedFundId(activeId);
      setTransactions(activeTxs);
      setTpairs(activePairs);
    } catch (e) {
      console.error('Failed parsing local storage database:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // --- 3. Save states back to LocalStorage on changes ---
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.FUNDS, JSON.stringify(funds));
  }, [funds, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.PAIRS, JSON.stringify(tpairs));
  }, [tpairs, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(LOCAL_STORAGE_KEYS.SELECTED_ID, selectedFundId);
  }, [selectedFundId, isLoaded]);

  // --- 4. Retrieve Active Fund Object ---
  const activeFund = useMemo(() => {
    return funds.find(f => f.id === selectedFundId) || funds[0];
  }, [funds, selectedFundId]);

  // --- 5. Generate high-fidelity Continuous NAV Dates & values ---
  const activeNavHistory = useMemo((): NAVPoint[] => {
    if (!activeFund) return [];

    // Return cached points if already loaded
    if (fundHistoryCache[activeFund.id]) {
      return fundHistoryCache[activeFund.id].points;
    }

    // Fallback to beautiful baseline simulated curve immediately so UI remains highly interactive
    const predefinedConf = PREDEFINED_FUNDS.find(p => p.id === activeFund.id);
    if (predefinedConf) {
      return generateNavHistory(predefinedConf);
    }

    const customPredef: PredefinedFund = {
      id: activeFund.id,
      name: activeFund.name,
      code: activeFund.code,
      baseNav: activeFund.initialCostNav,
      volatility: 0.10,
      trend: 0.02,
      cycleDays: 35,
      initialCostNav: activeFund.initialCostNav,
      initialShares: activeFund.initialShares
    };
    return generateNavHistory(customPredef);
  }, [activeFund, fundHistoryCache]);

  const isActiveRealData = useMemo(() => {
    if (!activeFund) return false;
    return !!fundHistoryCache[activeFund.id]?.isReal;
  }, [activeFund, fundHistoryCache]);

  // --- 5.1 Async Effect to Retrieve Actual Performance values via standard proxy node ---
  useEffect(() => {
    if (!activeFund || !activeFund.code) return;

    // Direct return if we already have a real record fetched for this active fund
    if (fundHistoryCache[activeFund.id]?.isReal) {
      return;
    }

    let active = true;
    setLoadingHistory(true);

    const pullActualData = async () => {
      try {
        const response = await fetch(`/api/fund-history?code=${activeFund.code}`);
        if (!response.ok) {
          throw new Error(`Proxy returned HTTP ${response.status}`);
        }
        const resData = await response.json();

        if (active) {
          if (resData.points && resData.points.length > 0) {
            setFundHistoryCache(prev => ({
              ...prev,
              [activeFund.id]: {
                points: resData.points,
                isReal: true
              }
            }));
          } else {
            throw new Error(resData.error || 'Got zero data points from public proxy node');
          }
        }
      } catch (err) {
        console.warn(`[REAL NAV SYNC] Failed for ${activeFund.name} (${activeFund.code}). Using high-fidelity baseline simulation:`, err);
        if (active) {
          // Keep using or overwrite with simulated data as robust client-side fallback
          const predefinedConf = PREDEFINED_FUNDS.find(p => p.id === activeFund.id);
          let simulatedList: NAVPoint[] = [];
          if (predefinedConf) {
            simulatedList = generateNavHistory(predefinedConf);
          } else {
            const customPredef: PredefinedFund = {
              id: activeFund.id,
              name: activeFund.name,
              code: activeFund.code,
              baseNav: activeFund.initialCostNav,
              volatility: 0.10,
              trend: 0.02,
              cycleDays: 35,
              initialCostNav: activeFund.initialCostNav,
              initialShares: activeFund.initialShares
            };
            simulatedList = generateNavHistory(customPredef);
          }
          setFundHistoryCache(prev => ({
            ...prev,
            [activeFund.id]: {
              points: simulatedList,
              isReal: false
            }
          }));
        }
      } finally {
        if (active) {
          setLoadingHistory(false);
        }
      }
    };

    pullActualData();

    return () => {
      active = false;
    };
  }, [activeFund?.id, activeFund?.code]);

  // --- 5.5 Calculate active fund lowered cost basis of core holding for chart reference lines ---
  const activeTProfit = useMemo(() => {
    if (!activeFund) return 0;
    return tpairs
      .filter(p => p.fundId === activeFund.id)
      .reduce((sum, p) => sum + p.profit, 0);
  }, [tpairs, activeFund]);

  const activeLoweredCostBasis = useMemo(() => {
    if (!activeFund) return 0;
    const originalTotalCost = activeFund.initialCostNav * activeFund.initialShares;
    const adjustedTotalCost = originalTotalCost - activeTProfit;
    return activeFund.initialShares > 0 ? adjustedTotalCost / activeFund.initialShares : 0;
  }, [activeFund, activeTProfit]);



  // --- 6. Core Database Operations Handlers ---

  const handleSelectFund = (fundId: string) => {
    setSelectedFundId(fundId);
  };

  const handleAddFund = (newFund: Fund) => {
    setFunds(prev => [...prev, newFund]);
    setSelectedFundId(newFund.id); // Swap focus immediately
  };

  const handleAddTransaction = (newTxData: Omit<Transaction, 'id' | 'pairedShares'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      pairedShares: 0
    };
    setTransactions(prev => [...prev, newTx]);
  };

  const handleDeleteTransaction = (txId: string) => {
    // 1. Find pairs that use this transaction
    const relatedPairs = tpairs.filter(p => p.buyTxId === txId || p.sellTxId === txId);
    
    // 2. Adjust other transactions' pairedShares
    setTransactions(prev => prev.map(tx => {
      let updatedPairedShares = tx.pairedShares;
      relatedPairs.forEach(pair => {
        if (pair.buyTxId === txId && pair.sellTxId === tx.id) {
          updatedPairedShares = Math.max(0, Number((updatedPairedShares - pair.shares).toFixed(4)));
        } else if (pair.sellTxId === txId && pair.buyTxId === tx.id) {
          updatedPairedShares = Math.max(0, Number((updatedPairedShares - pair.shares).toFixed(4)));
        }
      });
      return {
        ...tx,
        pairedShares: updatedPairedShares
      };
    }).filter(t => t.id !== txId));

    // 3. Remove the related pairs
    setTpairs(prev => prev.filter(p => p.buyTxId !== txId && p.sellTxId !== txId));
  };

  const handleDeleteFund = (fundId: string) => {
    const updatedFunds = funds.filter(f => f.id !== fundId);
    const updatedTransactions = transactions.filter(t => t.fundId !== fundId);
    const updatedPairs = tpairs.filter(p => p.fundId !== fundId);

    if (updatedFunds.length === 0) {
      // Re-initialize with first predefined fund if empty so app doesn't crash
      const defaultFund: Fund = {
        id: PREDEFINED_FUNDS[0].id,
        name: PREDEFINED_FUNDS[0].name,
        code: PREDEFINED_FUNDS[0].code,
        initialCostNav: PREDEFINED_FUNDS[0].initialCostNav,
        initialShares: PREDEFINED_FUNDS[0].initialShares,
        createdAt: new Date().toISOString()
      };
      setFunds([defaultFund]);
      setTransactions([]);
      setTpairs([]);
      setSelectedFundId(defaultFund.id);
      alert(`🎉 基金已删除！由于没有留存基金，已为您重置回默认的《${defaultFund.name}》持仓。`);
    } else {
      setFunds(updatedFunds);
      setTransactions(updatedTransactions);
      setTpairs(updatedPairs);
      // Auto focus on the first available fund
      setSelectedFundId(updatedFunds[0].id);
      alert('🎉 基金、关联套利对账及所有历史交易流水已完美删除！');
    }
  };

  const handleEditTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));

    // Keep pairs in sync with the edited transaction
    setTpairs(prev => prev.map(pair => {
      let changed = false;
      let buyNav = pair.buyNav;
      let buyDate = pair.buyDate;
      let sellNav = pair.sellNav;
      let sellDate = pair.sellDate;

      if (pair.buyTxId === updatedTx.id) {
        buyNav = updatedTx.nav;
        buyDate = updatedTx.date;
        changed = true;
      }
      if (pair.sellTxId === updatedTx.id) {
        sellNav = updatedTx.nav;
        sellDate = updatedTx.date;
        changed = true;
      }

      if (changed) {
        const profit = Number(((sellNav - buyNav) * pair.shares).toFixed(2));
        const profitRate = Number(((sellNav - buyNav) / buyNav * 100).toFixed(2));
        return {
          ...pair,
          buyNav,
          buyDate,
          sellNav,
          sellDate,
          profit,
          profitRate
        };
      }
      return pair;
    }));
  };

  // Manual pairing handler
  const handleAddPair = (newPairData: Omit<TPair, 'id'>) => {
    const pairId = `pair-user-${Date.now()}`;
    const newPair: TPair = {
      ...newPairData,
      id: pairId
    };

    // Update transactions' locked pairedShares count
    setTransactions(prev => prev.map(tx => {
      if (tx.id === newPair.buyTxId) {
        return { ...tx, pairedShares: Number((tx.pairedShares + newPair.shares).toFixed(4)) };
      }
      if (tx.id === newPair.sellTxId) {
        return { ...tx, pairedShares: Number((tx.pairedShares + newPair.shares).toFixed(4)) };
      }
      return tx;
    }));

    // Save pair
    setTpairs(prev => [...prev, newPair]);
  };

  // Delete pairing (Unpair / T-拆解)
  const handleRemovePair = (pairId: string) => {
    const targetPair = tpairs.find(p => p.id === pairId);
    if (!targetPair) return;

    // Deduct locked shares from underlying transactions
    setTransactions(prev => prev.map(tx => {
      if (tx.id === targetPair.buyTxId) {
        return { ...tx, pairedShares: Math.max(0, Number((tx.pairedShares - targetPair.shares).toFixed(4))) };
      }
      if (tx.id === targetPair.sellTxId) {
        return { ...tx, pairedShares: Math.max(0, Number((tx.pairedShares - targetPair.shares).toFixed(4))) };
      }
      return tx;
    }));

    // Remove the pair
    setTpairs(prev => prev.filter(p => p.id !== pairId));
  };

  // FIFO Auto-pairing Engine (一键对冲)
  const handleAutoPairAll = () => {
    if (!activeFund) return;

    // 1. Get unpaired buys sorted earliest first
    const buys = transactions
      .filter(t => t.fundId === activeFund.id && t.type === 'BUY' && t.pairedShares < t.shares)
      .sort((a,b) => a.date.localeCompare(b.date));

    // 2. Get unpaired sells sorted earliest first
    const sells = transactions
      .filter(t => t.fundId === activeFund.id && t.type === 'SELL' && t.pairedShares < t.shares)
      .sort((a,b) => a.date.localeCompare(b.date));

    if (buys.length === 0 || sells.length === 0) {
      alert('没有可供应对冲的流动买入、卖出动作对！');
      return;
    }

    // Creating temp deep copy trackers to run allocation logic
    const txMap = new Map<string, Transaction>();
    transactions.forEach(t => txMap.set(t.id, { ...t }));

    const newCreatedPairs: TPair[] = [];
    let bIdx = 0;
    let sIdx = 0;

    while (bIdx < buys.length && sIdx < sells.length) {
      const buyTx = txMap.get(buys[bIdx].id)!;
      const sellTx = txMap.get(sells[sIdx].id)!;

      const buyAvail = Number((buyTx.shares - buyTx.pairedShares).toFixed(4));
      const sellAvail = Number((sellTx.shares - sellTx.pairedShares).toFixed(4));

      if (buyAvail <= 0) {
        bIdx++;
        continue;
      }
      if (sellAvail <= 0) {
        sIdx++;
        continue;
      }

      // Max shares to bundle this pair
      const matchQty = Math.min(buyAvail, sellAvail);
      
      const profit = Number(((sellTx.nav - buyTx.nav) * matchQty).toFixed(2));
      const profitRate = Number(((sellTx.nav - buyTx.nav) / buyTx.nav * 100).toFixed(2));

      const newPair: TPair = {
        id: `pair-auto-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        fundId: activeFund.id,
        buyTxId: buyTx.id,
        sellTxId: sellTx.id,
        shares: matchQty,
        buyNav: buyTx.nav,
        sellNav: sellTx.nav,
        buyDate: buyTx.date,
        sellDate: sellTx.date,
        pairedDate: new Date().toISOString().split('T')[0],
        profit,
        profitRate,
        note: `【FIFO自动匹配】价差: ${sellTx.nav.toFixed(4)} - ${buyTx.nav.toFixed(4)}`
      };

      newCreatedPairs.push(newPair);

      // Mutate tracker values inline
      buyTx.pairedShares = Number((buyTx.pairedShares + matchQty).toFixed(4));
      sellTx.pairedShares = Number((sellTx.pairedShares + matchQty).toFixed(4));

      if (buyTx.pairedShares >= buyTx.shares) bIdx++;
      if (sellTx.pairedShares >= sellTx.shares) sIdx++;
    }

    if (newCreatedPairs.length > 0) {
      // Overwrite state
      setTransactions(Array.from(txMap.values()));
      setTpairs(prev => [...prev, ...newCreatedPairs]);
      alert(`🎉 匹配引擎成功建立 ${newCreatedPairs.length} 组做T套利闭环！已成功平摊底仓本金。`);
    }
  };

  // --- 7. Export / Import Backup files ---
  const handleExportDataSubmit = () => {
    const backupObj = {
      funds,
      transactions,
      tpairs,
      exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `做T账目备份_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
  };

  const handleImportDataObj = (importObj: any) => {
    if (importObj.funds) setFunds(importObj.funds);
    if (importObj.transactions) setTransactions(importObj.transactions);
    if (importObj.tpairs) setTpairs(importObj.tpairs);
    if (importObj.funds.length > 0) setSelectedFundId(importObj.funds[0].id);
  };

  // Reset to factory defaults for demo
  const handleResetDemoData = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.FUNDS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.PAIRS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SELECTED_ID);

    // Initial state matching demo setup
    const defaultF = PREDEFINED_FUNDS.map(f => ({
      id: f.id,
      name: f.name,
      code: f.code,
      initialCostNav: f.initialCostNav,
      initialShares: f.initialShares,
      createdAt: new Date().toISOString()
    }));

    const defaultDemo = getDefaultDemoData();

    setFunds(defaultF);
    setSelectedFundId('white-liquor');
    setTransactions(defaultDemo.demoTransactions);
    setTpairs(defaultDemo.demoTPairs);
  };

  // --- 8. Render App ---

  if (!isLoaded || !activeFund) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-6">
        <div className="p-4 bg-[#0e131f] rounded-2xl shadow-xs border border-slate-800 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
          <span className="text-sm font-bold text-slate-300">正在载入做T账本数据库...</span>
        </div>
      </div>
    );
  }

  // Double check transactions on selected fund to warn users if no transactions recorded
  const selectedFundTxs = transactions.filter(t => t.fundId === selectedFundId);

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f1f5f9] pb-8 selection:bg-indigo-500/30">
      
      {/* Premium Header Brand Banner - Dark, Compact, Sleek */}
      <nav id="app-brand-header" className="bg-[#0e131f]/80 backdrop-blur-md border-b border-slate-800/80 py-2.5 px-4 md:px-6 sticky top-0 z-30 shadow-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 px-1.5 bg-red-600 text-white rounded-lg flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
            <div>
              <span className="font-sans font-black tracking-tight text-white text-sm md:text-base">
                基金做T记录与套利折算系统
              </span>
              <span className="text-[10px] font-mono text-slate-500 ml-2 hidden sm:inline-block">Fund T+0 Arbitrage Logger</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 bg-emerald-950/40 text-emerald-400 font-bold rounded-lg border border-emerald-900/40 flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>本地安全沙盒模式</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto px-3 md:px-4 pt-3 font-sans space-y-3">
        
        {/* Step 1: Selector Profile & Custom Tickers Form */}
        <FundSelector 
          funds={funds}
          selectedFundId={selectedFundId}
          onSelectFund={handleSelectFund}
          onAddFund={handleAddFund}
          onDeleteFund={handleDeleteFund}
          onExportData={handleExportDataSubmit}
          onImportData={handleImportDataObj}
          onResetDemoData={handleResetDemoData}
        />

        {/* Step 2: Key Stats Indicators Dashboard (win-rate, lowered cost-basis etc) */}
        <DashboardStats 
          fund={activeFund}
          tpairs={tpairs}
          transactions={transactions}
        />

        {/* Two column Grid for Chart and Input Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* Fund NAV Waveform Charts (Plotted custom dots & closed pairings) - occupies 8-cols */}
          <div className="lg:col-span-8">
            <TChart 
              fund={activeFund}
              navHistory={activeNavHistory}
              transactions={transactions.filter(t => t.fundId === selectedFundId)}
              loweredCostBasis={activeLoweredCostBasis}
              initialCostNav={activeFund.initialCostNav}
              isLoading={loadingHistory}
              isRealData={isActiveRealData}
              onSelectTx={(tx) => {
                // Focus details if clicked
                alert(`交易对账卡片:\n----------------\n日期: ${tx.date}\n动作: ${tx.type === 'BUY' ? '买入加仓' : '卖出减筹'}\n净值: ￥${tx.nav.toFixed(4)}\n份额: ${tx.shares} 份\n金额: ￥${tx.amount.toFixed(2)}\n已对冲部分: ${tx.pairedShares} 份\n备注: ${tx.note || '--'}`);
              }}
            />
          </div>

          {/* Quick single-trade registration form - occupies 4-cols */}
          <div className="lg:col-span-4">
            <TransactionForm 
              fundId={selectedFundId}
              navHistory={activeNavHistory}
              transactions={transactions}
              onAddTransaction={handleAddTransaction}
            />
          </div>
        </div>

        {/* Step 4: Interactive T-Pairings Engine (FIFO Auto & Manual matchers) */}
        <TPairingManager 
          fundId={selectedFundId}
          transactions={transactions}
          tpairs={tpairs}
          onAddPair={handleAddPair}
          onRemovePair={handleRemovePair}
          onAutoPairAll={handleAutoPairAll}
        />

        {/* Step 5: Master ledger transaction logs list (Search, Type Filters, Deletions) */}
        <TransactionList 
          fundId={selectedFundId}
          transactions={transactions}
          tpairs={tpairs}
          onDeleteTransaction={handleDeleteTransaction}
          onEditTransaction={handleEditTransaction}
        />

      </main>
    </div>
  );
}
