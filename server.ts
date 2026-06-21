/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON request parser
  app.use(express.json());

  // --- Fund Real NAV API Proxy Endpoint ---
  app.get('/api/fund-history', async (req, res) => {
    const code = req.query.code as string;
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Missing or invalid 6-digit fund code parameter' });
    }

    // Eastmoney / Tiantian Fund API for historical net values
    // Using the requested pingzhongdata endpoint: https://fund.eastmoney.com/pingzhongdata/【code】.js?v=【time】
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://fund.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error from Eastmoney pingzhongdata JS! status: ${response.status}`);
      }

      const jsText = await response.text();

      // Parse Data_netWorthTrend = [...];
      let rawTrendJson = '';
      const regex = /Data_netWorthTrend\s*=\s*(\[[\s\S]*?\])\s*;/;
      const match = jsText.match(regex);

      if (match && match[1]) {
        rawTrendJson = match[1];
      } else {
        // Fallback robust custom index search
        const startIndex = jsText.indexOf('Data_netWorthTrend =');
        if (startIndex !== -1) {
          const afterEqual = jsText.substring(startIndex + 'Data_netWorthTrend ='.length).trim();
          if (afterEqual.startsWith('[')) {
            const endSemi = afterEqual.indexOf(';');
            if (endSemi !== -1) {
              rawTrendJson = afterEqual.substring(0, endSemi).trim();
            }
          }
        }
      }

      if (!rawTrendJson) {
        throw new Error('Could not parse Data_netWorthTrend from the retrieved JS payload');
      }

      const trendData = JSON.parse(rawTrendJson);

      if (Array.isArray(trendData)) {
        // Map elements into simple { date: 'YYYY-MM-DD', nav: float } NAVPoint structure
        const navPoints = trendData.map((item: any) => {
          // item.x is millisecond timestamp (usually aligned to Beijing Time midnight, meaning UTC+8 midnight)
          // Add 8 hours shift before doing UTC calculations to guarantee correct timezone matching for YYYY-MM-DD
          const d = new Date(item.x + 8 * 3600 * 1000);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(d.getUTCDate()).padStart(2, '0');
          
          return {
            date: `${yyyy}-${mm}-${dd}`,
            nav: typeof item.y === 'number' ? item.y : parseFloat(item.y) || 1.0
          };
        });

        // Filter out any NaN elements
        const validPoints = navPoints.filter(p => !isNaN(p.nav));

        // Sort chronologically (oldest to newest)
        validPoints.sort((a, b) => a.date.localeCompare(b.date));

        return res.json({ points: validPoints });
      } else {
        throw new Error('Parsed Data_netWorthTrend is not a standard array');
      }
    } catch (error: any) {
      console.error(`Error retrieving actual fund history for ${code}:`, error);
      return res.status(500).json({ 
        error: 'Failed to retrieve actual fund history from remote node', 
        details: error.message 
      });
    }
  });

  // --- Fund Name Lookup API Endpoint ---
  app.get('/api/fund-name', async (req, res) => {
    const code = req.query.code as string;
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Missing or invalid 6-digit fund code parameter' });
    }

    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://fund.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error code from Eastmoney! status: ${response.status}`);
      }

      const jsText = await response.text();
      // Match fName = "..." or similar
      const nameRegex = /fName\s*=\s*["']([^"']+)["']/;
      const match = jsText.match(nameRegex);

      if (match && match[1]) {
        return res.json({ name: match[1], code });
      } else {
        return res.json({ name: `自定义基金(${code})`, code });
      }
    } catch (error: any) {
      console.error(`Error fetching fund name for ${code}:`, error);
      return res.json({ name: `自定义基金(${code})`, code, isFallback: true });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Integrate Vite Dev Server Middleware or serve compiled static bundle
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files from /dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[REAL FUND PROXY SERVER] Running successfully on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal failure starts server:', err);
  process.exit(1);
});
