/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { QuickOrderWidget } from './components/QuickOrderWidget';
import { ServicesTable } from './components/ServicesTable';
import { OrderTracker } from './components/OrderTracker';
import { BonusPromo } from './components/BonusPromo';
import { UserProfileView } from './components/UserProfileView';
import { ResellerApiModal } from './components/ResellerApiModal';
import { SupportCenter } from './components/SupportCenter';
import { ReviewsAndFaq } from './components/ReviewsAndFaq';
import { DepositModal } from './components/DepositModal';
import { WhatsAppSupportWidget } from './components/WhatsAppSupportWidget';
import { Footer } from './components/Footer';

import { 
  Currency, 
  PlatformId, 
  OrderRecord, 
  TransactionRecord, 
  ThemePreset,
  ServiceItem
} from './types';
import { 
  INITIAL_ORDERS, 
  INITIAL_TRANSACTIONS, 
  SERVICES_CATALOG 
} from './data/servicesData';
import { ArrowLeft, Sparkles, Table as TableIcon, Lock } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { AuthModal, AuthMode } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';

import {
  ensureAuthSession,
  validateFirebaseConnection,
  seedInitialDataIfEmpty,
  subscribeToOrders,
  subscribeToTransactions,
  subscribeToWallet,
  saveOrderToFirestore,
  updateOrderInFirestore,
  saveTransactionToFirestore,
  saveWalletBalanceToFirestore,
  subscribeToAuthState,
  fetchUserProfile,
  logoutAccount,
  DESIGNATED_ADMIN_UID,
  checkIsAdmin,
  ensureAdminDesignation,
  SUPPORT_EMAIL
} from './lib/firebase';
import { UserProfile, OrderStatus } from './types';

export default function App() {
  // Navigation & UI State (6 primary menu categories: order, my-orders, bonus, profile, api, support)
  const [activeTab, setActiveTab] = useState<string>('order');
  const [currency, setCurrency] = useState<Currency>('KES');
  const [theme, setTheme] = useState<ThemePreset>('emerald-obsidian');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [showCatalogInOrderTab, setShowCatalogInOrderTab] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  // Business State
  const [walletBalance, setWalletBalance] = useState<number>(1280); // initial KES balance
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [services, setServices] = useState<ServiceItem[]>(SERVICES_CATALOG);
  const [broadcastNotice, setBroadcastNotice] = useState<string>(
    '⚡ Safaricom M-Pesa STK Push is operating at instant speeds (< 3s). Extra 10% promo bonus active on deposits!'
  );
  const [selectedCategory, setSelectedCategory] = useState<PlatformId>('facebook');
  const [preselectedServiceId, setPreselectedServiceId] = useState<string | undefined>('6206');
  const [searchedOrderId, setSearchedOrderId] = useState<string>('');
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

  // Auth Handlers
  const handleOpenAuth = (mode: AuthMode = 'login') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logoutAccount();
      setCurrentUser(null);
      setUserProfile(null);
      await ensureAuthSession();
    } catch (err) {
      console.warn('Logout notice:', err);
    }
  };

  // Initialize and synchronize with Firebase Firestore & Auth
  useEffect(() => {
    let unsubOrders: (() => void) | undefined;
    let unsubTxns: (() => void) | undefined;
    let unsubWallet: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;

    async function initFirebase() {
      try {
        await ensureAuthSession();
        const connected = await validateFirebaseConnection();
        setFirebaseConnected(connected);

        // Seed initial data if database collections are fresh
        await seedInitialDataIfEmpty(INITIAL_ORDERS, INITIAL_TRANSACTIONS, 1280);

        // Authorize designated admin user in Firestore
        await ensureAdminDesignation();

        // Listen to Auth State
        unsubAuth = subscribeToAuthState(async (user) => {
          setCurrentUser(user);
          if (user && !user.isAnonymous) {
            const prof = await fetchUserProfile(user.uid);
            setUserProfile(prof);

            const userIsAdmin = user.uid === DESIGNATED_ADMIN_UID || (await checkIsAdmin(user.uid));
            setIsAdmin(userIsAdmin);

            // Re-subscribe wallet specifically for this user account
            if (unsubWallet) unsubWallet();
            unsubWallet = subscribeToWallet((liveBalance) => {
              setWalletBalance(liveBalance);
            }, user.uid);
          } else {
            setUserProfile(null);
            setIsAdmin(false);
            if (unsubWallet) unsubWallet();
            unsubWallet = subscribeToWallet((liveBalance) => {
              setWalletBalance(liveBalance);
            }, 'default_user');
          }
        });

        // Real-time synchronization listeners
        unsubOrders = subscribeToOrders((liveOrders) => {
          if (liveOrders && liveOrders.length > 0) {
            setOrders(liveOrders);
          }
        });

        unsubTxns = subscribeToTransactions((liveTxns) => {
          if (liveTxns && liveTxns.length > 0) {
            setTransactions(liveTxns);
          }
        });
      } catch (err) {
        console.warn('Firebase init note:', err);
      }
    }

    initFirebase();

    return () => {
      if (unsubOrders) unsubOrders();
      if (unsubTxns) unsubTxns();
      if (unsubWallet) unsubWallet();
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Place order handler
  const handlePlaceOrder = (newOrder: OrderRecord, paymentSource: 'wallet' | 'mpesa'): boolean => {
    const currentUid = currentUser && !currentUser.isAnonymous ? currentUser.uid : 'default_user';
    const orderWithUser: OrderRecord = {
      ...newOrder,
      notes: currentUid !== 'default_user' ? `User: ${currentUser?.email}` : undefined,
    };

    let newBal = walletBalance;
    if (paymentSource === 'wallet') {
      newBal = Math.max(0, walletBalance - newOrder.charge);
      setWalletBalance(newBal);
      saveWalletBalanceToFirestore(newBal, currentUid);
    }

    setOrders((prev) => [orderWithUser, ...prev]);
    saveOrderToFirestore(orderWithUser);

    // Record Transaction
    const newTxn: TransactionRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'order',
      amount: newOrder.charge,
      method: paymentSource === 'mpesa' ? 'M-PESA STK Push' : 'Wallet Balance',
      reference: newOrder.mpesaRef || `ORD-${newOrder.id}`,
      status: 'Completed',
      timestamp: 'Just now',
    };
    setTransactions((prev) => [newTxn, ...prev]);
    saveTransactionToFirestore(newTxn);

    return true;
  };

  // Deposit handler
  const handleDepositSuccess = (amountInKES: number, method: string, reference: string) => {
    const currentUid = currentUser && !currentUser.isAnonymous ? currentUser.uid : 'default_user';
    const updatedBalance = walletBalance + amountInKES;
    setWalletBalance(updatedBalance);
    saveWalletBalanceToFirestore(updatedBalance, currentUid);

    const newTxn: TransactionRecord = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'deposit',
      amount: amountInKES,
      method: method as any,
      reference,
      status: 'Completed',
      timestamp: 'Just now',
    };
    setTransactions((prev) => [newTxn, ...prev]);
    saveTransactionToFirestore(newTxn);
  };

  // Refill request handler
  const handleRequestRefill = (orderId: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const nextCount = Math.min(ord.targetCount, ord.currentCount + Math.round(ord.quantity * 0.25));
          const updated: OrderRecord = {
            ...ord,
            status: 'Delivering',
            currentCount: nextCount,
          };
          updateOrderInFirestore(orderId, {
            status: 'Delivering',
            currentCount: nextCount,
          });
          return updated;
        }
        return ord;
      })
    );
  };

  // Admin Operations Handlers
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    updateOrderInFirestore(orderId, { status: newStatus });
  };

  const handleRefundOrder = (orderId: string, charge: number, reason = 'Admin Refund') => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'Canceled' } : o))
    );
    updateOrderInFirestore(orderId, { status: 'Canceled' });

    const currentUid = currentUser && !currentUser.isAnonymous ? currentUser.uid : 'default_user';
    const nextBal = walletBalance + charge;
    setWalletBalance(nextBal);
    saveWalletBalanceToFirestore(nextBal, currentUid);

    const refundTxn: TransactionRecord = {
      id: `TXN-REFUND-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'refund',
      amount: charge,
      method: 'Wallet Balance',
      reference: `REFUND-${orderId}`,
      status: 'Completed',
      timestamp: 'Just now',
    };
    setTransactions((prev) => [refundTxn, ...prev]);
    saveTransactionToFirestore(refundTxn);
  };

  const handleBoostOrder = (orderId: string, boostAmount: number) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const nextCount = Math.min(o.targetCount, o.currentCount + boostAmount);
          updateOrderInFirestore(orderId, { currentCount: nextCount, status: 'Delivering' });
          return { ...o, currentCount: nextCount, status: 'Delivering' };
        }
        return o;
      })
    );
  };

  const handleUpdateServiceRate = (serviceId: string, newRate: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, ratePer1000: newRate } : s))
    );
  };

  const handleToggleServiceStatus = (serviceId: string, disabled: boolean) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, disabled } : s))
    );
  };

  const handleAddCustomService = (newService: ServiceItem) => {
    setServices((prev) => [newService, ...prev]);
  };

  const handleAdjustWalletBalance = (deltaAmount: number, reason: string) => {
    const currentUid = currentUser && !currentUser.isAnonymous ? currentUser.uid : 'default_user';
    const nextBal = Math.max(0, walletBalance + deltaAmount);
    setWalletBalance(nextBal);
    saveWalletBalanceToFirestore(nextBal, currentUid);

    const adjTxn: TransactionRecord = {
      id: `TXN-ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
      type: deltaAmount >= 0 ? 'deposit' : 'order',
      amount: Math.abs(deltaAmount),
      method: 'Wallet Balance',
      reference: reason || 'Admin Adjustment',
      status: 'Completed',
      timestamp: 'Just now',
    };
    setTransactions((prev) => [adjTxn, ...prev]);
    saveTransactionToFirestore(adjTxn);
  };

  // Routing to specific service from Catalog
  const handleSelectServiceToOrder = (serviceId: string) => {
    const s = services.find((item) => item.id === serviceId);
    if (s) {
      setSelectedCategory(s.category);
      setPreselectedServiceId(serviceId);
    }
    setShowCatalogInOrderTab(false);
    setActiveTab('order');
    window.scrollTo({ top: 320, behavior: 'smooth' });
  };

  const handleViewOrder = (orderId: string) => {
    setSearchedOrderId(orderId);
    setActiveTab('my-orders');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dynamic Theme Palette Styling
  const themeStyles: Record<ThemePreset, { bg: string; glow1: string; glow2: string }> = {
    'emerald-obsidian': {
      bg: 'bg-[#080D1A]',
      glow1: 'from-emerald-600/15 via-teal-600/10 to-transparent',
      glow2: 'from-cyan-600/10 via-indigo-600/10 to-transparent',
    },
    'sapphire-cyber': {
      bg: 'bg-[#060B18]',
      glow1: 'from-blue-600/20 via-indigo-600/15 to-transparent',
      glow2: 'from-violet-600/15 via-cyan-500/10 to-transparent',
    },
    'sunset-gold': {
      bg: 'bg-[#0E0C13]',
      glow1: 'from-amber-600/15 via-orange-600/10 to-transparent',
      glow2: 'from-rose-600/10 via-purple-600/10 to-transparent',
    },
    'sleek-slate': {
      bg: 'bg-[#0A0D14]',
      glow1: 'from-slate-600/15 via-slate-800/10 to-transparent',
      glow2: 'from-emerald-600/10 via-slate-700/10 to-transparent',
    },
  };

  const currentTheme = themeStyles[theme] || themeStyles['emerald-obsidian'];

  return (
    <div className={`min-h-screen text-slate-100 selection:bg-emerald-500 selection:text-black relative transition-colors duration-500 ${currentTheme.bg}`}>
      
      {/* Ambient background glows */}
      <div className={`fixed top-0 left-1/4 w-[700px] h-[500px] bg-gradient-radial ${currentTheme.glow1} blur-[140px] pointer-events-none -z-10`}></div>
      <div className={`fixed bottom-0 right-1/4 w-[600px] h-[500px] bg-gradient-radial ${currentTheme.glow2} blur-[140px] pointer-events-none -z-10`}></div>

      {/* Main Navbar with 6 Primary Menu Categories */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currency={currency}
        setCurrency={setCurrency}
        walletBalance={walletBalance}
        onOpenDeposit={() => setIsDepositOpen(true)}
        theme={theme}
        setTheme={setTheme}
        firebaseConnected={firebaseConnected}
        currentUser={currentUser}
        userProfile={userProfile}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        isAdmin={isAdmin}
      />

      {/* Hero Banner (Featured on New order view) */}
      {activeTab === 'order' && (
        <HeroSection
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setShowCatalogInOrderTab(false);
          }}
          onExploreServices={() => setShowCatalogInOrderTab(true)}
          onOpenDeposit={() => setIsDepositOpen(true)}
        />
      )}

      {/* Primary Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Dynamic Admin Broadcast Banner for Clients */}
        {broadcastNotice && activeTab !== 'admin' && (
          <div className="mb-6 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border border-emerald-500/40 rounded-2xl px-4 py-3 text-xs flex items-center justify-between text-slate-200 shadow-xl backdrop-blur-md">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">Notice:</span>
              <span className="font-medium text-slate-200">{broadcastNotice}</span>
            </div>
            <button
              onClick={() => setBroadcastNotice('')}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer transition-colors"
              title="Dismiss announcement"
            >
              &times;
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. NEW ORDER (Category dashboard, custom 100s: likes at 45 bob per 100) */}
        {/* ======================================================== */}
        {activeTab === 'order' && (
          <div className="space-y-10">
            {/* Toggle bar between Quick Order Form and Wholesale Price List */}
            <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setShowCatalogInOrderTab(false)}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  !showCatalogInOrderTab
                    ? 'bg-emerald-500 text-black shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Quick Order Form</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCatalogInOrderTab(true)}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  showCatalogInOrderTab
                    ? 'bg-emerald-500 text-black shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                <span>Full Price List</span>
              </button>
            </div>

            {!showCatalogInOrderTab ? (
              <>
                <QuickOrderWidget
                  selectedCategory={selectedCategory}
                  onSelectCategory={(cat) => setSelectedCategory(cat)}
                  currency={currency}
                  walletBalance={walletBalance}
                  onPlaceOrder={handlePlaceOrder}
                  onOpenDeposit={() => setIsDepositOpen(true)}
                  preselectedServiceId={preselectedServiceId}
                  onViewOrder={handleViewOrder}
                  services={services}
                />
                {/* Reviews, Credibility & FAQ right below order widget */}
                <ReviewsAndFaq />
              </>
            ) : (
              <ServicesTable
                currency={currency}
                onSelectServiceToOrder={handleSelectServiceToOrder}
                services={services}
              />
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. MY ORDERS (Tracking, status, refill, and telemetry)    */}
        {/* ======================================================== */}
        {(activeTab === 'my-orders' || activeTab === 'track') && (
          <div className="space-y-6">
            <OrderTracker
              orders={orders}
              currency={currency}
              onRequestRefill={handleRequestRefill}
              searchedOrderId={searchedOrderId}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. BONUS 10% (Promo calculator, M-Pesa extra credit, ref) */}
        {/* ======================================================== */}
        {activeTab === 'bonus' && (
          <BonusPromo
            currency={currency}
            onOpenDeposit={() => setIsDepositOpen(true)}
            walletBalance={walletBalance}
          />
        )}

        {/* ======================================================== */}
        {/* 4. PROFILE (Wallet balance, API key, transaction ledger)  */}
        {/* ======================================================== */}
        {activeTab === 'profile' && (
          <UserProfileView
            walletBalance={walletBalance}
            currency={currency}
            onOpenDeposit={() => setIsDepositOpen(true)}
            transactions={transactions}
            orders={orders}
            currentUser={currentUser}
            userProfile={userProfile}
            onOpenAuth={handleOpenAuth}
            onLogout={handleLogout}
            onNavigateToAdmin={() => setActiveTab('admin')}
            isAdmin={isAdmin}
          />
        )}

        {/* ======================================================== */}
        {/* 5. API (SMM Reseller REST API endpoints & code samples)  */}
        {/* ======================================================== */}
        {activeTab === 'api' && (
          <ResellerApiModal />
        )}

        {/* ======================================================== */}
        {/* 6. SUPPORT (24/7 Nairobi WhatsApp, tickets & help desk)   */}
        {/* ======================================================== */}
        {(activeTab === 'support' || activeTab === 'faq') && (
          <SupportCenter orders={orders} />
        )}

        {/* Optional fallback view if navigated directly to services catalog */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab('order')}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to New order</span>
              </button>
            </div>
            <ServicesTable
              currency={currency}
              onSelectServiceToOrder={handleSelectServiceToOrder}
              services={services}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* 7. ADMIN HUB (Designated Superadmin Operations Console)  */}
        {/* ======================================================== */}
        {activeTab === 'admin' && (
          isAdmin ? (
            <AdminPanel
              orders={orders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onRefundOrder={handleRefundOrder}
              onBoostOrder={handleBoostOrder}
              services={services}
              onUpdateServiceRate={handleUpdateServiceRate}
              onToggleServiceStatus={handleToggleServiceStatus}
              onAddCustomService={handleAddCustomService}
              transactions={transactions}
              walletBalance={walletBalance}
              onAdjustWalletBalance={handleAdjustWalletBalance}
              broadcastNotice={broadcastNotice}
              onUpdateBroadcastNotice={setBroadcastNotice}
              currency={currency}
              adminUid={currentUser?.uid || DESIGNATED_ADMIN_UID}
            />
          ) : (
            <div className="rounded-3xl bg-[#0D131F] border border-rose-500/40 p-8 text-center max-w-lg mx-auto space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">Administrator Access Required</h3>
              <p className="text-xs text-slate-300">
                You must be logged in as the designated administrator ({DESIGNATED_ADMIN_UID}) to access the operations console.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleOpenAuth('login')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  Sign In with Admin Account
                </button>
              </div>
            </div>
          )
        )}

      </main>

      {/* Deposit / M-Pesa STK Modal */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        currency={currency}
        onDepositSuccess={handleDepositSuccess}
      />

      {/* User Authentication & Password Reset Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
      />

      {/* Floating 24/7 WhatsApp Support Widget */}
      <WhatsAppSupportWidget />

      {/* Global Footer */}
      <Footer onNavigate={setActiveTab} />

    </div>
  );
}
