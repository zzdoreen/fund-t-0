/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fund, NAVPoint, Transaction, TPair } from '../types';

export interface PredefinedFund {
  id: string;
  name: string;
  code: string;
  baseNav: number;
  volatility: number; // Amplitude modifier
  trend: number;      // Long-term drift
  cycleDays: number;  // Periodicity of waves
  initialCostNav: number;
  initialShares: number;
}

export const PREDEFINED_FUNDS: PredefinedFund[] = [
  {
    id: 'csi-300',
    name: '沪深300指数联接',
    code: '003096',
    baseNav: 1.2000,
    volatility: 0.08,
    trend: 0.04,
    cycleDays: 45,
    initialCostNav: 1.1850,
    initialShares: 10000,
  },
  {
    id: 'white-liquor',
    name: '中证白酒指数增强',
    code: '161725',
    baseNav: 1.5500,
    volatility: 0.18, // High volatility - iconic T-trading target!
    trend: -0.02,     // Swings but overall slightly down, great for demonstrating lowering cost via T!
    cycleDays: 30,
    initialCostNav: 1.6200,
    initialShares: 8000,
  },
  {
    id: 'nasdaq-100',
    name: '纳斯达克100指数联接',
    code: '040046',
    baseNav: 2.1000,
    volatility: 0.06,
    trend: 0.12,      // Strong upward trending bull fund
    cycleDays: 60,
    initialCostNav: 2.0500,
    initialShares: 5000,
  },
  {
    id: 'chip-tech',
    name: '半导体芯片主题成长',
    code: '001888',
    baseNav: 0.9500,
    volatility: 0.22, // Insane volatility
    trend: 0.08,
    cycleDays: 24,
    initialCostNav: 0.9800,
    initialShares: 12000,
  },
];

// Seeded pseudo-random number generator for deterministic curves
function seedRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Generates continuous NAV history for a fund up to a current date
 */
export function generateNavHistory(fund: PredefinedFund, daysCount = 120): NAVPoint[] {
  const history: NAVPoint[] = [];
  const baseDate = new Date('2026-06-19'); // Consistent with user current time: 2026-06-19
  
  // Start date is `daysCount` days ago
  const startDate = new Date(baseDate);
  startDate.setDate(baseDate.getDate() - daysCount + 1);

  let currentNav = fund.baseNav;

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dayOfWeek = d.getDay();
    
    // Financial markets are closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const dateStr = d.toISOString().split('T')[0];
    
    // Seeded random walk + sine waves for beautiful, organic, realistic fund fluctuations
    const dayIndex = i;
    const sineWave = Math.sin((dayIndex / fund.cycleDays) * Math.PI * 2) * fund.volatility;
    const cosineWave = Math.cos((dayIndex / (fund.cycleDays * 0.4)) * Math.PI * 2) * (fund.volatility * 0.4);
    
    // Long term trend drift
    const drift = (dayIndex / daysCount) * fund.trend;
    
    // Daily noise
    const noise = (seedRandom(dayIndex + fund.name.length) - 0.5) * (fund.volatility * 0.15);
    
    const multiplier = 1 + sineWave + cosineWave + drift + noise;
    const calculatedNav = Number((fund.baseNav * multiplier).toFixed(4));
    
    history.push({
      date: dateStr,
      nav: calculatedNav,
    });
  }

  return history;
}

// Generate pre-populated, demo records for "中证白酒指数增强" (white-liquor)
// to make the app interactive immediately.
export function getDefaultDemoData() {
  const whiteLiquorPref = PREDEFINED_FUNDS[1]; // White Liquor
  const navHistory = generateNavHistory(whiteLiquorPref, 120);
  
  // Let's pick dates inside the generated nav history for trades.
  // There are about 85 working days in 120 calendar days. Let's find index points.
  const len = navHistory.length;
  
  // We'll map some explicit transaction days:
  // e.g., index 15 (Buy, Active), index 30 (Buy, Paired), index 42 (Sell, Paired), 
  // index 55 (Buy, Paired), index 60 (Sell, Paired), index 75 (Sell, Active)
  const getPoint = (offset: number) => {
    const idx = Math.min(Math.floor(len * offset), len - 1);
    return navHistory[idx];
  };

  const p1 = getPoint(0.18); // Buy 1 - Paired with Sell 1
  const p2 = getPoint(0.35); // Sell 1 - Paired with Buy 1
  
  const p3 = getPoint(0.50); // Buy 2 - Paired with Sell 2
  const p4 = getPoint(0.65); // Sell 2 - Paired with Buy 2
  
  const p5 = getPoint(0.72); // Buy 3 - Active (Unpaired / Floating Buy)
  const p6 = getPoint(0.88); // Sell 4 - Active (Unpaired / Floating Sell)

  const demoTransactions: Transaction[] = [
    {
      id: 'tx-1',
      fundId: 'white-liquor',
      type: 'BUY',
      date: p1.date,
      nav: p1.nav,
      shares: 2000,
      amount: Number((p1.nav * 2000).toFixed(2)),
      pairedShares: 2000, // Fully paired
      note: '低位建仓做T底层防守',
    },
    {
      id: 'tx-2',
      fundId: 'white-liquor',
      type: 'SELL',
      date: p2.date,
      nav: p2.nav,
      shares: 2000,
      amount: Number((p2.nav * 2000).toFixed(2)),
      pairedShares: 2000, // Fully paired
      note: '波段触及阻力位，高抛落袋为安',
    },
    {
      id: 'tx-3',
      fundId: 'white-liquor',
      type: 'BUY',
      date: p3.date,
      nav: p3.nav,
      shares: 1500,
      amount: Number((p3.nav * 1500).toFixed(2)),
      pairedShares: 1500, // Fully paired
      note: '白酒板块回调至支撑位，执行T+0买入',
    },
    {
      id: 'tx-4',
      fundId: 'white-liquor',
      type: 'SELL',
      date: p4.date,
      nav: p4.nav,
      shares: 1500,
      amount: Number((p4.nav * 1500).toFixed(2)),
      pairedShares: 1500, // Fully paired
      note: '快速反弹回踩压力，止盈半仓做T',
    },
    {
      id: 'tx-5',
      fundId: 'white-liquor',
      type: 'BUY',
      date: p5.date,
      nav: p5.nav,
      shares: 1800,
      amount: Number((p5.nav * 1800).toFixed(2)),
      pairedShares: 0, // Unpaired (Floating Buy, active red dot)
      note: '盘中大幅下砸，补仓拉低均价',
    },
    {
      id: 'tx-6',
      fundId: 'white-liquor',
      type: 'SELL',
      date: p6.date,
      nav: p6.nav,
      shares: 1000,
      amount: Number((p6.nav * 1000).toFixed(2)),
      pairedShares: 0, // Unpaired (Floating Sell, active green dot)
      note: '反抽拉高减仓，留底静待企稳',
    }
  ];

  const demoTPairs: TPair[] = [
    {
      id: 'pair-1',
      fundId: 'white-liquor',
      buyTxId: 'tx-1',
      sellTxId: 'tx-2',
      shares: 2000,
      buyNav: p1.nav,
      sellNav: p2.nav,
      buyDate: p1.date,
      sellDate: p2.date,
      pairedDate: p2.date,
      profit: Number(((p2.nav - p1.nav) * 2000).toFixed(2)),
      profitRate: Number(((p2.nav - p1.nav) / p1.nav * 100).toFixed(2)),
      note: '【高抛低吸】首战告捷，价差：' + (p2.nav - p1.nav).toFixed(4),
    },
    {
      id: 'pair-2',
      fundId: 'white-liquor',
      buyTxId: 'tx-3',
      sellTxId: 'tx-4',
      shares: 1500,
      buyNav: p3.nav,
      sellNav: p4.nav,
      buyDate: p3.date,
      sellDate: p4.date,
      pairedDate: p4.date,
      profit: Number(((p4.nav - p3.nav) * 1500).toFixed(2)),
      profitRate: Number(((p4.nav - p3.nav) / p3.nav * 100).toFixed(2)),
      note: '【回调低吸】完美止盈，锁定价差利润',
    }
  ];

  return {
    demoTransactions,
    demoTPairs,
  };
}
