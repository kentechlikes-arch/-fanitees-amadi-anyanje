import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  RotateCcw, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  Wallet, 
  TrendingUp, 
  Megaphone, 
  Key, 
  Layers, 
  Save, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Activity, 
  UserCheck, 
  Lock, 
  RefreshCw 
} from 'lucide-react';
import { 
  OrderRecord, 
  TransactionRecord, 
  ServiceItem, 
  Currency, 
  OrderStatus, 
  PlatformId,
  ServiceType 
} from '../types';
import { formatCurrency, PLATFORMS_CONFIG } from '../data/servicesData';
import { DESIGNATED_ADMIN_UID } from '../lib/firebase';
import { RESERVED_USERNAMES, PROHIBITED_KEYWORDS } from '../lib/termsPolicy';

interface AdminPanelProps {
  orders: OrderRecord[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onRefundOrder: (orderId: string, charge: number, reason?: string) => void;
  onBoostOrder: (orderId: string, boostAmount: number) => void;
  services: ServiceItem[];
  onUpdateServiceRate: (serviceId: string, newRate: number) => void;
  onToggleServiceStatus: (serviceId: string, disabled: boolean) => void;
  onAddCustomService: (newService: ServiceItem) => void;
  transactions: TransactionRecord[];
  walletBalance: number;
  onAdjustWalletBalance: (deltaAmount: number, reason: string) => void;
  broadcastNotice: string;
  onUpdateBroadcastNotice: (notice: string) => void;
  currency: Currency;
  adminUid: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  orders,
  onUpdateOrderStatus,
  onRefundOrder,
  onBoostOrder,
  services,
  onUpdateServiceRate,
  onToggleServiceStatus,
  onAddCustomService,
  transactions,
  walletBalance,
  onAdjustWalletBalance,
  broadcastNotice,
  onUpdateBroadcastNotice,
  currency,
  adminUid
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'services' | 'finances' | 'broadcast' | 'access'>('orders');
  
  // Orders filter & search state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  
  // Services search & filter
  const [serviceSearch, setServiceSearch] = useState('');
  const [servicePlatformFilter, setServicePlatformFilter] = useState<string>('all');
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState<number>(0);
  
  // Add service modal
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcPlatform, setNewSvcPlatform] = useState<PlatformId>('tiktok');
  const [newSvcRate, setNewSvcRate] = useState<number>(100);
  const [newSvcMin, setNewSvcMin] = useState<number>(50);
  const [newSvcMax, setNewSvcMax] = useState<number>(100000);
  const [newSvcSpeed, setNewSvcSpeed] = useState('Instant (0-15m)');
  const [newSvcDescription, setNewSvcDescription] = useState('');
  
  // Financial adjustment
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjType, setAdjType] = useState<'credit' | 'debit'>('credit');
  const [adjReason, setAdjReason] = useState<string>('Administrative manual adjustment');
  const [adjFeedback, setAdjFeedback] = useState<string | null>(null);

  // Broadcast state
  const [noticeDraft, setNoticeDraft] = useState(broadcastNotice);
  const [noticeSavedFeedback, setNoticeSavedFeedback] = useState(false);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const matchSearch = 
        ord.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
        ord.serviceName.toLowerCase().includes(orderSearch.toLowerCase()) ||
        ord.link.toLowerCase().includes(orderSearch.toLowerCase()) ||
        (ord.mpesaRef && ord.mpesaRef.toLowerCase().includes(orderSearch.toLowerCase()));
      const matchStatus = orderStatusFilter === 'all' || ord.status === orderStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      const matchSearch = 
        svc.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        svc.id.includes(serviceSearch);
      const matchPlatform = servicePlatformFilter === 'all' || svc.category === servicePlatformFilter;
      return matchSearch && matchPlatform;
    });
  }, [services, serviceSearch, servicePlatformFilter]);

  // Financial aggregates
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.status !== 'Canceled' ? o.charge : 0), 0);
  }, [orders]);

  const totalDeposited = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Handlers
  const handleSaveRate = (serviceId: string) => {
    if (editRateValue > 0) {
      onUpdateServiceRate(serviceId, editRateValue);
    }
    setEditingRateId(null);
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSvcName.trim()) return;

    const newId = `ADMIN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newServiceItem: ServiceItem = {
      id: newId,
      name: newSvcName.trim(),
      category: newSvcPlatform,
      categoryName: PLATFORMS_CONFIG[newSvcPlatform]?.name || 'Social',
      type: 'custom' as ServiceType,
      ratePer1000: Number(newSvcRate),
      minQuantity: Number(newSvcMin),
      maxQuantity: Number(newSvcMax),
      speed: newSvcSpeed,
      refill: '30 Days Auto-Refill',
      description: newSvcDescription.trim() || 'Premium high retention automated delivery service.',
      badge: 'VIP',
      linkPlaceholder: 'https://...',
      linkExample: 'https://...',
      averageTime: '5-15 mins'
    };

    onAddCustomService(newServiceItem);
    setIsAddServiceOpen(false);
    setNewSvcName('');
    setNewSvcDescription('');
  };

  const handleExecuteWalletAdj = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(adjAmount);
    if (isNaN(val) || val <= 0) return;

    const signedDelta = adjType === 'credit' ? val : -val;
    onAdjustWalletBalance(signedDelta, adjReason);
    setAdjAmount('');
    setAdjFeedback(`Wallet adjusted successfully by ${adjType === 'credit' ? '+' : '-'}${val} ${currency}`);
    setTimeout(() => setAdjFeedback(null), 3000);
  };

  const handleSaveBroadcast = () => {
    onUpdateBroadcastNotice(noticeDraft);
    setNoticeSavedFeedback(true);
    setTimeout(() => setNoticeSavedFeedback(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Admin Header */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0C1525] via-[#09101C] to-[#0C1525] border border-emerald-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-black shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  KEN_TECH Operations Admin Console
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Superadmin Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-mono">
                Admin UID: <span className="text-emerald-400 font-bold">{adminUid || DESIGNATED_ADMIN_UID}</span> &bull; Cloud Firestore Authorized
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-[#121A2A] border border-slate-700 px-3.5 py-2 rounded-xl text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Ledger Wallet</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                {formatCurrency(walletBalance, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-[#121A2A]/90 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Total Orders Placed</span>
            <span className="text-xl font-black text-white font-mono mt-0.5 block">{orders.length}</span>
            <span className="text-[11px] text-emerald-400">{orders.filter(o => o.status === 'Completed').length} Completed</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#121A2A]/90 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Orders in Delivery</span>
            <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
              {orders.filter(o => o.status === 'Delivering' || o.status === 'In Progress').length}
            </span>
            <span className="text-[11px] text-slate-400">Automated queue</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#121A2A]/90 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Gross Revenue Charged</span>
            <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
              {formatCurrency(totalRevenue, currency)}
            </span>
            <span className="text-[11px] text-slate-400">Order fees collected</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#121A2A]/90 border border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Live Catalog Services</span>
            <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">
              {services.length}
            </span>
            <span className="text-[11px] text-emerald-400">{services.filter(s => !s.disabled).length} Online Active</span>
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex bg-[#0B101E] p-1.5 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-emerald-500 text-black shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Orders Management ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'services'
              ? 'bg-emerald-500 text-black shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Services & Rates ({services.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('finances')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'finances'
              ? 'bg-emerald-500 text-black shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Finances & Wallet Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'broadcast'
              ? 'bg-emerald-500 text-black shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Notice Banner</span>
        </button>

        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'access'
              ? 'bg-emerald-500 text-black shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Admin Security</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ORDERS MANAGEMENT                                 */}
      {/* ======================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="rounded-2xl bg-[#0B101E] border border-slate-800 p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search Order ID, link, M-Pesa ref..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full bg-[#121A2A] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto scrollbar-none">
              {['all', 'Pending', 'In Progress', 'Delivering', 'Completed', 'Canceled'].map((st) => (
                <button
                  key={st}
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    orderStatusFilter === st
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="rounded-3xl bg-[#0B101E] border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121A2A] text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Order ID & Date</th>
                    <th className="py-3 px-4">Service & Platform</th>
                    <th className="py-3 px-4">Target Link</th>
                    <th className="py-3 px-4">Quantity / Progress</th>
                    <th className="py-3 px-4">Charge</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No orders matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-white block">{ord.id}</span>
                          <span className="text-[10px] text-slate-500 block">{ord.createdAt}</span>
                          {ord.mpesaRef && (
                            <span className="text-[10px] text-emerald-400 block font-mono">
                              M-Pesa: {ord.mpesaRef}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 max-w-[200px]">
                          <span className="font-bold text-slate-200 block truncate">{ord.serviceName}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">{ord.platform}</span>
                        </td>

                        <td className="py-3.5 px-4 max-w-[180px]">
                          <a
                            href={ord.link.startsWith('http') ? ord.link : `https://${ord.link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline truncate block font-mono text-[11px]"
                          >
                            {ord.link}
                          </a>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-white block">
                            {ord.currentCount} / {ord.targetCount}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Qty: {ord.quantity.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {formatCurrency(ord.charge, currency)}
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={ord.status}
                            onChange={(e) => onUpdateOrderStatus(ord.id, e.target.value as OrderStatus)}
                            className="bg-[#121A2A] border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 font-medium"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Delivering">Delivering</option>
                            <option value="Completed">Completed</option>
                            <option value="Canceled">Canceled</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Boost Button */}
                          <button
                            onClick={() => onBoostOrder(ord.id, Math.round(ord.quantity * 0.25))}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold cursor-pointer"
                            title="Boost count by +25%"
                          >
                            +25% Boost
                          </button>

                          {/* Refund Button */}
                          {ord.status !== 'Canceled' && (
                            <button
                              onClick={() => onRefundOrder(ord.id, ord.charge, 'Admin one-click refund')}
                              className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-[11px] font-bold cursor-pointer"
                              title="Refund charge to client wallet"
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SERVICES & RATES CONFIGURATOR                     */}
      {/* ======================================================== */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0B101E] border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search service name, ID..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="w-full bg-[#121A2A] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              <select
                value={servicePlatformFilter}
                onChange={(e) => setServicePlatformFilter(e.target.value)}
                className="bg-[#121A2A] border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
              >
                <option value="all">All Platforms</option>
                {Object.keys(PLATFORMS_CONFIG).map((p) => (
                  <option key={p} value={p}>{PLATFORMS_CONFIG[p as PlatformId]?.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsAddServiceOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black flex items-center space-x-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Service</span>
            </button>
          </div>

          {/* Add Service Modal */}
          {isAddServiceOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-[#0D131F] border border-slate-700 rounded-3xl p-6 max-w-lg w-full space-y-4">
                <h3 className="text-lg font-black text-white">Create New Catalog Service</h3>
                <form onSubmit={handleCreateService} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Service Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TikTok High Retention Kenyan Views"
                      value={newSvcName}
                      onChange={(e) => setNewSvcName(e.target.value)}
                      className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Platform</label>
                      <select
                        value={newSvcPlatform}
                        onChange={(e) => setNewSvcPlatform(e.target.value as PlatformId)}
                        className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        {Object.keys(PLATFORMS_CONFIG).map((p) => (
                          <option key={p} value={p}>{PLATFORMS_CONFIG[p as PlatformId]?.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Rate / 1000 (KES)</label>
                      <input
                        type="number"
                        required
                        value={newSvcRate}
                        onChange={(e) => setNewSvcRate(Number(e.target.value))}
                        className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Min Quantity</label>
                      <input
                        type="number"
                        value={newSvcMin}
                        onChange={(e) => setNewSvcMin(Number(e.target.value))}
                        className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Max Quantity</label>
                      <input
                        type="number"
                        value={newSvcMax}
                        onChange={(e) => setNewSvcMax(Number(e.target.value))}
                        className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Description / Notes</label>
                    <textarea
                      rows={2}
                      value={newSvcDescription}
                      onChange={(e) => setNewSvcDescription(e.target.value)}
                      placeholder="High quality automated service with lifetime guarantee..."
                      className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddServiceOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-black"
                    >
                      Create Service
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Services List */}
          <div className="rounded-3xl bg-[#0B101E] border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121A2A] text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Service Details</th>
                    <th className="py-3 px-4">Platform</th>
                    <th className="py-3 px-4">Min - Max</th>
                    <th className="py-3 px-4">Rate per 1,000 (KES)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredServices.map((svc) => (
                    <tr key={svc.id} className={`hover:bg-slate-800/30 transition-colors ${svc.disabled ? 'opacity-50' : ''}`}>
                      <td className="py-3 px-4 font-mono text-slate-400">{svc.id}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">{svc.name}</span>
                        <span className="text-[10px] text-slate-500 block">{svc.speed}</span>
                      </td>
                      <td className="py-3 px-4 font-mono uppercase text-emerald-400 text-[11px] font-bold">
                        {svc.category}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {svc.minQuantity.toLocaleString()} - {svc.maxQuantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {editingRateId === svc.id ? (
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              value={editRateValue}
                              onChange={(e) => setEditRateValue(Number(e.target.value))}
                              className="w-20 bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-xs text-emerald-400 font-bold"
                            />
                            <button
                              onClick={() => handleSaveRate(svc.id)}
                              className="p-1 rounded bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white font-mono">{svc.ratePer1000} KES</span>
                            <button
                              onClick={() => {
                                setEditingRateId(svc.id);
                                setEditRateValue(svc.ratePer1000);
                              }}
                              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                              title="Edit rate"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          svc.disabled ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {svc.disabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onToggleServiceStatus(svc.id, !svc.disabled)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                            svc.disabled 
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                              : 'bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300'
                          }`}
                        >
                          {svc.disabled ? 'Enable' : 'Disable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: FINANCES & WALLET MANUAL ADJUSTMENT               */}
      {/* ======================================================== */}
      {activeTab === 'finances' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Manual Wallet Tool Card */}
          <div className="lg:col-span-1 rounded-3xl bg-[#0B101E] border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2.5">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">Manual Client Wallet Adjustment</h3>
            </div>
            <p className="text-xs text-slate-300">
              Directly credit or debit the central client wallet balance for manual M-Pesa reconciliations, bonuses, or compensations.
            </p>

            {adjFeedback && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs">
                {adjFeedback}
              </div>
            )}

            <form onSubmit={handleExecuteWalletAdj} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType('credit')}
                    className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      adjType === 'credit' ? 'bg-emerald-500 text-black font-black' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    + Credit Funds
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('debit')}
                    className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      adjType === 'debit' ? 'bg-rose-600 text-white font-black' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    - Debit Funds
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Amount (KES)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Audit Reason / Note</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full bg-[#121A2A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black shadow-lg cursor-pointer transition-all active:scale-95"
              >
                Apply Wallet Adjustment
              </button>
            </form>
          </div>

          {/* Transaction Ledger Table */}
          <div className="lg:col-span-2 rounded-3xl bg-[#0B101E] border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Full System Financial Ledger</h3>
              <span className="text-xs text-slate-400 font-mono">{transactions.length} records</span>
            </div>

            <div className="divide-y divide-slate-800 max-h-[480px] overflow-y-auto">
              {transactions.map((t) => {
                const isDeposit = t.type === 'deposit';
                const isRefund = t.type === 'refund';
                const isBonus = t.type === 'bonus';
                return (
                  <div key={t.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isDeposit || isBonus ? 'bg-emerald-500/20 text-emerald-400' : isRefund ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {isDeposit || isBonus ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-white block capitalize">{t.type}: {t.method}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Ref: {t.reference} &bull; {t.timestamp}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-black ${isDeposit || isRefund || isBonus ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {isDeposit || isRefund || isBonus ? '+' : '-'}{formatCurrency(t.amount, currency)}
                      </span>
                      <span className="block text-[10px] text-slate-400">{t.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: STOREFRONT NOTICE BROADCAST                       */}
      {/* ======================================================== */}
      {activeTab === 'broadcast' && (
        <div className="rounded-3xl bg-[#0B101E] border border-slate-800 p-6 sm:p-8 shadow-xl max-w-2xl space-y-4">
          <div className="flex items-center space-x-2.5">
            <Megaphone className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-black text-white">
              Storefront Announcement Banner
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            This notice appears at the top of the storefront for every customer. Use it to announce M-Pesa promotions, holiday bonuses, or service updates.
          </p>

          {noticeSavedFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Broadcast notice saved and published live!</span>
            </div>
          )}

          <div className="space-y-3">
            <textarea
              rows={3}
              value={noticeDraft}
              onChange={(e) => setNoticeDraft(e.target.value)}
              placeholder="e.g. ⚡ Safaricom M-Pesa STK Push is operating at instant speeds (< 3s)..."
              className="w-full bg-[#121A2A] border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />

            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveBroadcast}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-950/40"
              >
                <Save className="w-4 h-4" />
                <span>Publish Announcement</span>
              </button>
              <button
                onClick={() => {
                  setNoticeDraft('');
                  onUpdateBroadcastNotice('');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Clear / Hide Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: ADMIN SECURITY & PRIVILEGES                      */}
      {/* ======================================================== */}
      {activeTab === 'access' && (
        <div className="rounded-3xl bg-[#0B101E] border border-slate-800 p-6 sm:p-8 shadow-xl max-w-2xl space-y-4">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-black text-white">
              Administrator Security & Role Status
            </h3>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-2xl bg-[#121A2A] border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Primary Administrator UID</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Active
                </span>
              </div>
              <p className="text-xs font-mono text-emerald-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 break-all">
                {DESIGNATED_ADMIN_UID}
              </p>
              <p className="text-[11px] text-slate-400">
                This UID is locked in Firestore Security Rules (`firestore.rules`) with full administrative permissions to modify orders, service catalogs, and system records.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#121A2A] border border-slate-700/80 space-y-1.5">
              <span className="text-xs font-bold text-white block">Official Support Contact</span>
              <p className="text-xs text-slate-300 font-mono">
                Email: <span className="text-emerald-400">kentechlikeS@gmail.com</span>
              </p>
              <p className="text-xs text-slate-300 font-mono">
                Helpline: <span className="text-emerald-400">+254 793 749 604</span>
              </p>
            </div>

            {/* Platform Policy & Prohibited Terms Status */}
            <div className="p-4 rounded-2xl bg-[#121A2A] border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Active Reserved & Prohibited Terms</span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Enforced
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                System automatically scans all checkout target links and blocks registrations attempting to impersonate administration.
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Reserved Usernames</span>
                  <span className="font-mono font-bold text-amber-400">{RESERVED_USERNAMES.length} Protected Names</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Prohibited Link Keywords</span>
                  <span className="font-mono font-bold text-rose-400">{PROHIBITED_KEYWORDS.length} Blocked Terms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
