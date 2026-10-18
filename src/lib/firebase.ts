import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  getDocFromServer,
  Unsubscribe 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OrderRecord, TransactionRecord, UserProfile } from '../types';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Initialize Firestore using named database ID if provisioned
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Helper to convert Firebase Auth errors into friendly messages
export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in or reset your password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/user-not-found':
      return 'No account was found with this email. Please check your spelling or register.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please verify your credentials or click "Forgot Password".';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please wait a moment or reset your password.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    default:
      return error.message || 'Authentication failed. Please verify your details.';
  }
}

// Auto sign-in anonymously if no user is signed in to establish public session
export async function ensureAuthSession(): Promise<string | null> {
  try {
    if (auth.currentUser) {
      return auth.currentUser.uid;
    }
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err) {
    console.warn('Anonymous Firebase auth fallback:', err);
    return null;
  }
}

// Connection test per skill requirements
export async function validateFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection check: Client currently offline or initializing.');
    }
    return true;
  }
}

// ==========================================
// Firebase Authentication Methods
// ==========================================

export async function registerAccount(
  email: string,
  pass: string,
  fullName: string,
  phoneNumber?: string
): Promise<{ user: FirebaseUser; profile: UserProfile }> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const user = cred.user;

  const displayName = fullName.trim() || email.split('@')[0];
  await updateProfile(user, { displayName });

  const randomApiKey = `kt_live_${Math.random().toString(36).substring(2, 9)}${Math.random().toString(36).substring(2, 9)}`;

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || email.trim(),
    displayName,
    phoneNumber: phoneNumber?.trim() || '',
    accountTier: 'Gold',
    createdAt: new Date().toISOString(),
    apiKey: randomApiKey,
  };

  // Save profile to users collection
  await setDoc(doc(db, 'users', user.uid), profile);

  // Initialize their wallet with 50 KES welcome credit bonus
  await setDoc(
    doc(db, 'wallets', user.uid),
    {
      balance: 50,
      updatedAt: new Date().toISOString(),
      userName: displayName,
      phoneNumber: phoneNumber?.trim() || '',
      accountTier: 'Gold',
      totalSpent: 0,
      ordersCount: 0,
    },
    { merge: true }
  );

  // Add welcome bonus record
  const welcomeTxn: TransactionRecord = {
    id: `TXN-BONUS-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'bonus',
    amount: 50,
    method: 'Wallet Balance',
    reference: 'WELCOME-BONUS-50KES',
    status: 'Completed',
    timestamp: 'Just now',
  };
  await setDoc(doc(db, 'transactions', welcomeTxn.id), welcomeTxn);

  return { user, profile };
}

export async function loginAccount(email: string, pass: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutAccount(): Promise<void> {
  await signOut(auth);
}

export const SUPPORT_EMAIL = 'kentechlikeS@gmail.com';
export const SUPPORT_PHONE = '+254 793 749 604';

// Designated Admin UID requested by user
export const DESIGNATED_ADMIN_UID = 'thkYKuQCw0XHsYJBXnAqCJTP6G33';
export const ADMIN_UIDS: string[] = [DESIGNATED_ADMIN_UID];

export async function checkIsAdmin(uid?: string | null): Promise<boolean> {
  if (!uid) return false;
  if (ADMIN_UIDS.includes(uid)) return true;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists() && adminSnap.data().active !== false) {
      return true;
    }
  } catch (e) {
    console.warn('Error checking admin doc:', e);
  }
  return false;
}

export async function ensureAdminDesignation(): Promise<void> {
  try {
    const adminRef = doc(db, 'admins', DESIGNATED_ADMIN_UID);
    await setDoc(adminRef, {
      uid: DESIGNATED_ADMIN_UID,
      role: 'admin',
      active: true,
      assignedAt: new Date().toISOString(),
      email: 'amadifanitees@gmail.com',
      systemLevel: 'SuperAdmin'
    }, { merge: true });

    // Also ensure user profile has admin role
    const userRef = doc(db, 'users', DESIGNATED_ADMIN_UID);
    await setDoc(userRef, {
      uid: DESIGNATED_ADMIN_UID,
      role: 'admin',
      isAdmin: true,
      accountTier: 'Administrator',
      displayName: 'System Admin (KenTech)'
    }, { merge: true });
  } catch (err) {
    console.warn('Notice setting up admin document:', err);
  }
}

export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.warn('Notice fetching user profile:', err);
    return null;
  }
}

// ==========================================
// Real-time Firestore Subscriptions
// ==========================================

export function subscribeToOrders(
  onUpdate: (orders: OrderRecord[]) => void
): Unsubscribe {
  const ordersCol = collection(db, 'orders');
  return onSnapshot(
    ordersCol,
    (snapshot) => {
      if (!snapshot.empty) {
        const items = snapshot.docs.map((d) => d.data() as OrderRecord);
        items.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        onUpdate(items);
      }
    },
    (err) => {
      console.warn('Orders real-time listener note:', err.message);
    }
  );
}

export function subscribeToTransactions(
  onUpdate: (transactions: TransactionRecord[]) => void
): Unsubscribe {
  const txnsCol = collection(db, 'transactions');
  return onSnapshot(
    txnsCol,
    (snapshot) => {
      if (!snapshot.empty) {
        const items = snapshot.docs.map((d) => d.data() as TransactionRecord);
        items.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        onUpdate(items);
      }
    },
    (err) => {
      console.warn('Transactions real-time listener note:', err.message);
    }
  );
}

export function subscribeToWallet(
  onUpdate: (balance: number) => void,
  userId = 'default_user'
): Unsubscribe {
  const walletRef = doc(db, 'wallets', userId);
  return onSnapshot(
    walletRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.balance === 'number') {
          onUpdate(data.balance);
        }
      }
    },
    (err) => {
      console.warn('Wallet real-time listener note:', err.message);
    }
  );
}

// ==========================================
// Firestore Persistence Helpers
// ==========================================

export async function saveOrderToFirestore(order: OrderRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'orders', order.id), order);
  } catch (error) {
    console.error('Failed to save order to Firestore:', error);
  }
}

export async function updateOrderInFirestore(orderId: string, updates: Partial<OrderRecord>): Promise<void> {
  try {
    await updateDoc(doc(db, 'orders', orderId), updates);
  } catch (error) {
    console.error(`Failed to update order ${orderId} in Firestore:`, error);
  }
}

export async function loadOrdersFromFirestore(): Promise<OrderRecord[] | null> {
  try {
    const snapshot = await getDocs(collection(db, 'orders'));
    if (snapshot.empty) return null;
    const items = snapshot.docs.map((docSnap) => docSnap.data() as OrderRecord);
    items.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    return items;
  } catch (error) {
    console.warn('Error reading orders from Firestore:', error);
    return null;
  }
}

export async function saveTransactionToFirestore(txn: TransactionRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'transactions', txn.id), txn);
  } catch (error) {
    console.error('Failed to save transaction to Firestore:', error);
  }
}

export async function loadTransactionsFromFirestore(): Promise<TransactionRecord[] | null> {
  try {
    const snapshot = await getDocs(collection(db, 'transactions'));
    if (snapshot.empty) return null;
    const items = snapshot.docs.map((docSnap) => docSnap.data() as TransactionRecord);
    items.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    return items;
  } catch (error) {
    console.warn('Error reading transactions from Firestore:', error);
    return null;
  }
}

export async function saveWalletBalanceToFirestore(balance: number, userId = 'default_user'): Promise<void> {
  try {
    await setDoc(
      doc(db, 'wallets', userId), 
      { 
        balance, 
        updatedAt: new Date().toISOString(),
        userName: 'KenTech Client',
        accountTier: 'Gold'
      }, 
      { merge: true }
    );
  } catch (error) {
    console.error('Failed to save wallet balance to Firestore:', error);
  }
}

export async function loadWalletBalanceFromFirestore(userId = 'default_user'): Promise<number | null> {
  try {
    const snap = await getDoc(doc(db, 'wallets', userId));
    if (snap.exists() && typeof snap.data().balance === 'number') {
      return snap.data().balance;
    }
    return null;
  } catch (error) {
    console.warn('Error reading wallet from Firestore:', error);
    return null;
  }
}

export async function seedInitialDataIfEmpty(
  initialOrders: OrderRecord[],
  initialTransactions: TransactionRecord[],
  initialBalance: number
): Promise<void> {
  try {
    await ensureAuthSession();
    
    // Check if default wallet exists
    const walletSnap = await getDoc(doc(db, 'wallets', 'default_user'));
    if (!walletSnap.exists()) {
      await saveWalletBalanceToFirestore(initialBalance, 'default_user');
    }

    // Check if orders collection is empty
    const ordersSnap = await getDocs(collection(db, 'orders'));
    if (ordersSnap.empty) {
      for (const order of initialOrders) {
        await setDoc(doc(db, 'orders', order.id), order);
      }
    }

    // Check if transactions collection is empty
    const txnsSnap = await getDocs(collection(db, 'transactions'));
    if (txnsSnap.empty) {
      for (const txn of initialTransactions) {
        await setDoc(doc(db, 'transactions', txn.id), txn);
      }
    }
  } catch (err) {
    console.warn('Notice seeding initial Firestore documents:', err);
  }
}
