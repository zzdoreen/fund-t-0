/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Fund, NAVPoint, Transaction, ChartDataPoint, TransactionType } from '../types';
import { Calendar, HelpCircle, TrendingUp, DollarSign } from 'lucide-react';

interface TChartProps {
  fund: Fund;
  navHistory: NAVPoint[];
  transactions: Transaction[];
  onSelectTx?: (tx: Transaction) => void;
  initialCostNav?: number;
  loweredCostBasis?: number;
  isLoading?: boolean;
  isRealData?: boolean;
}

export default function TChart({ 
  fund, 
  navHistory, 
  transactions, 
  onSelectTx,
  initialCostNav,
  loweredCostBasis,
  isLoading,
  isRealData
}: TChartProps) {
  // Default rangeDays set to 30 for representing meaningful monthly fund performance graphs
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [chartMode, setChartMode] = useState<'NAV' | 'PCT'>('PCT'); // Default to Cumulative Yield (PCT) first

  // 1. Filter NAV history to the selected range
  const filteredHistory = useMemo(() => {
    // History is sorted chronologically
    return navHistory.slice(-rangeDays);
  }, [navHistory, rangeDays]);

  // 2. Baseline NAV is the first day in this filtered history
  const baselineNav = useMemo(() => {
    if (filteredHistory.length === 0) return 1;
    return filteredHistory[0].nav;
  }, [filteredHistory]);

  // 3. Prepare the chart dataset by combining NAV history and transactions
  const chartData = useMemo((): ChartDataPoint[] => {
    return filteredHistory.map(pt => {
      // Find all transactions of the selected fund occurring on this day
      const dayTxs = transactions.filter(tx => tx.date === pt.date);
      
      const mappedTxs = dayTxs.map(tx => ({
        id: tx.id,
        type: tx.type,
        nav: tx.nav,
        shares: tx.shares,
        isPaired: tx.pairedShares >= tx.shares, // Completed if paired shares matches total shares
        pairedFraction: tx.shares > 0 ? tx.pairedShares / tx.shares : 0
      }));

      // Calculate percentage return since baseline
      const changePct = Number((((pt.nav - baselineNav) / baselineNav) * 100).toFixed(2));

      return {
        date: pt.date,
        nav: pt.nav,
        changePct,
        transactions: mappedTxs
      };
    });
  }, [filteredHistory, transactions, baselineNav]);

  // Custom DOT Render Component for Recharts Line/Area
  const CustomizedDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.transactions || payload.transactions.length === 0) {
      return null;
    }

    return (
      <g>
        {payload.transactions.map((tx: any, idx: number) => {
          // If there are multiple transactions on the same day, stack them slightly downward
          const offset = idx * 22;
          const isBought = tx.type === 'BUY';
          const isPaired = tx.isPaired;

          let fillColor = '#64748b'; // Gray for completed pairs ("置灰")
          let text = 'T';
          let ringColor = '#94a3b8';

          if (!isPaired) {
            fillColor = isBought ? '#ef4444' : '#22c55e'; // Red for buy, Green for sell
            text = isBought ? '买' : '卖';
            ringColor = isBought ? '#fee2e2' : '#dcfce7';
          }

          return (
            <g 
              key={tx.id} 
              transform={`translate(0, ${offset})`}
              className="cursor-pointer group"
              onClick={() => {
                const found = transactions.find(t => t.id === tx.id);
                if (found && onSelectTx) onSelectTx(found);
              }}
            >
              {/* Outer soft ring */}
              <circle
                cx={cx}
                cy={cy}
                r={12}
                fill={ringColor}
                opacity={0.8}
                className="group-hover:scale-125 transition-transform duration-200"
              />
              {/* Primary background circle */}
              <circle
                cx={cx}
                cy={cy}
                r={9.5}
                fill={fillColor}
                stroke="#ffffff"
                strokeWidth={1}
                className="group-hover:scale-125 transition-transform duration-200"
              />
              {/* Overlay central text mapping '买/卖/T' */}
              <text
                x={cx}
                y={cy + 3.5}
                fill="#ffffff"
                fontSize="9"
                fontWeight="900"
                textAnchor="middle"
                className="pointer-events-none select-none font-sans"
              >
                {text}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // Customized tooltip content to look highly professional
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: ChartDataPoint = payload[0].payload;
      const isUp = data.changePct >= 0;

      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white rounded-xl p-3.5 shadow-xl max-w-sm font-sans z-30">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-mono">
            <Calendar size={13} className="text-slate-500" />
            <span>{data.date}</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between gap-8 text-xs">
              <span className="text-slate-400">单位净值:</span>
              <span className="font-mono font-bold text-slate-100">￥{data.nav.toFixed(4)}</span>
            </div>
            <div className="flex justify-between gap-8 text-xs">
              <span className="text-slate-400">区间涨幅:</span>
              <span className={`font-mono font-bold ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                {isUp ? '+' : ''}{data.changePct}%
              </span>
            </div>
            {chartMode === 'NAV' && loweredCostBasis && (
              <div className="flex justify-between gap-8 text-xs border-t border-slate-800/60 pt-1 mt-1">
                <span className="text-slate-400">相对您的保本均价:</span>
                <span className={`font-mono font-bold ${data.nav >= loweredCostBasis ? 'text-red-400' : 'text-green-400'}`}>
                  {data.nav >= loweredCostBasis ? '浮盈' : '浮亏'} {(((data.nav - loweredCostBasis) / loweredCostBasis) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {data.transactions && data.transactions.length > 0 && (
            <div className="border-t border-slate-800/80 mt-2.5 pt-2 space-y-2">
              <p className="text-[9px] font-extrabold text-slate-550 tracking-wider uppercase">本日交易流水</p>
              {data.transactions.map((tx, i) => (
                <div key={tx.id || i} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      tx.isPaired 
                        ? 'bg-slate-800 text-slate-400 border border-slate-700' 
                        : tx.type === 'BUY' 
                        ? 'bg-red-950/80 text-red-400 border border-red-900/50' 
                        : 'bg-green-950/80 text-green-400 border border-green-900/50'
                    }`}>
                      {tx.isPaired ? '做T对冲完结' : tx.type === 'BUY' ? '低吸买入' : '高抛卖出'}
                    </span>
                    <span className="text-slate-300 font-mono">
                      {tx.shares.toFixed(0)} 份
                    </span>
                  </div>
                  <span className="text-slate-200 font-mono font-bold">
                    ￥{tx.nav.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#0e131f] rounded-xl border border-slate-800/60 p-3.5 shadow-sm flex flex-col h-auto">
      {/* Chart Headers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
              <span>{fund.name}</span>
              <span className="text-[10px] font-mono bg-blue-950 text-blue-400 border border-blue-900/40 px-1.5 py-0.5 rounded font-bold">
                {fund.code}
              </span>
            </h3>
            
            {isLoading ? (
              <span className="flex items-center gap-1 text-[9px] text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-2 py-0.5 rounded-full animate-pulse font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                <span>正在同步最新业绩...</span>
              </span>
            ) : isRealData ? (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-950/50 px-2 py-0.5 rounded-full font-medium" title="已成功适配该基金代码获取实盘走势图数据">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-405"></span>
                <span>实盘数据已同步</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] text-rose-450 bg-rose-955/20 border border-rose-900/30 px-2 py-0.5 rounded-full font-medium animate-pulse" title="无法连接公共净值数据，使用高模拟基准">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                <span>模拟基准</span>
              </span>
            )}

            <div className="group relative">
              <HelpCircle size={13} className="text-slate-400 hover:text-slate-200 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-slate-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl border border-slate-800 hidden group-hover:block z-20 leading-relaxed">
                显示当前基金专属的历史业绩走势。<br />
                <strong>【单位净值模式】</strong> Y轴展示真实的基金净值。界面会横向画出您的保本均价与购买价格，更清晰观察套利空间。<br />
                <strong>【累计收益模式】</strong> Y轴显示对应波动时间内的区间变动比例。<br />
                图线气泡：<span className="text-red-400">红色买点</span>/ <span className="text-green-400">绿色卖点</span> 是未配对持仓；<span className="text-slate-400">灰色气泡</span> 代表做T配对成功的闭环。
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {chartMode === 'NAV' 
              ? `业绩单位净值趋势及持仓线对照 - 本期最高价: ￥${Math.max(...filteredHistory.map(h => h.nav)).toFixed(4)}` 
              : `基金业绩累计收益变动 - 区间基准净值: ￥${(filteredHistory[0]?.nav || 0).toFixed(4)} (以其为0%原点) `}
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Mode switch helper tabs */}
          <div className="bg-[#141b2a] border border-slate-800/60 p-0.5 rounded-lg flex text-[11px]">
            <button
              onClick={() => setChartMode('PCT')}
              className={`px-2.5 py-1 rounded-md transition-all font-bold flex items-center gap-1 cursor-pointer ${
                chartMode === 'PCT'
                  ? 'bg-blue-950 text-blue-400 border border-blue-900/30'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <TrendingUp size={11} className="shrink-0" />
              <span>年化累计收益</span>
            </button>
            <button
              onClick={() => setChartMode('NAV')}
              className={`px-2.5 py-1 rounded-md transition-all font-bold flex items-center gap-1 cursor-pointer ${
                chartMode === 'NAV'
                  ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-900/30 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <DollarSign size={11} className="shrink-0" />
              <span>单位净值图</span>
            </button>
          </div>

          {/* Time range picker */}
          <div className="bg-[#141b2a] border border-slate-800 p-0.5 rounded-lg flex gap-0.5">
            {[7, 15, 30, 60, 90, 120].map(days => (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  rangeDays === days 
                    ? 'bg-[#1e293b] text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                {days}天
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-[280px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 15, right: 15, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.6} />
            <XAxis 
              dataKey="date" 
              tickLine={false}
              axisLine={false}
              dy={8}
              tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
              tickFormatter={(str) => {
                // Shorten YYYY-MM-DD to MM-DD
                if (!str) return '';
                const parts = str.split('-');
                return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : str;
              }}
            />
            <YAxis 
              tickLine={false}
              axisLine={false}
              dx={-5}
              domain={['auto', 'auto']}
              tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
              tickFormatter={(val) => chartMode === 'NAV' ? `￥${val.toFixed(4)}` : `${val > 0 ? '+' : ''}${val}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />

            {/* Custom Background Area for high professional feel */}
            <Area
              type="monotone"
              dataKey={chartMode === 'NAV' ? 'nav' : 'changePct'}
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#navGradient)"
              dot={<CustomizedDot />}
              activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote */}
      <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-blue-500 rounded-full inline-block"></span>
          <span>{chartMode === 'NAV' ? '单位净值业绩波动曲线' : '累计变动百分比曲线'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full inline-block"></span>
            <span>买入加仓</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
            <span>卖出减筹</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-slate-500 rounded-full inline-block font-mono text-[8px] flex items-center justify-center text-white">T</span>
            <span>已做T对冲</span>
          </div>
        </div>
      </div>
    </div>
  );
}
