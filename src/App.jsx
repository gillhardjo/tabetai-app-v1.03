import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ShoppingCart, MessageCircle, ChevronLeft, Plus, Minus, X, Download, Clock, Store, 
  User, Phone, Users, ScrollText, Edit2, Save, Trash2, LogOut, Eye, EyeOff, Tag, Search, Filter, CheckCircle, ChefHat, FolderOpen, Database, Banknote, QrCode, Image as ImageIcon, UtensilsCrossed, Printer, Menu as MenuIcon, BarChart3, Calendar, TrendingUp, Box, Layers
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAwsfBMS0_9gbPayYU-Ry2iFNfF8TMMKVU",
  authDomain: "tabetai-app-v103.firebaseapp.com",
  projectId: "tabetai-app-v103",
  storageBucket: "tabetai-app-v103.firebasestorage.app",
  messagingSenderId: "555178920953",
  appId: "1:555178920953:web:96ab92b21b8212c57a0b28",
  measurementId: "G-6189BCY5YH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

const getColRef = (colName) => {
  let name = colName;
  if (name === 'menu') name = 'menus';
  if (name === 'transactions') name = 'orders';
  return collection(db, name);
};

const getDocRef = (colName, docId) => {
  let name = colName;
  if (name === 'menu') name = 'menus';
  if (name === 'transactions') name = 'orders';
  return doc(db, name, docId);
};

const ADMIN_CREDENTIALS = { username: 'admin', phone: '2131' };
const ADMIN_WA_NUMBER = "6281285557779"; 
const qrisImageUrl = "https://github.com/gillhardjo/tabetai-app/blob/main/public/qris.png?raw=true";
const logoImageUrl = "https://github.com/gillhardjo/tabetai-app/blob/main/public/logo.png?raw=true";

const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);

const isMenuAvailableByTime = (menu) => {
  if (!menu.isTimeRestricted || !menu.startTime || !menu.endTime) return true;
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = menu.startTime.split(':').map(Number);
  const [eh, em] = menu.endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return currentMins >= startMins && currentMins <= endMins;
};

const calculatePromoDiscount = (cart, promo) => {
  if (!promo) return { discount: 0, error: null };
  let eligibleSubtotal = 0;
  let eligibleQty = 0;
  let nonPromoQty = 0;

  cart.forEach(item => {
    const menuId = item.originalId || item.dbId || item.id;
    const qty = item.qty || item.quantity || 1;
    const isApplicable = !promo.applicableMenus || promo.applicableMenus.includes('all') || promo.applicableMenus.includes(menuId);

    if (isApplicable) {
      eligibleSubtotal += (item.price * qty);
      eligibleQty += qty;
    } else {
      nonPromoQty += qty;
    }
  });

  if (eligibleQty === 0) return { discount: 0, error: 'Promo tidak berlaku untuk menu di keranjang Anda' };
  if (promo.minQty > 0 && eligibleQty < promo.minQty) return { discount: 0, error: `Minimal pembelian ${promo.minQty} item menu promo` };

  if (promo.requireNonPromoItem && nonPromoQty < (promo.minNonPromoQty || 1)) {
    return { discount: 0, error: `Syarat: Beli minimal ${promo.minNonPromoQty || 1} menu lain di luar menu promo` };
  }

  let discAmount = 0;
  if (promo.type === 'percent') {
    discAmount = (eligibleSubtotal * promo.value) / 100;
    if (promo.maxDiscount && promo.maxDiscount > 0) {
      discAmount = Math.min(discAmount, promo.maxDiscount);
    }
  } else {
    discAmount = Math.min(promo.value, eligibleSubtotal); 
  }
  
  return { discount: Math.floor(discAmount), error: null };
};

const getMenuHPP = (menu, variantName, menusData) => {
  if (!menu) return 0;
  
  if (menu.itemType === 'composite' && menu.ingredients) {
      return menu.ingredients.reduce((total, ing) => {
          const ingMenu = menusData?.find(m => m.dbId === ing.menuId);
          if (ingMenu) {
             const ingHPP = getMenuHPP(ingMenu, 'default', menusData);
             return total + (ingHPP * ing.qty);
          }
          return total;
      }, 0);
  }
  
  const targetVariant = menu.variants?.find(v => v.name === variantName);
  if (targetVariant && targetVariant.hpp) return Number(targetVariant.hpp);
  return Number(menu.hpp) || 0;
};

const generateInvoiceWAUrl = (order, userPhone) => {
  const itemsText = order.items.map(i => `- ${i.quantity || i.qty}x ${i.name} (${i.variant || i.variantId})${i.note ? ` [Note: ${i.note}]` : ''}: ${formatRp(i.price * (i.quantity || i.qty))}`).join('%0A');
  let discountText = '';
  if (order.discount && order.discount.value > 0) discountText = `%0A*Diskon Promo (${order.discount.code}):* -${formatRp(order.discount.value)}`;
  const text = `*INVOICE TABETAI*%0A%0AOrder ID: ${order.id}%0ATanggal: ${order.date || order.time}%0ANama: ${order.customer}%0A%0A*Detail Pesanan:*%0A${itemsText}%0A%0A*Subtotal:* ${formatRp(order.originalTotal || order.total + (order.discount?.value || 0))}${discountText}%0A*TOTAL TAGIHAN:* ${formatRp(order.total)}%0A%0A*Poin Didapat:* +${order.earnedPoints || 0} Poin%0A%0ATerima kasih telah memesan di Tabetai!`;
  
  let waNumber = userPhone || "";
  waNumber = waNumber.replace(/[^\d+]/g, ''); 
  if (waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1);
  if (waNumber.startsWith('+')) waNumber = waNumber.substring(1);
  return `https://wa.me/${waNumber}?text=${text}`;
};

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  const [members, setMembers] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  const [savedBills, setSavedBills] = useState([]);
  
  const [role, setRole] = useState(() => localStorage.getItem('tbt_role') || 'guest'); 
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('tbt_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('tbt_role', role);
    if (currentUser) localStorage.setItem('tbt_user', JSON.stringify(currentUser));
    else localStorage.removeItem('tbt_user');
  }, [role, currentUser]);
  
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
        setAuthError(null);
      } catch (error) {
        setAuthError(error.message);
      } finally {
        setIsAuthReady(true);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const unsubMembers = onSnapshot(getColRef('members'), snap => setMembers(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubMenus = onSnapshot(getColRef('menu'), snap => setMenus(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubOrders = onSnapshot(getColRef('transactions'), snap => setOrders(snap.docs.map(d => ({ ...d.data(), dbId: d.id })))); 
    const unsubPromos = onSnapshot(getColRef('promos'), snap => setPromos(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubBills = onSnapshot(getColRef('savedBills'), snap => setSavedBills(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    return () => { unsubMembers(); unsubMenus(); unsubOrders(); unsubPromos(); unsubBills(); };
  }, [isAuthReady]);

  const handleLogin = (name, phone) => {
    if (name.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase() && phone === ADMIN_CREDENTIALS.phone) {
      setRole('admin');
      setCurrentUser({ name: 'Admin Tabetai', phone });
      showToast('Berhasil login sebagai Admin', 'success');
      return;
    }
    const existingMember = members.find(m => m.name.toLowerCase() === name.toLowerCase() && m.phone === phone);
    if (existingMember) {
      setRole('member');
      setCurrentUser(existingMember);
      showToast(`Selamat datang kembali, ${existingMember.name}!`, 'success');
      return;
    }
    showToast('Akun tidak ditemukan. Silakan Registrasi.', 'error');
  };

  const handleRegister = async (name, phone) => {
    if(name.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase()) return showToast('Username ini tidak dapat digunakan.', 'error');
    if(members.find(m => m.phone === phone)) return showToast('Nomor WhatsApp sudah terdaftar. Silakan login.', 'error');
    
    try {
      const newMemberData = { name, phone, points: 0, joinedAt: Date.now() };
      const res = await addDoc(getColRef('members'), newMemberData);
      setRole('member');
      setCurrentUser({ ...newMemberData, dbId: res.id });
      showToast('Registrasi berhasil!', 'success');
    } catch (e) {
      showToast("Gagal menyambung ke database.", 'error');
    }
  };

  const handleLogout = () => {
    setRole('guest');
    setCurrentUser(null);
    localStorage.removeItem('tbt_role');
    localStorage.removeItem('tbt_user');
  };

  const activeUser = currentUser ? members.find(m => m.phone === currentUser.phone && m.name.toLowerCase() === currentUser.name.toLowerCase()) || currentUser : null;

  return (
    <div className="w-full min-h-screen bg-slate-100 font-sans flex justify-center overflow-hidden relative">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-bold shadow-xl z-[999] flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'}`}>
          {toast.type === 'success' && <CheckCircle size={20} />}
          {toast.message}
        </div>
      )}
      {authError && <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center text-xs py-1 z-[1000]">Error Firebase: {authError}</div>}

      {role === 'guest' && <GuestView onLogin={handleLogin} onRegister={handleRegister} />}
      {role === 'member' && <MemberAppView user={activeUser} menus={menus} orders={orders} promos={promos} onLogout={handleLogout} showToast={showToast} />}
      {role === 'admin' && <AdminPOSView menus={menus} orders={orders} members={members} promos={promos} savedBills={savedBills} onLogout={handleLogout} showToast={showToast} />}
    </div>
  );
}

function GuestView({ onLogin, onRegister }) {
  const [view, setView] = useState('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const onSubmit = (e) => {
    e.preventDefault();
    if (view === 'login') onLogin(name, phone);
    else onRegister(name, phone);
  };

  return (
    <div className="w-full max-w-md bg-red-50 min-h-screen flex flex-col justify-center px-8 shadow-2xl">
      <div className="text-center mb-10 animate-fade-in-up">
        <div className="w-32 h-32 mx-auto mb-4 shadow-xl rounded-full overflow-hidden bg-white border-4 border-white flex items-center justify-center">
          <img src={logoImageUrl} alt="Tabetai Logo" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/200x200/ef4444/ffffff?text=Tabetai'; }} />
        </div>
        <h1 className="text-3xl font-black text-red-600 tracking-tight mt-2">TABETAI.ID</h1>
        <p className="text-red-900/60 font-medium mt-1 text-sm">Oishii Onigiri</p>
      </div>
      
      <div className="bg-white p-6 rounded-3xl shadow-lg shadow-red-100/50 border border-red-50 animate-in slide-in-from-bottom-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">{view === 'login' ? 'Masuk ke Akun' : 'Daftar Member Baru'}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Lengkap / Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={18} />
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Budi Santoso" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">No. WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contoh: 08123456789" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
            </div>
          </div>
          <button type="submit" className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-all mt-4">
            {view === 'login' ? 'Login' : 'Daftar Sekarang'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <p className="text-slate-500">{view === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}</p>
          <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="text-red-600 font-bold mt-1 hover:underline">
            {view === 'login' ? 'Registrasi Member Baru' : 'Login di sini'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberAppView({ user, menus, orders, promos, onLogout, showToast }) {
  const [view, setView] = useState('home'); 
  
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('tbt_cart_member');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('tbt_cart_member', JSON.stringify(cart)); }, [cart]);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [claimedPromoCode, setClaimedPromoCode] = useState('');

  const getCartTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const getCartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (item, variantName, quantity, note) => {
    const varTarget = item.variants?.find(v => v.name === variantName);
    
    if (item.itemType !== 'composite') {
        const existingIdx = cart.findIndex(i => (i.dbId || i.id) === (item.dbId || item.id) && i.variant === variantName && i.note === note);
        let currentCartQty = 0;
        if (existingIdx > -1) currentCartQty = cart[existingIdx].quantity;

        if (varTarget && currentCartQty + quantity > varTarget.qty) {
           showToast(`Stok tidak cukup! Sisa stok: ${varTarget.qty}`, 'error');
           return; 
        }
    }

    const calculatedHPP = getMenuHPP(item, variantName, menus);

    setCart(prev => {
      const idx = prev.findIndex(i => (i.dbId || i.id) === (item.dbId || item.id) && i.variant === variantName && i.note === note);
      if (idx > -1) {
        const newCart = [...prev];
        newCart[idx] = { ...newCart[idx], quantity: newCart[idx].quantity + quantity };
        return newCart;
      }
      return [...prev, { ...item, variant: variantName, quantity, note, hpp: calculatedHPP, cartId: Date.now() }];
    });
    setSelectedItem(null);
    showToast("Berhasil ditambah ke keranjang");
  };

  const updateQty = (id, d) => {
    const targetItem = cart.find(i => i.cartId === id);
    if (!targetItem) return;

    if (d > 0) {
      const menuTarget = menus.find(m => m.dbId === (targetItem.dbId || targetItem.id));
      if (menuTarget && menuTarget.itemType !== 'composite') {
          const varTarget = menuTarget?.variants?.find(v => v.name === targetItem.variant);
          if (varTarget && targetItem.quantity + d > varTarget.qty) {
            showToast(`Sisa stok hanya ${varTarget.qty}`, 'error');
            return; 
          }
      }
    }

    setCart(prevCart => prevCart.map(i => {
      if (i.cartId === id) {
        return { ...i, quantity: Math.max(0, i.quantity + d) };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const placeOrder = async (finalTotal, discountObj) => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    
    const earnedPoints = Math.floor(finalTotal * 0.1); 
    
    let maxId = 0;
    orders.forEach(o => {
      const match = o.id && o.id.match(/APP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });
    const orderId = `APP-${String(maxId + 1).padStart(4, '0')}`;
    const dateObj = new Date();
    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    
    const newOrderData = {
      id: orderId,
      customer: user.name,
      customerPhone: user.phone,
      items: [...cart],
      total: finalTotal,
      originalTotal: getCartTotal(),
      discount: discountObj || null,
      earnedPoints: earnedPoints,
      isPointsAwarded: false,
      isStockDeducted: false,
      status: 'Menunggu Konfirmasi',
      payment: 'QRIS / Transfer',
      time: timeStr,
      date: dateObj.toLocaleString('id-ID'),
      filterDateKey: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`,
      timestamp: Date.now()
    };
    
    try {
      await setDoc(getDocRef('transactions', orderId), newOrderData);

      if (discountObj && discountObj.dbId) {
        const promoToUpdate = promos.find(p => p.dbId === discountObj.dbId);
        if (promoToUpdate) {
          await updateDoc(getDocRef('promos', promoToUpdate.dbId), {
            stock: Math.max(0, (promoToUpdate.stock || 0) - 1),
            usedBy: [...(promoToUpdate.usedBy || []), user.phone] 
          });
        }
      }

      setCart([]);
      setView('payment');
      showToast("Pesanan berhasil dibuat!", "success");
    } catch (e) {
      showToast("Gagal memproses pesanan.", "error");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
      try {
        await updateDoc(getDocRef('transactions', orderId), { status: 'Dibatalkan' });
        
        const target = orders.find(o => o.dbId === orderId);
        if (target && target.discount && target.discount.dbId) {
          const promoToUpdate = promos.find(p => p.dbId === target.discount.dbId);
          if (promoToUpdate) {
            const updatedUsedBy = (promoToUpdate.usedBy || []).filter(phone => phone !== target.customerPhone);
            await updateDoc(getDocRef('promos', promoToUpdate.dbId), {
              stock: (promoToUpdate.stock || 0) + 1,
              usedBy: updatedUsedBy
            });
          }
        }
        
        showToast("Pesanan berhasil dibatalkan", "info");
      } catch (e) {
        showToast("Gagal membatalkan pesanan", "error");
      }
    }
  };

  const activeMenus = menus.filter(m => m.isActive !== false && isMenuAvailableByTime(m)).sort((a,b) => (a.orderPriority || 99) - (b.orderPriority || 99));
  const myOrders = orders.filter(o => o.customer === user.name && o.customerPhone === user.phone).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));

  return (
    <div className="w-full max-w-md bg-slate-50 min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
      {view === 'home' && (
        <div className="flex-1 flex flex-col">
          <div className="bg-red-600 pt-12 pb-24 px-6 rounded-b-[40px] text-white shadow-md relative z-10 flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-2xl font-bold mt-1 leading-tight">
                <span className="block truncate">{user?.name}-san,</span>
                <span className="block text-xl mt-0.5 opacity-95">Irasshaimase!</span>
              </h1>
              <p className="text-red-100 text-sm font-medium mt-1.5">Kyou, nani tabetai?</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 bg-red-700/80 px-4 py-1.5 rounded-full text-sm font-bold shadow-inner border border-red-500/50">
                  <Tag size={14} className="text-yellow-400" /> {user?.points || 0} Poin
                </div>
                <button onClick={() => setView('checkout')} className="relative bg-red-700 p-2.5 rounded-full hover:bg-red-800 transition-colors shadow-sm border border-red-500/30">
                  <ShoppingCart size={18} />
                  {getCartCount() > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-red-900 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-red-600 shadow-sm">
                      {getCartCount()}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <button onClick={onLogout} className="bg-red-700 p-2.5 rounded-full hover:bg-red-800 transition-colors shadow-sm shrink-0">
              <LogOut size={20} />
            </button>
          </div>
          <div className="flex-1 px-6 -mt-16 z-20 relative space-y-4">
            <button onClick={() => setView('menu')} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow active:scale-[0.98] text-left">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-3xl">🍱</div>
                <div><h2 className="text-lg font-bold text-slate-800">Menu Tabetai</h2><p className="text-sm text-slate-500 mt-1">Pesan makanan & minuman</p></div>
              </div>
              <ChevronLeft className="text-slate-300 rotate-180" />
            </button>
            <button onClick={() => setView('status')} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow active:scale-[0.98] text-left">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><Clock size={32} /></div>
                <div><h2 className="text-lg font-bold text-slate-800">Status Pesanan</h2><p className="text-sm text-slate-500 mt-1">Cek pesanan aktif & riwayat</p></div>
              </div>
              <ChevronLeft className="text-slate-300 rotate-180" />
            </button>
          </div>
          
          <MemberHome user={user} menus={menus} onNavigate={setView} promos={promos} formatRp={formatRp} onClaimPromo={(code) => { setClaimedPromoCode(code); showToast(`Voucher ${code} diklaim! Silakan pilih menu.`); }} />
          
          <a href={`https://wa.me/${ADMIN_WA_NUMBER}?text=Halo%20Admin%20Tabetai,%20saya%20${user.name}%20butuh%20bantuan.`} target="_blank" rel="noreferrer" className="absolute bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-transform active:scale-95 z-50">
            <MessageCircle size={28} />
          </a>
        </div>
      )}

      {view === 'menu' && (
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm border-b border-slate-50">
            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={24} className="text-slate-700" /></button>
            <h1 className="flex-1 text-center font-bold text-lg text-slate-800 pr-10">Daftar Menu</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
            {activeMenus.map(item => (
              <div key={item.dbId} className="flex gap-4 p-4 border border-slate-100 rounded-2xl shadow-sm bg-white">
                <div className="w-24 h-24 bg-slate-50 rounded-xl overflow-hidden shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="font-bold text-slate-800">{item.name}</h3>
                  {item.desc && <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{item.desc}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="font-bold text-red-600">{formatRp(item.price)}</span>
                    <button onClick={() => setSelectedItem(item)} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full font-semibold text-sm hover:bg-red-100">Tambah</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {getCartCount() > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30">
              <div onClick={() => setView('checkout')} className="bg-red-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer active:scale-[0.98]">
                <div className="flex flex-col"><span className="text-sm text-red-100 font-medium">{getCartCount()} Item</span><span className="font-bold text-lg">{formatRp(getCartTotal())}</span></div>
                <div className="flex items-center gap-2 font-bold bg-red-700 py-2 px-4 rounded-xl"><ShoppingCart size={18} /> Checkout</div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'checkout' && (
        <MemberCheckout cart={cart} onBack={() => setView('menu')} updateQty={updateQty} subtotal={getCartTotal()} onPay={placeOrder} promos={promos} formatRp={formatRp} showToast={showToast} userPhone={user.phone} isPlacingOrder={isPlacingOrder} defaultPromoCode={claimedPromoCode} clearClaimedPromo={() => setClaimedPromoCode('')} />
      )}

      {view === 'payment' && myOrders[0] && (
        <MemberPayment order={myOrders[0]} userPhone={user.phone} onCheckStatus={() => setView('status')} onBackHome={() => setView('home')} formatRp={formatRp} />
      )}

      {view === 'status' && (
        <MemberStatus orders={myOrders} onBack={() => setView('home')} userPhone={user.phone} formatRp={formatRp} onCancelOrder={handleCancelOrder} />
      )}

      {selectedItem && (
        <VariantModal item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={addToCart} formatRp={formatRp} />
      )}
    </div>
  );
}

function MemberHome({ user, menus = [], onNavigate, promos, formatRp, onClaimPromo }) {
  const activePromos = promos?.filter(p => {
    if (p.isActive === false) return false;
    if (p.eligibleUsers && !p.eligibleUsers.includes('all') && p.eligibleUsers.length > 0) {
      if (!user || !p.eligibleUsers.includes(user.phone)) return false;
    }
    return true;
  }) || [];

  return (
    <div className="flex-1 overflow-y-auto px-6 mt-6 pb-24 space-y-6">
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800 text-base">Voucher Promo Spesial 🍱</h3>
        </div>
        {activePromos.length > 0 ? (
          <div className="space-y-3">
            {activePromos.map((promo) => {
              const isOutOfStock = promo.stock !== undefined && promo.stock <= 0;
              const isUsed = promo.usedBy && promo.usedBy.includes(user?.phone);
              const isUnavailable = isOutOfStock || isUsed;
              
              const isAllMenus = !promo.applicableMenus || promo.applicableMenus.includes('all') || promo.applicableMenus.length === 0;
              let applicableText = "Berlaku untuk: Semua makanan";
              if (!isAllMenus && menus && menus.length > 0) {
                  const applicableMenuNames = promo.applicableMenus
                      .map(id => menus.find(m => m.dbId === id)?.name)
                      .filter(Boolean)
                      .join(', ');
                  if (applicableMenuNames) {
                      applicableText = `Berlaku untuk: ${applicableMenuNames}`;
                  }
              }

              return (
                <div key={promo.dbId} className={`bg-white border-2 border-dashed ${isUnavailable ? 'border-slate-200 opacity-60 grayscale' : 'border-red-200'} rounded-2xl p-4 flex justify-between items-center shadow-sm relative overflow-hidden transition-all`}>
                  <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-r-2 border-dashed ${isUnavailable ? 'border-slate-200' : 'border-red-200'}`}></div>
                  <div className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-l-2 border-dashed ${isUnavailable ? 'border-slate-200' : 'border-red-200'}`}></div>
                  
                  <div className="pl-4">
                    <div className="flex items-center gap-2">
                      <span className={`${isUnavailable ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-600'} font-extrabold px-2 py-0.5 rounded text-xs tracking-wider uppercase transition-colors`}>
                        {promo.code}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mt-1.5">
                      Potongan {promo.type === 'percent' ? `${promo.value}%` : formatRp(promo.value)}
                    </p>
                    
                    <p className="text-[10px] text-blue-600 font-semibold mt-0.5 leading-tight">
                      {applicableText}
                    </p>

                    {promo.maxDiscount > 0 && (
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Maks potongan {formatRp(promo.maxDiscount)}</p>
                    )}
                    {promo.minQty > 0 && (
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Min. beli {promo.minQty} item</p>
                    )}
                    {promo.requireNonPromoItem && (
                      <p className="text-xs text-purple-600 font-medium mt-0.5">Disertai menu lain</p>
                    )}
                  </div>
                  
                  <div className="pr-4 flex items-center justify-center">
                    <button 
                      disabled={isUnavailable}
                      onClick={() => { onClaimPromo(promo.code); onNavigate('menu'); }}
                      className={`${isUnavailable ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white active:scale-95 shadow-md'} text-xs font-bold py-1.5 px-4 rounded-full transition-all`}
                    >
                      {isUsed ? 'Terpakai' : isOutOfStock ? 'Habis' : 'Klaim'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Belum ada promo aktif saat ini.</p>
        )}
      </div>
    </div>
  );
}

function MemberCheckout({ cart, onBack, updateQty, subtotal, onPay, promos, formatRp, showToast, userPhone, isPlacingOrder, defaultPromoCode, clearClaimedPromo }) {
  const [promoCode, setPromoCode] = useState(defaultPromoCode || '');
  const [appliedPromo, setAppliedPromo] = useState(null);

  useEffect(() => {
    if (defaultPromoCode) {
      const valid = promos.find(p => p.code === defaultPromoCode.toUpperCase() && p.isActive !== false);
      if (valid) {
        if (valid.eligibleUsers && !valid.eligibleUsers.includes('all') && valid.eligibleUsers.length > 0 && !valid.eligibleUsers.includes(userPhone)) {
           showToast('Voucher eksklusif ini tidak berlaku untuk akun Anda', 'error');
        } else if (valid.stock !== undefined && valid.stock <= 0) {
           showToast('Kuota promo sudah habis', 'error');
        } else if (valid.usedBy && valid.usedBy.includes(userPhone)) {
           showToast('Anda sudah pernah menggunakan kode promo ini', 'error');
        } else {
           const calculation = calculatePromoDiscount(cart, valid);
           if (calculation.error) {
             showToast(`Voucher siap, tapi ${calculation.error.toLowerCase()}`, 'info');
           } else {
             setAppliedPromo(valid);
           }
           setPromoCode(valid.code);
        }
      }
      clearClaimedPromo();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPromo = () => {
    const valid = promos.find(p => p.code === promoCode.toUpperCase() && p.isActive !== false);
    if (!valid) return showToast('Kode promo tidak valid', 'error');
    if (valid.eligibleUsers && !valid.eligibleUsers.includes('all') && valid.eligibleUsers.length > 0 && !valid.eligibleUsers.includes(userPhone)) return showToast('Voucher eksklusif: Tidak berlaku untuk akun Anda', 'error');
    if (valid.stock !== undefined && valid.stock <= 0) return showToast('Kuota promo sudah habis', 'error');
    if (valid.usedBy && valid.usedBy.includes(userPhone)) return showToast('Anda sudah pernah menggunakan kode promo ini', 'error');
    
    const calculation = calculatePromoDiscount(cart, valid);
    if (calculation.error) {
      return showToast(calculation.error, 'error');
    }

    setAppliedPromo(valid); 
    showToast(`Promo ${valid.code} diterapkan!`); 
  };

  const discountAmount = useMemo(() => calculatePromoDiscount(cart, appliedPromo).discount, [cart, appliedPromo]);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm"><button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={24} /></button><h1 className="flex-1 text-center font-bold text-lg">Konfirmasi Pesanan</h1></div>
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50"><h2 className="font-bold text-slate-800 text-sm">Daftar Pesanan</h2></div>
          <div className="divide-y divide-slate-50">
            {cart.length === 0 ? (
               <div className="p-6 text-center text-slate-400 text-sm font-medium">Keranjang masih kosong</div>
            ) : (
              cart.map(item => (
                <div key={item.cartId} className="p-4 flex gap-4">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Varian: {item.variant}</p>
                    {item.note && <p className="text-xs text-slate-400 italic">Catatan: {item.note}</p>}
                    <p className="font-bold text-red-600 text-sm mt-1">{formatRp(item.price)}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                      <button onClick={() => updateQty(item.cartId, -1)} className="w-7 h-7 bg-white rounded flex items-center justify-center text-slate-600 shadow-sm"><Minus size={14} /></button>
                      <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.cartId, 1)} className="w-7 h-7 bg-white rounded flex items-center justify-center text-red-600 shadow-sm"><Plus size={14} /></button>
                    </div>
                    <span className="text-xs font-bold text-slate-800 mt-2">{formatRp(item.price * item.quantity)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Kode Promo / Voucher</h2>
          <div className="flex gap-2">
            <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Masukkan kode promo" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 outline-none uppercase text-sm" />
            <button onClick={applyPromo} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800">Pakai</button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Ringkasan Pembayaran</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatRp(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Diskon Promo ({appliedPromo.code})</span><span>-{formatRp(discountAmount)}</span></div>}
          </div>
          <div className="border-t border-dashed border-slate-200 mt-3 pt-3 flex justify-between items-center"><span className="font-bold text-slate-800">Total Akhir</span><span className="font-black text-red-600 text-lg">{formatRp(finalTotal)}</span></div>
          <div className="bg-red-50 text-red-700 text-xs text-center p-2 rounded-lg mt-4 font-medium">Dapatkan <strong className="text-red-800">{Math.floor(finalTotal * 0.1)} Poin</strong> dari pesanan ini!</div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
        <button 
          disabled={isPlacingOrder || cart.length === 0}
          onClick={() => onPay(finalTotal, appliedPromo ? { code: appliedPromo.code, value: discountAmount, dbId: appliedPromo.dbId } : null)} 
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {isPlacingOrder ? "Memproses Pesanan..." : "Lanjut Pembayaran"}
        </button>
      </div>
    </div>
  );
}

function MemberPayment({ onCheckStatus, onBackHome, order, userPhone, formatRp }) {
  const handleConfirmWA = () => {
    let waNumber = ADMIN_WA_NUMBER.replace(/[^\d+]/g, ''); 
    const text = `Halo Admin Tabetai, saya ${order.customer} sudah melakukan pembayaran via QRIS untuk Order ID: ${order.id} sebesar *${formatRp(order.total)}*. Mohon dicek ya!`;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-4 bg-white flex items-center border-b border-slate-100"><h1 className="flex-1 text-center font-bold text-lg">Pembayaran</h1></div>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <p className="text-slate-500 text-sm mb-1">Total Tagihan</p><p className="text-3xl font-black text-slate-800 mb-8">{formatRp(order.total)}</p>
        <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100 mb-6 w-full max-w-[260px] relative">
          <img 
            src={qrisImageUrl} 
            alt="QRIS" 
            className="w-full object-contain" 
            onError={(e) => { e.target.src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=QRIS_BELUM_DISET'; }} 
          />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-xs font-bold">QRIS TABETAI</div>
        </div>
        <button onClick={() => window.open(generateInvoiceWAUrl(order, userPhone), '_blank')} className="text-blue-600 font-semibold bg-blue-50 py-3 px-6 rounded-xl text-sm mb-10 flex gap-2"><ScrollText size={16} /> Download Invoice</button>
        <div className="w-full mt-auto space-y-3">
          <button onClick={handleConfirmWA} className="w-full bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center gap-2"><MessageCircle size={20} /> Konfirmasi pesanan via WA</button>
          <button onClick={onCheckStatus} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl">Cek Status Pesanan</button>
          <button onClick={onBackHome} className="w-full bg-slate-100 text-slate-800 font-bold py-4 rounded-xl mt-2">Kembali ke Beranda</button>
        </div>
      </div>
    </div>
  );
}

function MemberStatus({ orders, onBack, userPhone, formatRp, onCancelOrder }) {
  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative pb-24">
      <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100"><button onClick={onBack} className="p-2"><ChevronLeft size={24} /></button><h1 className="flex-1 text-center font-bold text-lg pr-10">Riwayat Pesanan</h1></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {orders.map((order) => (
          <div key={order.dbId} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${order.status === 'Selesai' ? 'bg-green-500' : order.status === 'Diproses' ? 'bg-blue-500' : order.status === 'Dibatalkan' ? 'bg-red-500' : 'bg-orange-500'}`} />
            <div className="flex justify-between items-start mb-3">
              <div><p className="text-xs text-slate-500 mb-0.5">{order.time} {order.date && `• ${order.date.split(',')[0]}`}</p><p className="font-bold text-slate-800 text-sm">ID: {order.id}</p></div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${order.status === 'Selesai' ? 'bg-green-100 text-green-700' : order.status === 'Diproses' ? 'bg-blue-100 text-blue-700' : order.status === 'Dibatalkan' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{order.status}</span>
            </div>
            <div className="border-t border-b border-slate-50 py-3 my-3 text-sm text-slate-600 space-y-1">
              {order.items.map((item, i) => <div key={i}><span className="font-semibold text-slate-800">{(item.quantity || item.qty)}x {item.name}</span></div>)}
            </div>
            <div className="flex justify-between items-center mb-4"><span className="text-sm text-slate-500">Total</span><span className="font-bold text-slate-800">{formatRp(order.total)}</span></div>
            <button onClick={() => window.open(generateInvoiceWAUrl(order, userPhone), '_blank')} className="w-full flex justify-center gap-2 text-blue-600 font-semibold border border-blue-100 bg-blue-50 py-2 rounded-lg text-sm"><Download size={14} /> Invoice WA</button>
            {(order.status === 'Menunggu Konfirmasi' || order.status === 'Pembayaran Diterima') && (
               <button onClick={() => onCancelOrder(order.dbId)} className="w-full mt-2 flex justify-center gap-2 text-red-600 font-semibold border border-red-100 bg-red-50 py-2 rounded-lg text-sm transition-colors hover:bg-red-100"><X size={14} /> Batalkan Pesanan</button>
            )}
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100"><button onClick={onBack} className="w-full bg-slate-100 text-slate-800 font-bold py-4 rounded-xl">Kembali ke Beranda</button></div>
    </div>
  );
}

function VariantModal({ item, onClose, onAdd, formatRp }) {
  const availableVariants = item.variants || [];
  const [selectedVariant, setSelectedVariant] = useState(availableVariants[0]?.name || '');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  const currentVarObj = availableVariants.find(v => v.name === selectedVariant);
  const maxQty = currentVarObj ? currentVarObj.qty : 0;
  const isComposite = item.itemType === 'composite';
  const isOutOfStock = !isComposite && maxQty <= 0;
  const isOverStock = !isComposite && qty > maxQty;

  const handleIncreaseQty = () => {
    if (isComposite || qty < maxQty) setQty(qty + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full overflow-hidden">
        
        <div className="relative w-full h-56 md:h-64 bg-slate-100 shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md text-white rounded-full z-10 hover:bg-black/60 transition-colors"><X size={20} /></button>
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        </div>
        
        <div className="p-6 border-b border-slate-100 shrink-0 bg-white z-10">
          <h2 className="font-bold text-2xl text-slate-800">{item.name}</h2>
          {item.desc && <p className="text-sm text-slate-500 mt-2 leading-relaxed">{item.desc}</p>}
          <p className="text-red-600 font-black text-xl mt-2">{formatRp(item.price)}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white z-10">
          {availableVariants.length > 0 && (
              <>
                <h3 className="font-bold text-slate-800 mb-3 text-sm">Pilih Varian</h3>
                <div className="space-y-2 mb-6">
                  {availableVariants.map(v => (
                    <label key={v.name} className={`flex items-center justify-between p-4 border rounded-xl ${selectedVariant === v.name ? 'border-red-500 bg-red-50/50' : 'border-slate-200'} ${(!isComposite && v.qty <= 0) ? 'opacity-50' : ''}`}>
                      <span className="font-medium text-slate-700">{v.name} {(!isComposite && v.qty <= 0) && '(Habis)'}</span>
                      {((isComposite) || v.qty > 0) && <input type="radio" checked={selectedVariant === v.name} onChange={() => setSelectedVariant(v.name)} className="w-5 h-5 accent-red-500" />}
                    </label>
                  ))}
                </div>
              </>
          )}
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Catatan Tambahan</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: pedas sekali..." className="w-full p-4 border border-slate-200 rounded-xl focus:border-red-500 outline-none text-sm resize-none" rows="2" />
        </div>
        <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-4 pb-8">
          <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-xl">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 bg-white rounded-lg shadow-sm"><Minus size={18} className="mx-auto"/></button>
            <span className="font-bold text-lg w-4 text-center">{qty}</span>
            <button onClick={handleIncreaseQty} className={`w-10 h-10 bg-white rounded-lg shadow-sm ${(!isComposite && qty >= maxQty) ? 'text-slate-300 cursor-not-allowed' : 'text-red-600'}`}><Plus size={18} className="mx-auto"/></button>
          </div>
          <button 
            onClick={() => onAdd(item, selectedVariant || 'default', qty, note)} 
            disabled={(!selectedVariant && availableVariants.length > 0) || isOutOfStock || isOverStock} 
            className={`flex-1 text-white font-bold py-4 rounded-xl disabled:opacity-50 transition-colors ${isOutOfStock || isOverStock ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-md'}`}
          >
            {isOutOfStock ? "Stok Habis" : isOverStock ? `Stok sisa ${maxQty}` : `Tambah - ${formatRp(item.price * qty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPOSView({ menus, orders, members, promos, savedBills, onLogout, showToast }) {
  const [activeTab, setActiveTab] = useState('kasir'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('tbt_cart_admin');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => { localStorage.setItem('tbt_cart_admin', JSON.stringify(cart)); }, [cart]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);

  const [checkoutModal, setCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(''); 
  const [cashAmount, setCashAmount] = useState('');
  const [variantModal, setVariantModal] = useState(false);
  const [showSaveBillModal, setShowSaveBillModal] = useState(false);
  
  const [billCustomerType, setBillCustomerType] = useState('existing');
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  
  const [activeBill, setActiveBill] = useState(null);

  const pendingCount = orders.filter(o => o.status === 'Menunggu Konfirmasi' || o.status === 'Pembayaran Diterima').length;
  
  const prevPendingCount = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount > prevPendingCount.current) {
      try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        let playCount = 0;
        const maxPlays = 5;
        audio.onended = () => { playCount++; if (playCount < maxPlays) audio.play().catch(e => {}); };
        audio.play().catch(e => {});
      } catch (e) {}
    }
    prevPendingCount.current = pendingCount;
  }, [pendingCount]);

  const filteredMenu = menus.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch && item.isActive !== false && isMenuAvailableByTime(item);
  }).sort((a, b) => (a.orderPriority || 99) - (b.orderPriority || 99));

  const addToCartFinal = (item, variantName, quantity = 1, note = '') => {
    const itemPrice = item.price; 
    const variantId = variantName || 'default';

    const existingIdx = cart.findIndex(c => c.originalId === (item.dbId || item.id) && c.variantId === variantId && c.note === note);
    const varTarget = item.variants?.find(v => v.name === variantId);
    let currentCartQty = 0;
    
    if (existingIdx > -1) {
      currentCartQty = cart[existingIdx].qty;
    }

    if (item.itemType !== 'composite' && varTarget && currentCartQty + quantity > varTarget.qty) {
       showToast(`Stok tidak cukup! Sisa stok: ${varTarget.qty}`, 'error');
       return;
    }

    const calculatedHPP = getMenuHPP(item, variantName, menus);

    setCart(prevCart => {
      const idx = prevCart.findIndex(c => c.originalId === (item.dbId || item.id) && c.variantId === variantId && c.note === note);
      if (idx > -1) {
        const newCart = [...prevCart];
        newCart[idx] = { ...newCart[idx], qty: newCart[idx].qty + quantity };
        return newCart;
      } else {
        return [...prevCart, { ...item, name: item.name, price: itemPrice, qty: quantity, variantId, originalId: (item.dbId || item.id), note, hpp: calculatedHPP, cartId: Date.now() }];
      }
    });
    setVariantModal(false);
    showToast("Berhasil ditambah ke keranjang");
  };

  const applyPromoCode = () => {
    const valid = promos.find(p => p.code === promoCode.toUpperCase() && p.isActive !== false);
    if (valid) {
      if (valid.stock !== undefined && valid.stock <= 0) {
        setAppliedPromo(null); return showToast("Kuota promo sudah habis", "error");
      }
      const calculation = calculatePromoDiscount(cart, valid);
      if (calculation.error) {
        setAppliedPromo(null); return showToast(calculation.error, "error");
      }
      setAppliedPromo(valid);
      showToast(`Promo ${valid.code} diterapkan!`, "success");
    } else {
      setAppliedPromo(null); showToast("Kode promo tidak valid", "error");
    }
  };

  const discountAmount = useMemo(() => calculatePromoDiscount(cart, appliedPromo).discount, [cart, appliedPromo]);
  const calculateSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const calculateTotal = () => Math.max(0, calculateSubtotal() - discountAmount);
  const calculateChange = () => cashAmount ? parseInt(cashAmount.replace(/\D/g, '')) - calculateTotal() : 0;

  const deductStockForOrder = async (itemsArray) => {
      for (const item of itemsArray) {
        const menuTarget = menus.find(m => m.dbId === (item.originalId || item.dbId || item.id));
        if (menuTarget) {
          const deductQty = Number(item.qty || item.quantity || 1);
          const variantName = item.variantId || item.variant || 'default';
          
          if (menuTarget.itemType === 'composite' && menuTarget.ingredients) {
              for (const ing of menuTarget.ingredients) {
                  const ingMenu = menus.find(m => m.dbId === ing.menuId);
                  if (ingMenu && ingMenu.itemType !== 'composite') {
                      const totalDeduct = deductQty * ing.qty;
                      const targetVarName = ing.variantId || 'default';
                      const updatedVariants = ingMenu.variants.map(v => 
                          (v.name === targetVarName || ingMenu.variants.length === 1) 
                          ? { ...v, qty: Math.max(0, Number(v.qty) - totalDeduct) } 
                          : v
                      );
                      const totalQty = updatedVariants.reduce((sum, v) => sum + (Number(v.qty) || 0), 0);
                      const updates = { variants: updatedVariants };
                      if (totalQty <= 0) updates.isActive = false;
                      await updateDoc(getDocRef('menu', ingMenu.dbId), updates);
                  }
              }
          } else {
              const updatedVariants = menuTarget.variants.map(v => v.name === variantName ? { ...v, qty: Math.max(0, Number(v.qty) - deductQty) } : v);
              const totalQty = updatedVariants.reduce((sum, v) => sum + (Number(v.qty) || 0), 0);
              const updates = { variants: updatedVariants };
              if (totalQty <= 0) updates.isActive = false; 
              await updateDoc(getDocRef('menu', menuTarget.dbId), updates);
          }
        }
      }
  };

  const handleCheckout = async () => {
    if (!paymentMethod) return showToast("Pilih metode pembayaran!", "error");
    if (paymentMethod === 'Cash' && calculateChange() < 0) return showToast("Uang tunai kurang!", "error");

    let maxId = 0;
    orders.forEach(o => {
      const match = o.id && o.id.match(/-(0*\d+)$/);
      if (match && o.id.startsWith('POS-')) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });
    const id = `POS-${String(maxId + 1).padStart(4, '0')}`;
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    const newTrx = {
      id, customer: activeBill ? activeBill.name : 'Walk-in / Cashier', items: [...cart], 
      total: calculateTotal(),
      originalTotal: calculateSubtotal(),
      discount: appliedPromo ? { code: appliedPromo.code, value: discountAmount, dbId: appliedPromo.dbId } : null,
      status: "Diproses", payment: paymentMethod, 
      isStockDeducted: true,
      time: timeStr,
      date: new Date().toLocaleString('id-ID'), timestamp: Date.now()
    };
    try {
      await setDoc(getDocRef('transactions', id), newTrx);
      
      if (activeBill) { await deleteDoc(getDocRef('savedBills', activeBill.id)); }

      if (appliedPromo && appliedPromo.dbId) {
        const promoToUpdate = promos.find(p => p.dbId === appliedPromo.dbId);
        if (promoToUpdate) {
          await updateDoc(getDocRef('promos', promoToUpdate.dbId), { stock: Math.max(0, (promoToUpdate.stock || 0) - 1) });
        }
      }

      await deductStockForOrder(cart);

      setCart([]); setPromoCode(""); setAppliedPromo(null); setPaymentMethod(''); setCashAmount(''); setCheckoutModal(false); setActiveBill(null);
      showToast("Pembayaran Berhasil! Struk siap dicetak.", "success");
    } catch (e) { showToast("Gagal memproses pembayaran", "error"); }
  };

  const handleSaveBill = async () => {
    if (cart.length === 0) return showToast("Keranjang kosong", "error");
    
    let customerName = "Walk-in";
    let customerPhone = "";
    
    if (billCustomerType === 'existing' && selectedMemberId) {
       const mem = members.find(m => m.dbId === selectedMemberId);
       if (mem) { customerName = mem.name; customerPhone = mem.phone; }
    } else if (billCustomerType === 'new' && newMemberName && newMemberPhone) {
       customerName = newMemberName; customerPhone = newMemberPhone;
       try {
         await addDoc(getColRef('members'), { name: newMemberName, phone: newMemberPhone, points: 0, joinedAt: Date.now() });
       } catch (e) { return showToast("Gagal register member baru", "error"); }
    } else if (billCustomerType === 'new' && newMemberName) {
       customerName = newMemberName; 
    } else {
       return showToast("Pilih/Masukkan nama pelanggan", "error");
    }

    try {
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
      await setDoc(getDocRef('savedBills', `BILL-${Date.now()}`), { name: customerName, phone: customerPhone, items: [...cart], timeString: timeStr, timestamp: Date.now() });
      setCart([]); setShowSaveBillModal(false); setSelectedMemberId(''); setNewMemberName(''); setNewMemberPhone(''); setMemberSearch(''); setActiveBill(null);
      showToast(`Bill untuk '${customerName}' disimpan`, "success");
    } catch (e) { showToast("Gagal menyimpan bill", "error"); }
  };

  const handleAutoSaveBill = async () => {
    try {
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
      await setDoc(getDocRef('savedBills', activeBill.id), { name: activeBill.name, phone: activeBill.phone || "", items: [...cart], timeString: timeStr, timestamp: Date.now() });
      setCart([]); setActiveBill(null);
      showToast(`Bill untuk '${activeBill.name}' auto-save berhasil`, "success");
    } catch (e) { showToast("Gagal menyimpan bill", "error"); }
  };

  const handlePrintReceipt = async (order) => {
    if (!navigator.bluetooth) return showToast("Browser tidak mendukung Bluetooth API", "error");
    try {
      showToast("Mencari Printer Bluetooth...", "info");
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000180a-0000-1000-8000-00805f9b34fb'] });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let printChar = null;
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) { if (char.properties.write || char.properties.writeWithoutResponse) { printChar = char; break; } }
        if (printChar) break;
      }
      if (!printChar) throw new Error("Tidak menemukan jalur tulis printer.");

      const ESC = '\x1B', init = ESC + '@', center = ESC + 'a' + '\x01', left = ESC + 'a' + '\x00', boldOn = ESC + 'E' + '\x01', boldOff = ESC + 'E' + '\x00';
      const lineWidth = 28, lineStr = '-'.repeat(lineWidth) + '\n', dotLineStr = '.'.repeat(lineWidth) + '\n';
      const alignRight = (leftText, rightText) => { let l = String(leftText), r = String(rightText), spaces = lineWidth - l.length - r.length; return spaces < 1 ? l + ' ' + r + '\n' : l + ' '.repeat(spaces) + r + '\n'; };

      let formattedDateTime = '';
      if (order.timestamp) {
        const d = new Date(order.timestamp);
        formattedDateTime = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } else {
        formattedDateTime = `${order.date ? order.date.split(',')[0].trim() : ''} ${order.time ? order.time.replace('.', ':').substring(0, 5) : ''}`.trim();
      }
      
      let receiptText = init + center + boldOn + 'tabetai.id\n' + boldOff + 'oishii onigiri\n\n' + left + `Order: ${order.customer}\nNo. Resi: ${order.id}\nWaktu: ${formattedDateTime}\nEmployee: Admin\nPOS: Master\n` + lineStr;
      
      order.items.forEach(item => {
        const qty = item.quantity || item.qty;
        let displayName = item.name.length > 15 ? item.name.substring(0, 14) + '.' : item.name;
        if (item.note) { receiptText += `${displayName}\n  Catatan: ${item.note}\n` + alignRight(`${qty} x ${formatRp(item.price)}`, formatRp(item.price * qty)); } 
        else { receiptText += alignRight(displayName, formatRp(item.price * qty)) + `${qty} x ${formatRp(item.price)}\n`; }
        const variant = item.variant || item.variantId;
        if (variant && variant !== 'default') variant.split(',').forEach(v => receiptText += `  + ${v.trim()}\n`);
        receiptText += ' \n'; 
      });
      receiptText += lineStr;
      if (order.discount && order.discount.value > 0) {
        receiptText += alignRight('Subtotal', formatRp((order.originalTotal || order.total) + order.discount.value)) + alignRight(`Diskon`, '-' + formatRp(order.discount.value)) + lineStr;
      }
      receiptText += boldOn + alignRight('Total', formatRp(order.total)).replace('\n', '') + boldOff + '\n\n' + alignRight(order.payment || 'QRIS', formatRp(order.total)) + dotLineStr;
      receiptText += center + '**Arigatou**\nPlease consume it\nimmediately on the day\nit is ordered or store it\nin the refrigerator for\na maximum of 3 days\n\nWA : 0812-8555-7779\n(text only)\nIG : @tabetaii.id\n\n';
      receiptText += left + alignRight(formattedDateTime, '#' + (order.id.split('-')[1] || order.id)) + '\n\n\n\n';

      const printData = new TextEncoder().encode(receiptText);
      for (let i = 0; i < printData.length; i += 256) await printChar.writeValue(printData.slice(i, i + 256));
      showToast("Struk berhasil dicetak!", "success");
    } catch (error) { showToast(error.message.includes('cancelled') ? 'Dibatalkan' : 'Gagal mencetak: ' + error.message, "error"); }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden w-full relative">
      {/* SIDEBAR */}
      <div className={`transition-all duration-300 overflow-hidden bg-white shadow-xl flex flex-col justify-between z-20 shrink-0 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div>
          <div className={`p-4 md:p-6 flex items-center border-b border-slate-100 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={logoImageUrl} alt="Logo" className="w-10 h-10 bg-red-600 rounded-xl p-1 shrink-0" />
              <h1 className={`text-xl font-black text-slate-800 transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Tabetai<span className="text-red-600">POS</span></h1>
            </div>
            {isSidebarOpen && <button onClick={()=>setIsSidebarOpen(false)} className="md:hidden p-1 bg-slate-100 rounded text-slate-500"><X size={20}/></button>}
          </div>
          <nav className="p-3 space-y-2">
            {[
              {id:'kasir', icon: ChefHat, label: 'Kasir'}, 
              {id:'pesanan', icon: Clock, label: 'Pesanan'}, 
              {id:'openbill', icon: FolderOpen, label: 'Open Bill'}, 
              {id:'laporan', icon: BarChart3, label: 'Laporan'},
              {id:'menu', icon: UtensilsCrossed, label: 'Menu Admin'}, 
              {id:'members', icon: Users, label: 'Member'}, 
              {id:'promos', icon: Tag, label: 'Promo'}
            ].map(tab => (
              <button key={tab.id} onClick={() => {
                  setActiveTab(tab.id); 
                  setShowSaveBillModal(false); 
                  setCheckoutModal(false); 
                  setVariantModal(false); 
                  if(window.innerWidth<768) setIsSidebarOpen(false);
              }} className={`relative w-full flex items-center px-3 py-3 rounded-xl transition-colors ${activeTab === tab.id ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:bg-red-50'} ${isSidebarOpen ? 'gap-3' : 'justify-center'}`}>
                <tab.icon size={22} className="shrink-0" />
                <span className={`font-bold transition-opacity whitespace-nowrap ${isSidebarOpen ? 'opacity-100 block' : 'opacity-0 hidden'}`}>{tab.label}</span>
                {tab.id === 'openbill' && savedBills.length > 0 && <span className={`absolute bg-yellow-400 text-black text-xs py-0.5 rounded-full font-bold ${isSidebarOpen ? 'right-4 px-2' : 'top-1 right-1 px-1.5 text-[10px]'}`}>{savedBills.length}</span>}
                {tab.id === 'pesanan' && pendingCount > 0 && <span className={`absolute bg-blue-500 text-white font-bold shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse ${isSidebarOpen ? 'right-4 text-[10px] px-2 py-0.5 rounded-full' : 'top-1 right-1 w-3 h-3 rounded-full text-transparent'}`}>{isSidebarOpen ? pendingCount : ''}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className={`p-4 border-t border-slate-100 flex items-center gap-3 ${!isSidebarOpen ? 'justify-center' : ''}`}>
          <button onClick={onLogout} className="p-2 bg-slate-100 text-red-600 rounded-full hover:bg-red-100 shrink-0"><LogOut size={18}/></button>
          {isSidebarOpen && (
            <div className="whitespace-nowrap overflow-hidden">
              <p className="text-xs font-semibold text-green-500">Online</p>
              <p className="text-sm font-bold text-slate-700 truncate">Admin Mode</p>
            </div>
          )}
        </div>
      </div>

      {/* KONTEN UTAMA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* HEADER TOP BAR UNTUK TOGGLE SIDEBAR */}
        <div className="bg-white border-b border-slate-200 shadow-sm p-4 flex items-center gap-4 z-10 shrink-0">
           <button onClick={()=>setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"><MenuIcon size={24}/></button>
           <h2 className="font-bold text-lg text-slate-800 hidden md:block">Tabetai Dashboard</h2>
        </div>

        {activeTab === 'kasir' && (
          <div className="flex-1 flex overflow-hidden bg-slate-50">
            <div className="flex-[2] flex flex-col h-full border-r border-slate-200">
              <div className="p-4 bg-white z-10 flex flex-col gap-4 shadow-sm">
                <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Cari nama menu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-200 outline-none" /></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                {filteredMenu.map(item => (
                  <div key={item.dbId} onClick={() => item.variants?.length ? setVariantModal(item) : addToCartFinal(item, null)} className="bg-white rounded-2xl p-3 border border-slate-100 hover:border-red-300 hover:shadow-lg cursor-pointer flex flex-col h-fit">
                    <div className="w-full aspect-square bg-slate-100 rounded-xl mb-3 overflow-hidden relative"><img src={item.image} className="w-full h-full object-cover" /></div>
                    <h3 className="font-bold text-sm mb-1 line-clamp-2">{item.name}</h3>
                    <p className="text-red-600 font-black text-sm mt-1">{formatRp(item.price)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* KERANJANG KASIR */}
            <div className="w-[350px] lg:w-[400px] bg-white flex flex-col h-full">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold flex items-center gap-2">Pesanan <span className="bg-red-100 text-red-600 text-sm py-0.5 px-2 rounded-full">{cart.reduce((a,c)=>a+c.qty,0)}</span></h2>{cart.length>0 && <button onClick={()=>{if(window.confirm('Kosongkan keranjang?')) { setCart([]); setActiveBill(null); }}} className="text-red-500 text-sm font-semibold hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer relative z-10">Kosongkan</button>}</div>
              {activeBill && <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex justify-between items-center"><span className="text-orange-700 text-xs font-bold uppercase tracking-wider">Sedang Edit Bill: {activeBill.name}</span><button onClick={() => { if(window.confirm('Tutup mode edit? Perubahan yang belum di-save akan hilang.')) { setCart([]); setActiveBill(null); } }} className="text-orange-600 hover:text-red-500 bg-orange-100 p-1 rounded-full shadow-sm"><X size={14}/></button></div>}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <img src={item.image} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Varian: {item.variantId}</p>
                      {item.note && <p className="text-xs text-slate-400 italic">"{item.note}"</p>}
                      <p className="text-red-500 font-bold text-xs mt-1">{formatRp(item.price * item.qty)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                      <button onClick={() => setCart(c => c.map(i=> i.originalId===item.originalId && i.variantId===item.variantId && i.note===item.note ? {...i, qty: i.qty-1} : i).filter(i=>i.qty>0))} className="w-7 h-7 bg-white rounded flex items-center justify-center shadow-sm"><Minus size={14}/></button>
                      <span className="w-4 text-center font-bold text-sm">{item.qty}</span>
                      <button onClick={() => {
                        const menuTarget = menus.find(m => m.dbId === item.originalId);
                        if (menuTarget && menuTarget.itemType !== 'composite') {
                            const varTarget = menuTarget?.variants?.find(v => v.name === item.variantId);
                            if (varTarget && item.qty + 1 > varTarget.qty) {
                              showToast(`Sisa stok hanya ${varTarget.qty}`, 'error');
                              return;
                            }
                        }
                        setCart(c => c.map(i=> i.originalId===item.originalId && i.variantId===item.variantId && i.note===item.note ? {...i, qty: i.qty+1} : i));
                      }} className="w-7 h-7 bg-white rounded flex items-center justify-center text-red-600 shadow-sm"><Plus size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
                <div className="flex gap-2 mb-4"><input type="text" placeholder="Promo" value={promoCode} onChange={(e)=>setPromoCode(e.target.value.toUpperCase())} className="flex-1 px-3 py-2 bg-slate-50 border rounded-xl text-sm outline-none uppercase" /><button onClick={applyPromoCode} className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl">Pakai</button></div>
                <div className="flex justify-between items-center mb-1"><span className="text-slate-500 text-sm">Subtotal</span><span className="font-semibold text-slate-700">{formatRp(calculateSubtotal())}</span></div>
                {discountAmount > 0 && <div className="flex justify-between items-center mb-1 text-green-600"><span className="text-sm">Diskon Promo ({appliedPromo?.code})</span><span className="font-semibold">-{formatRp(discountAmount)}</span></div>}
                <div className="flex justify-between items-center mb-3 pt-2 border-t border-slate-100"><span className="text-slate-800 font-bold">Total Akhir</span><span className="text-2xl font-black text-red-600">{formatRp(calculateTotal())}</span></div>
                <div className="flex gap-2">
                  <button onClick={() => { if (cart.length > 0) { if(activeBill) handleAutoSaveBill(); else setShowSaveBillModal(true); } }} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold flex justify-center items-center"><FolderOpen size={24} /></button>
                  <button onClick={() => { if (cart.length > 0) setCheckoutModal(true); }} className="flex-1 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200">Pilih Pembayaran</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CHECKOUT KASIR */}
        {checkoutModal && (
          <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50"><h3 className="font-black text-xl">Pembayaran</h3><button onClick={()=>setCheckoutModal(false)}><X size={20}/></button></div>
              <div className="p-6 text-center"><p className="text-sm text-slate-500 mb-1">Total</p><p className="text-4xl font-black text-red-600 mb-6">{formatRp(calculateTotal())}</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => setPaymentMethod('Cash')} className={`py-4 rounded-2xl font-bold border-2 flex flex-col items-center gap-2 ${paymentMethod==='Cash'?'border-red-500 bg-red-50 text-red-700':'border-slate-200 text-slate-500'}`}><Banknote size={28} /> Tunai</button>
                  <button onClick={() => setPaymentMethod('QRIS')} className={`py-4 rounded-2xl font-bold border-2 flex flex-col items-center gap-2 ${paymentMethod==='QRIS'?'border-red-500 bg-red-50 text-red-700':'border-slate-200 text-slate-500'}`}><QrCode size={28} /> QRIS</button>
                </div>
                {paymentMethod === 'Cash' && (
                  <input type="text" value={cashAmount} onChange={(e) => { const v=e.target.value.replace(/\D/g,''); setCashAmount(v?parseInt(v).toLocaleString('id-ID'):''); }} className="w-full p-4 bg-slate-50 border-2 rounded-2xl font-bold text-xl text-center mb-4" placeholder="Nominal Uang" />
                )}
                {paymentMethod === 'QRIS' && (
                  <div className="mb-6 flex justify-center">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 w-48 relative">
                      <img 
                        src={qrisImageUrl} 
                        alt="QRIS" 
                        className="w-full object-contain" 
                        onError={(e) => { e.target.src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=QRIS_BELUM_DISET'; }} 
                      />
                    </div>
                  </div>
                )}
                <button onClick={handleCheckout} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-lg">Proses</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL OPEN BILL DENGAN MEMBER SELECT */}
        {showSaveBillModal && (
          <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-visible flex flex-col min-h-[520px] max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 bg-slate-50"><h3 className="text-xl font-bold">Simpan Tagihan</h3></div>
              <div className="p-6 flex-1 overflow-visible">
                <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
                  <button onClick={()=>setBillCustomerType('existing')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${billCustomerType==='existing'?'bg-white shadow text-red-600':'text-slate-500'}`}>Pilih Member</button>
                  <button onClick={()=>setBillCustomerType('new')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${billCustomerType==='new'?'bg-white shadow text-red-600':'text-slate-500'}`}>Baru / Guest</button>
                </div>
                
                {billCustomerType === 'existing' ? (
                  <div className="relative overflow-visible">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Cari Member (Nama/No.HP)</label>
                    <input type="text" value={memberSearch} onChange={e => { setMemberSearch(e.target.value); setShowMemberDropdown(true); setSelectedMemberId(''); }} onFocus={() => setShowMemberDropdown(true)} placeholder="Ketik nama atau No. WA..." className="w-full p-3 rounded-xl border border-slate-300 focus:border-red-500 outline-none" />
                    {showMemberDropdown && memberSearch && (
                      <div className="absolute w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto z-50">
                        {members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()) || (m.phone && m.phone.includes(memberSearch))).map(m => (
                          <div key={m.dbId} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0" onClick={() => { setMemberSearch(`${m.name} - ${m.phone}`); setSelectedMemberId(m.dbId); setShowMemberDropdown(false); }}>
                            <div className="font-bold text-sm text-slate-800">{m.name}</div><div className="text-xs text-slate-500">{m.phone}</div>
                          </div>
                        ))}
                        {members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()) || (m.phone && m.phone.includes(memberSearch))).length === 0 && (
                          <div className="p-3 text-slate-500 text-sm text-center">Member tidak ditemukan</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Nama Guest / Meja</label><input autoFocus type="text" value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Contoh: Meja 4 / Budi" className="w-full p-3 rounded-xl border border-slate-300 focus:border-red-500 outline-none" /></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">No. WA (Opsional)</label><input type="text" value={newMemberPhone} onChange={e=>setNewMemberPhone(e.target.value)} placeholder="Isi untuk auto-register member" className="w-full p-3 rounded-xl border border-slate-300 focus:border-red-500 outline-none" /><p className="text-xs text-slate-500 mt-1">*Jika diisi, otomatis terdaftar sebagai member</p></div>
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-slate-100 flex gap-2 bg-slate-50 rounded-b-3xl">
                <button onClick={()=>setShowSaveBillModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">Batal</button>
                <button onClick={handleSaveBill} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Simpan</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'laporan' && <AdminReportManager orders={orders} menus={menus} formatRp={formatRp} />}
        {activeTab === 'pesanan' && <AdminOrderManager orders={orders} members={members} menus={menus} promos={promos} db={db} formatRp={formatRp} showToast={showToast} onPrint={handlePrintReceipt} deductStockForOrder={deductStockForOrder} />}
        {activeTab === 'openbill' && <AdminOpenBill savedBills={savedBills} db={db} handleLoadBill={(b) => { setCart(b.items); setActiveBill({id: b.dbId, name: b.name, phone: b.phone}); setActiveTab('kasir'); }} showToast={showToast} />}
        {activeTab === 'menu' && <AdminMenuManager menus={menus} db={db} formatRp={formatRp} showToast={showToast} getMenuHPP={getMenuHPP} />}
        {activeTab === 'members' && <AdminMemberManager members={members} db={db} showToast={showToast} />}
        {activeTab === 'promos' && <AdminPromoManager promos={promos} menus={menus} members={members} db={db} formatRp={formatRp} showToast={showToast} />}
        
        {variantModal && (
          <VariantModal item={variantModal} onClose={() => setVariantModal(false)} onAdd={addToCartFinal} formatRp={formatRp} />
        )}

      </div>
    </div>
  );
}

function AdminReportManager({ orders, menus, formatRp }) {
  const [filterType, setFilterType] = useState('today'); // today, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [reportSearch, setReportSearch] = useState('');
  const [reportSort, setReportSort] = useState('qty-desc');

  const filteredOrders = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (filterType === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (filterType === 'week') {
      const first = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1); // Monday
      start = new Date(now.setDate(first));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (filterType === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filterType === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return orders.filter(o => {
       const oDate = new Date(o.timestamp);
       return oDate >= start && oDate <= end && (o.status === 'Selesai' || o.status === 'Diproses' || o.status === 'Pembayaran Diterima');
    });
  }, [orders, filterType, startDate, endDate]);

  const reportMetrics = useMemo(() => {
    let grossSales = 0;
    let netSales = 0;
    let totalCogs = 0;
    let itemsSoldMap = {};

    filteredOrders.forEach(order => {
       grossSales += (order.originalTotal || order.total);
       netSales += order.total; // after discount
       
       const orderDate = order.date ? order.date.split(',')[0].trim() : new Date(order.timestamp).toLocaleDateString('id-ID');

       order.items.forEach(item => {
           const qty = Number(item.qty || item.quantity || 1);
           const price = Number(item.price || 0);
           const hpp = Number(item.hpp || 0);
           const lineSales = price * qty;
           const lineCogs = hpp * qty;
           
           totalCogs += lineCogs;

           const key = `${orderDate}_${item.originalId || item.dbId}_${item.variantId || item.variant || 'default'}`;
           if (!itemsSoldMap[key]) {
               itemsSoldMap[key] = {
                   date: orderDate,
                   name: item.name,
                   variant: item.variantId || item.variant || 'default',
                   qty: 0,
                   sales: 0,
                   cogs: 0
               };
           }
           itemsSoldMap[key].qty += qty;
           itemsSoldMap[key].sales += lineSales;
           itemsSoldMap[key].cogs += lineCogs;
         });
      });

      return {
          grossSales,
          netSales,
          totalCogs,
          grossProfit: netSales - totalCogs,
          averageMarginPct: netSales > 0 ? (((netSales - totalCogs) / netSales) * 100) : 0,
          itemDetails: Object.values(itemsSoldMap)
      };
  }, [filteredOrders]);

  const processedItemDetails = useMemo(() => {
      let items = reportMetrics.itemDetails.filter(item => item.name.toLowerCase().includes(reportSearch.toLowerCase()));
      items.sort((a, b) => {
          if (reportSort === 'qty-desc') return b.qty - a.qty;
          if (reportSort === 'sales-desc') return b.sales - a.sales;
          if (reportSort === 'margin-desc') return (b.sales - b.cogs) - (a.sales - a.cogs);
          if (reportSort === 'name-asc') return a.name.localeCompare(b.name);
          return 0;
      });
      return items;
  }, [reportMetrics.itemDetails, reportSearch, reportSort]);

  const handleExportCSV = () => {
      if (processedItemDetails.length === 0) {
          return alert("Tidak ada data untuk diekspor");
      }
      const headers = ['Tanggal', 'Nama Item', 'Varian', 'Terjual (Qty)', 'Penjualan (Rp)', 'HPP (Rp)', 'Margin (Rp)', 'Margin (%)'];
      const csvRows = [headers.join(',')];
      
      processedItemDetails.forEach(item => {
          const margin = item.sales - item.cogs;
          const marginPct = item.sales > 0 ? ((margin / item.sales) * 100).toFixed(1) : 0;
          const row = [
              `"${item.date}"`,
              `"${item.name.replace(/"/g, '""')}"`,
              `"${item.variant.replace(/"/g, '""')}"`,
              item.qty,
              item.sales,
              item.cogs,
              margin,
              marginPct
          ];
          csvRows.push(row.join(','));
      });
      
      // Tambahkan ringkasan total margin di bagian bawah CSV
      csvRows.push('');
      csvRows.push('RINGKASAN PENJUALAN KESELURUHAN');
      csvRows.push(`Penjualan Kotor,${reportMetrics.grossSales}`);
      csvRows.push(`Penjualan Bersih (Nett),${reportMetrics.netSales}`);
      csvRows.push(`Total HPP,${reportMetrics.totalCogs}`);
      csvRows.push(`Laba Kotor,${reportMetrics.grossProfit}`);
      csvRows.push(`Rata-rata Margin Laba,${reportMetrics.averageMarginPct.toFixed(1)}%`);
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Laporan_Penjualan_${filterType}_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <div className="bg-white p-6 border-b border-slate-200 shadow-sm z-10 sticky top-0">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
            <h2 className="text-2xl font-bold">Laporan Penjualan</h2>
            <button onClick={handleExportCSV} className="bg-green-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 font-bold shadow-sm hover:bg-green-700 transition-colors">
                <Download size={18} /> Export Laporan (CSV)
            </button>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-bold text-slate-700">
                <option value="today">Hari Ini</option>
                <option value="week">Minggu Ini</option>
                <option value="month">Bulan Ini</option>
                <option value="custom">Pilih Tanggal</option>
            </select>
            {filterType === 'custom' && (
                <div className="flex items-center gap-2">
                    <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    <span className="text-slate-400">-</span>
                    <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Banknote size={24}/></div>
                  <div><p className="text-slate-500 text-sm font-medium">Penjualan Kotor</p><p className="text-xl font-bold text-slate-800">{formatRp(reportMetrics.grossSales)}</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><Banknote size={24}/></div>
                  <div><p className="text-slate-500 text-sm font-medium">Penjualan Bersih (Nett)</p><p className="text-xl font-bold text-slate-800">{formatRp(reportMetrics.netSales)}</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center"><Box size={24}/></div>
                  <div><p className="text-slate-500 text-sm font-medium">Total HPP</p><p className="text-xl font-bold text-slate-800">{formatRp(reportMetrics.totalCogs)}</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><BarChart3 size={24}/></div>
                  <div><p className="text-slate-500 text-sm font-medium">Laba Kotor</p><p className="text-xl font-bold text-slate-800">{formatRp(reportMetrics.grossProfit)}</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><TrendingUp size={24}/></div>
                  <div><p className="text-slate-500 text-sm font-medium">Rata-rata Margin</p><p className="text-xl font-bold text-slate-800">{reportMetrics.averageMarginPct.toFixed(1)}%</p></div>
              </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-bold text-slate-800">Detail Penjualan Item</h3>
                  <div className="flex gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-48">
                          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                          <input type="text" placeholder="Cari item..." value={reportSearch} onChange={e=>setReportSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-xl outline-none text-sm focus:border-slate-400" />
                      </div>
                      <select value={reportSort} onChange={e=>setReportSort(e.target.value)} className="px-3 py-2 border rounded-xl text-sm font-semibold outline-none bg-white focus:border-slate-400">
                          <option value="qty-desc">Terlaris (Qty)</option>
                          <option value="sales-desc">Penjualan Terbesar</option>
                          <option value="margin-desc">Margin Terbesar</option>
                          <option value="name-asc">Nama (A-Z)</option>
                      </select>
                  </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-white border-b border-slate-100 text-slate-500">
                          <tr>
                              <th className="p-4 font-semibold whitespace-nowrap">Tanggal</th>
                              <th className="p-4 font-semibold whitespace-nowrap">Nama Item</th>
                              <th className="p-4 font-semibold whitespace-nowrap">Varian</th>
                              <th className="p-4 font-semibold text-center whitespace-nowrap">Terjual</th>
                              <th className="p-4 font-semibold text-right whitespace-nowrap">Penjualan</th>
                              <th className="p-4 font-semibold text-right whitespace-nowrap">HPP Item</th>
                              <th className="p-4 font-semibold text-right whitespace-nowrap">Margin Laba</th>
                          </tr>
                      </thead>
                      <tbody>
                          {processedItemDetails.length === 0 ? (
                              <tr><td colSpan="7" className="p-8 text-center text-slate-400">Tidak ada data penjualan yang cocok.</td></tr>
                          ) : (
                              processedItemDetails.map((item, i) => (
                                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                      <td className="p-4 text-slate-600 whitespace-nowrap">{item.date}</td>
                                      <td className="p-4 font-medium text-slate-800 whitespace-nowrap">{item.name}</td>
                                      <td className="p-4 text-slate-600 whitespace-nowrap">{item.variant}</td>
                                      <td className="p-4 text-center font-bold">{item.qty}</td>
                                      <td className="p-4 text-right text-slate-800 font-medium whitespace-nowrap">{formatRp(item.sales)}</td>
                                      <td className="p-4 text-right text-orange-600 font-medium whitespace-nowrap">{formatRp(item.cogs)}</td>
                                      <td className="p-4 text-right whitespace-nowrap">
                                          <div className="text-green-600 font-bold">{formatRp(item.sales - item.cogs)}</div>
                                          <div className="text-xs text-slate-500 mt-0.5">{item.sales > 0 ? (((item.sales - item.cogs) / item.sales) * 100).toFixed(1) : 0}%</div>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
}

function AdminOrderManager({ orders, members, menus, promos, db, formatRp, showToast, onPrint, deductStockForOrder }) {
  const STATUS_OPTIONS = ['Menunggu Konfirmasi', 'Pembayaran Diterima', 'Diproses', 'Selesai', 'Dibatalkan'];
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [sortOrder, setSortOrder] = useState("Terbaru");
  
  const [expandedOrders, setExpandedOrders] = useState({});

  const toggleOrderDetails = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };
  
  const handleStatusChange = async (orderId, newStatus) => {
    const target = orders.find(o => o.dbId === orderId);
    if (!target) return;
    try {
      const updates = { status: newStatus };
      
      if (newStatus === 'Pembayaran Diterima' || newStatus === 'Diproses' || newStatus === 'Selesai') {
        if (!target.isPointsAwarded && target.customer !== 'Walk-in / Cashier') {
          updates.isPointsAwarded = true;
          const member = members.find(m => m.name === target.customer && m.phone === target.customerPhone);
          if (member) await updateDoc(getDocRef('members', member.dbId), { points: (member.points || 0) + (target.earnedPoints || 0) });
        }
        if (!target.isStockDeducted) {
          updates.isStockDeducted = true;
          await deductStockForOrder(target.items);
        }
      } else if (newStatus === 'Dibatalkan') {
        if (target.isStockDeducted) {
          updates.isStockDeducted = false;
          for (const item of target.items) {
            const menuTarget = menus.find(m => m.dbId === (item.dbId || item.originalId || item.id));
            if (menuTarget) {
              const addQty = Number(item.quantity || item.qty || 1);
              const variantName = item.variant || item.variantId;
              
              if (menuTarget.itemType === 'composite' && menuTarget.ingredients) {
                  for (const ing of menuTarget.ingredients) {
                      const ingMenu = menus.find(m => m.dbId === ing.menuId);
                      if (ingMenu && ingMenu.itemType !== 'composite') {
                          const totalAdd = addQty * ing.qty;
                          const targetVarName = ing.variantId || 'default';
                          const updatedVariants = ingMenu.variants.map(v => 
                              (v.name === targetVarName || ingMenu.variants.length === 1) 
                              ? { ...v, qty: Number(v.qty) + totalAdd } 
                              : v
                          );
                          await updateDoc(getDocRef('menu', ingMenu.dbId), { variants: updatedVariants, isActive: true });
                      }
                  }
              } else {
                  const updatedVariants = menuTarget.variants.map(v => 
                    v.name === variantName ? { ...v, qty: Number(v.qty) + addQty } : v
                  );
                  await updateDoc(getDocRef('menu', menuTarget.dbId), { variants: updatedVariants, isActive: true });
              }
            }
          }
        }
        
        if (target.discount && target.discount.dbId) {
          const promoToUpdate = promos.find(p => p.dbId === target.discount.dbId);
          if (promoToUpdate) {
            const updatedUsedBy = (promoToUpdate.usedBy || []).filter(phone => phone !== target.customerPhone);
            await updateDoc(getDocRef('promos', promoToUpdate.dbId), {
              stock: (promoToUpdate.stock || 0) + 1,
              usedBy: updatedUsedBy
            });
          }
        }

        if (target.isPointsAwarded && target.customer !== 'Walk-in / Cashier') {
          updates.isPointsAwarded = false;
          const member = members.find(m => m.name === target.customer && m.phone === target.customerPhone);
          if (member) await updateDoc(getDocRef('members', member.dbId), { points: Math.max(0, (member.points || 0) - (target.earnedPoints || 0)) });
        }
      }
      
      await updateDoc(getDocRef('transactions', target.dbId), updates);
      showToast(`Status diubah ke ${newStatus}`);
    } catch(e) { showToast("Gagal update status", "error"); }
  };

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      const query = searchQuery.toLowerCase();
      const matchSearch = (o.customer && o.customer.toLowerCase().includes(query)) || (o.id && o.id.toLowerCase().includes(query));
      
      const matchStatus = filterStatus === 'Semua' || o.status === filterStatus;

      let matchDate = true;
      if (filterDate) {
        const [y, m, d] = filterDate.split('-');
        const idFormat1 = `${d}/${m}/${y}`;
        const idFormat2 = `${parseInt(d)}/${parseInt(m)}/${y}`;
        
        matchDate = o.filterDateKey === filterDate || (o.date && (o.date.includes(idFormat1) || o.date.includes(idFormat2)));
      }

      return matchSearch && matchStatus && matchDate;
    });

    return [...result].sort((a, b) => {
      const timeA = Number(a.timestamp) || 0;
      const timeB = Number(b.timestamp) || 0;
      if (sortOrder === "Terbaru") {
        return timeB - timeA;
      } else {
        return timeA - timeB;
      }
    });
  }, [orders, searchQuery, filterDate, filterStatus, sortOrder]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <div className="bg-white p-6 border-b border-slate-200 shadow-sm z-10 sticky top-0">
        <h2 className="text-2xl font-bold mb-4">Manajemen Pesanan</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3 text-slate-400" />
            <input type="text" placeholder="Cari Nama / No Pesanan..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex flex-wrap gap-3">
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400" />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 font-semibold">
              <option value="Semua">Semua Status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 font-semibold">
              <option value="Terbaru">Waktu: Terbaru</option>
              <option value="Terlama">Waktu: Terlama</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <p className="text-center text-slate-500 mt-10">Tidak ada pesanan yang sesuai filter.</p>
          ) : (
            filteredOrders.map(order => (
              <div key={order.dbId} className={`p-5 rounded-2xl shadow-sm border flex flex-col gap-4 relative overflow-hidden transition-all duration-300 ${order.status === 'Menunggu Konfirmasi' ? 'border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-blue-50/50' : 'bg-white border-slate-100'}`}>
                {order.status === 'Menunggu Konfirmasi' && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 animate-pulse" />
                )}
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <p className="font-bold text-lg">{order.id} <span className="text-slate-400 text-sm ml-2">{order.time} {order.date && `• ${order.date.split(',')[0]}`}</span></p>
                    <p className="text-sm font-semibold text-red-600">{order.customer}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <button onClick={() => toggleOrderDetails(order.dbId)} className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-colors">
                      {expandedOrders[order.dbId] ? <ChevronLeft className="rotate-90" size={18}/> : <ChevronLeft className="-rotate-90" size={18}/>}
                      {expandedOrders[order.dbId] ? 'Tutup' : 'Buka Pesanan'}
                    </button>
                    <button onClick={() => onPrint(order)} className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm">
                      <Printer size={18}/> Cetak
                    </button>
                    <select value={order.status} onChange={(e) => handleStatusChange(order.dbId, e.target.value)} className="p-2 border rounded-xl bg-slate-50 font-bold text-sm">
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={()=>deleteDoc(getDocRef('transactions', order.dbId))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={20}/></button>
                  </div>
                </div>

                {expandedOrders[order.dbId] && (
                  <div className="mt-2 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                    <h4 className="font-bold text-slate-800 text-sm mb-3">Daftar Item:</h4>
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="font-bold text-slate-800 mr-2">{(item.quantity || item.qty)}x</span>
                            <span className="font-semibold text-slate-700">{item.name}</span>
                            <p className="text-xs text-slate-500 mt-1 ml-6">Varian: {item.variant || item.variantId}</p>
                            {item.note && <p className="text-xs text-orange-600 italic mt-0.5 ml-6">Catatan: "{item.note}"</p>}
                          </div>
                          <span className="font-bold text-slate-700">{formatRp(item.price * (item.quantity || item.qty))}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex flex-col gap-1 items-end pt-3 border-t border-dashed border-slate-200">
                      <div className="flex justify-between w-56 text-sm text-slate-500">
                        <span>Subtotal:</span>
                        <span>{formatRp(order.originalTotal || order.total + (order.discount?.value || 0))}</span>
                      </div>
                      {order.discount && order.discount.value > 0 && (
                        <div className="flex justify-between w-56 text-sm text-green-600">
                          <span>Diskon Promo ({order.discount.code}):</span>
                          <span>-{formatRp(order.discount.value)}</span>
                        </div>
                      )}
                      <div className="flex justify-between w-56 text-base font-bold text-slate-800 mt-2 pt-2 border-t border-slate-200">
                        <span>Total Akhir:</span>
                        <span className="text-red-600">{formatRp(order.total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AdminOpenBill({ savedBills, db, handleLoadBill, showToast }) {
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeBillName, setMergeBillName] = useState('');

  const [splitBillModal, setSplitBillModal] = useState(null);
  const [splitQuantities, setSplitQuantities] = useState({});
  const [splitBillName, setSplitBillName] = useState('');

  const handleToggleMerge = (dbId) => {
    setSelectedForMerge(prev => prev.includes(dbId) ? prev.filter(id => id !== dbId) : [...prev, dbId]);
  };

  const handleMergeSubmit = async () => {
    if (selectedForMerge.length < 2) return showToast("Pilih minimal 2 bill untuk digabung", "error");
    if (!mergeBillName.trim()) return showToast("Nama bill gabungan harus diisi!", "error");

    try {
        let combinedItems = [];
        const billsToMerge = savedBills.filter(b => selectedForMerge.includes(b.dbId));
        
        billsToMerge.forEach(bill => {
            bill.items.forEach(item => {
                const existingIdx = combinedItems.findIndex(i => i.originalId === item.originalId && i.variantId === item.variantId && i.note === item.note);
                if(existingIdx > -1) {
                    combinedItems[existingIdx].qty += item.qty;
                } else {
                    combinedItems.push({...item, cartId: Date.now() + Math.random()});
                }
            });
        });

        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
        await setDoc(doc(db, 'savedBills', `BILL-MERGED-${Date.now()}`), {
            name: mergeBillName,
            phone: billsToMerge[0].phone || '',
            items: combinedItems,
            timeString: timeStr,
            timestamp: Date.now()
        });

        for(const id of selectedForMerge) {
            await deleteDoc(doc(db, 'savedBills', id));
        }

        setSelectedForMerge([]);
        setIsMergeMode(false);
        setMergeBillName('');
        showToast("Berhasil menggabungkan bill", "success");
    } catch(e) {
        showToast("Gagal menggabungkan bill", "error");
    }
  };

  const openSplitModal = (bill) => {
      setSplitBillModal(bill);
      setSplitBillName(`${bill.name} - Split`);
      const initialQtys = {};
      bill.items.forEach(item => {
          initialQtys[item.cartId] = 0;
      });
      setSplitQuantities(initialQtys);
  };

  const updateSplitQty = (cartId, d, max) => {
      setSplitQuantities(prev => {
          const current = prev[cartId] || 0;
          const next = current + d;
          if (next < 0 || next > max) return prev;
          return { ...prev, [cartId]: next };
      });
  };

  const handleSplitSubmit = async () => {
      const movedItems = [];
      const remainingItems = [];

      splitBillModal.items.forEach(item => {
          const moveQty = splitQuantities[item.cartId] || 0;
          const remainQty = item.qty - moveQty;

          if (moveQty > 0) {
              movedItems.push({ ...item, qty: moveQty, cartId: Date.now() + Math.random() });
          }
          if (remainQty > 0) {
              remainingItems.push({ ...item, qty: remainQty });
          }
      });

      if (movedItems.length === 0) return showToast("Pilih minimal 1 item untuk dipisah", "error");
      if (!splitBillName.trim()) return showToast("Nama bill baru harus diisi!", "error");

      try {
          const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
          
          await setDoc(doc(db, 'savedBills', `BILL-SPLIT-${Date.now()}`), {
              name: splitBillName,
              phone: splitBillModal.phone || '',
              items: movedItems,
              timeString: timeStr,
              timestamp: Date.now()
          });

          if (remainingItems.length === 0) {
              await deleteDoc(doc(db, 'savedBills', splitBillModal.dbId));
          } else {
              await updateDoc(doc(db, 'savedBills', splitBillModal.dbId), {
                  items: remainingItems
              });
          }

          setSplitBillModal(null);
          setSplitQuantities({});
          setSplitBillName('');
          showToast("Berhasil memisahkan bill", "success");
      } catch(e) {
          showToast("Gagal memisahkan bill", "error");
      }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Tagihan Tersimpan (Open Bill)</h2>
        <div className="flex gap-2">
            {isMergeMode ? (
               <div className="flex items-center gap-2">
                   <input type="text" value={mergeBillName} onChange={e => setMergeBillName(e.target.value)} placeholder="Nama Bill Gabungan" className="px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none w-48 focus:border-blue-500" />
                   <button onClick={() => { setIsMergeMode(false); setSelectedForMerge([]); setMergeBillName(''); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm">Batal</button>
                   <button onClick={handleMergeSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md">Gabungkan ({selectedForMerge.length})</button>
               </div>
            ) : (
               <button onClick={() => { setIsMergeMode(true); setMergeBillName("Gabungan Bill"); }} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors hover:bg-blue-100"><Layers size={16}/> Gabung Bill</button>
            )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {savedBills.map(bill => (
          <div key={bill.dbId} className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col relative transition-all ${isMergeMode && selectedForMerge.includes(bill.dbId) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-100'}`}>
            {isMergeMode && (
                <div className="absolute top-4 right-4 z-10">
                    <input type="checkbox" checked={selectedForMerge.includes(bill.dbId)} onChange={() => handleToggleMerge(bill.dbId)} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                </div>
            )}
            <h3 className="font-bold text-lg mb-1 pr-6">{bill.name}</h3>
            <p className="text-xs text-slate-400 mb-3">{bill.timeString}</p>
            
            <div className="text-sm text-slate-600 mb-4 bg-slate-50 p-2 rounded-lg max-h-24 overflow-y-auto">
                {bill.items.map((it, i) => (
                    <div key={i} className="flex justify-between border-b border-slate-100 last:border-0 py-1">
                        <span className="truncate pr-2 text-xs font-semibold">{it.qty}x {it.name}</span>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 mt-auto">
              <button onClick={() => !isMergeMode && handleLoadBill(bill)} disabled={isMergeMode} className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 py-2 rounded-lg font-bold text-xs md:text-sm transition-colors disabled:opacity-50">Buka Kasir</button>
              {!isMergeMode && (
                  <button onClick={() => openSplitModal(bill)} className="p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold px-3 transition-colors">Pisah</button>
              )}
              {!isMergeMode && (
                  <button onClick={()=>deleteDoc(doc(db, 'savedBills', bill.dbId))} className="p-2 text-red-500 hover:bg-red-50 border rounded-lg transition-colors"><Trash2 size={16}/></button>
              )}
            </div>
          </div>
        ))}
      </div>
      {savedBills.length === 0 && <div className="text-center py-10 text-slate-400 font-medium">Tidak ada tagihan yang tersimpan.</div>}

      {/* MODAL PISAH (SPLIT) BILL */}
      {splitBillModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 fade-in">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-black text-xl text-slate-800">Pisah Bill (Split)</h3>
                  <button onClick={()=>setSplitBillModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
              </div>
              <div className="p-4 bg-blue-50 text-blue-800 text-sm border-b border-blue-100 leading-relaxed font-medium">
                  Atur jumlah *Item* yang ingin dipindahkan dari <b>{splitBillModal.name}</b> ke dalam tagihan / Bill yang baru.
              </div>
              <div className="p-4 bg-white border-b border-slate-100">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Bill Baru (Pecahan)</label>
                  <input type="text" value={splitBillName} onChange={e => setSplitBillName(e.target.value)} placeholder="Masukkan nama bill baru" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-blue-500 font-semibold text-sm" />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {splitBillModal.items.map(item => {
                      const moveQty = splitQuantities[item.cartId] || 0;
                      return (
                          <div key={item.cartId} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center gap-2">
                              <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                                  <p className="text-xs text-slate-500">{item.variantId}</p>
                                  <p className="text-xs font-semibold text-slate-500 mt-1">Sisa Stok di Bill: {item.qty - moveQty}</p>
                              </div>
                              <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                  <button onClick={() => updateSplitQty(item.cartId, -1, item.qty)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition-colors" disabled={moveQty <= 0}><Minus size={14}/></button>
                                  <span className="font-bold text-blue-600 w-4 text-center">{moveQty}</span>
                                  <button onClick={() => updateSplitQty(item.cartId, 1, item.qty)} className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded-md text-blue-600 hover:bg-blue-200 disabled:opacity-30 transition-colors" disabled={moveQty >= item.qty}><Plus size={14}/></button>
                              </div>
                          </div>
                      );
                  })}
              </div>
              <div className="p-5 border-t border-slate-100 bg-white">
                  <button type="button" onClick={handleSplitSubmit} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-colors">
                      Pisahkan ke Bill Baru
                  </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminMenuManager({ menus, db, formatRp, showToast, getMenuHPP }) {
  const [form, setForm] = useState(null);
  const [searchMenu, setSearchMenu] = useState("");
  
  const handleToggleVisibility = async (id, currentStatus) => {
    try { await updateDoc(getDocRef('menu', id), { isActive: !currentStatus }); showToast(currentStatus ? "Menu disembunyikan" : "Menu ditampilkan", "success"); } 
    catch(e) { showToast("Gagal mengubah status", "error"); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if(form.itemType !== 'composite' && form.variants.length === 0) return showToast("Minimal 1 varian untuk item standar!", "error");
    try {
      const data = { 
          ...form, 
          price: Number(form.price), 
          hpp: form.itemType === 'composite' ? 0 : Number(form.hpp || 0),
          orderPriority: Number(form.orderPriority)||99 
      };
      
      if (data.itemType === 'composite' && !data.ingredients) data.ingredients = [];

      if(form.dbId) await updateDoc(getDocRef('menu', form.dbId), data);
      else await addDoc(getColRef('menu'), data);
      setForm(null); showToast("Menu disimpan");
    } catch(e) { showToast("Gagal menyimpan", "error"); }
  };

  const addIngredient = () => {
      setForm(f => ({ ...f, ingredients: [...(f.ingredients || []), { menuId: '', variantId: 'default', qty: 1 }] }));
  };

  const updateIngredient = (index, field, value) => {
      const ings = [...form.ingredients];
      ings[index][field] = value;
      setForm({ ...form, ingredients: ings });
  };

  const removeIngredient = (index) => {
      const ings = [...form.ingredients];
      ings.splice(index, 1);
      setForm({ ...form, ingredients: ings });
  };

  if(form) {
    const currentHPP = form.itemType === 'composite' ? getMenuHPP(form, 'default', menus) : (form.hpp || 0);
    const formMargin = form.price > 0 ? (((form.price - currentHPP) / form.price) * 100).toFixed(1) : 0;
    
    return (
      <div className="flex-1 p-6 bg-white overflow-y-auto">
        <div className="flex justify-between mb-6"><h2 className="text-xl font-bold">Edit Menu</h2><button onClick={()=>setForm(null)}><X size={24}/></button></div>
        <form onSubmit={handleSave} className="max-w-2xl space-y-4 pb-20">
          <div className="flex gap-4 items-center"><input type="checkbox" checked={form.isActive!==false} onChange={e=>setForm({...form, isActive: e.target.checked})} className="w-5 h-5 accent-red-600"/><label className="font-bold">Tampilkan (Visibility)</label></div>
          
          <div><label className="font-bold text-sm">Nama Menu</label><input required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
          <div><label className="font-bold text-sm">Deskripsi Singkat</label><textarea value={form.desc || ''} onChange={e=>setForm({...form, desc: e.target.value})} placeholder="Jelaskan komposisi makanan ini..." className="w-full p-3 border rounded-xl resize-none outline-none focus:border-slate-400" rows="2" /></div>
          
          <div className="flex gap-4">
              <div className="flex-1">
                  <label className="font-bold text-sm">Tipe Item</label>
                  <select value={form.itemType || 'standard'} onChange={e=>setForm({...form, itemType: e.target.value})} className="w-full p-3 border rounded-xl bg-white outline-none focus:border-slate-400">
                      <option value="standard">Barang Standar</option>
                      <option value="composite">Barang Komposit (Bahan Baku)</option>
                  </select>
              </div>
              <div className="w-32"><label className="font-bold text-sm">Urutan</label><input type="number" value={form.orderPriority||99} onChange={e=>setForm({...form, orderPriority: e.target.value})} className="w-full p-3 border rounded-xl text-center" /></div>
          </div>

          <div className="flex gap-4">
              <div className="flex-1"><label className="font-bold text-sm">Harga Jual (Price)</label><input type="number" required value={form.price} onChange={e=>setForm({...form, price: e.target.value})} className="w-full p-3 border rounded-xl text-red-600 font-bold" /></div>
              
              {form.itemType !== 'composite' ? (
                  <div className="flex-1"><label className="font-bold text-sm text-orange-600">HPP / Harga Pokok Dasar</label><input type="number" value={form.hpp || 0} onChange={e=>setForm({...form, hpp: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
              ) : (
                  <div className="flex-1"><label className="font-bold text-sm text-orange-600">Total HPP (Otomatis)</label><div className="w-full p-3 border bg-slate-100 rounded-xl font-bold text-orange-600">{formatRp(currentHPP)}</div></div>
              )}

              <div className="w-20 md:w-24">
                  <label className="font-bold text-sm text-green-600">Margin</label>
                  <div className="w-full p-3 border bg-green-50 border-green-200 rounded-xl font-bold text-green-700 text-center text-sm">{formMargin}%</div>
              </div>
          </div>

          <div><label className="font-bold text-sm">URL Gambar</label><input required type="url" value={form.image} onChange={e=>setForm({...form, image: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
          
          {/* FITUR AUTO-HIDE WAKTU */}
          <div className="border-t pt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
             <div className="flex items-center gap-2 mb-3">
                 <input type="checkbox" checked={form.isTimeRestricted||false} onChange={e=>setForm({...form, isTimeRestricted: e.target.checked})} className="w-5 h-5 accent-red-600"/>
                 <label className="font-bold text-sm">Batasi Waktu Penjualan</label>
             </div>
             {form.isTimeRestricted && (
                <div className="flex gap-4">
                   <div className="flex-1">
                       <label className="block text-xs font-bold text-slate-500 mb-1">Jam Mulai (HH:MM)</label>
                       <input type="time" value={form.startTime||''} onChange={e=>setForm({...form, startTime: e.target.value})} className="w-full p-3 border rounded-xl" />
                   </div>
                   <div className="flex-1">
                       <label className="block text-xs font-bold text-slate-500 mb-1">Jam Berakhir (HH:MM)</label>
                       <input type="time" value={form.endTime||''} onChange={e=>setForm({...form, endTime: e.target.value})} className="w-full p-3 border rounded-xl" />
                   </div>
                </div>
             )}
          </div>

          {/* FITUR KOMPOSIT */}
          {form.itemType === 'composite' && (
              <div className="border-t pt-4 bg-orange-50 p-4 rounded-xl border border-orange-100 mt-2">
                  <div className="flex justify-between items-center mb-3">
                      <label className="font-bold text-sm text-orange-800">Komponen Bahan Baku</label>
                      <button type="button" onClick={addIngredient} className="bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">Tambah Komponen</button>
                  </div>
                  <div className="space-y-2">
                      {(form.ingredients || []).map((ing, i) => (
                          <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-orange-200">
                              <select required value={ing.menuId} onChange={e => updateIngredient(i, 'menuId', e.target.value)} className="flex-[2] p-2 border rounded-lg text-sm bg-slate-50">
                                  <option value="">Pilih Item...</option>
                                  {menus.filter(m => m.dbId !== form.dbId && m.itemType !== 'composite').map(m => (
                                      <option key={m.dbId} value={m.dbId}>{m.name}</option>
                                  ))}
                              </select>
                              <input type="number" required min="0.01" step="0.01" value={ing.qty} onChange={e => updateIngredient(i, 'qty', Number(e.target.value))} className="w-20 p-2 border rounded-lg text-center text-sm" placeholder="Qty" />
                              <div className="w-24 text-right text-xs font-semibold text-slate-500 whitespace-nowrap">
                                  {formatRp(getMenuHPP(menus.find(m => m.dbId === ing.menuId), 'default', menus) * ing.qty)}
                              </div>
                              <button type="button" onClick={()=>removeIngredient(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X size={16}/></button>
                          </div>
                      ))}
                      {(form.ingredients || []).length === 0 && <p className="text-xs text-orange-600/60 italic text-center py-2">Belum ada bahan baku yang ditambahkan.</p>}
                  </div>
                  <p className="text-xs text-orange-700 mt-3">*Stok item komposit tidak diatur manual. Saat item ini terjual, stok komponen akan otomatis terpotong.</p>
              </div>
          )}

          {/* FITUR VARIAN & STOK (Hanya untuk item standar) */}
          {form.itemType !== 'composite' && (
              <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-2">
                      <label className="font-bold">Varian & Stok</label>
                      <button type="button" onClick={()=>setForm({...form, variants: [...form.variants, {name:'',qty:0, hpp: form.hpp || 0}]})} className="bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">Tambah Varian</button>
                  </div>
                {form.variants.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="flex-1">
                            <input required placeholder="Nama Varian (Cth: Reguler)" value={v.name} onChange={e=>{const va=[...form.variants]; va[i].name=e.target.value; setForm({...form, variants:va})}} className="w-full p-2 border rounded-lg text-sm"/>
                        </div>
                        <div className="w-28 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">HPP</span>
                            <input type="number" placeholder="HPP" value={v.hpp !== undefined ? v.hpp : (form.hpp || 0)} onChange={e=>{const va=[...form.variants]; va[i].hpp=Number(e.target.value); setForm({...form, variants:va})}} className="w-full p-2 pl-9 border rounded-lg text-sm text-right"/>
                        </div>
                        <div className="w-14 bg-green-50 border border-green-100 rounded-lg flex items-center justify-center text-xs font-bold text-green-700 h-9">
                            {form.price > 0 ? (((form.price - (v.hpp !== undefined ? v.hpp : (form.hpp || 0))) / form.price) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="w-20 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Stok</span>
                            <input type="number" required value={v.qty} onChange={e=>{const va=[...form.variants]; va[i].qty=Number(e.target.value); setForm({...form, variants:va})}} className="w-full p-2 pl-8 border rounded-lg text-center text-sm font-bold"/>
                        </div>
                        <button type="button" onClick={()=>{const va=[...form.variants]; va.splice(i,1); setForm({...form, variants:va})}} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X size={18}/></button>
                    </div>
                ))}
              </div>
          )}

          <button type="submit" className="w-full bg-red-600 text-white font-bold py-4 rounded-xl mt-6 shadow-md hover:bg-red-700 transition-colors">Simpan Menu</button>
        </form>
      </div>
    );
  }

  const sortedMenus = menus.filter(m => m.name.toLowerCase().includes(searchMenu.toLowerCase())).sort((a, b) => {
    const aActive = a.isActive !== false; const bActive = b.isActive !== false;
    if (aActive && !bActive) return -1; if (!aActive && bActive) return 1;
    return (a.orderPriority || 99) - (b.orderPriority || 99);
  });

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold">Manajemen Menu</h2>
        <div className="flex gap-2">
           <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="text" placeholder="Cari menu..." value={searchMenu} onChange={e=>setSearchMenu(e.target.value)} className="pl-9 pr-3 py-2 border rounded-xl outline-none" /></div>
           <button onClick={()=>setForm({name:'', desc:'', price:'', hpp:0, image:'', isActive:true, itemType:'standard', ingredients:[], orderPriority:99, isTimeRestricted: false, startTime: '', endTime: '', variants:[{name:'Reguler',qty:100, hpp:0}]})} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Plus size={18}/> Tambah</button>
        </div>
      </div>
      <div className="space-y-5">
        {sortedMenus.map((menu, index) => (
          <div key={menu.dbId} className={`bg-white p-5 mb-2 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 hover:shadow-md transition-shadow ${menu.isActive===false?'opacity-50 grayscale':''}`}>
            <div className="flex gap-4 items-center">
              <span className="font-bold text-slate-400 text-xl w-8 text-center">{index + 1}</span>
              <img src={menu.image} className="w-20 h-20 rounded-xl object-cover" />
              <div>
                  <h3 className="font-bold flex items-center gap-2">
                      {menu.name} 
                      {menu.itemType === 'composite' && <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-bold"><Layers size={10} className="inline mr-1"/>Komposit</span>}
                      {menu.isActive === false && <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">Hidden</span>} 
                      {menu.isTimeRestricted && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold"><Clock size={10} className="inline mr-1"/>Waktu</span>}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {(() => {
                          const itemHPP = getMenuHPP(menu, 'default', menus);
                          const marginPct = menu.price > 0 ? (((menu.price - itemHPP) / menu.price) * 100).toFixed(1) : 0;
                          return (
                              <>
                                  <p className="text-red-600 text-sm font-bold">{formatRp(menu.price)}</p>
                                  <p className="text-slate-400 text-xs font-semibold">HPP: {formatRp(itemHPP)}</p>
                                  <p className="text-green-700 text-[10px] font-bold bg-green-100 px-2 py-0.5 rounded-full">{marginPct}%</p>
                                  {menu.itemType !== 'composite' && (
                                      <p className="text-slate-400 text-xs font-semibold">Stok: {menu.variants?.reduce((a,b)=>a+(Number(b.qty)||0),0)}</p>
                                  )}
                              </>
                          );
                      })()}
                  </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleToggleVisibility(menu.dbId, menu.isActive !== false)} className={`p-2 rounded-lg ${menu.isActive !== false ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}><Eye size={18} /></button>
              <button onClick={()=>setForm(menu)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={18}/></button>
              <button onClick={()=>deleteDoc(getDocRef('menu', menu.dbId))} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminMemberManager({ members, db, showToast }) {
  const [editingMember, setEditingMember] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMember, setSortMember] = useState('newest'); // newest, points-desc, points-asc, name-asc

  const processedMembers = useMemo(() => {
      let filtered = members.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || (m.phone && m.phone.includes(searchQuery)));
      return filtered.sort((a, b) => {
          if (sortMember === 'points-desc') return (b.points || 0) - (a.points || 0);
          if (sortMember === 'points-asc') return (a.points || 0) - (b.points || 0);
          if (sortMember === 'name-asc') return a.name.localeCompare(b.name);
          if (sortMember === 'newest') return (b.joinedAt || 0) - (a.joinedAt || 0);
          return 0;
      });
  }, [members, searchQuery, sortMember]);

  const handleSave = async (e) => { e.preventDefault(); try { await updateDoc(getDocRef('members', editingMember.dbId), { name: editingMember.name, phone: editingMember.phone, points: Number(editingMember.points) }); setEditingMember(null); showToast("Data member diperbarui!", "success"); } catch (error) { showToast("Gagal memperbarui data", "error"); } };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-50 relative">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Daftar Member</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Cari nama / no wa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-red-500 outline-none" />
            </div>
            <select value={sortMember} onChange={e=>setSortMember(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-red-500">
                <option value="newest">Terbaru</option>
                <option value="points-desc">Poin Terbanyak</option>
                <option value="points-asc">Poin Sedikit</option>
                <option value="name-asc">Nama (A-Z)</option>
            </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {processedMembers.map(m => (
          <div key={m.dbId} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
            <div><h3 className="font-bold text-slate-800">{m.name}</h3><p className="text-slate-500 text-sm mt-0.5">{m.phone}</p><p className="text-yellow-600 font-bold text-sm mt-1">{m.points || 0} Poin</p></div>
            <div className="flex gap-2"><button onClick={() => setEditingMember(m)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 size={18} /></button><button onClick={() => { if(window.confirm('Hapus member ini?')) deleteDoc(getDocRef('members', m.dbId)) }} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={18}/></button></div>
          </div>
        ))}
        {processedMembers.length === 0 && <p className="text-slate-500 col-span-2 text-center py-10">Member tidak ditemukan</p>}
      </div>

      {editingMember && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm"><div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95"><div className="p-5 border-b border-slate-100 flex justify-between bg-slate-50"><h3 className="font-black text-xl text-slate-800">Edit Member</h3><button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div><form onSubmit={handleSave} className="p-6 space-y-4"><div><label className="block text-sm font-bold text-slate-700 mb-1">Nama Member</label><input type="text" required value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 focus:border-red-500 outline-none rounded-xl" /></div><div><label className="block text-sm font-bold text-slate-700 mb-1">No. WhatsApp</label><input type="tel" required value={editingMember.phone} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} className="w-full px-4 py-3 border border-slate-200 focus:border-red-500 outline-none rounded-xl" /></div><div><label className="block text-sm font-bold text-slate-700 mb-1">Jumlah Poin</label><input type="number" required value={editingMember.points} onChange={e => setEditingMember({...editingMember, points: e.target.value})} className="w-full px-4 py-3 border border-slate-200 focus:border-red-500 outline-none rounded-xl" /></div><button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl mt-4 transition-colors">Simpan Perubahan</button></form></div></div>
      )}
    </div>
  );
}

function AdminPromoManager({ promos, menus, members, db, formatRp, showToast }) {
  const [form, setForm] = useState(null);
  
  const handleMenuToggle = (menuId) => { 
    let current = form.applicableMenus || ['all']; 
    if (current.includes('all')) current = []; 
    if (current.includes(menuId)) { 
      current = current.filter(id => id !== menuId); 
      if (current.length === 0) current = ['all']; 
    } else { 
      current = [...current, menuId]; 
    } 
    setForm({ ...form, applicableMenus: current }); 
  };

  const handleUserToggle = (userPhone) => { 
    let current = form.eligibleUsers || ['all']; 
    if (current.includes('all')) current = []; 
    if (current.includes(userPhone)) { 
      current = current.filter(phone => phone !== userPhone); 
      if (current.length === 0) current = ['all']; 
    } else { 
      current = [...current, userPhone]; 
    } 
    setForm({ ...form, eligibleUsers: current }); 
  };

  const isAllMenus = !form?.applicableMenus || form?.applicableMenus.includes('all') || form?.applicableMenus.length === 0;
  const isAllUsers = !form?.eligibleUsers || form?.eligibleUsers.includes('all') || form?.eligibleUsers.length === 0;

  const sortedMenus = useMemo(() => [...menus].sort((a, b) => a.name.localeCompare(b.name)), [menus]);

  const handleSave = async (e) => { 
    e.preventDefault(); 
    try { 
      const data = { ...form, value: Number(form.value), stock: Number(form.stock), maxDiscount: Number(form.maxDiscount) || 0, minQty: Number(form.minQty) || 0, minNonPromoQty: Number(form.minNonPromoQty) || 0 };
      if (!data.usedBy) data.usedBy = []; 
      if (!data.applicableMenus) data.applicableMenus = ['all'];
      if (!data.eligibleUsers) data.eligibleUsers = ['all'];
      
      if(form.dbId) await updateDoc(getDocRef('promos', form.dbId), data); 
      else await addDoc(getColRef('promos'), data); 
      
      setForm(null); showToast("Promo disimpan"); 
    } catch(e){ showToast("Gagal menyimpan promo", "error"); } 
  };

  if(form) return (
    <div className="flex-1 p-6 bg-white overflow-y-auto">
      <div className="flex justify-between mb-6">
        <h2 className="text-xl font-bold">Edit Promo</h2>
        <button onClick={()=>setForm(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24}/></button>
      </div>
      <form onSubmit={handleSave} className="max-w-md space-y-4">
        <input required placeholder="KODE (Cth: PROMO50)" value={form.code} onChange={e=>setForm({...form, code:e.target.value.toUpperCase()})} className="w-full p-3 border rounded-xl uppercase"/>
        <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full p-3 border rounded-xl"><option value="percent">Persentase (%)</option><option value="nominal">Nominal (Rp)</option></select>
        <input required type="number" placeholder="Nilai Diskon" value={form.value} onChange={e=>setForm({...form, value:Number(e.target.value)})} className="w-full p-3 border rounded-xl"/>
        
        {form.type === 'percent' && (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Maksimal Potongan (Rp)</label>
            <input type="number" placeholder="Isi 0 jika tanpa batas" value={form.maxDiscount || ''} onChange={e=>setForm({...form, maxDiscount:Number(e.target.value)})} className="w-full p-3 border rounded-xl"/>
          </div>
        )}
        
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Minimal Pembelian (Qty Item Promo)</label>
          <input type="number" placeholder="Isi 0 jika tanpa batas" value={form.minQty || ''} onChange={e=>setForm({...form, minQty:Number(e.target.value)})} className="w-full p-3 border rounded-xl"/>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Stok / Kuota Penggunaan Promo</label>
          <input required type="number" placeholder="Stok / Kuota Promo" value={form.stock !== undefined ? form.stock : 100} onChange={e=>setForm({...form, stock:Number(e.target.value)})} className="w-full p-3 border rounded-xl"/>
        </div>
        
        {/* FITUR TRIGGER PEMBELIAN NON-PROMO */}
        <div className="border-t pt-3 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={form.requireNonPromoItem||false} onChange={e=>setForm({...form, requireNonPromoItem: e.target.checked})} className="w-5 h-5 accent-red-600"/>
            <label className="font-bold text-sm text-slate-700">Syarat Pembelian Menu Lain</label>
          </div>
          {form.requireNonPromoItem && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah Minimal Menu Lain Yang Harus Dibeli</label>
              <input type="number" value={form.minNonPromoQty || 1} min="1" onChange={e=>setForm({...form, minNonPromoQty:Number(e.target.value)})} className="w-full p-3 border rounded-xl"/>
            </div>
          )}
        </div>

        {/* TARGET MENU KHUSUS */}
        <div className="border-t border-slate-200 pt-4 mt-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">Berlaku Untuk Menu:</label>
          <div className="space-y-2 max-h-48 overflow-y-auto p-3 border border-slate-200 rounded-xl bg-slate-50">
            <label className="flex items-center gap-3 cursor-pointer pb-2 border-b border-slate-200">
              <input type="checkbox" checked={isAllMenus} onChange={() => setForm({...form, applicableMenus: ['all']})} className="w-5 h-5 accent-red-600"/>
              <span className="font-bold text-slate-800 text-sm">Semua Menu</span>
            </label>
            {sortedMenus.map(m => (
              <label key={m.dbId} className="flex items-center gap-3 cursor-pointer py-1">
                <input type="checkbox" checked={!isAllMenus && form.applicableMenus?.includes(m.dbId)} onChange={() => handleMenuToggle(m.dbId)} className="w-5 h-5 accent-red-600"/>
                <span className="text-sm font-medium text-slate-700">{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* TARGET PELANGGAN KHUSUS (DEDICATED VOUCHER) */}
        <div className="border-t border-slate-200 pt-4 mt-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">Berlaku Untuk Pelanggan (Dedicated Voucher):</label>
          <div className="space-y-2 max-h-48 overflow-y-auto p-3 border border-slate-200 rounded-xl bg-slate-50">
            <label className="flex items-center gap-3 cursor-pointer pb-2 border-b border-slate-200">
              <input type="checkbox" checked={isAllUsers} onChange={() => setForm({...form, eligibleUsers: ['all']})} className="w-5 h-5 accent-red-600"/>
              <span className="font-bold text-slate-800 text-sm">Semua Pelanggan (Publik)</span>
            </label>
            {members.map(m => (
              <label key={m.dbId} className="flex items-center gap-3 cursor-pointer py-1">
                <input type="checkbox" checked={!isAllUsers && form.eligibleUsers?.includes(m.phone)} onChange={() => handleUserToggle(m.phone)} className="w-5 h-5 accent-red-600"/>
                <span className="text-sm font-medium text-slate-700">{m.name} <span className="text-slate-400 text-xs">({m.phone})</span></span>
              </label>
            ))}
            {members.length === 0 && <p className="text-xs text-slate-400 p-2 text-center">Belum ada pelanggan terdaftar.</p>}
          </div>
        </div>

        <div className="flex gap-2 items-center pt-2">
          <input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form, isActive:e.target.checked})} className="w-5 h-5 accent-red-600"/>
          <label className="font-bold text-slate-700">Promo Aktif</label>
        </div>
        
        <button className="w-full bg-slate-900 hover:bg-slate-800 transition-colors text-white font-bold py-4 rounded-xl mt-4 shadow-md">Simpan</button>
      </form>
    </div>
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Promo & Diskon</h2>
        <button onClick={()=>setForm({code:'', type:'percent', value:0, stock:100, isActive:true, usedBy: [], applicableMenus: ['all'], eligibleUsers: ['all'], minQty: 0, requireNonPromoItem: false, minNonPromoQty: 1})} className="bg-slate-900 hover:bg-slate-800 transition-colors text-white px-4 py-2 rounded-xl font-bold shadow-md">Tambah</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promos.map(p => {
          const isDedicated = p.eligibleUsers && !p.eligibleUsers.includes('all') && p.eligibleUsers.length > 0;
          return (
            <div key={p.dbId} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm relative overflow-hidden">
              {isDedicated && (
                <div className="absolute top-0 right-0 bg-purple-100 text-purple-700 text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">
                  Dedicated Voucher
                </div>
              )}
              <div>
                <h3 className="font-black text-xl text-slate-800">{p.code}</h3>
                <p className="text-slate-500 font-medium text-sm mt-0.5">
                  {p.type==='percent'?`${p.value}%`:formatRp(p.value)} {p.maxDiscount > 0 ? ` (Maks ${formatRp(p.maxDiscount)})` : ''}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Sisa Kuota: {p.stock !== undefined ? p.stock : '∞'} • Min Qty: {p.minQty || 0}
                  <span className={`ml-2 font-bold ${p.isActive ? 'text-green-500' : 'text-slate-400'}`}>
                    {p.isActive ? '(Aktif)' : '(Mati)'}
                  </span>
                </p>
              </div>
              <div className="flex gap-2 relative z-10">
                <button onClick={()=>setForm(p)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 size={18}/></button>
                <button onClick={() => { if(window.confirm('Hapus promo ini?')) deleteDoc(getDocRef('promos', p.dbId)) }} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={18}/></button>
              </div>
            </div>
          )
        })}
        {promos.length === 0 && <p className="text-slate-500 text-center col-span-2 py-10">Belum ada promo yang dibuat.</p>}
      </div>
    </div>
  );
}
