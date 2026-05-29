import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, MessageCircle, ChevronLeft, 
  Plus, Minus, X, Download, Clock, Store, 
  Utensils, User, Phone, Users, UtensilsCrossed, 
  ScrollText, Edit2, Save, Trash2, LogOut, Eye, EyeOff, Tag, Search, Filter, GripVertical
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
  getFirestore, collection, doc, addDoc, 
  updateDoc, deleteDoc, onSnapshot 
} from 'firebase/firestore';

// ==========================================
// 1. MASUKKAN CONFIG FIREBASE ANDA DI SINI
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAwsfBMS0_9gbPayYU-Ry2iFNfF8TMMKVU",
  authDomain: "tabetai-app-v103.firebaseapp.com",
  projectId: "tabetai-app-v103",
  storageBucket: "tabetai-app-v103.firebasestorage.app",
  messagingSenderId: "555178920953",
  appId: "1:555178920953:web:96ab92b21b8212c57a0b28",
  measurementId: "G-6189BCY5YH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// --- INITIAL SHARED DATA ---
const ADMIN_CREDENTIALS = {
  username: 'gillhardjo',
  phone: '081285557779'
};

// Image URLs & WhatsApp
const qrisImageUrl = "https://github.com/gillhardjo/tabetai-app/blob/main/public/qris.png?raw=true";
const logoImageUrl = "https://github.com/gillhardjo/tabetai-app/blob/main/public/logo.png?raw=true";
const ADMIN_WA_NUMBER = "6281285557779"; 

// --- UTILS ---
const formatRp = (angka) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
};

const generateInvoiceWAUrl = (order, userPhone) => {
    const itemsText = order.items.map(i => `- ${i.quantity}x ${i.name} (${i.variant})${i.note ? ` [Note: ${i.note}]` : ''}: ${formatRp(i.price * i.quantity)}`).join('%0A');
    let discountText = '';
    if (order.discount && order.discount.value > 0) {
      discountText = `%0A*Diskon Promo (${order.discount.code}):* -${formatRp(order.discount.value)}`;
    }
    const text = `*INVOICE TABETAI*%0A%0AOrder ID: ${order.id}%0ATanggal: ${order.date}%0ANama: ${order.customer}%0A%0A*Detail Pesanan:*%0A${itemsText}%0A%0A*Subtotal:* ${formatRp(order.originalTotal)}${discountText}%0A*TOTAL TAGIHAN:* ${formatRp(order.total)}%0A%0A*Poin Didapat:* +${order.earnedPoints} Poin%0A%0ATerima kasih telah memesan di Tabetai!`;
    
    // Format nomor HP agar sesuai standar WhatsApp API (Ganti awalan 0 menjadi 62)
    let waNumber = userPhone || "";
    waNumber = waNumber.replace(/[^\d+]/g, ''); 
    if (waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1);
    if (waNumber.startsWith('+')) waNumber = waNumber.substring(1);

    return `https://wa.me/${waNumber}?text=${text}`;
};

export default function TabetaiApp() {
  // State tersinkronisasi Firebase
  const [members, setMembers] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promos, setPromos] = useState([]);
  
  // State Navigasi
  const [role, setRole] = useState('guest'); 
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState('login'); 
  const [memberView, setMemberView] = useState('home'); 
  const [adminView, setAdminView] = useState('dashboard');

  const [cart, setCart] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);

  // Sync Data Realtime dari Firebase
  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), snap => setMembers(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubMenus = onSnapshot(collection(db, 'menus'), snap => setMenus(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubOrders = onSnapshot(collection(db, 'orders'), snap => setOrders(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    const unsubPromos = onSnapshot(collection(db, 'promos'), snap => setPromos(snap.docs.map(d => ({ ...d.data(), dbId: d.id }))));
    
    return () => { unsubMembers(); unsubMenus(); unsubOrders(); unsubPromos(); };
  }, []);

  // Update current user data (points) real-time
  const activeUser = currentUser ? members.find(m => m.phone === currentUser.phone && m.name.toLowerCase() === currentUser.name.toLowerCase()) || currentUser : null;

  const handleLogin = (name, phone) => {
    if (name.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase() && phone === ADMIN_CREDENTIALS.phone) {
      setRole('admin');
      setCurrentUser({ name: 'Admin Tabetai', phone });
      setAdminView('dashboard');
      return;
    }
    
    const existingMember = members.find(m => m.name.toLowerCase() === name.toLowerCase() && m.phone === phone);
    if (existingMember) {
      setRole('member');
      setCurrentUser(existingMember);
      setMemberView('home');
      return;
    }
    alert('Akun tidak ditemukan atau salah. Silakan periksa kembali atau lakukan Registrasi.');
  };

  const handleRegister = async (name, phone) => {
    if(name.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase()) {
      alert('Username ini tidak dapat digunakan.');
      return;
    }
    const existingMember = members.find(m => m.name.toLowerCase() === name.toLowerCase() && m.phone === phone);
    if(existingMember) {
      alert('Akun sudah terdaftar. Silakan login.');
      return;
    }

    try {
      const newMemberData = { id: Date.now(), name, phone, points: 0 };
      const res = await addDoc(collection(db, 'members'), newMemberData);
      
      setRole('member');
      setCurrentUser({ ...newMemberData, dbId: res.id });
      setMemberView('home');
    } catch (e) {
      alert("Gagal menyambung ke database. Pastikan koneksi internet stabil.");
      console.error(e);
    }
  };

  const handleLogout = () => {
    setRole('guest');
    setCurrentUser(null);
    setAuthView('login');
    setCart([]);
  };

  const addToCart = (item, variantName, quantity, note) => {
    setCart(prev => {
      const existing = prev.findIndex(i => (i.dbId === item.dbId || i.id === item.id) && i.variant === variantName && i.note === note);
      if (existing > -1) {
        const newCart = [...prev];
        newCart[existing].quantity += quantity;
        return newCart;
      }
      return [...prev, { ...item, variant: variantName, quantity, note, cartId: Date.now() }];
    });
    setSelectedMenuItem(null);
  };

  const updateCartQty = (cartId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const getCartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async (finalTotal, discountObj) => {
    const earnedPoints = Math.floor(finalTotal * 0.1); 
    const newOrderData = {
      id: `TBT-${Math.floor(Math.random() * 10000)}`,
      customer: activeUser.name,
      customerPhone: activeUser.phone,
      items: [...cart],
      total: finalTotal,
      originalTotal: getCartTotal(),
      discount: discountObj,
      earnedPoints: earnedPoints,
      status: 'Menunggu Pembayaran',
      date: new Date().toLocaleString('id-ID')
    };
    
    try {
      const res = await addDoc(collection(db, 'orders'), newOrderData);
      
      // Update Poin Member
      if (activeUser.dbId) {
        await updateDoc(doc(db, 'members', activeUser.dbId), { points: (activeUser.points || 0) + earnedPoints });
      }
      
      // Optimistic update
      setOrders([{ ...newOrderData, dbId: res.id }, ...orders]);
      setCart([]);
      setMemberView('payment');
    } catch (e) {
      alert("Gagal memproses pesanan. Silakan coba lagi.");
      console.error(e);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-100 flex justify-center font-sans">
      <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
        
        {role === 'guest' && (
          <div className="flex-1 flex flex-col justify-center px-8 bg-red-50">
            <div className="text-center mb-10 animate-fade-in-up">
              <div className="w-32 h-32 mx-auto mb-4 shadow-xl rounded-full overflow-hidden bg-white border-4 border-white flex items-center justify-center">
                <img src={logoImageUrl} alt="Tabetai Logo" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/200x200/ef4444/ffffff?text=Tabetai'; }} />
              </div>
              <h1 className="text-3xl font-black text-red-600 tracking-tight mt-2">TABETAI</h1>
              <p className="text-gray-600 mt-1 text-sm">Authentic Japanese Cuisine</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 animate-fade-in-up">
              {authView === 'login' ? (
                <>
                  <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Masuk ke Akun</h2>
                  <AuthForm onSubmit={handleLogin} btnText="Login" />
                  <div className="mt-6 text-center text-sm">
                    <p className="text-gray-500">Belum punya akun?</p>
                    <button onClick={() => setAuthView('register')} className="text-red-600 font-bold mt-1 hover:underline">Registrasi Member Baru</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Daftar Member</h2>
                  <AuthForm onSubmit={handleRegister} btnText="Daftar Sekarang" />
                  <div className="mt-6 text-center text-sm">
                    <p className="text-gray-500">Sudah punya akun?</p>
                    <button onClick={() => setAuthView('login')} className="text-red-600 font-bold mt-1 hover:underline">Login di sini</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {role === 'member' && (
          <div className="flex-1 flex flex-col w-full h-full">
            {memberView === 'home' && <MemberHome user={activeUser} onNavigate={setMemberView} onLogout={handleLogout} />}
            {memberView === 'menu' && (
              <MemberMenu 
                menus={menus.filter(m => m.isActive !== false).sort((a,b) => (a.orderPriority || 99) - (b.orderPriority || 99))} 
                onBack={() => setMemberView('home')} onSelectItem={setSelectedMenuItem}
                cartCount={getCartCount()} cartTotal={getCartTotal()} onCheckout={() => setMemberView('checkout')}
              />
            )}
            {memberView === 'checkout' && (
              <MemberCheckout 
                cart={cart} onBack={() => setMemberView('menu')} updateQty={updateCartQty} 
                subtotal={getCartTotal()} onPay={placeOrder} promos={promos}
              />
            )}
            {memberView === 'payment' && (
              <MemberPayment 
                onCheckStatus={() => setMemberView('status')} 
                order={orders.filter(o => o.customer === activeUser.name)[0]}
                userPhone={activeUser.phone}
              />
            )}
            {memberView === 'status' && (
              <MemberStatus 
                orders={orders.filter(o => o.customer === activeUser.name)} 
                onBack={() => setMemberView('home')} userPhone={activeUser.phone}
              />
            )}

            {(memberView === 'home' || memberView === 'status') && (
              <a href={`https://wa.me/${ADMIN_WA_NUMBER}?text=Halo%20Admin%20Tabetai,%20saya%20${activeUser.name}%20butuh%20bantuan.`} target="_blank" rel="noreferrer" className="absolute bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-transform active:scale-95 z-50 flex items-center justify-center">
                <MessageCircle size={28} />
              </a>
            )}
            {selectedMenuItem && (
              <VariantModal item={selectedMenuItem} onClose={() => setSelectedMenuItem(null)} onAdd={addToCart} />
            )}
          </div>
        )}

        {role === 'admin' && (
          <div className="flex-1 flex flex-col w-full h-full bg-slate-100">
             {adminView !== 'dashboard' && (
              <div className="bg-slate-900 text-white p-4 flex items-center shadow-md z-20">
                <button onClick={() => setAdminView('dashboard')} className="p-2 hover:bg-slate-800 rounded-full mr-2"><ChevronLeft size={24} /></button>
                <h1 className="font-bold text-lg flex-1">
                  {adminView === 'menus' && 'Manajemen Menu'}
                  {adminView === 'orders' && 'Pesanan Masuk'}
                  {adminView === 'members' && 'Daftar Member'}
                  {adminView === 'promos' && 'Manajemen Promo'}
                </h1>
              </div>
            )}

            {adminView === 'dashboard' && (
              <AdminDashboard onNavigate={setAdminView} onLogout={handleLogout} stats={{ orders: orders.length, menus: menus.length, members: members.length, promos: promos.length }} />
            )}
            {adminView === 'menus' && <AdminMenuManager menus={menus} />}
            {adminView === 'orders' && <AdminOrderManager orders={orders} />}
            {adminView === 'members' && <AdminMemberManager members={members} />}
            {adminView === 'promos' && <AdminPromoManager promos={promos} />}
          </div>
        )}
      </div>
    </div>
  );
}

function AuthForm({ onSubmit, btnText }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if(name && phone) onSubmit(name, phone);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap / Username</label>
        <div className="relative">
          <User className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Budi Santoso" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">No. WhatsApp</label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contoh: 08123456789" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all" />
        </div>
      </div>
      <button type="submit" className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-all mt-4">{btnText}</button>
    </form>
  );
}

function MemberHome({ user, onNavigate, onLogout }) {
  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <div className="bg-red-600 pt-12 pb-24 px-6 rounded-b-[40px] text-white shadow-md relative z-10 flex justify-between items-start">
        <div>
          <p className="text-red-100 text-sm font-medium">Konnichiwa,</p>
          <h1 className="text-2xl font-bold mt-1 truncate">{user?.name}!</h1>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-red-700/50 px-3 py-1 rounded-full text-sm font-medium">
            <Tag size={14} className="text-yellow-300" /> {user?.points || 0} Poin
          </div>
        </div>
        <button onClick={onLogout} className="bg-red-700 p-2.5 rounded-full hover:bg-red-800 transition-colors shadow-sm"><LogOut size={20} /></button>
      </div>

      <div className="flex-1 px-6 -mt-16 z-20 relative space-y-4">
        <button onClick={() => onNavigate('menu')} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow active:scale-[0.98] text-left">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-2xl flex items-center justify-center text-3xl">🍱</div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Pesan Makanan</h2>
              <p className="text-sm text-gray-500 mt-1">Lihat menu dan pesan sekarang</p>
            </div>
          </div>
          <ChevronLeft className="text-gray-300 rotate-180" />
        </button>

        <button onClick={() => onNavigate('status')} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow active:scale-[0.98] text-left">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-2xl flex items-center justify-center"><Clock size={32} /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Status Pesanan</h2>
              <p className="text-sm text-gray-500 mt-1">Lacak status pesanan aktifmu</p>
            </div>
          </div>
          <ChevronLeft className="text-gray-300 rotate-180" />
        </button>
      </div>
    </div>
  );
}
function MemberMenu({ menus, onBack, onSelectItem, cartCount, cartTotal, onCheckout }) {
  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm border-b border-gray-50">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={24} className="text-gray-700" /></button>
        <h1 className="flex-1 text-center font-bold text-lg text-gray-800 pr-10">Menu Tabetai</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {menus.map(item => (
          <div key={item.dbId || item.id} className="flex gap-4 p-4 border border-gray-100 rounded-2xl shadow-sm bg-white">
            <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/100x100/eeeeee/999999?text=No+Image'; }} />
            </div>
            <div className="flex-1 flex flex-col">
              <h3 className="font-bold text-gray-800">{item.name}</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.desc}</p>
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className="font-bold text-red-600">{formatRp(item.price)}</span>
                <button onClick={() => onSelectItem(item)} className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full font-semibold text-sm hover:bg-red-100 transition-colors">Tambah</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cartCount > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30 animate-fade-in-up">
          <div onClick={onCheckout} className="bg-red-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer active:scale-[0.98] transition-transform">
            <div className="flex flex-col">
              <span className="text-sm text-red-100 font-medium">{cartCount} Item di keranjang</span>
              <span className="font-bold text-lg">{formatRp(cartTotal)}</span>
            </div>
            <div className="flex items-center gap-2 font-bold bg-red-700 py-2 px-4 rounded-xl"><ShoppingCart size={18} /> Checkout</div>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantModal({ item, onClose, onAdd }) {
  const availableVariants = item.variants.filter(v => v.qty > 0);
  const [selectedVariant, setSelectedVariant] = useState(availableVariants[0]?.name || '');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  const handleAdd = () => {
    if(!selectedVariant) return;
    onAdd(item, selectedVariant, qty, note);
  };

  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end">
      <div className="bg-white rounded-t-3xl p-6 w-full max-h-[90vh] flex flex-col shadow-2xl relative animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"><X size={20} /></button>
        <div className="flex gap-4 items-center mb-6 border-b border-gray-100 pb-6 mt-2">
           <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden shrink-0"><img src={item.image} alt={item.name} className="w-full h-full object-cover" /></div>
            <div><h2 className="font-bold text-xl text-gray-800">{item.name}</h2><p className="text-red-600 font-bold text-lg mt-1">{formatRp(item.price)}</p></div>
        </div>

        <div className="flex-1 overflow-y-auto mb-6">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">Pilih Varian <span className="text-red-500">*</span></h3>
          <div className="space-y-2 mb-6">
            {item.variants.map(variant => {
              const isAvailable = variant.qty > 0;
              return (
                <label key={variant.name} className={`flex items-center justify-between p-4 border rounded-xl transition-all ${!isAvailable ? 'opacity-50 bg-gray-50 cursor-not-allowed' : 'cursor-pointer'} ${selectedVariant === variant.name ? 'border-red-500 bg-red-50/50' : 'border-gray-200'}`}>
                  <span className={`font-medium ${selectedVariant === variant.name ? 'text-red-700' : 'text-gray-700'}`}>{variant.name} {!isAvailable && '(Habis)'}</span>
                  {isAvailable && (
                    <>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedVariant === variant.name ? 'border-red-500' : 'border-gray-300'}`}>{selectedVariant === variant.name && <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />}</div>
                      <input type="radio" name="variant" value={variant.name} disabled={!isAvailable} checked={selectedVariant === variant.name} onChange={() => setSelectedVariant(variant.name)} className="hidden" />
                    </>
                  )}
                </label>
              );
            })}
          </div>
          <h3 className="font-bold text-gray-800 mb-3 text-sm">Catatan (Opsional)</h3>
          <textarea placeholder="Contoh: Jangan terlalu pedas, kuah dipisah..." value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-4 border border-gray-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all text-sm resize-none" rows="2" />
        </div>

        {availableVariants.length > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 bg-gray-100 p-2 rounded-xl">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-gray-600"><Minus size={18} /></button>
              <span className="font-bold text-lg w-4 text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-red-600"><Plus size={18} /></button>
            </div>
            <button onClick={handleAdd} className="flex-1 bg-red-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-transform">Tambah - {formatRp(item.price * qty)}</button>
          </div>
        ) : (
          <button disabled className="w-full bg-gray-300 text-gray-500 font-bold py-4 rounded-xl shadow-sm">Stok Habis</button>
        )}
      </div>
    </div>
  );
}

function MemberCheckout({ cart, onBack, updateQty, subtotal, onPay, promos }) {
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-gray-50">
        <div className="p-4 bg-white flex items-center"><button onClick={onBack} className="p-2"><ChevronLeft size={24} /></button><h1 className="flex-1 text-center font-bold pr-10 text-lg">Keranjang</h1></div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-500"><Utensils size={64} className="mb-4 text-gray-300" /><p>Keranjangmu masih kosong.</p><button onClick={onBack} className="mt-4 text-red-600 font-bold p-2">Pilih Menu</button></div>
      </div>
    );
  }

  const handleApplyPromo = () => {
    setPromoError('');
    if (!promoCodeInput.trim()) return;
    const promo = promos.find(p => p.code.toLowerCase() === promoCodeInput.toLowerCase() && p.isActive !== false);
    if (promo) {
      setAppliedPromo(promo);
    } else {
      setAppliedPromo(null);
      setPromoError('Kode promo tidak valid atau kadaluarsa.');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoError('');
  };

  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.type === 'percent') discountAmount = (subtotal * appliedPromo.value) / 100;
    else discountAmount = appliedPromo.value;
    if (discountAmount > subtotal) discountAmount = subtotal;
  }
  const finalTotal = subtotal - discountAmount;

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm"><button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={24} className="text-gray-700" /></button><h1 className="flex-1 text-center font-bold text-lg text-gray-800 pr-10">Konfirmasi Pesanan</h1></div>
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200 mb-6 text-sm font-medium flex gap-3 items-start shadow-sm"><span className="text-xl">⚠️</span><p>Pre-Orders are accepted until 21.00 WIB. please make payment before checkout</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50"><h2 className="font-bold text-gray-800 text-sm">Daftar Pesanan</h2></div>
          <div className="divide-y divide-gray-100">
            {cart.map(item => (
              <div key={item.cartId} className="p-4 flex gap-4">
                <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden shrink-0"><img src={item.image} alt={item.name} className="w-full h-full object-cover" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-sm">{item.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Varian: {item.variant}</p>
                  {item.note && <p className="text-xs text-gray-400 mt-0.5 italic">Catatan: {item.note}</p>}
                  <p className="font-bold text-red-600 text-sm mt-1">{formatRp(item.price)}</p>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-lg border border-gray-100">
                    <button onClick={() => updateQty(item.cartId, -1)} className="w-7 h-7 bg-white rounded flex items-center justify-center text-gray-600 shadow-sm"><Minus size={14} /></button>
                    <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartId, 1)} className="w-7 h-7 bg-white rounded flex items-center justify-center text-red-600 shadow-sm"><Plus size={14} /></button>
                  </div>
                  <span className="text-xs font-bold text-gray-800 mt-2">{formatRp(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Promo Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <h2 className="font-bold text-gray-800 text-sm mb-3">Punya Kode Promo?</h2>
          {!appliedPromo ? (
            <div>
              <div className="flex gap-2">
                <input type="text" value={promoCodeInput} onChange={e => setPromoCodeInput(e.target.value)} placeholder="Masukkan kode voucher" className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm uppercase" />
                <button onClick={handleApplyPromo} className="bg-gray-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm">Pakai</button>
              </div>
              {promoError && <p className="text-red-500 text-xs mt-2">{promoError}</p>}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-green-600" />
                <div><p className="text-sm font-bold text-green-800">{appliedPromo.code}</p><p className="text-xs text-green-600">Diskon diaplikasikan</p></div>
              </div>
              <button onClick={handleRemovePromo} className="text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 text-sm mb-3">Ringkasan Pembayaran</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatRp(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Diskon Promo</span><span>-{formatRp(discountAmount)}</span></div>}
          </div>
          <div className="border-t border-dashed border-gray-200 mt-3 pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-800">Total</span><span className="font-black text-red-600 text-lg">{formatRp(finalTotal)}</span>
          </div>
          <div className="mt-2 text-xs text-center text-gray-400 bg-gray-50 py-1.5 rounded-lg border border-gray-100">
            Dapatkan <strong>{Math.floor(finalTotal * 0.1)} Poin</strong> dari pesanan ini
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30">
        <button onClick={() => onPay(finalTotal, appliedPromo ? { code: appliedPromo.code, value: discountAmount } : null)} className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-red-700 active:scale-95 transition-transform flex items-center justify-center gap-2 text-lg">Pay Now <ChevronLeft className="rotate-180" size={20} /></button>
      </div>
    </div>
  );
}

function MemberPayment({ onCheckStatus, order, userPhone }) {
  if(!order) return null;
  const handleSaveImage = () => { window.open(qrisImageUrl, '_blank'); };
  
  const handleConfirmWA = () => {
    const text = `Halo Admin Tabetai, saya ${order.customer} sudah melakukan pembayaran via QRIS untuk Order ID: ${order.id}. Mohon dicek ya!`;
    window.open(`https://wa.me/${ADMIN_WA_NUMBER}?text=${text}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
       <div className="p-4 bg-white flex items-center border-b border-gray-100"><h1 className="flex-1 text-center font-bold text-lg text-gray-800">Pembayaran</h1></div>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium mb-6 flex items-center gap-2 w-full justify-center"><Clock size={16} /> Selesaikan dalam 15:00</div>
        <p className="text-gray-500 text-sm mb-1">Total Tagihan</p><p className="text-3xl font-black text-gray-800 mb-8">{formatRp(order.total)}</p>
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 mb-6 w-full max-w-[280px] aspect-square flex items-center justify-center relative">
          <img src={qrisImageUrl} alt="QRIS Code" className="w-full h-full object-contain p-2" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider">QRIS TABETAI</div>
        </div>
        <div className="flex gap-3 w-full max-w-[280px]">
          <button onClick={handleSaveImage} className="flex-1 flex flex-col items-center justify-center gap-1 text-red-600 font-semibold border-2 border-red-100 bg-red-50 p-3 rounded-xl hover:bg-red-100 transition-colors"><Download size={20} /> <span className="text-xs">Save QRIS</span></button>
          <button onClick={() => window.open(generateInvoiceWAUrl(order, userPhone), '_blank')} className="flex-1 flex flex-col items-center justify-center gap-1 text-blue-600 font-semibold border-2 border-blue-100 bg-blue-50 p-3 rounded-xl hover:bg-blue-100 transition-colors"><ScrollText size={20} /> <span className="text-xs">Kirim Invoice</span></button>
        </div>
        
        <div className="w-full mt-10 space-y-3">
          <button onClick={handleConfirmWA} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-green-700 active:scale-95 transition-transform flex items-center justify-center gap-2">
            <MessageCircle size={20} /> Konfirmasi Pesanan WA
          </button>
          <button onClick={onCheckStatus} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-md hover:bg-gray-800 active:scale-95 transition-transform">
            Cek Status Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberStatus({ orders, onBack, userPhone }) {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 pb-24">
      <div className="flex items-center p-4 bg-white sticky top-0 z-20 shadow-sm border-b border-gray-100"><button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={24} className="text-gray-700" /></button><h1 className="flex-1 text-center font-bold text-lg text-gray-800 pr-10">Status Pesanan</h1></div>
      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20"><Store size={64} className="mb-4 opacity-50" /><p>Belum ada riwayat pesanan.</p></div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div key={order.dbId || order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${order.status === 'Selesai' ? 'bg-green-500' : 'bg-orange-500'}`} />
                <div className="flex justify-between items-start mb-3">
                  <div><p className="text-xs text-gray-500 mb-0.5">{order.date}</p><p className="font-bold text-gray-800 text-sm">Order ID: {order.id}</p></div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${order.status === 'Selesai' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{order.status}</span>
                </div>
                <div className="border-t border-b border-gray-50 py-3 my-3">
                  <p className="text-sm text-gray-600 mb-2">{order.items.length} Menu dipesan:</p>
                  <div className="space-y-1.5">
                    {order.items.map((item, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-semibold text-gray-800">{item.quantity}x {item.name}</span>
                        {item.note && <p className="text-xs text-gray-500 italic ml-4">"{item.note}"</p>}
                      </div>
                    ))}
                  </div>
                  {order.discount && order.discount.value > 0 && <p className="text-xs text-green-600 font-medium mt-2">- Diskon: {formatRp(order.discount.value)}</p>}
                  {order.earnedPoints > 0 && <p className="text-xs text-yellow-600 font-medium mt-1">+ Mendapat {order.earnedPoints} Poin</p>}
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-500">Total Belanja</span><span className="font-bold text-gray-800">{formatRp(order.total)}</span>
                </div>
                <button onClick={() => window.open(generateInvoiceWAUrl(order, userPhone), '_blank')} className="w-full bg-blue-50 text-blue-600 text-sm font-semibold py-2.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                  <Download size={16} /> Unduh Invoice WA
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30 max-w-md mx-auto">
        <button onClick={onBack} className="w-full bg-gray-100 text-gray-800 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors">Kembali ke Beranda</button>
      </div>
    </div>
  );
}

function AdminDashboard({ onNavigate, onLogout, stats }) {
  return (
    <div className="flex-1 flex flex-col bg-slate-100">
      <div className="bg-slate-900 pt-12 pb-20 px-6 rounded-b-[40px] text-white shadow-md relative z-10">
        <div className="flex justify-between items-center">
          <div><p className="text-slate-400 text-sm font-medium">Selamat Datang,</p><h1 className="text-2xl font-bold mt-1">gillhardjo</h1></div>
          <button onClick={onLogout} className="bg-slate-800 p-3 rounded-full hover:bg-slate-700 transition-colors"><LogOut size={20} /></button>
        </div>
      </div>
      <div className="flex-1 px-6 -mt-12 z-20 relative space-y-4 pb-10">
        <button onClick={() => onNavigate('menus')} className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98] text-left">
          <div className="flex items-center gap-4"><div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center"><UtensilsCrossed size={28} /></div><div><h2 className="text-lg font-bold text-slate-800">Manajemen Menu</h2><p className="text-sm text-slate-500 mt-0.5">{stats.menus} Menu aktif</p></div></div>
        </button>
        <button onClick={() => onNavigate('orders')} className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98] text-left">
          <div className="flex items-center gap-4"><div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><ScrollText size={28} /></div><div><h2 className="text-lg font-bold text-slate-800">Pesanan Masuk</h2><p className="text-sm text-slate-500 mt-0.5">{stats.orders} Pesanan perlu diproses</p></div></div>
        </button>
        <button onClick={() => onNavigate('promos')} className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98] text-left">
          <div className="flex items-center gap-4"><div className="w-14 h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center"><Tag size={28} /></div><div><h2 className="text-lg font-bold text-slate-800">Manajemen Promo</h2><p className="text-sm text-slate-500 mt-0.5">{stats.promos} Promo tersedia</p></div></div>
        </button>
        <button onClick={() => onNavigate('members')} className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98] text-left">
          <div className="flex items-center gap-4"><div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center"><Users size={28} /></div><div><h2 className="text-lg font-bold text-slate-800">Daftar Member</h2><p className="text-sm text-slate-500 mt-0.5">{stats.members} Member terdaftar</p></div></div>
        </button>
      </div>
    </div>
  );
}

function AdminMenuManager({ menus }) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentMenu, setCurrentMenu] = useState(null);

  const handleAddNew = () => {
    setCurrentMenu({ id: Date.now(), orderPriority: 99, name: '', desc: '', price: '', image: '', isActive: true, variants: [{ name: '', qty: 0 }] });
    setIsEditing(true);
  };

  const handleSaveMenu = async (savedMenu) => {
    try {
      if (savedMenu.dbId) await updateDoc(doc(db, 'menus', savedMenu.dbId), savedMenu);
      else await addDoc(collection(db, 'menus'), savedMenu);
      setIsEditing(false);
    } catch (e) { alert("Error menyimpan menu!"); console.error(e); }
  };

  const handleDeleteMenu = async (id) => {
    if(window.confirm('Hapus menu ini?')) { 
      const target = menus.find(m => (m.dbId || m.id) === id);
      if (target && target.dbId) await deleteDoc(doc(db, 'menus', target.dbId));
    }
  };

  const handleToggleVisibility = async (id) => {
    const target = menus.find(m => (m.dbId || m.id) === id);
    if (target && target.dbId) await updateDoc(doc(db, 'menus', target.dbId), { isActive: target.isActive === false ? true : false });
  };

  if (isEditing) return <AdminMenuForm menu={currentMenu} onSave={handleSaveMenu} onCancel={() => setIsEditing(false)} />;

  const sortedMenus = [...menus].sort((a,b) => (a.orderPriority || 99) - (b.orderPriority || 99));

  return (
    <div className="flex-1 flex flex-col relative pb-24 overflow-y-auto">
      <div className="p-4 space-y-4">
        {sortedMenus.map(menu => (
          <div key={menu.dbId || menu.id} className={`bg-white p-4 rounded-2xl shadow-sm border ${menu.isActive !== false ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-75'} flex flex-col`}>
            <div className="flex gap-4">
              <div className="flex flex-col items-center justify-center w-8 bg-slate-50 rounded-lg border border-slate-100 text-slate-400">
                <GripVertical size={16} className="mb-1 opacity-50" />
                <span className="text-xs font-bold">{menu.orderPriority || '-'}</span>
              </div>
              <div className={`w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${menu.isActive === false ? 'grayscale' : ''}`}>
                <img src={menu.image} alt={menu.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/100x100/eeeeee/999999?text=No+Image'; }} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  {menu.name} {menu.isActive === false && <span className="bg-slate-200 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider">Hidden</span>}
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-1">{formatRp(menu.price)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => handleToggleVisibility(menu.dbId || menu.id)} className={`p-1.5 rounded-lg flex items-center justify-center ${menu.isActive !== false ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                  {menu.isActive !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => { setCurrentMenu(menu); setIsEditing(true); }} className="p-1.5 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                <button onClick={() => handleDeleteMenu(menu.dbId || menu.id)} className="p-1.5 flex items-center justify-center bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleAddNew} className="absolute bottom-6 right-6 bg-slate-900 text-white p-4 rounded-full shadow-lg hover:bg-slate-800 transition-transform active:scale-95 flex items-center justify-center"><Plus size={28} /></button>
    </div>
  );
}

function AdminMenuForm({ menu, onSave, onCancel }) {
  const [formData, setFormData] = useState(menu);
  const handleVariantChange = (index, field, value) => { const newVariants = [...formData.variants]; newVariants[index][field] = value; setFormData({ ...formData, variants: newVariants }); };
  const addVariant = () => { setFormData({ ...formData, variants: [...formData.variants, { name: '', qty: 0 }] }); };
  const removeVariant = (index) => { setFormData({ ...formData, variants: formData.variants.filter((_, i) => i !== index) }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.variants.length === 0) return alert("Minimal masukkan 1 varian!");
    if (!formData.image) return alert("Harap masukkan URL Gambar Menu!");
    onSave({ ...formData, price: Number(formData.price), orderPriority: Number(formData.orderPriority) || 99 });
  };

  return (
    <div className="flex-1 bg-white overflow-y-auto relative">
      <form onSubmit={handleSubmit} className="p-6 space-y-5 pb-32">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div><label className="block text-sm font-bold text-slate-700">Tampilkan ke Pelanggan</label><p className="text-xs text-slate-500">Menu ini akan terlihat di aplikasi</p></div>
          <button type="button" onClick={() => setFormData({...formData, isActive: formData.isActive === false ? true : false})} className={`w-12 h-6 rounded-full relative transition-colors ${formData.isActive !== false ? 'bg-slate-900' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${formData.isActive !== false ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex gap-4">
          <div className="w-24"><label className="block text-sm font-bold text-slate-700 mb-1">No. Urut</label><input type="number" required value={formData.orderPriority} onChange={e => setFormData({...formData, orderPriority: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 text-center" /></div>
          <div className="flex-1"><label className="block text-sm font-bold text-slate-700 mb-1">Nama Menu</label><input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900" /></div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Gambar Menu (URL)</label>
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
               {formData.image ? <img src={formData.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/100x100/eeeeee/999999?text=No+Image'; }} /> : <span className="text-slate-400 text-xs">No Img</span>}
            </div>
            <input required type="url" placeholder="https://..." value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 text-sm" />
          </div>
        </div>
        <div><label className="block text-sm font-bold text-slate-700 mb-1">Deskripsi Singkat</label><textarea required value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 text-sm" rows={2} /></div>
        <div><label className="block text-sm font-bold text-slate-700 mb-1">Harga Dasar (Rp)</label><input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900" /></div>
        <div className="pt-4 border-t border-slate-200">
          <div className="flex justify-between items-center mb-3"><label className="block text-sm font-bold text-slate-700">Varian & Qty</label><button type="button" onClick={addVariant} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={14}/> Tambah</button></div>
          <div className="space-y-3">
            {formData.variants.map((v, i) => (
              <div key={i} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                <input required type="text" placeholder="Nama Varian" value={v.name} onChange={e => handleVariantChange(i, 'name', e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"/>
                <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold px-1">QTY</span><input required type="number" min="0" value={v.qty} onChange={e => handleVariantChange(i, 'qty', Number(e.target.value))} className="w-16 px-2 py-2 rounded-lg border border-slate-200 text-sm text-center"/></div>
                {formData.variants.length > 1 && (<button type="button" onClick={() => removeVariant(i)} className="p-2 text-red-500 bg-red-50 rounded-lg"><X size={16} /></button>)}
              </div>
            ))}
          </div>
        </div>
      </form>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3.5 rounded-xl border border-slate-200">Batal</button>
        <button type="button" onClick={handleSubmit} className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2"><Save size={18}/> Simpan</button>
      </div>
    </div>
  );
}

function AdminOrderManager({ orders }) {
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterDate, setFilterDate] = useState('');

  const STATUS_OPTIONS = ['Menunggu Pembayaran', 'Diproses', 'Selesai', 'Dibatalkan'];
  
  const handleStatusChange = async (orderId, newStatus) => { 
    const target = orders.find(o => (o.dbId || o.id) === orderId);
    if (target && target.dbId) {
      try { await updateDoc(doc(db, 'orders', target.dbId), { status: newStatus }); }
      catch(e) { console.error(e); }
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const query = filterName.toLowerCase();
      const matchSearch = o.customer.toLowerCase().includes(query) || o.id.toLowerCase().includes(query);
      const matchStatus = filterStatus === 'Semua' || o.status === filterStatus;
      const matchDate = filterDate === '' || o.date.includes(filterDate);
      return matchSearch && matchStatus && matchDate;
    });
  }, [orders, filterName, filterStatus, filterDate]);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="bg-white p-4 border-b border-slate-200 shadow-sm space-y-3 z-10 sticky top-0">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-1"><Filter size={16} /> Filter Pesanan</div>
        <div className="flex gap-2">
           <div className="relative flex-1">
             <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
             <input type="text" placeholder="Nama / Order ID" value={filterName} onChange={e=>setFilterName(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
           </div>
           <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
        </div>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400">
           <option value="Semua">Semua Status</option>
           {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="p-4 space-y-4">
        {filteredOrders.length === 0 ? (
          <p className="text-center text-slate-500 mt-10">Tidak ada pesanan yang sesuai filter.</p>
        ) : (
          filteredOrders.map(order => (
            <div key={order.dbId || order.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                <div><p className="font-black text-slate-800">{order.id}</p><p className="text-xs text-slate-500">{order.date}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-slate-700">{order.customer}</p></div>
              </div>
              <div className="space-y-2 mb-4">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="font-bold bg-slate-100 px-2 rounded text-slate-700">{item.quantity}x</span>
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">Varian: {item.variant}</p>
                      {item.note && <p className="text-xs text-slate-500 italic mt-0.5">"{item.note}"</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                <span className="text-sm font-bold text-slate-600">Total Pembayaran</span><span className="font-black text-slate-900">{formatRp(order.total)}</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Ubah Status Pesanan</label>
                <select 
                  value={order.status} onChange={(e) => handleStatusChange(order.dbId || order.id, e.target.value)}
                  className={`w-full text-sm font-bold p-3 rounded-xl border outline-none appearance-none ${
                    order.status === 'Selesai' ? 'bg-green-50 text-green-700 border-green-200' : 
                    order.status === 'Diproses' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    order.status === 'Dibatalkan' ? 'bg-red-50 text-red-700 border-red-200' : 
                    'bg-orange-50 text-orange-700 border-orange-200'
                  }`}
                >
                  {STATUS_OPTIONS.map(status => (<option key={status} value={status}>{status}</option>))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AdminMemberManager({ members }) {
  const [editingMember, setEditingMember] = useState(null);
  
  const handleSaveMember = async (e) => { 
    e.preventDefault(); 
    if (editingMember.dbId) {
      try { await updateDoc(doc(db, 'members', editingMember.dbId), editingMember); } 
      catch(e) { console.error(e); }
    }
    setEditingMember(null); 
  };

  const handleDeleteMember = async (id) => {
    if(window.confirm('Hapus member ini dari database?')) { 
      const target = members.find(m => (m.dbId || m.id) === id);
      if (target && target.dbId) await deleteDoc(doc(db, 'members', target.dbId));
    }
  };

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {members.map(member => (
          <div key={member.dbId || member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-lg">{member.name.charAt(0).toUpperCase()}</div>
              <div>
                <h3 className="font-bold text-slate-800">{member.name}</h3>
                <p className="text-sm text-slate-500">{member.phone}</p>
                <p className="text-xs font-bold text-yellow-600 mt-0.5">{member.points || 0} Poin</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingMember(member)} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"><Edit2 size={18} /></button>
              <button onClick={() => handleDeleteMember(member.dbId || member.id)} className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
      {editingMember && (
        <div className="absolute inset-0 bg-slate-900/60 z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-6 w-full flex flex-col shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4"><h2 className="font-bold text-xl text-slate-800">Edit Member</h2><button onClick={() => setEditingMember(null)} className="p-2 bg-slate-100 text-slate-600 rounded-full"><X size={20} /></button></div>
            <form onSubmit={handleSaveMember} className="space-y-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1">Nama / Username</label><input required type="text" value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">No. WhatsApp</label><input required type="tel" value={editingMember.phone} onChange={e => setEditingMember({...editingMember, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900" /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">Total Poin</label><input required type="number" value={editingMember.points || 0} onChange={e => setEditingMember({...editingMember, points: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900" /></div>
              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-md mt-6 flex items-center justify-center gap-2"><Save size={20}/> Simpan Perubahan</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPromoManager({ promos }) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentPromo, setCurrentPromo] = useState(null);

  const handleAddNew = () => {
    setCurrentPromo({ id: Date.now(), code: '', type: 'percent', value: 0, isActive: true });
    setIsEditing(true);
  };

  const handleSavePromo = async (e) => {
    e.preventDefault();
    if (currentPromo.dbId) {
      await updateDoc(doc(db, 'promos', currentPromo.dbId), currentPromo);
    } else { 
      await addDoc(collection(db, 'promos'), currentPromo); 
    }
    setIsEditing(false);
  };

  const handleDeletePromo = async (id) => {
    if(window.confirm('Hapus promo ini?')) { 
      const target = promos.find(p => (p.dbId || p.id) === id);
      if (target && target.dbId) await deleteDoc(doc(db, 'promos', target.dbId));
    }
  };

  if (isEditing) return (
    <div className="flex-1 bg-white overflow-y-auto relative">
      <form onSubmit={handleSavePromo} className="p-6 space-y-5 pb-32">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div><label className="block text-sm font-bold text-slate-700">Status Promo</label><p className="text-xs text-slate-500">Aktif / Non-Aktif</p></div>
          <button type="button" onClick={() => setCurrentPromo({...currentPromo, isActive: !currentPromo.isActive})} className={`w-12 h-6 rounded-full relative transition-colors ${currentPromo.isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${currentPromo.isActive ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div><label className="block text-sm font-bold text-slate-700 mb-1">Kode Promo</label><input required type="text" value={currentPromo.code} onChange={e => setCurrentPromo({...currentPromo, code: e.target.value.toUpperCase()})} placeholder="Cth: DISKON50" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 uppercase" /></div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Jenis Diskon</label>
          <select value={currentPromo.type} onChange={e => setCurrentPromo({...currentPromo, type: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900 outline-none bg-white">
            <option value="percent">Persentase (%)</option>
            <option value="nominal">Nominal / Potongan Harga (Rp)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Nilai Diskon</label>
          <input required type="number" min="1" value={currentPromo.value} onChange={e => setCurrentPromo({...currentPromo, value: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-900" />
          <p className="text-xs text-slate-500 mt-1">Jika persentase, isi 1-100. Jika nominal, isi langsung jumlahnya (cth: 15000)</p>
        </div>
      </form>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3.5 rounded-xl border border-slate-200">Batal</button>
        <button onClick={handleSavePromo} className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2"><Save size={18}/> Simpan</button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col relative pb-24 overflow-y-auto">
      <div className="p-4 space-y-4">
        {promos.map(promo => (
          <div key={promo.dbId || promo.id} className={`bg-white p-4 rounded-2xl shadow-sm border ${promo.isActive ? 'border-green-200' : 'border-slate-200 opacity-60'} flex flex-col`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${promo.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}><Tag size={24} /></div>
                <div>
                  <h3 className="font-black text-slate-800 tracking-wide">{promo.code}</h3>
                  <p className="text-sm font-medium text-slate-500 mt-0.5">Potongan: {promo.type === 'percent' ? `${promo.value}%` : formatRp(promo.value)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setCurrentPromo(promo); setIsEditing(true); }} className="p-1.5 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                <button onClick={() => handleDeletePromo(promo.dbId || promo.id)} className="p-1.5 flex items-center justify-center bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleAddNew} className="absolute bottom-6 right-6 bg-slate-900 text-white p-4 rounded-full shadow-lg hover:bg-slate-800 transition-transform active:scale-95 flex items-center justify-center"><Plus size={28} /></button>
    </div>
  );
}
