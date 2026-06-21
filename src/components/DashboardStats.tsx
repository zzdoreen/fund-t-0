/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Fund, TPair, Transaction } from '../types';
import { TrendingUp, ArrowDownRight, Award, Zap, Percent, Calendar } from 'lucide-react';

interface DashboardStatsProps {
  fund: Fund;
  tpairs: TPair[];
  transactions: Transaction[];
}

export default function DashboardStats({ fund, tpairs, transactions }: DashboardStatsProps) {
  // Filter core records belonging specifically to this active fund
  const fundPairs = React.useMemo(() => tpairs.filter(p => p.fundId === fund.id), [tpairs, fund.id]);
  const fundTxs = React.useMemo(() => transactions.filter(t => t.fundId === fund.id), [transactions, fund.id]);

  // 1. Calculate Cumulative T-Profit
  const totalTProfit = fundPairs.reduce((sum, pair) => sum + pair.profit, 0);

  // 2. Calculate T-Win Rate (percentage of T-pairs with profit > 0)
  const completedCount = fundPairs.length;
  const winningCount = fundPairs.filter(p => p.profit > 0).length;
  const winRate = completedCount > 0 ? (winningCount / completedCount) * 100 : 0;

  // 3. Calculate Lowered Cost Basis (持仓摊薄成本价)
  // Formula: Adjusted Cost = (Initial Cost * Initial Shares - Total T Profit) / Initial Shares
  const originalTotalCost = fund.initialCostNav * fund.initialShares;
  const adjustedTotalCost = originalTotalCost - totalTProfit;
  const loweredCostBasis = fund.initialShares > 0 ? adjustedTotalCost / fund.initialShares : 0;
  const costReduction = fund.initialCostNav - loweredCostBasis;
  const costReductionPct = fund.initialCostNav > 0 ? (costReduction / fund.initialCostNav) * 100 : 0;

  // 4. Calculate Average Holding Days for Completed T-pairs
  const calculateDaysBetween = (d1: string, d2: string) => {
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    const diff = Math.abs(t2 - t1);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const totalHoldingDays = fundPairs.reduce((sum, pair) => {
    return sum + calculateDaysBetween(pair.buyDate, pair.sellDate);
  }, 0);
  const avgHoldingDays = completedCount > 0 ? (totalHoldingDays / completedCount).toFixed(1) : '0';

  // 5. Active / Paired Transaction Breakdown
  const totalSells = fundTxs.filter(t => t.type === 'SELL').length;
  const totalBuys = fundTxs.filter(t => t.type === 'BUY').length;
  const activeTxCount = fundTxs.filter(t => t.pairedShares < t.shares).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Metric 1: Cumulative Realized T-Profit */}
      <div 
        id="stat-cumulative-profit"
        className="bg-[#0e131f] rounded-xl border border-slate-800/60 p-4 shadow-sm hover:border-slate-700 transition-all duration-300 relative overflow-hidden group"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase leading-none">做T累计已结收益</p>
            <h3 className={`text-xl md:text-2xl font-black font-mono mt-1.5 md:mt-2.5 leading-tight ${totalTProfit >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {totalTProfit >= 0 ? '+' : ''}￥{totalTProfit.toFixed(2)}
            </h3>
          </div>
          <div className={`p-2 rounded-xl border group-hover:scale-105 transition-transform duration-300 ${totalTProfit >= 0 ? 'bg-red-950/40 border-red-900/30 text-red-400' : 'bg-green-950/40 border-green-950/30 text-green-400'}`}>
            <TrendingUp size={16} />
          </div>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 font-bold rounded-md border leading-none ${totalTProfit >= 0 ? 'bg-red-950/60 border-red-900/30 text-red-400' : 'bg-green-950/60 border-green-900/30 text-green-400'}`}>
            已成功套利 {completedCount} 组
          </span>
          <span className="text-[10px] text-slate-400 leading-none">
            本次对对账进度：{completedCount * 2} 笔已销
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-red-500/30 opacity-70"></div>
      </div>

      {/* Metric 2: Transaction Ledger Status Breakdown */}
      <div 
        id="stat-ledger-status"
        className="bg-[#0e131f] rounded-xl border border-slate-800/60 p-4 shadow-sm hover:border-slate-700 transition-all duration-300 relative overflow-hidden group"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase leading-none">待建对冲做T流水</p>
            <h3 className="text-xl md:text-2xl font-black font-mono text-slate-100 mt-1.5 md:mt-2.5 leading-tight">
              {activeTxCount} <span className="text-xs font-sans font-normal text-slate-400">笔待结清</span>
            </h3>
          </div>
          <div className="p-2 bg-indigo-950/40 border border-indigo-900/30 rounded-xl text-indigo-400 group-hover:scale-105 transition-transform duration-300">
            <Calendar size={16} />
          </div>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 font-bold rounded-md bg-indigo-950/60 text-indigo-400 border border-indigo-900/30 leading-none">
            总发生额比数
          </span>
          <span className="text-[10px] text-slate-400 leading-none">
            历史累计：加仓 {totalBuys} 笔 / 高抛 {totalSells} 笔
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-indigo-500/30 opacity-70"></div>
      </div>
    </div>
  );
}
