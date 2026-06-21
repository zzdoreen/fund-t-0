/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, NAVPoint } from '../types';
import { PlusCircle, Info, Calendar, DollarSign, Edit } from 'lucide-react';

interface TransactionFormProps {
  fundId: string;
  navHistory: NAVPoint[];
  transactions: Transaction[];
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'pairedShares'>) => void;
}

export default function TransactionForm({ fundId, navHistory, transactions, onAddTransaction }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('BUY');
  const [date, setDate] = useState<string>('2026-06-19'); // Default to current workspace date
  const [nav, setNav] = useState<string>('');
  const [shares, setShares] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // 1. Find earliest BUY transaction date for this fund
  const earliestBuyDate = useMemo(() => {
    const buys = transactions.filter(t => t.fundId === fundId && t.type === 'BUY');
    if (buys.length === 0) return '';
    return buys.reduce((min, t) => t.date < min ? t.date : min, buys[0].date);
  }, [transactions, fundId]);

  const todayDate = useMemo(() => {
    return '2026-06-19'; // Consistent system date
  }, []);
  
  // Available dates map for quick lookup
  const navMap = useMemo(() => {
    const map = new Map<string, number>();
    navHistory.forEach(pt => {
      map.set(pt.date, pt.nav);
    });
    return map;
  }, [navHistory]);

  // Handle case where user chooses a date: Auto-fill NAV if date matches history
  useEffect(() => {
    const historicalNav = navMap.get(date);
    if (historicalNav !== undefined) {
      setNav(historicalNav.toFixed(4));
    }
  }, [date, navMap]);

  // Set default initial NAV on mount or when history changes
  useEffect(() => {
    if (navHistory.length > 0) {
      // Default to latest history date
      const latest = navHistory[navHistory.length - 1];
      setDate(latest.date);
      setNav(latest.nav.toFixed(4));
    }
  }, [navHistory]);

  const amount = useMemo(() => {
    const n = parseFloat(nav);
    const s = parseFloat(shares);
    if (!isNaN(n) && !isNaN(s)) {
      return Number((n * s).toFixed(2));
    }
    return 0;
  }, [nav, shares]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const navVal = parseFloat(nav);
    const sharesVal = parseFloat(shares);

    if (isNaN(navVal) || navVal <= 0) {
      alert('请双击或手动输入合理的单位净值（大零）');
      return;
    }
    if (isNaN(sharesVal) || sharesVal <= 0) {
      alert('请输入合理的交易份额数（大零）');
      return;
    }

    if (earliestBuyDate && date < earliestBuyDate) {
      alert(`⚠️ 交易日期不能早于第一次主买入日期 (${earliestBuyDate})`);
      return;
    }
    if (date > todayDate) {
      alert(`⚠️ 交易日期不能晚于当天 (${todayDate})`);
      return;
    }

    onAddTransaction({
      fundId,
      type,
      date,
      nav: navVal,
      shares: sharesVal,
      amount,
      note: note.trim() || undefined
    });

    // Reset fields (keep date and type for convenient bulk logging)
    setShares('');
    setNote('');
  };

  return (
    <div className="bg-[#0e131f] rounded-xl border border-slate-800/60 p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 mb-3">
        <PlusCircle size={15} className="text-blue-400" />
        <h3 className="text-xs font-bold text-slate-100">登记新的做T交易</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* BUY / SELL Radio Buttons */}
        <div id="tx-type-selector-radio" className="flex bg-[#141b2a] border border-slate-800/60 p-2.5 rounded-lg gap-5 items-center">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200 select-none">
            <input
              type="radio"
              name="txTypeAdd"
              value="BUY"
              checked={type === 'BUY'}
              onChange={() => setType('BUY')}
              className="w-4 h-4 accent-red-500 cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              买入 (低吸/加仓)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200 select-none">
            <input
              type="radio"
              name="txTypeAdd"
              value="SELL"
              checked={type === 'SELL'}
              onChange={() => setType('SELL')}
              className="w-4 h-4 accent-green-500 cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              卖出 (高抛/利减)
            </span>
          </label>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          
          {/* Transaction Date */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Calendar size={11} className="text-slate-500" />
              <span>交易日期</span>
            </label>
            <input
              type="date"
              value={date}
              min={earliestBuyDate || undefined}
              max={todayDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#141b2a] border border-slate-800/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-100 text-xs"
              required
            />
            {earliestBuyDate ? (
              <span className="text-[9px] text-slate-500 mt-1 block leading-tight">
                限 <span className="font-mono font-bold text-slate-400">{earliestBuyDate}</span> 起
              </span>
            ) : (
              <span className="text-[9px] text-amber-500 mt-1 block leading-tight">
                首笔买入建仓
              </span>
            )}
            {navMap.get(date) !== undefined && (
              <span className="text-[9px] text-blue-400 font-semibold mt-0.5 block">
                ✓ 自动载入当日净值
              </span>
            )}
          </div>

          {/* Unit NAV on transaction */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <DollarSign size={11} className="text-slate-500" />
              <span>成交单位净值</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder="0.0000"
              value={nav}
              onChange={(e) => setNav(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#141b2a] border border-slate-800/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-100 text-xs font-bold"
              required
            />
          </div>

          {/* Shares traded */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <PlusCircle size={11} className="text-slate-500" />
              <span>成交份额 (份)</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder="例: 5000"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="w-full px-2 py-1.5 bg-[#141b2a] border border-[#1e293b] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-100 text-xs"
              required
            />
          </div>

          {/* Auto Amount Display */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Info size={11} className="text-slate-500" />
              <span>预估成交金额 (元)</span>
            </label>
            <div className="w-full px-2.5 py-1.5 bg-[#1a2335]/60 border border-slate-800/80 rounded-lg text-slate-300 font-mono text-xs font-bold flex items-center justify-between">
              <span>￥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
              <span className="text-[8px] font-sans font-normal text-slate-400 bg-slate-800 px-1 rounded">自算</span>
            </div>
          </div>
        </div>

        {/* Note / Comment */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
            <Edit size={11} className="text-slate-500" />
            <span>备注说明 (可选)</span>
          </label>
          <input
            type="text"
            placeholder="备注买入/卖出原因、操作策略..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-2 py-1.5 bg-[#141b2a] border border-slate-800/85 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-100 text-xs"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`w-full py-2 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer ${
            type === 'BUY'
              ? 'bg-red-650 hover:bg-red-700'
              : 'bg-green-650 hover:bg-green-700'
          }`}
        >
          确认登记该笔 {type === 'BUY' ? '买入' : '卖出'} 做T
        </button>
      </form>
    </div>
  );
}
