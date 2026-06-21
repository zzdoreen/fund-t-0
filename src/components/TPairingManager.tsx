/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, TPair } from '../types';
import { 
  Check, 
  Plus, 
  Trash2, 
  HelpCircle, 
  ArrowRightLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface TPairingManagerProps {
  fundId: string;
  transactions: Transaction[];
  tpairs: TPair[];
  onAddPair: (pair: Omit<TPair, 'id'>) => void;
  onRemovePair: (pairId: string) => void;
  onAutoPairAll: () => void;
}

export default function TPairingManager({
  fundId,
  transactions,
  tpairs,
  onAddPair,
  onRemovePair,
  onAutoPairAll
}: TPairingManagerProps) {
  const [selectedBuyId, setSelectedBuyId] = useState<string>('');
  const [selectedSellId, setSelectedSellId] = useState<string>('');
  const [customSharesString, setCustomSharesString] = useState<string>('');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // 1. Filter active BUY transactions (unpaired shares left)
  const activeBuys = useMemo(() => {
    return transactions.filter(t => t.fundId === fundId && t.type === 'BUY' && t.pairedShares < t.shares);
  }, [transactions, fundId]);

  // 2. Filter active SELL transactions (unpaired shares left)
  const activeSells = useMemo(() => {
    return transactions.filter(t => t.fundId === fundId && t.type === 'SELL' && t.pairedShares < t.shares);
  }, [transactions, fundId]);

  // 3. Find selected transactions
  const selectedBuy = useMemo(() => {
    return activeBuys.find(b => b.id === selectedBuyId);
  }, [activeBuys, selectedBuyId]);

  const selectedSell = useMemo(() => {
    return activeSells.find(s => s.id === selectedSellId);
  }, [activeSells, selectedSellId]);

  // 4. Calculate default suggested pairing shares
  const suggestedShares = useMemo(() => {
    if (!selectedBuy || !selectedSell) return 0;
    const buyAvail = selectedBuy.shares - selectedBuy.pairedShares;
    const sellAvail = selectedSell.shares - selectedSell.pairedShares;
    return Math.min(buyAvail, sellAvail);
  }, [selectedBuy, selectedSell]);

  // Set default shares when selection changes
  React.useEffect(() => {
    if (suggestedShares > 0) {
      setCustomSharesString(suggestedShares.toString());
    } else {
      setCustomSharesString('');
    }
  }, [suggestedShares]);

  // 5. Handle manual pairing submit
  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuy || !selectedSell) return;

    const sharesInput = parseFloat(customSharesString);
    if (isNaN(sharesInput) || sharesInput <= 0 || sharesInput > suggestedShares) {
      alert(`配对份额不合法！最大可配对: ${suggestedShares} 份`);
      return;
    }

    // Calculate profit & rate
    const profit = Number(((selectedSell.nav - selectedBuy.nav) * sharesInput).toFixed(2));
    const profitRate = Number(((selectedSell.nav - selectedBuy.nav) / selectedBuy.nav * 100).toFixed(2));

    onAddPair({
      fundId,
      buyTxId: selectedBuy.id,
      sellTxId: selectedSell.id,
      shares: sharesInput,
      buyNav: selectedBuy.nav,
      sellNav: selectedSell.nav,
      buyDate: selectedBuy.date,
      sellDate: selectedSell.date,
      pairedDate: new Date().toISOString().split('T')[0], // Use today's date
      profit,
      profitRate,
      note: `【手动配对】做T锁定差价: ${selectedSell.nav.toFixed(4)} - ${selectedBuy.nav.toFixed(4)}`
    });

    // Reset selection
    setSelectedBuyId('');
    setSelectedSellId('');
  };

  // 6. Filter completed pairings for this fund
  const fundPairs = useMemo(() => {
    return tpairs.filter(p => p.fundId === fundId).sort((a, b) => b.pairedDate.localeCompare(a.pairedDate));
  }, [tpairs, fundId]);

  return (
    <div className="bg-[#0e131f] rounded-xl border border-slate-800/60 p-3.5 shadow-sm">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-slate-100">做T撮合与结对对冲</h3>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-indigo-400 hover:text-indigo-300 font-medium text-[11px] flex items-center gap-0.5 cursor-pointer"
            >
              <HelpCircle size={12} />
              <span>说明</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            将独立买入和卖出交易对等折合，锁定做T净差额收益，并置灰走势图上的节点
          </p>
        </div>

        {/* Quick Actions */}
        <button
          onClick={onAutoPairAll}
          disabled={activeBuys.length === 0 || activeSells.length === 0}
          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all disabled:from-[#141b2a] disabled:to-[#141b2a] disabled:text-slate-600 disabled:border-slate-850 disabled:cursor-not-allowed group cursor-pointer"
        >
          <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
          <span>FIFO 一键自动对冲</span>
        </button>
      </div>

      {/* Explanatory Banner */}
      {showExplanation && (
        <div className="bg-indigo-950/20 border border-indigo-900/50 rounded-lg p-3 mb-3 text-[11px] text-slate-300 leading-relaxed">
          <div className="flex gap-2 items-start">
            <Sparkles size={14} className="text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold mb-1">什么是基金“做T”对冲？</p>
              <p className="mb-1.5">
                <strong>做T（T+0/日内及短波段套利）</strong>的核心是不改变长期基础底仓份额的前提下，低吸高抛，从而赚取买卖差价。
              </p>
              <p className="mb-1.5">
                我们通过簿记对换的方式：将一笔<b>买入（低吸点）</b>和另一笔<b>卖出（高抛点）</b>相撮合配对，锁死套利利润。
              </p>
              <p className="font-bold mt-1.5 mb-1">配对后会发生什么？</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>走势图上该点会被<b>灰色置灰</b>，避免与活动点混淆。</li>
                <li>利润实时平摊，<b>直接调低当前持仓的基础底仓均价</b>！</li>
                <li>配对支持随时“拆解”还原，不损耗任何数据。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Manual Matching Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch mb-4">
        
        {/* Active Buys Lane (Left) */}
        <div className="lg:col-span-4 flex flex-col">
          <h4 className="text-[11px] font-bold text-slate-400 mb-2.5 flex items-center justify-between">
            <span>待结清买入 (低吸/加仓)</span>
            <span className="font-mono bg-red-950/80 text-red-400 border border-red-900/40 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
              {activeBuys.length} 笔待对
            </span>
          </h4>
          <div className="border border-slate-800/80 rounded-lg bg-[#141b2a] p-1.5 h-[180px] overflow-y-auto space-y-1.5">
            {activeBuys.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-3">
                <p className="text-[11px] text-slate-500">无待对冲买入项</p>
                <p className="text-[9px] text-slate-600 mt-0.5">请先登记买入流水</p>
              </div>
            ) : (
              activeBuys.map(buy => {
                const avail = buy.shares - buy.pairedShares;
                const isSelected = selectedBuyId === buy.id;
                return (
                  <div
                    key={buy.id}
                    onClick={() => setSelectedBuyId(isSelected ? '' : buy.id)}
                    className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-red-950/30 border-red-500/50 shadow-xs' 
                        : 'bg-[#1a2335]/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-slate-200 font-mono">{buy.date}</span>
                      <span className="text-[9px] font-bold font-mono px-1 bg-red-950 text-red-400 border border-red-900/30 rounded">
                        买
                      </span>
                    </div>
                    <div className="flex justify-between items-end text-xs text-slate-400 mt-1">
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase leading-none">净值</p>
                        <p className="font-mono font-bold text-slate-300 leading-normal">￥{buy.nav.toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-slate-500 uppercase leading-none">可用份额</p>
                        <p className="font-mono font-bold text-slate-300 leading-normal">
                          {avail} <span className="text-[9px] font-sans text-slate-500">/{buy.shares}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pairing Console & Control (Middle) */}
        <div className="lg:col-span-4 flex flex-col justify-center bg-[#171f2f]/60 border border-slate-800/80 rounded-lg p-3.5 text-center relative overflow-hidden">
          {selectedBuy && selectedSell ? (
            <form onSubmit={handlePairSubmit} className="space-y-3">
              <div className="flex items-center justify-around gap-1.5 mb-1">
                <div className="text-center">
                  <span className="text-[8px] font-bold uppercase text-red-400">买入</span>
                  <div className="font-mono font-bold text-slate-100 text-xs mt-0.5">￥{selectedBuy.nav.toFixed(4)}</div>
                  <div className="text-[8px] text-slate-500 font-mono leading-none">{selectedBuy.date}</div>
                </div>
                
                <div className="p-1.5 bg-indigo-950 text-indigo-400 rounded-full animate-pulse border border-indigo-900/40">
                  <ArrowRightLeft size={12} />
                </div>

                <div className="text-center">
                  <span className="text-[8px] font-bold uppercase text-green-400">卖出</span>
                  <div className="font-mono font-bold text-slate-100 text-xs mt-0.5">￥{selectedSell.nav.toFixed(4)}</div>
                  <div className="text-[8px] text-slate-500 font-mono leading-none">{selectedSell.date}</div>
                </div>
              </div>

              {/* Real-time Projected Yield */}
              <div className="bg-[#141b2a] border border-slate-805 rounded-lg p-2 text-center">
                <span className="text-[8px] text-slate-500 font-bold uppercase block mb-0.5">预计套利空间</span>
                {selectedSell.nav > selectedBuy.nav ? (
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-black text-red-400 flex items-center gap-0.5">
                      <TrendingUp size={12} />
                      +￥{((selectedSell.nav - selectedBuy.nav) * (parseFloat(customSharesString) || suggestedShares)).toFixed(2)}
                    </span>
                    <span className="text-[9px] text-rose-450 font-bold leading-none mt-0.5">
                      套利盈利数: +{(((selectedSell.nav - selectedBuy.nav)/selectedBuy.nav)*100).toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-black text-green-400 flex items-center gap-0.5">
                      <TrendingDown size={12} />
                      -￥{Math.abs((selectedSell.nav - selectedBuy.nav) * (parseFloat(customSharesString) || suggestedShares)).toFixed(2)}
                    </span>
                    <span className="text-[9px] text-green-500 font-bold leading-none mt-0.5">
                      亏损防守做T: {(((selectedSell.nav - selectedBuy.nav)/selectedBuy.nav)*100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Shares input setting */}
              <div>
                <label className="block text-[8px] font-bold text-slate-400 text-left mb-1">
                  对冲份额数 (最大: {suggestedShares})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={customSharesString}
                    onChange={(e) => setCustomSharesString(e.target.value)}
                    max={suggestedShares}
                    min="1"
                    className="w-full pl-2.5 pr-14 py-1.5 bg-[#141b2a] border border-slate-800 font-mono font-bold text-slate-100 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setCustomSharesString(suggestedShares.toString())}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-indigo-400 hover:text-indigo-300 font-bold px-1 py-0.5 bg-indigo-950 hover:bg-slate-800 rounded border border-indigo-900/30 cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                立即建立对冲
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-500 py-4">
              <div className="p-2 bg-[#1a2335]/80 border border-slate-800 rounded-xl text-indigo-400">
                <Activity size={18} className="stroke-[1.5]" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">手动配对控制台</p>
                <p className="text-[9px] text-slate-500 max-w-[190px] mx-auto mt-0.5 leading-relaxed">
                  请点击左侧一笔 <b>买入项</b> 与右侧一笔 <b>卖出项</b> 即可建立套利绑定。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Active Sells Lane (Right) */}
        <div className="lg:col-span-4 flex flex-col">
          <h4 className="text-[11px] font-bold text-slate-400 mb-2.5 flex items-center justify-between">
            <span>待结清卖出 (高抛/平仓)</span>
            <span className="font-mono bg-green-950/80 text-green-400 border border-green-900/40 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
              {activeSells.length} 笔待对
            </span>
          </h4>
          <div className="border border-slate-800/80 rounded-lg bg-[#141b2a] p-1.5 h-[180px] overflow-y-auto space-y-1.5">
            {activeSells.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-3">
                <p className="text-[11px] text-slate-500">无待对冲卖出项</p>
                <p className="text-[9px] text-slate-600 mt-0.5">请先登记反抽卖出流水</p>
              </div>
            ) : (
              activeSells.map(sell => {
                const avail = sell.shares - sell.pairedShares;
                const isSelected = selectedSellId === sell.id;
                return (
                  <div
                    key={sell.id}
                    onClick={() => setSelectedSellId(isSelected ? '' : sell.id)}
                    className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-green-950/30 border-green-500/50 shadow-xs' 
                        : 'bg-[#1a2335]/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-slate-200 font-mono">{sell.date}</span>
                      <span className="text-[9px] font-bold font-mono px-1 bg-green-950 text-green-400 border border-green-900/30 rounded">
                        卖
                      </span>
                    </div>
                    <div className="flex justify-between items-end text-xs text-slate-400 mt-1">
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase leading-none">净值</p>
                        <p className="font-mono font-bold text-slate-300 leading-normal">￥{sell.nav.toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-slate-500 uppercase leading-none">可用份额</p>
                        <p className="font-mono font-bold text-slate-300 leading-normal">
                          {avail} <span className="text-[9px] font-sans text-slate-500">/{sell.shares}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Done pairings history */}
      <div>
        <h4 className="text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1">
          <Check size={12} className="text-indigo-400" />
          <span>已套利结清做T对冲列表</span>
          <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold ml-1 border border-slate-700/50">
            {fundPairs.length} 组闭环
          </span>
        </h4>

        {fundPairs.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs">
            无已结清对冲。在上方进行买卖对换配对即可实现成本平摊！
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[170px] overflow-y-auto pr-1">
            {fundPairs.map(pair => {
              const profitIsPositive = pair.profit >= 0;
              return (
                <div 
                  key={pair.id} 
                  className="bg-[#141b2a] border border-slate-800/80 p-2.5 rounded-lg flex items-center justify-between hover:border-slate-700 transition-all group"
                >
                  <div className="space-y-0.5 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200 font-mono">
                        {pair.shares} 份
                      </span>
                      <span className={`text-[9px] font-bold px-1 rounded leading-none border ${
                        profitIsPositive 
                          ? 'bg-red-950/40 text-red-400 border-red-900/30' 
                          : 'bg-green-950/40 text-green-400 border-green-900/30'
                      }`}>
                        {profitIsPositive ? '+' : ''}{pair.profitRate.toFixed(2)}%
                      </span>
                    </div>
                    
                    <div className="text-[9px] text-slate-500 space-y-0.5">
                      <div className="flex items-center gap-1 leading-none">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        <span>吸：{pair.buyDate} (￥{pair.buyNav.toFixed(4)})</span>
                      </div>
                      <div className="flex items-center gap-1 leading-none">
                        <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                        <span>抛：{pair.sellDate} (￥{pair.sellNav.toFixed(4)})</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-[8px] text-slate-500 leading-none">闭环利润</p>
                      <p className={`text-xs font-bold font-mono ${
                        profitIsPositive ? 'text-red-400' : 'text-green-450'
                      }`}>
                        {profitIsPositive ? '+' : ''}￥{pair.profit.toFixed(2)}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => onRemovePair(pair.id)}
                      className="p-1 border border-slate-800 text-slate-500 hover:text-red-400 hover:border-red-900/40 hover:bg-red-950 rounded cursor-pointer opacity-60 group-hover:opacity-100 transition-all"
                      title="拆解此配对"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
