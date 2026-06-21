/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Fund } from '../types';
import { PREDEFINED_FUNDS } from '../data/mockFunds';
import { 
  Building, 
  ChevronDown, 
  Plus, 
  X, 
  Download, 
  Upload, 
  Info,
  Layers,
  ArrowRight,
  Trash2
} from 'lucide-react';

interface FundSelectorProps {
  funds: Fund[];
  selectedFundId: string;
  onSelectFund: (fundId: string) => void;
  onAddFund: (fund: Fund) => void;
  onDeleteFund: (fundId: string) => void;
  onExportData: () => void;
  onImportData: (importObj: any) => void;
  onResetDemoData: () => void;
}

export default function FundSelector({
  funds,
  selectedFundId,
  onSelectFund,
  onAddFund,
  onDeleteFund,
  onExportData,
  onImportData,
  onResetDemoData
}: FundSelectorProps) {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  
  // Custom Fund Form State
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [isLoadingName, setIsLoadingName] = useState<boolean>(false);
  const [nameFetchError, setNameFetchError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFund = funds.find(f => f.id === selectedFundId) || funds[0];

  // Auto-fetch fund name when code is exactly 6 digits
  React.useEffect(() => {
    if (/^\d{6}$/.test(code.trim())) {
      const fetchFundName = async () => {
        setIsLoadingName(true);
        setNameFetchError('');
        try {
          const res = await fetch(`/api/fund-name?code=${code.trim()}`);
          if (res.ok) {
            const data = await res.json();
            if (data.name) {
              setName(data.name);
            } else {
              setName(`自定义基金(${code.trim()})`);
            }
          } else {
            setName(`自定义基金(${code.trim()})`);
          }
        } catch (error) {
          console.error('Error auto-resolving name:', error);
          setName(`自定义基金(${code.trim()})`);
        } finally {
          setIsLoadingName(false);
        }
      };
      fetchFundName();
    } else {
      setName('');
    }
  }, [code]);

  const handleCreateFund = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !/^\d{6}$/.test(code.trim())) {
      return alert('请先输入正确的6位数字基金代码！');
    }
    if (!name.trim()) {
      return alert('无法获取到基金名称，请重新检查基金代码。');
    }

    const newFund: Fund = {
      id: `custom-fund-${Date.now()}`,
      name: name.trim(),
      code: code.trim(),
      initialCostNav: 0,
      initialShares: 0,
      createdAt: new Date().toISOString()
    };

    onAddFund(newFund);
    
    // Reset & Close
    setName('');
    setCode('');
    setShowAddModal(false);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.funds && parsed.transactions && parsed.tpairs) {
          onImportData(parsed);
          alert('🎉 记录备份导入成功！数据已更新。');
        } else {
          alert('❌ 导入失败：JSON 格式不正确，缺少核心做T关键字段 (funds/transactions/tpairs)。');
        }
      } catch (err) {
        alert('❌ 导入合并失败，非法的 JSON 配置文件！');
      }
    };
    reader.readAsText(file);
    // Clear value to allow re-upload same file
    if (e.target) e.target.value = '';
  };

  return (
    <div className="bg-[#0e131f] text-white rounded-xl p-3.5 shadow-md relative overflow-hidden border border-slate-800/60">
      {/* Background Decorative Rings */}
      <div className="absolute right-0 top-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        
        {/* Selector Dropdown & Profile */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="p-2 bg-blue-600/15 text-blue-400 rounded-lg border border-blue-500/20 shrink-0">
            <Layers size={18} />
          </div>
          <div className="space-y-1 w-full">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">进行对冲做T的基金</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative inline-block w-full sm:w-52">
                <select
                  value={selectedFundId}
                  onChange={(e) => onSelectFund(e.target.value)}
                  className="w-full pl-2.5 pr-8 py-1.5 bg-[#171f30] border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.code ? `(${f.code})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Delete Current Selected Fund */}
              <button
                type="button"
                onClick={() => {
                  if (selectedFund) {
                    if (confirm(`⚠️ 警告！确认要删除《${selectedFund.name}》及该基金下的所有对冲配对、历史交易流水和底仓价格记录吗？\n\n删除后数据不可恢复！`)) {
                      onDeleteFund(selectedFundId);
                    }
                  }
                }}
                className="p-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-900/30 text-rose-400 hover:text-rose-100 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center shrink-0"
                title={`删除当前基金: ${selectedFund?.name || ''}`}
              >
                <Trash2 size={13} />
              </button>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-2.5 py-1.5 bg-[#171f30] hover:bg-[#202b43] border border-slate-700 rounded-lg text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={13} />
                <span>录入新账户</span>
              </button>
            </div>
          </div>
        </div>

        {/* Current profile holding specs and operations */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto self-stretch md:self-auto border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
          


          {/* Backup Import/Export & Reset buttons */}
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            <button
              onClick={onExportData}
              className="p-1.5 bg-[#171f30] hover:bg-[#202b43] border border-slate-750 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="导出做T本金账簿 (JSON备份)"
            >
              <Download size={14} />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 bg-[#171f30] hover:bg-[#202b43] border border-slate-750 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="导入账簿备份 (.json文件)"
            >
              <Upload size={14} />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFileChange}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => {
                if(confirm('⚠️ 警告：恢复系统演示数据将清空您当前在浏览器中的所有手动添加记录（包括新增基金、对冲闭环、交易流水）。\n\n确认要恢复出厂初始化演示数据吗？')) {
                  onResetDemoData();
                }
              }}
              className="px-3 py-2 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-semibold cursor-pointer"
            >
              重置演示
            </button>
          </div>

        </div>

      </div>

      {/* Add Custom Fund Slide-over / Modal (styled beautifully as glassmorphic popup) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl animate-fade-in text-white text-left">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setName('');
                setCode('');
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <Building className="text-blue-400" size={18} />
              <h3 className="text-sm font-bold text-slate-100">录入新的基金端持仓</h3>
            </div>

            <form onSubmit={handleCreateFund} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  基金代码 (6位数字) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="例如：005827"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm placeholder-slate-500"
                    required
                    autoFocus
                  />
                  {isLoadingName && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[11px] text-blue-400">
                      <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>正在查询...</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  基金名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="输入代码自动获取基金名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-slate-500 font-medium"
                  required
                />
              </div>

              {/* Informative advice */}
              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-[10px] text-slate-400 leading-relaxed flex gap-1.5">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong>如何开始对账与折线做T？</strong>
                  <br />
                  添加成功后，在下方的<b>【添加最新做T收支流水】</b>中，直接输入买入/卖出交易（如加仓、高抛），通过顶部套利模块进行结对配对。系统不仅会自动计算利润，还会实时生成对冲高抛与低吸连线！
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-800 pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setName('');
                    setCode('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isLoadingName || !name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  录入基金账户
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
