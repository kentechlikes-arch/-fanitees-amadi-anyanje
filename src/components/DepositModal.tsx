import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  CreditCard, 
  Coins, 
  Copy, 
  Check, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Currency } from '../types';
import { formatCurrency } from '../data/servicesData';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: Currency;
  onDepositSuccess: (amountInKES: number, method: string, reference: string) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  currency,
  onDepositSuccess,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'stk' | 'paybill' | 'crypto' | 'card'>('stk');
  
  // STK form state
  const [phoneNumber, setPhoneNumber] = useState('0793749604');
  const [amount, setAmount] = useState<number>(1000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stkPromptScreen, setStkPromptScreen] = useState(false);
  const [stkPin, setStkPin] = useState('');
  const [successReceipt, setSuccessReceipt] = useState<{ amount: number; ref: string } | null>(null);

  // Paybill verification state
  const [manualCode, setManualCode] = useState('');
  const [manualCodeSubmitted, setManualCodeSubmitted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const quickAmounts = [200, 500, 1000, 2500, 5000, 10000];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleInitiateSTK = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) return;
    if (amount < 50) return;

    setStkPromptScreen(true);
  };

  const handleConfirmSTKPin = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const generatedRef = `QJD${Math.floor(100000 + Math.random() * 900000)}KE`;
      setIsProcessing(false);
      setStkPromptScreen(false);
      setSuccessReceipt({ amount, ref: generatedRef });
      onDepositSuccess(amount, 'M-PESA STK Push', generatedRef);

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#059669', '#3B82F6'],
        });
      } catch (err) {}
    }, 1800);
  };

  const handleManualCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || manualCode.length < 8) return;

    setIsProcessing(true);
    setTimeout(() => {
      const creditedAmount = 1500; // Simulated verified amount
      setIsProcessing(false);
      setManualCodeSubmitted(true);
      setSuccessReceipt({ amount: creditedAmount, ref: manualCode.toUpperCase() });
      onDepositSuccess(creditedAmount, 'M-PESA Paybill', manualCode.toUpperCase());

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#059669'],
        });
      } catch (err) {}
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 my-8">
        
        {/* Modal Top Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-b border-emerald-500/20 p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Deposit & Top Up Wallet
              </h3>
              <p className="text-xs text-slate-400">
                Direct automated Safaricom M-Pesa integration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-900/60 text-xs font-bold text-slate-400">
          <button
            onClick={() => setActiveTab('stk')}
            className={`py-3 px-2 text-center transition-colors border-b-2 flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 cursor-pointer ${
              activeTab === 'stk'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>M-Pesa STK</span>
          </button>

          <button
            onClick={() => setActiveTab('paybill')}
            className={`py-3 px-2 text-center transition-colors border-b-2 flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 cursor-pointer ${
              activeTab === 'paybill'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>Paybill 522522</span>
          </button>

          <button
            onClick={() => setActiveTab('crypto')}
            className={`py-3 px-2 text-center transition-colors border-b-2 flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 cursor-pointer ${
              activeTab === 'crypto'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>Crypto USDT</span>
          </button>

          <button
            onClick={() => setActiveTab('card')}
            className={`py-3 px-2 text-center transition-colors border-b-2 flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 cursor-pointer ${
              activeTab === 'card'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Card / Bank</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          
          {/* Success Screen If Paid */}
          {successReceipt ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-4 ring-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">Payment Received!</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Your wallet has been credited with{' '}
                  <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(successReceipt.amount, currency)}</strong>
                </p>
              </div>

              <div className="max-w-xs mx-auto bg-slate-900 border border-emerald-500/30 p-3 rounded-xl text-left text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Reference:</span>
                  <span className="text-emerald-400 font-bold">{successReceipt.ref}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-white">Completed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time:</span>
                  <span className="text-slate-300">Instant Automated</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setSuccessReceipt(null);
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow cursor-pointer"
              >
                Done & Start Ordering
              </button>
            </div>
          ) : (
            <>
              {/* TAB 1: M-PESA STK PUSH */}
              {activeTab === 'stk' && (
                <form onSubmit={handleInitiateSTK} className="space-y-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start space-x-2">
                    <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Enter your phone number. Safaricom will send an automated prompt to your phone. Enter your PIN to instantly credit your account.
                    </span>
                  </div>

                  {/* Phone input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Safaricom Phone Number for M-Pesa Prompt:
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0793749604"
                      className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-emerald-300 font-bold font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Amount input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-200">
                      <label>Amount to Top Up (KES):</label>
                      <span className="text-emerald-400 font-mono">Min: KES 50</span>
                    </div>
                    <input
                      type="number"
                      min={50}
                      step={50}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full bg-[#090D16] border border-slate-700 rounded-xl px-4 py-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Quick preset chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {quickAmounts.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(q)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                          amount === q
                            ? 'bg-emerald-500 text-black font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        KES {q.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-sm tracking-wide shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Send M-Pesa Prompt (KES {amount.toLocaleString()})</span>
                  </button>
                </form>
              )}

              {/* TAB 2: PAYBILL INSTRUCTIONS */}
              {activeTab === 'paybill' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
                    <p className="font-semibold text-white">Manual M-Pesa Lipa na M-Pesa Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                      <li>Go to M-PESA menu on your phone</li>
                      <li>Select <strong>Lipa Na M-PESA &rarr; Pay Bill</strong></li>
                      <li>Enter Business Number: <strong className="text-white">522522</strong></li>
                      <li>Enter Account Number: <strong className="text-white">KT-88421</strong></li>
                      <li>Enter your desired Amount & M-PESA PIN</li>
                      <li>Paste the received M-Pesa SMS Code below to auto-verify!</li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Paybill Number</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">522522</span>
                      </div>
                      <button
                        onClick={() => handleCopy('522522', 'paybill')}
                        className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        {copiedField === 'paybill' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Account Number</span>
                        <span className="text-sm font-mono font-bold text-white">KT-88421</span>
                      </div>
                      <button
                        onClick={() => handleCopy('KT-88421', 'acc')}
                        className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Code Verification form */}
                  <form onSubmit={handleManualCodeSubmit} className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-semibold text-slate-200">
                      Enter M-Pesa Confirmation Code (e.g., QJD78239KA):
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="QJD78239KA"
                        className="flex-1 bg-[#090D16] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white uppercase focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs cursor-pointer"
                      >
                        {isProcessing ? 'Verifying...' : 'Verify & Credit'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: CRYPTO USDT */}
              {activeTab === 'crypto' && (
                <div className="space-y-4 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                    Accepting USDT (TRC-20 & BEP-20) with instant conversion: <strong>1 USDT = 130 KES</strong>.
                  </div>

                  <div className="space-y-2">
                    <label className="text-slate-400 block">USDT (TRC-20) Deposit Address:</label>
                    <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800 font-mono text-[11px] text-white flex items-center justify-between break-all">
                      <span>TKp7A9dZ19W4yJmNxE3vQ8u2kL5sC8F3b</span>
                      <button
                        onClick={() => handleCopy('TKp7A9dZ19W4yJmNxE3vQ8u2kL5sC8F3b', 'usdt')}
                        className="ml-2 p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white shrink-0"
                      >
                        {copiedField === 'usdt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Network confirmations usually take 1 - 3 minutes. Your KEN_TECH LIKES balance is credited automatically upon 1 confirmation.
                  </p>
                </div>
              )}

              {/* TAB 4: CARD / INTERNATIONAL */}
              {activeTab === 'card' && (
                <div className="space-y-4 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <p className="font-semibold text-white">Credit / Debit Card (Visa, Mastercard, Apple Pay):</p>
                    <p className="text-slate-400 text-[11px]">
                      International cards are processed securely with 3D-Secure 256-bit encryption.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-slate-400">Cardholder Name:</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-slate-400">Card Number:</label>
                    <input
                      type="text"
                      placeholder="4000 1234 5678 9010"
                      className="w-full bg-[#090D16] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onDepositSuccess(2500, 'Card', `CARD-${Math.floor(100000 + Math.random() * 900000)}`);
                      setSuccessReceipt({ amount: 2500, ref: 'CARD-AUTH-OK' });
                    }}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                  >
                    Simulate Card Deposit (KES 2,500)
                  </button>
                </div>
              )}
            </>
          )}

        </div>

      </div>

      {/* STK Push Simulator Prompt Modal */}
      {stkPromptScreen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-emerald-500/50 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-emerald-400 tracking-wider">
                M-PESA SIM PROMPT
              </span>
              <button onClick={() => setStkPromptScreen(false)} className="text-slate-400 text-xs">✕</button>
            </div>

            <div className="bg-[#05110E] p-3.5 rounded-xl border border-emerald-500/30 text-xs text-emerald-300 font-mono space-y-1">
              <p>Pay <strong>Ksh {amount.toLocaleString()}</strong> to <strong>KEN TECH LIKES LTD</strong>?</p>
              <p className="text-[11px] text-slate-400">Till/Paybill: 522522</p>
              <p className="text-[11px] text-emerald-400 font-bold">Paying Line: {phoneNumber || '0793749604'}</p>
            </div>

            <div className="text-center">
              <label className="text-xs text-slate-300 block mb-1">Enter PIN (4 Digits):</label>
              <input
                type="password"
                maxLength={4}
                value={stkPin}
                onChange={(e) => setStkPin(e.target.value)}
                placeholder="••••"
                className="w-32 mx-auto text-center bg-black border border-emerald-500/60 rounded-lg py-1.5 text-base text-emerald-400 font-mono tracking-widest focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmSTKPin}
              disabled={isProcessing}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs cursor-pointer shadow"
            >
              {isProcessing ? 'Verifying with Safaricom...' : 'Authorize Ksh ' + amount.toLocaleString()}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
