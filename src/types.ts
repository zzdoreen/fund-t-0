/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  fundId: string;
  type: TransactionType;
  date: string;       // YYYY-MM-DD
  nav: number;        // Net Asset Value (unit price)
  shares: number;     // Number of shares traded
  amount: number;     // Total trade amount (nav * shares)
  pairedShares: number; // Part of shares that has been successfully paired/hedged in T trades
  note?: string;      // Optional notes or remarks
}

export interface TPair {
  id: string;
  fundId: string;
  buyTxId: string;
  sellTxId: string;
  shares: number;     // Paired shares
  buyNav: number;     // Unit price when buying
  sellNav: number;    // Unit price when selling
  buyDate: string;    // Buy transaction date
  sellDate: string;   // Sell transaction date
  pairedDate: string; // Dynamic paired timestamp/date
  profit: number;     // (sellNav - buyNav) * shares minus fees if applicable
  profitRate: number; // (sellNav - buyNav) / buyNav * 100%
  note?: string;      // Pair note
}

export interface Fund {
  id: string;
  name: string;
  code: string;       // Fund code (e.g., 161725)
  initialCostNav: number; // Initial unit cost before any T-trading
  initialShares: number;  // Initial core shares held (base position)
  createdAt: string;
}

export interface NAVPoint {
  date: string;       // YYYY-MM-DD
  nav: number;        // Net Asset Value (unit price)
}

export interface ChartDataPoint {
  date: string;
  nav: number;
  changePct: number;    // Difference percentage from the baseline (first point of the chart)
  transactions: {
    id: string;
    type: TransactionType;
    nav: number;
    shares: number;
    isPaired: boolean; // Fully paired
    pairedFraction: number; // 0 to 1 representing how much is paired
  }[];
}
