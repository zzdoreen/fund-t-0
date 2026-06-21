/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, TPair } from '../types';
import { 
  Trash2, 
  Search, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  X, 
  Info, 
  Settings, 
  DollarSign, 
  Calendar,
  Layers
} from 'lucide-react';

interface TransactionListProps {
  fundId: string;
  transactions: Transaction[];
  tpairs: TPair[];
  onDeleteTransaction: (txId: string) => void;
  onEditTransaction: (updatedTx: Transaction) => void;
}

type ActiveTab = 'BUYS' | 'FLOATING_SELLS';

export default function TransactionList({ 
  fundId, 
  transactions, 
  tpairs, 
  onDeleteTransaction,
  onEditTransaction 
}: TransactionListProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('BUYS');
  const [search, setSearch] = useState<string>('');
  const [expandedBuyIds, setExpandedBuyIds] = useState<Record<string, boolean>>({});
  
  // Modal Edit state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editNav, setEditNav] = useState<string>('');
  const [editShares, setEditShares] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editType, setEditType] = useState<'BUY' | 'SELL'>('BUY');

  // Today static target limit
  const todayDate = '2026-06-19';

  // 1. Filter Transactions by active Fund
  const fundTxs = useMemo(() => {
    return transactions
      .filter(t => t.fundId === fundId)
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort latest first
  }, [transactions, fundId]);

  // 2. Separate BUYS and SELLS of active fund
  const buyTxs = useMemo(() => {
    return fundTxs.filter(tx => tx.type === 'BUY');
  }, [fundTxs]);

  const allSellTxs = useMemo(() => {
    return fundTxs.filter(tx => tx.type === 'SELL');
  }, [fundTxs]);

  // Floating SELL transactions (unpaired or partially unpaired)
  const floatingSellTxs = useMemo(() => {
    return allSellTxs.filter(tx => tx.pairedShares < tx.shares);
  }, [allSellTxs]);

  // Earliest BUY date for this fund to lock dates
  const earliestBuyDate = useMemo(() => {
    const buys = fundTxs.filter(t => t.type === 'BUY');
    if (buys.length === 0) return '';
    return buys.reduce((min, t) => t.date < min ? t.date : min, buys[0].date);
  }, [fundTxs]);

  // Earliest BUY date excluding the currently edited transaction if it's a BUY
  const earliestBuyDateExcludingCurrent = useMemo(() => {
    if (!editingTx) return earliestBuyDate;
    const buys = fundTxs.filter(t => t.type === 'BUY' && t.id !== editingTx.id);
    if (buys.length === 0) return '';
    return buys.reduce((min, t) => t.date < min ? t.date : min, buys[0].date);
  }, [fundTxs, editingTx, earliestBuyDate]);

  // Toggle expanded state of a BUY record row
  const toggleExpandBuy = (buyId: string) => {
    setExpandedBuyIds(prev => ({
      ...prev,
      [buyId]: !prev[buyId]
    }));
  };

  // Find paired sell transactions for a given Buy transaction
  const getPairedSellsForBuy = (buyId: string) => {
    const associatedPairs = tpairs.filter(p => p.buyTxId === buyId && p.fundId === fundId);
    
    return associatedPairs.map(pair => {
      const origSellTx = transactions.find(t => t.id === pair.sellTxId);
      return {
        pairId: pair.id,
        pairedShares: pair.shares,
        profit: pair.profit,
        profitRate: pair.profitRate,
        sellDate: pair.sellDate,
        sellNav: pair.sellNav,
        note: pair.note || origSellTx?.note || '做T对冲匹配记录',
        sellTx: origSellTx
      };
    });
  };

  // Delete transaction action with integrity validations
  const handleDeleteClick = (tx: Transaction) => {
    const confirmMsg = tx.pairedShares > 0
      ? `【警告】确认要删除 ${tx.date} 这笔 ${tx.type === 'BUY' ? '买入' : '卖出'} 交易吗？\n\n该交易有关联的做T套利对冲闭环（已有 ${tx.pairedShares} 份对冲），删除它将自动解散相关的做T配对并重算底仓价格。`
      : `确认要删除 ${tx.date} 这笔 ${tx.type === 'BUY' ? '买入' : '卖出'} 交易流水吗？\n删除后将立刻为您同步折线图与降低保本价等精算指标。`;

    if (confirm(confirmMsg)) {
      onDeleteTransaction(tx.id);
    }
  };

  // Handle opening editing modal
  const handleEditClick = (tx: Transaction) => {
    setEditingTx(tx);
    setEditNav(tx.nav.toString());
    setEditShares(tx.shares.toString());
    setEditNote(tx.note || '');
    setEditDate(tx.date);
    setEditType(tx.type);
  };

  // Handle saving editing modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const navVal = parseFloat(editNav);
    const sharesVal = parseFloat(editShares);

    if (isNaN(navVal) || navVal <= 0) {
      alert('请输入合理的成交单位净值');
      return;
    }
    if (isNaN(sharesVal) || sharesVal <= 0) {
      alert('请输入合理的成交份额');
      return;
    }

    // Date constraints checks
    const targetMinDate = earliestBuyDateExcludingCurrent;
    if (targetMinDate && editDate < targetMinDate) {
      alert(`⚠️ 交易时间不能早于第一次主买入时间(${targetMinDate})`);
      return;
    }
    if (editDate > todayDate) {
      alert(`⚠️ 交易时间不能晚于当天(${todayDate})`);
      return;
    }

    // Safety checks for changing mathematics of paired transactions
    if (editingTx.pairedShares > 0) {
      if (editType !== editingTx.type) {
         alert('⚠️ 无法更改方向：该交易已有生效 of 的套利配对。请先在顶部的看板解约配对。');
         return;
      }
      if (sharesVal < editingTx.pairedShares) {
         alert(`⚠️ 无法缩减份额：该交易中已有 ${editingTx.pairedShares} 份在做T套利闭环中绑定，新修改的份额不能低于已匹配数。`);
         return;
      }
    }

    const updatedTx: Transaction = {
      ...editingTx,
      type: editType,
      date: editDate,
      nav: navVal,
      shares: sharesVal,
      amount: Number((navVal * sharesVal).toFixed(2)),
      note: editNote.trim() || undefined
    };

    onEditTransaction(updatedTx);
    setEditingTx(null); // Close Modal
    alert('🎉 交易流水已成功更新！所有指标及波段折线图已即时完成同步！');
  };

  // Display only Floating sells for target metrics comparison
  const filteredFloatingSellTxs = useMemo(() => {
    return floatingSellTxs.filter(tx => {
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const matchesNote = tx.note?.toLowerCase().includes(query);
        const matchesDate = tx.date.includes(query);
        const matchesNav = tx.nav.toString().includes(query);
        return matchesNote || matchesDate || matchesNav;
      }
      return true;
    });
  }, [floatingSellTxs, search]);

  // Filter displayed results based on text query (search across BUY components)
  const filteredBuyTxs = useMemo(() => {
    return buyTxs.filter(tx => {
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const matchesNote = tx.note?.toLowerCase().includes(query);
        const matchesDate = tx.date.includes(query);
        const matchesNav = tx.nav.toString().includes(query);
        return matchesNote || matchesDate || matchesNav;
      }
      return true;
    });
  }, [buyTxs, search]);

  return (
    <div className="bg-[#0e131f] rounded-xl border border-slate-800/60 p-3.5 shadow-sm">
      
      {/* Title & Top Navigation Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-3 border-b border-slate-800/60 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <FileText size={14} className="text-blue-400" />
            <span>智能做T套利对账单</span>
            <span className="text-[10px] font-mono bg-blue-950 text-blue-400 border border-blue-900/30 px-1.5 py-0.2 rounded font-bold">
              底仓流管理
            </span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            对账单优先展示买入底仓。您可以直接在买入记录中折叠/展开高抛套利流水，并可进行删除、同步或快捷编辑。
          </p>
        </div>

        {/* Tab Selector & Query Bar Layout */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
          {/* Text Filter input */}
          <div className="relative flex-1 md:flex-initial">
            <input
              type="text"
              placeholder="搜索日期、价格或备注..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-48 pl-7 pr-3 py-1 bg-[#141b2a] border border-slate-800 focus:border-blue-500 text-[11px] rounded-lg text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500/30"
            />
            <Search size={11} className="text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Ledger tabs slider */}
          <div className="bg-[#141b2a] p-0.5 rounded-lg flex text-[11px] font-bold border border-slate-800/40">
            <button
              onClick={() => setActiveTab('BUYS')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'BUYS'
                  ? 'bg-slate-800 text-slate-100 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>买入主账册</span>
              <span className="bg-red-950 text-red-400 border border-red-900/44 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {filteredBuyTxs.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('FLOATING_SELLS')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === 'FLOATING_SELLS'
                  ? 'bg-slate-800 text-slate-100 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="尚未配对的流动作T卖出单"
            >
              <span>待对账卖出</span>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-900/44 text-[9px] px-1 rounded-full min-w-4 h-4 flex items-center justify-center font-bold">
                {filteredFloatingSellTxs.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Tab: BUYS (Renders buy rows, nests sells) */}
      {activeTab === 'BUYS' && (
        <div>
          {filteredBuyTxs.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-lg p-10 text-center text-slate-500 text-xs">
              无符合特定条件的买入对账记录
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-400">
                <thead className="text-[10px] text-slate-500 font-bold tracking-wider uppercase border-b border-slate-800/60">
                  <tr>
                    <th className="py-2 px-1 w-[30px]"></th>
                    <th className="py-2 px-1.5">买入日期</th>
                    <th className="py-2 px-1.5">业务类型</th>
                    <th className="py-2 px-1.5 text-right">买入净值</th>
                    <th className="py-2 px-1.5 text-right">买入份额</th>
                    <th className="py-2 px-1.5 text-right">成交金额</th>
                    <th className="py-2 px-1.5 text-center">做T对冲进度</th>
                    <th className="py-2 px-1.5 text-right">T后总收益</th>
                    <th className="py-2 px-1.5 text-right">T后收益率</th>
                    <th className="py-2 px-2.5">备注</th>
                    <th className="py-2 px-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-sans">
                  {filteredBuyTxs.map(buyTx => {
                    const pairedSells = getPairedSellsForBuy(buyTx.id);
                    const isFullyPaired = buyTx.pairedShares >= buyTx.shares;
                    const isPartiallyPaired = buyTx.pairedShares > 0 && buyTx.pairedShares < buyTx.shares;
                    const isExpanded = !!expandedBuyIds[buyTx.id];

                    // T-Profit calculations
                    const tProfitSum = pairedSells.reduce((sum, p) => sum + p.profit, 0);
                    const tProfitRate = buyTx.amount > 0 ? (tProfitSum / buyTx.amount) * 100 : 0;

                    return (
                      <React.Fragment key={buyTx.id}>
                        {/* Parent BUY row */}
                        <tr 
                          className={`hover:bg-[#1a2335]/30 transition-colors ${
                            isFullyPaired ? 'bg-[#141b2a]/40 text-slate-500' : ''
                          }`}
                        >
                          {/* Expander Arrow Icon */}
                          <td className="py-2.5 px-1 text-center">
                            {pairedSells.length > 0 ? (
                               <button
                                 onClick={() => toggleExpandBuy(buyTx.id)}
                                 className="p-0.5 text-slate-450 hover:text-slate-200 hover:bg-slate-800 rounded transition-all cursor-pointer"
                                 title={isExpanded ? '折叠高抛卖出流水' : '展开对应的高抛卖出流水'}
                               >
                                 {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </button>
                            ) : (
                              <div className="text-slate-600">-</div>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-2.5 px-1.5 font-mono font-bold text-slate-200">
                            {buyTx.date}
                          </td>

                          {/* Type */}
                          <td className="py-2.5 px-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${
                              isFullyPaired
                                ? 'bg-slate-900/60 text-slate-500 border-slate-800/60'
                                : 'bg-red-950/60 text-red-400 border-red-900/40'
                            }`}>
                              {isFullyPaired ? '底仓已T清' : '低吸买入'}
                            </span>
                          </td>

                          {/* Unit NAV */}
                          <td className="py-2.5 px-1.5 text-right font-mono font-bold text-slate-300">
                            ￥{buyTx.nav.toFixed(4)}
                          </td>

                          {/* Shares */}
                          <td className="py-2.5 px-1.5 text-right font-mono text-slate-405">
                            {buyTx.shares.toFixed(2)} 份
                          </td>

                          {/* Amount */}
                          <td className="py-2.5 px-1.5 text-right font-mono font-bold text-slate-300">
                            ￥{buyTx.amount.toLocaleString()}
                          </td>

                          {/* Pairing / hedging percentage */}
                          <td className="py-2.5 px-1.5 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {isFullyPaired ? (
                                <span className="flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-900/60 px-1.5 py-0.2 border border-slate-800 rounded-full font-bold">
                                  <CheckCircle2 size={10} className="text-slate-500" />
                                  <span>对冲完毕 (置灰)</span>
                                </span>
                              ) : isPartiallyPaired ? (
                                <span className="flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-950/50 border border-amber-900/45 px-1.5 py-0.2 rounded-full font-bold">
                                  <Clock size={10} className="text-amber-400" />
                                  <span>部分已T ({buyTx.pairedShares.toFixed(0)}/{buyTx.shares.toFixed(0)})</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-[9px] text-rose-400 bg-red-950/40 border border-red-900/40 px-1.5 py-0.2 rounded-full font-bold">
                                  <AlertTriangle size={10} className="text-red-400" />
                                  <span>流动底仓 (等抛)</span>
                                </span>
                              )}
                              {pairedSells.length > 0 && (
                                <span 
                                  onClick={() => toggleExpandBuy(buyTx.id)}
                                  className="text-[9px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-bold leading-none mt-0.5"
                                >
                                  {isExpanded ? '收起详情 ↑' : `展开关联 ${pairedSells.length} 笔卖出 ↓`}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* T后总收益 */}
                          <td className={`py-2.5 px-1.5 text-right font-mono font-bold ${
                            tProfitSum > 0 ? 'text-red-400' : tProfitSum < 0 ? 'text-green-400' : 'text-slate-500'
                          }`}>
                            {tProfitSum > 0 ? '+' : ''}￥{tProfitSum.toFixed(2)}
                          </td>

                          {/* T后收益率 */}
                          <td className={`py-2.5 px-1.5 text-right font-mono font-bold ${
                            tProfitSum > 0 ? 'text-red-400' : tProfitSum < 0 ? 'text-green-400' : 'text-slate-500'
                          }`}>
                            {tProfitSum > 0 ? '+' : ''}{tProfitRate.toFixed(2)}%
                          </td>

                          {/* Note */}
                          <td className="py-2.5 px-2.5 text-[11px] text-slate-550 truncate max-w-[140px]" title={buyTx.note}>
                            {buyTx.note || '--'}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Edit triggers modal */}
                              <button
                                onClick={() => handleEditClick(buyTx)}
                                className="p-1 rounded border border-slate-805 text-slate-500 hover:text-blue-400 hover:border-blue-900/30 hover:bg-slate-800 transition-all cursor-pointer"
                                title="编辑这笔买入交易"
                              >
                                <Edit3 size={11} />
                              </button>
                              
                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteClick(buyTx)}
                                className="p-1 rounded border border-slate-805 transition-all text-slate-500 hover:text-red-400 hover:border-red-900/30 hover:bg-red-950/40 cursor-pointer"
                                title="删除买入流水"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable nested associated SELL transactions */}
                        {isExpanded && pairedSells.length > 0 && (
                          <tr>
                            <td colSpan={9} className="bg-[#141b2a]/30 p-0">
                              <div className="px-5 py-2 border-l-2 border-emerald-500/80 bg-[#161f2f]/40">
                                <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                                  <Layers size={10} className="text-emerald-400" />
                                  <span>对应高抛对冲套利明细 - 挂靠在 {buyTx.date} (买入 ￥{buyTx.nav.toFixed(4)}) 之下:</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px] text-left">
                                    <thead>
                                      <tr className="text-[9px] text-slate-500 font-bold border-b border-slate-800">
                                        <th className="py-1">高抛卖出日期</th>
                                        <th className="py-1 text-right">卖出净值</th>
                                        <th className="py-1 text-right">配对对冲份额</th>
                                        <th className="py-1 text-right">套利对冲盈亏</th>
                                        <th className="py-1 text-right">套利波段收益率</th>
                                        <th className="py-1 pl-4">备注明细</th>
                                        <th className="py-1 text-center font-sans">子级交易操作</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 p-0 font-sans">
                                      {pairedSells.map((sellItem, index) => {
                                        const isProfit = sellItem.profit >= 0;
                                        return (
                                          <tr key={`${sellItem.pairId}-${index}`} className="hover:bg-[#1a2335]/40 transition-colors">
                                            
                                            {/* Date */}
                                            <td className="py-1.5 font-mono font-bold text-slate-300 flex items-center gap-1">
                                              <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                                              {sellItem.sellDate}
                                            </td>

                                            {/* Sell Nav */}
                                            <td className="py-1.5 text-right font-mono font-bold text-slate-350">
                                              ￥{sellItem.sellNav.toFixed(4)}
                                            </td>

                                            {/* Paired shares */}
                                            <td className="py-1.5 text-right font-mono text-slate-400">
                                              {sellItem.pairedShares.toFixed(2)} 份
                                            </td>

                                            {/* Profit */}
                                            <td className={`py-1.5 text-right font-mono font-black ${
                                              isProfit ? 'text-red-400' : 'text-green-400'
                                            }`}>
                                              {isProfit ? '+' : ''}￥{sellItem.profit.toFixed(2)}
                                            </td>

                                            {/* Profit rate */}
                                            <td className={`py-1.5 text-right font-mono font-bold ${
                                              isProfit ? 'text-red-400' : 'text-green-400'
                                            }`}>
                                              <span className={`px-1 rounded text-[9px] font-sans ${
                                                isProfit 
                                                  ? 'bg-red-950/40 text-red-400 border border-red-900/30' 
                                                  : 'bg-green-950/40 text-green-400 border border-green-905/30'
                                              }`}>
                                                {isProfit ? '↑' : '↓'} {sellItem.profitRate.toFixed(2)}%
                                              </span>
                                            </td>

                                            {/* Note */}
                                            <td className="py-1.5 pl-4 text-slate-500 italic truncate max-w-[180px]" title={sellItem.note}>
                                              {sellItem.note}
                                            </td>

                                            {/* Sub transaction operations */}
                                            <td className="py-1.5 text-center">
                                              <div className="inline-flex items-center gap-1">
                                                {sellItem.sellTx ? (
                                                  <>
                                                    <button
                                                      onClick={() => handleEditClick(sellItem.sellTx!)}
                                                      className="p-0.5 rounded border border-slate-805 text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-all cursor-pointer"
                                                      title="编辑该高抛卖出流水"
                                                    >
                                                      <Edit3 size={10} />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteClick(sellItem.sellTx!)}
                                                      className="p-0.5 rounded border border-slate-805 text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all cursor-pointer"
                                                      title="删除该高抛卖出流水并解对"
                                                    >
                                                      <Trash2 size={10} />
                                                    </button>
                                                  </>
                                                ) : (
                                                  <span className="text-[10px] text-slate-555 italic">来自预配置</span>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Secondary Tab: FLOATING SELLS (unpaired standalone high-selling transactions) */}
      {activeTab === 'FLOATING_SELLS' && (
        <div>
          {filteredFloatingSellTxs.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-lg p-10 text-center text-slate-500 text-xs">
              目前没有正处于 “游离/未匹配套利” 状态的高抛卖出流水记录。
              <div className="text-[10px] text-emerald-400 mt-1 font-medium">所有卖出动作已和买入底仓结对，保本线已被完美拉平拉低。</div>
            </div>
          ) : (
            <div>
              <div className="bg-amber-950/20 text-slate-300 border border-amber-900/40 rounded-lg px-3 py-2.5 text-[11px] mb-3 flex items-center gap-1.5">
                <Info size={12} className="text-amber-400 shrink-0" />
                <span>这里展示的是您高抛套利、但**尚未与特定低吸买入底仓进行配对对冲**的交易。您可以在顶部对冲面板直接一键对等或手动撮合它们。</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-400">
                  <thead className="text-[10px] text-slate-500 font-bold tracking-wider uppercase border-b border-slate-800/60 font-sans">
                    <tr>
                      <th className="py-2 px-1.5">高抛日期</th>
                      <th className="py-2 px-1.5">业务类型</th>
                      <th className="py-2 px-1.5 text-right">抛出净值</th>
                      <th className="py-2 px-1.5 text-right">抛出份额</th>
                      <th className="py-2 px-1.5 text-right">已对冲套利份额</th>
                      <th className="py-2 px-1.5 text-right">成交估算金额</th>
                      <th className="py-2 px-2.5">备注说明</th>
                      <th className="py-2 px-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-sans">
                    {filteredFloatingSellTxs.map(sellTx => {
                      return (
                        <tr key={sellTx.id} className="hover:bg-[#1a2335]/30">
                          {/* Date */}
                          <td className="py-2.5 px-1.5 font-mono font-bold text-slate-200">
                            {sellTx.date}
                          </td>

                          {/* Type */}
                          <td className="py-2.5 px-1.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold border bg-emerald-950/40 text-emerald-400 border-emerald-900/30">
                              游离高抛去仓
                            </span>
                          </td>

                          {/* NAV */}
                          <td className="py-2.5 px-1.5 text-right font-mono font-bold text-slate-300">
                            ￥{sellTx.nav.toFixed(4)}
                          </td>

                          {/* Shares */}
                          <td className="py-2.5 px-1.5 text-right font-mono text-slate-405">
                            {sellTx.shares.toFixed(2)} 份
                          </td>

                          {/* Paired */}
                          <td className="py-2.5 px-1.5 text-right font-mono text-slate-500">
                            {sellTx.pairedShares.toFixed(2)} 份
                          </td>

                          {/* Amount */}
                          <td className="py-2.5 px-1.5 text-right font-mono font-bold text-slate-350">
                            ￥{sellTx.amount.toLocaleString()}
                          </td>

                          {/* Note */}
                          <td className="py-2.5 px-2.5 text-[11px] text-slate-555 truncate max-w-[180px]" title={sellTx.note}>
                            {sellTx.note || '--'}
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditClick(sellTx)}
                                className="p-1 rounded border border-slate-805 text-slate-500 hover:text-blue-400 hover:border-blue-900/30 hover:bg-slate-800 transition-all cursor-pointer"
                                title="编辑这笔高游离卖出记录"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(sellTx)}
                                className="p-1 rounded border border-slate-805 text-slate-500 hover:text-red-400 hover:border-red-900/30 hover:bg-red-950/40 transition-all cursor-pointer"
                                title="删除这笔游离高抛去仓"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* PERFECT MODAL: EDIT TRANSACTION DIALOG   */}
      {/* ========================================= */}
      {editingTx && (
        <div className="fixed inset-0 bg-[#060911]/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-[#0e131f] rounded-xl shadow-xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in duration-100">
            {/* Modal Header */}
            <div className="bg-[#141b2a] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Settings size={14} className="text-blue-400" />
                <h4 className="text-xs font-bold text-slate-200">
                  修改做T对账： ({editingTx.type === 'BUY' ? '买入主底仓' : '卖出高抛点'})
                </h4>
              </div>
              <button 
                onClick={() => setEditingTx(null)}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3">
              
              {/* Alert Warning for Locked transaction parameters */}
              {editingTx.pairedShares > 0 && (
                <div className="bg-amber-950/20 text-yellow-500 border border-amber-900/45 rounded-lg p-3 text-[11px] flex items-start gap-1.5">
                  <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">⚠️ 该笔交易已建立做T套利对账：</span>
                    <p className="text-slate-400 mt-1">
                      此项已有 <span className="font-bold text-slate-200">{editingTx.pairedShares} 份</span> 被套利模块配对。修改的份额不可低于此绑定份额。如需更换类型或减大份额，请先到顶层撮合拆解。
                    </p>
                  </div>
                </div>
              )}

              {/* Grid 2-col inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Direction Switch - Disabled if paired */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">交易类型</label>
                  <div className="flex items-center gap-3 py-1.5 px-2 bg-[#141b2a] border border-slate-800 rounded-lg h-[34px]">
                    <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-bold select-none ${editingTx.pairedShares > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="radio"
                        name="txTypeEdit"
                        value="BUY"
                        checked={editType === 'BUY'}
                        onChange={() => setEditType('BUY')}
                        disabled={editingTx.pairedShares > 0}
                        className="w-3.5 h-3.5 accent-red-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-slate-200">买入</span>
                    </label>
                    <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-bold select-none ${editingTx.pairedShares > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="radio"
                        name="txTypeEdit"
                        value="SELL"
                        checked={editType === 'SELL'}
                        onChange={() => setEditType('SELL')}
                        disabled={editingTx.pairedShares > 0}
                        className="w-3.5 h-3.5 accent-green-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-slate-200">卖出</span>
                    </label>
                  </div>
                </div>

                {/* Trade Date LIMIT bounds */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar size={11} className="text-slate-505" />
                    <span>交易日期</span>
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    min={earliestBuyDateExcludingCurrent || undefined}
                    max={todayDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#141b2a] border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-slate-200 text-xs"
                    required
                  />
                  {earliestBuyDateExcludingCurrent && (
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      最早买入限额：{earliestBuyDateExcludingCurrent}
                    </span>
                  )}
                </div>

                {/* Unit NAV */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <DollarSign size={11} className="text-slate-505" />
                    <span>成交单位净值</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editNav}
                    onChange={(e) => setEditNav(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#141b2a] border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-slate-200 text-xs font-bold"
                    required
                  />
                </div>

                {/* Shares */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">成交份额 (份)</label>
                  <input
                    type="number"
                    step="any"
                    value={editShares}
                    onChange={(e) => setEditShares(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#141b2a] border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-slate-200 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Calculated Amount */}
              <div className="bg-[#141b2a] rounded-lg p-2 border border-slate-800/80 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>估算总额</span>
                <span className="font-mono text-slate-200 text-xs font-bold">
                  ￥{(!isNaN(parseFloat(editNav)) && !isNaN(parseFloat(editShares))) 
                    ? (parseFloat(editNav) * parseFloat(editShares)).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
                    : '0.00'} 元
                </span>
              </div>

              {/* Note */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">备注说明</label>
                <input
                  type="text"
                  placeholder="加仓/高抛对冲备注..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#141b2a] border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-200 text-xs"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 mt-4 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-[#1a2335] text-slate-400 rounded-lg font-bold transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-xs cursor-pointer"
                >
                  保存并更新
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
