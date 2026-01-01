import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ReferenceLine, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, Wallet, Bell, 
  RotateCcw, ChevronRight, Plus, Minus, X, Clock, CalendarClock, Zap, 
  Search, Menu, Gift, AlertCircle, Trophy, User, Megaphone, Lock, Server, AlertTriangle, WifiOff, LogOut, Mail, Key
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection, runTransaction, addDoc, deleteDoc 
} from 'firebase/firestore';

// --- 상수 및 초기 데이터 ---
const INITIAL_CASH = 10000000;
const MAX_HISTORY = 60; 
const MAX_STORED_HISTORY = 600;
const RECENT_VIEW_COUNT = 60;
const SERVER_URL = "https://stock-tycoon-server.onrender.com"; // 배포된 서버 주소

// --- 1. Firebase 설정 ---
const firebaseConfig = {
  apiKey: "AIzaSyDVWurbFRuUdotVWffdPqPkLdlnXu3yVPc",
  authDomain: "stock-tycoon-a5444.firebaseapp.com",
  projectId: "stock-tycoon-a5444",
  storageBucket: "stock-tycoon-a5444.firebasestorage.app",
  messagingSenderId: "776057113968",
  appId: "1:776057113968:web:c955beac3ebd2a35d613b5"
};

// --- Firebase 초기화 ---
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase Init Error:", e);
}

const APP_ID = 'stock-tycoon-a5444';
const MARKET_COLLECTION = 'market_final';      
const USER_COLLECTION = 'users_final';         
const LEADERBOARD_COLLECTION = 'leaderboard_final'; 

// 초기 종목 데이터
const INITIAL_STOCKS_DATA = [
  { id: 'SAMS', name: '삼성전자', price: 72000, volatility: 0.012, held: 0, avgPrice: 0, trend: 0, sector: '반도체', color: '#3B82F6', newsEffect: null },
  { id: 'KAKO', name: '카카오', price: 54000, volatility: 0.020, held: 0, avgPrice: 0, trend: 0, sector: '플랫폼', color: '#F59E0B', newsEffect: null },
  { id: 'HYUN', name: '현대차', price: 198000, volatility: 0.015, held: 0, avgPrice: 0, trend: 0, sector: '자동차', color: '#10B981', newsEffect: null },
  { id: 'ECOP', name: '에코프로', price: 850000, volatility: 0.035, held: 0, avgPrice: 0, trend: 0, sector: '2차전지', color: '#EC4899', newsEffect: null },
  { id: 'BTC', name: '비트코인', price: 45000000, volatility: 0.050, held: 0, avgPrice: 0, trend: 0, sector: '가상화폐', color: '#8B5CF6', newsEffect: null },
];

// --- 유틸리티 ---
let idCounter = 0;
const generateId = (prefix = 'id') => {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${idCounter}`;
};

// --- 컴포넌트 ---
const ConfettiParticle = ({ style }) => {
  return <div className="confetti" style={style} />;
};

const FloatingText = ({ style, text, type }) => {
  return (
    <div 
      className={`fixed pointer-events-none font-bold text-2xl animate-float-up z-[100] ${type === 'profit' ? 'text-red-400' : 'text-blue-400'}`}
      style={style}
    >
      {text}
    </div>
  );
};

const Toast = ({ message, type }) => (
  <div className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-[24px] shadow-2xl flex items-center gap-3 animate-bounce-in z-[200] backdrop-blur-md border w-max max-w-[90vw] ${type === 'error' ? 'bg-[#333]/90 text-white border-gray-600' : type === 'jackpot' ? 'bg-[#333]/90 text-red-400 border-red-500/30' : type === 'gift' ? 'bg-[#333]/90 text-yellow-400 border-yellow-500/30' : 'bg-[#333]/90 text-white border-gray-600'}`}>
    <div className="shrink-0">{type === 'error' ? <X size={20}/> : type === 'jackpot' ? <TrendingUp size={20}/> : type === 'gift' ? <Gift size={20}/> : <Bell size={20}/>}</div>
    <span className="font-semibold text-sm tracking-tight whitespace-normal text-center leading-snug">{typeof message === 'object' ? JSON.stringify(message) : String(message)}</span>
  </div>
);

// --- 로그인 화면 ---
const AuthScreen = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-email') setError('이메일 형식이 올바르지 않습니다.');
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError('이메일 또는 비밀번호가 일치하지 않습니다.');
      else if (err.code === 'auth/email-already-in-use') setError('이미 사용 중인 이메일입니다.');
      else if (err.code === 'auth/weak-password') setError('비밀번호는 6자리 이상이어야 합니다.');
      else setError('로그인 오류: ' + err.code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#111] z-[10000] flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-[#202025] w-full max-w-md p-8 rounded-[32px] border border-gray-800 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Toss Tycoon</h1>
          <p className="text-gray-400 text-sm">로그인하여 내 자산을 지키세요</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 ml-1 mb-1 block">이메일</label>
            <div className="bg-[#161616] rounded-2xl flex items-center px-4 py-3 border border-gray-700 focus-within:border-blue-500 transition-colors">
              <Mail size={18} className="text-gray-500 mr-3" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="bg-transparent text-white w-full outline-none placeholder-gray-600"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs font-bold text-gray-500 ml-1 mb-1 block">비밀번호</label>
            <div className="bg-[#161616] rounded-2xl flex items-center px-4 py-3 border border-gray-700 focus-within:border-blue-500 transition-colors">
              <Key size={18} className="text-gray-500 mr-3" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="bg-transparent text-white w-full outline-none placeholder-gray-600"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {loading ? '처리 중...' : (isSignUp ? '회원가입하고 시작하기' : '로그인')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-gray-500 text-sm hover:text-white transition-colors"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RandomBoxModal = ({ onClose, onOpen }) => {
  const [opened, setOpened] = useState(false);
  const [amount, setAmount] = useState(0);
  const handleOpen = () => { 
    if (opened) return; 
    const reward = Math.floor(Math.random() * 2900000) + 100000; 
    setAmount(reward); 
    setOpened(true); 
    setTimeout(() => { 
      onOpen(reward); 
      setTimeout(onClose, 1500); 
    }, 500); 
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center animate-fade-in p-4">
      <div className="bg-[#202025] p-8 rounded-[32px] shadow-2xl border border-gray-700 text-center max-w-sm w-full relative overflow-visible">
        <h3 className="text-xl font-bold text-white mb-6">랜덤 박스 도착! 🎁</h3>
        {!opened ? 
          <button onClick={handleOpen} className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-lg flex items-center justify-center mx-auto hover:scale-105 transition-transform active:scale-95">
            <Gift size={48} className="text-white animate-bounce" />
          </button> 
          : 
          <div className="animate-pop-in w-full">
            <div className="text-sm text-gray-400 mb-1">축하합니다!</div>
            <div className="text-3xl font-bold text-yellow-400 mb-4 break-words leading-tight">+{amount.toLocaleString()}원</div>
            <div className="text-xs text-gray-500">계좌로 입금되었습니다</div>
          </div>
        }
        {!opened && <p className="text-gray-400 text-sm mt-6">상자를 눌러 용돈을 받으세요</p>}
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white"><X size={24}/></button>
      </div>
    </div>
  );
};

const ServerWaitingScreen = () => (
  <div className="fixed inset-0 z-[9999] bg-[#111]/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-fade-in">
    <div className="bg-[#202025] p-8 rounded-[32px] border border-gray-800 shadow-2xl max-w-md w-full flex flex-col items-center">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Server size={40} className="text-red-500" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">서버 연결 대기 중</h2>
      <p className="text-gray-400 text-sm mb-8 leading-relaxed">
        주식 시장 서버가 닫혀있습니다.<br/>
        호스트가 <code className="bg-gray-800 px-2 py-1 rounded text-yellow-400 font-mono text-xs">node server.js</code>를<br/>
        실행하면 자동으로 게임이 시작됩니다.
      </p>
      <div className="flex items-center gap-3 text-xs text-gray-600 bg-black/30 px-4 py-2 rounded-full">
        <Activity size={14} className="animate-spin" />
        <span>서버 신호를 찾는 중...</span>
      </div>
    </div>
  </div>
);

const StockTradingTycoon = () => {
  // App State
  const [user, setUser] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [cash, setCash] = useState(INITIAL_CASH);
  const [stocks, setStocks] = useState(INITIAL_STOCKS_DATA);
  const [selectedStockId, setSelectedStockId] = useState(INITIAL_STOCKS_DATA[0].id);
  const [stockHistory, setStockHistory] = useState({}); 
  const [gameTime, setGameTime] = useState(0);
  const [news, setNews] = useState([]); 
  const [tradeAmount, setTradeAmount] = useState(1);
  const [toast, setToast] = useState(null); 
  const [activeTab, setActiveTab] = useState('trade');
  const [orderMode, setOrderMode] = useState('market'); 
  const [targetPrice, setTargetPrice] = useState(0);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [principal, setPrincipal] = useState(INITIAL_CASH);
  const [particles, setParticles] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [screenFlash, setScreenFlash] = useState(null);
  const [showRandomBox, setShowRandomBox] = useState(false);
  const [lastBoxTime, setLastBoxTime] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [chartScale, setChartScale] = useState('1m'); 
  const [serverStatus, setServerStatus] = useState(false);
  
  const [localNewsEffects, setLocalNewsEffects] = useState({});
  const lastProcessedNewsId = useRef(null);
  const processingOrdersRef = useRef(new Set()); // 중복 체결 방지용

  // 서버 연결 상태 체크를 위한 Heartbeat
  const lastServerUpdate = useRef(Date.now());

  const stocksRef = useRef(stocks);
  useEffect(() => { stocksRef.current = stocks; }, [stocks]);

  // --- Handlers ---
  const showToast = useCallback((message, type = 'success') => {
    const msg = typeof message === 'object' ? JSON.stringify(message) : String(message);
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const triggerConfetti = (x, y) => {
    const colors = ['#FCD34D', '#F87171', '#60A5FA', '#34D399'];
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({ 
      id: generateId('p') + i, 
      x, y, 
      color: colors[Math.floor(Math.random() * colors.length)] 
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id))), 1000);
  };

  const triggerFloatingText = (x, y, text, type) => {
    const id = generateId('ft');
    setFloatingTexts(prev => [...prev, { id, x, y, text, type }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(ft => ft.id !== id)), 1200);
  };

  // ★ [수정됨] 거래 로직: 시장가(서버 전송) / 지정가(Firebase 저장) ★
  const handleTrade = async (type, e) => {
    if (!user) return;
    const stock = stocks.find(s => s.id === selectedStockId);
    const clickX = e?.clientX || window.innerWidth / 2;
    const clickY = e?.clientY || window.innerHeight / 2;

    // 1. 지정가(Limit) 주문: Firebase에 저장
    if (orderMode === 'limit') {
      try {
        const orderData = {
          stockId: stock.id,
          stockName: stock.name,
          type: type, // 'buy' or 'sell'
          price: targetPrice,
          amount: tradeAmount,
          createdAt: Date.now()
        };
        
        await addDoc(collection(db, 'artifacts', APP_ID, USER_COLLECTION, user.uid, 'orders'), orderData);
        
        showToast(`${stock.name} ${targetPrice.toLocaleString()}원 ${type === 'buy' ? '매수' : '매도'} 예약 완료`, 'success');
        triggerFloatingText(clickX, clickY, "예약됨", 'normal');
      } catch (err) {
        console.error("Order Save Error:", err);
        showToast("예약 주문 저장 실패", 'error');
      }
      return; 
    }

    // 2. 시장가(Market) 주문: 즉시 서버로 전송
    await executeMarketTrade(stock, type, tradeAmount, clickX, clickY);
  };

  // 실제 서버로 거래 요청을 보내는 함수 (시장가 / 예약 체결 공용)
  const executeMarketTrade = async (stock, type, amount, fxX, fxY) => {
    try {
        const response = await fetch(`${SERVER_URL}/api/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: user.uid,
                stockId: stock.id,
                type: type,
                amount: amount
            })
        });

        const result = await response.json();
        
        if (result.success) {
            // 성공 시 시각 효과
            if (type === 'sell') {
                const profit = (stock.price * amount) - (stock.avgPrice * amount);
                if (profit > 0) {
                     if(fxX && fxY) triggerConfetti(fxX, fxY);
                     if(fxX && fxY) triggerFloatingText(fxX, fxY, `+${Math.floor(profit).toLocaleString()}`, 'profit');
                } else {
                     if(fxX && fxY) triggerFloatingText(fxX, fxY, `${Math.floor(profit).toLocaleString()}`, 'loss');
                }
            } else {
                 if(fxX && fxY) triggerFloatingText(fxX, fxY, `-${Math.floor(stock.price * amount).toLocaleString()}`, 'loss');
            }
            if(fxX && fxY) showToast(result.msg, 'success'); // 예약 체결 시에는 토스트 안 띄우거나 다르게 처리할 수도 있음
        } else {
            showToast(result.msg, 'error');
            throw new Error(result.msg); // 에러 전파
        }
    } catch (e) {
        console.error(e);
        if(fxX && fxY) showToast(typeof e === 'string' ? e : "거래 실패", 'error');
        throw e;
    }
  };

  const cancelOrder = async (orderId) => { 
    if(!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, USER_COLLECTION, user.uid, 'orders', orderId));
      showToast('주문이 취소되었습니다', 'success'); 
    } catch(e) {
      showToast('취소 실패', 'error');
    }
  };
  
  const setAmountByPercent = (percent) => {
    const stock = stocks.find(s => s.id === selectedStockId);
    if (percent === 'max_buy') { const price = orderMode === 'limit' ? targetPrice : stock.price; const max = Math.floor(cash / price); setTradeAmount(max > 0 ? max : 1); }
    else if (percent === 'max_sell') { setTradeAmount(stock.held > 0 ? stock.held : 1); }
    else if (percent === 'half_sell') { setTradeAmount(stock.held > 0 ? Math.floor(stock.held / 2) : 1); }
  };

  const openRandomBox = (reward) => {
    const newCash = cash + reward; 
    setCash(newCash); 
    setLastBoxTime(Date.now()); 
    setShowRandomBox(false);
    showToast(`${reward.toLocaleString()}원 획득!`, 'gift'); 
    triggerConfetti(window.innerWidth/2, window.innerHeight/2);
    
    const portfolio = stocks.map(s => ({ id: s.id, held: s.held, avgPrice: s.avgPrice }));
    setDoc(doc(db, 'artifacts', APP_ID, USER_COLLECTION, user.uid, 'data', 'profile'), {
         cash: newCash,
         portfolio,
         updatedAt: Date.now()
    }, { merge: true });
  };
  
  const handleTradeClick = (type, e) => handleTrade(type, e);
  const handleSignOut = () => { 
      signOut(auth); 
      setUser(null); 
      setIsDataLoaded(false); 
      setCash(INITIAL_CASH); 
  };

  // --- Effects ---

  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (!u) setIsDataLoaded(false); 
    });
  }, []);

  // Styles
  useEffect(() => {
    const style = document.createElement("style");
    style.innerText = `
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
      body { font-family: 'Pretendard', sans-serif; background-color: #111; }
      .confetti { position: fixed; width: 6px; height: 6px; border-radius: 50%; pointer-events: none; animation: explode 0.8s ease-out forwards; z-index: 9999; }
      @keyframes explode { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }
      @keyframes floatUp { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-40px); opacity: 0; } }
      .animate-float-up { animation: floatUp 1.2s ease-out forwards; }
      @keyframes bounceIn { 0% { transform: translate(-50%, 20px); opacity: 0; } 50% { transform: translate(-50%, -5px); opacity: 1; } 100% { transform: translate(-50%, 0); opacity: 1; } }
      .animate-bounce-in { animation: bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      .animate-pop-in { animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      ::-webkit-scrollbar { width: 4px; height: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      .effect-good { animation: pulseRed 2s infinite; border: 1px solid rgba(239, 68, 68, 0.3) !important; background-color: rgba(239, 68, 68, 0.05) !important; }
      .effect-bad { animation: pulseBlue 2s infinite; border: 1px solid rgba(59, 130, 246, 0.3) !important; background-color: rgba(59, 130, 246, 0.05) !important; }
      @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      @keyframes pulseBlue { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const stock = stocks.find(s => s.id === selectedStockId);
    if (stock) setTargetPrice(Math.floor(stock.price));
  }, [selectedStockId]);

  // --- SERVER SYNC (Stocks & News) ---
  useEffect(() => {
    if (!user || !db) return;
    
    const marketDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', MARKET_COLLECTION, 'main');
    
    const unsubscribe = onSnapshot(marketDocRef, (docSnap) => {
      lastServerUpdate.current = Date.now();
      setServerStatus(true); 

      if (docSnap.exists()) {
        const data = docSnap.data();

        setStocks(prevStocks => {
          return data.stocks.map(serverStock => {
            const localStock = prevStocks.find(s => s.id === serverStock.id);
            const myEffect = localNewsEffects[serverStock.id];
            return {
              ...serverStock, 
              held: localStock ? localStock.held : 0, 
              avgPrice: localStock ? localStock.avgPrice : 0,
              newsEffect: myEffect
            };
          });
        });
        
        if (data.history) setStockHistory(data.history); 
        if (data.gameTime) setGameTime(data.gameTime);
        
        if (data.latestNews && data.latestNews.id !== lastProcessedNewsId.current) {
           lastProcessedNewsId.current = data.latestNews.id;
           
           if (data.newsLogs) setNews(data.newsLogs);
           else setNews(prev => [data.latestNews, ...prev].slice(0, 20));
           
           if (data.latestNews.type) {
             setScreenFlash(data.latestNews.type);
             setTimeout(() => setScreenFlash(null), 500);
             showToast(data.latestNews.text, data.latestNews.type === 'good' ? 'success' : 'error');

             const stockId = stocksRef.current.find(s => data.latestNews.text.includes(s.name))?.id;
             if (stockId) {
                 setLocalNewsEffects(prev => ({ ...prev, [stockId]: data.latestNews.type }));
                 setTimeout(() => {
                     setLocalNewsEffects(prev => {
                         const newState = { ...prev };
                         delete newState[stockId];
                         return newState;
                     });
                 }, 5000);
             }
           }
        }
      }
    }, (error) => {
       console.error("Sync Error:", error);
       setServerStatus(false);
    });
    return () => unsubscribe();
  }, [db, user, localNewsEffects]);

  // Server Heartbeat Checker
  useEffect(() => {
    const interval = setInterval(() => {
       if (Date.now() - lastServerUpdate.current > 5000) {
           setServerStatus(false);
       }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load User Data
  useEffect(() => {
    if (!user || !db) return;
    const loadUserData = async () => {
        try {
            const userDocRef = doc(db, 'artifacts', APP_ID, USER_COLLECTION, user.uid, 'data', 'profile');
            
            onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.cash) setCash(data.cash);
                    if (data.principal) setPrincipal(data.principal);
                    if (data.portfolio) {
                        setStocks(prev => prev.map(st => {
                            const sv = data.portfolio.find(p=>p.id===st.id);
                            return sv ? {...st, held: sv.held, avgPrice: sv.avgPrice} : st;
                        }));
                    }
                } else {
                    setDoc(userDocRef, { 
                      cash: INITIAL_CASH, 
                      portfolio: [], 
                      userId: user.email ? user.email.split('@')[0] : 'User',
                      totalAsset: INITIAL_CASH 
                    });
                }
                setIsDataLoaded(true);
            });

        } catch (e) { console.error("Load Error", e); }
    };
    loadUserData();
  }, [user, db]);

  // ★ [추가됨] 예약 주문 목록 동기화 (Firebase <-> Client) ★
  useEffect(() => {
    if (!user || !db) return;
    const ordersRef = collection(db, 'artifacts', APP_ID, USER_COLLECTION, user.uid, 'orders');
    return onSnapshot(ordersRef, (snapshot) => {
      const orders = [];
      snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
      // 시간순 정렬 (최신이 위로)
      orders.sort((a, b) => b.createdAt - a.createdAt);
      setPendingOrders(orders);
    });
  }, [user, db]);

  // ★ [추가됨] 예약 주문 자동 체결 감시자 (Client Side Watcher) ★
  useEffect(() => {
    if (!user || !isDataLoaded || pendingOrders.length === 0) return;

    pendingOrders.forEach(async (order) => {
      // 이미 처리 중인 주문 건너뛰기
      if (processingOrdersRef.current.has(order.id)) return;

      const currentStock = stocks.find(s => s.id === order.stockId);
      if (!currentStock) return;

      let shouldExecute = false;
      
      // 매수 예약: 현재가가 목표가보다 낮거나 같으면 체결
      if (order.type === 'buy' && currentStock.price <= order.price) {
        shouldExecute = true;
      }
      // 매도 예약: 현재가가 목표가보다 높거나 같으면 체결
      else if (order.type === 'sell' && currentStock.price >= order.price) {
        shouldExecute = true;
      }

      if (shouldExecute) {
        processingOrdersRef.current.add(order.id);
        console.log(`⚡ 예약 주문 체결 시도: ${order.stockName} ${order.price}원`);

        try {
          // 1. 서버로 거래 요청
          await executeMarketTrade(currentStock, order.type, order.amount, null, null);
          
          // 2. 성공 시 주문 삭제
          await deleteDoc(doc(db, 'artifacts', APP_ID, USER_COLLECTION, user.uid, 'orders', order.id));
          
          showToast(`예약된 ${order.stockName} 주문이 체결되었습니다!`, 'success');
        } catch (error) {
          console.error("Auto Trade Error:", error);
          // 실패 시 잠시 후 다시 시도할 수 있도록 처리 목록에서 제거
          setTimeout(() => processingOrdersRef.current.delete(order.id), 5000);
        }
      }
    });
  }, [stocks, pendingOrders, user, isDataLoaded]);


  // 랭킹 구독
  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', LEADERBOARD_COLLECTION), (s) => {
        const r = []; s.forEach(d=>r.push(d.data()));
        r.sort((a,b)=>b.totalAsset - a.totalAsset);
        setLeaderboard(r.slice(0, 50));
    });
  }, [user, db]);

  // --- Render Variables ---
  const selectedStock = stocks.find(s => s.id === selectedStockId);
  const fullHistoryData = stockHistory[selectedStockId] || [];
  const chartData = chartScale === '1m' ? fullHistoryData.slice(-RECENT_VIEW_COUNT) : fullHistoryData;

  const totalAsset = cash + stocks.reduce((acc, s) => acc + (s.price * s.held), 0);
  const profitRate = principal > 0 ? ((totalAsset - principal) / principal) * 100 : 0;
  const isPositive = profitRate >= 0;
  
  const canOpenBox = Date.now() - lastBoxTime > 60000;

  // --- Main Render ---
  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className={`flex flex-col h-screen bg-[#111111] text-white font-sans overflow-hidden select-none relative transition-colors duration-300 ${screenFlash === 'good' ? 'flash-good' : screenFlash === 'bad' ? 'flash-bad' : ''}`}>
      
      {!serverStatus && (
        <ServerWaitingScreen />
      )}
      
      {particles.map(p => <ConfettiParticle key={p.id} x={p.x} y={p.y} color={p.color} />)}
      {floatingTexts.map(ft => <FloatingText key={ft.id} x={ft.x} y={ft.y} text={ft.text} type={ft.type} />)}
      {toast && <Toast message={toast.message} type={toast.type} />}
      {showRandomBox && <RandomBoxModal onClose={() => setShowRandomBox(false)} onOpen={openRandomBox} />}

      <nav className="flex items-center justify-between px-6 py-4 bg-[#111111] z-10 border-b border-gray-800/50 mt-4 sm:mt-0">
        <div className="flex items-center gap-3">
           <span className="text-xl font-bold tracking-tight text-white">Toss Tycoon</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => canOpenBox ? setShowRandomBox(true) : showToast('아직 쿨타임 중입니다 (1분)', 'error')} className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${canOpenBox ? 'bg-[#333] border-yellow-500/50 text-yellow-400 hover:bg-[#444] animate-pulse' : 'bg-[#222] border-gray-800 text-gray-600'}`}>
            <Gift size={16} /><span className="text-xs font-bold">{canOpenBox ? '선물 받기' : '준비 중'}</span>
          </button>
          
          <div className="flex flex-col items-end mr-2 hidden sm:flex">
            <span className="text-xs text-gray-500 font-medium">총 자산</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold tracking-tight ${isPositive ? 'text-red-400' : 'text-blue-400'}`}>{Math.floor(totalAsset).toLocaleString()}원</span>
              <span className={`text-xs ${isPositive ? 'text-red-400' : 'text-blue-400'}`}>({isPositive ? '+' : ''}{profitRate.toFixed(2)}%)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#191919] px-4 py-2 rounded-full border border-gray-800 hover:bg-[#222] transition-colors cursor-pointer group relative">
            <Wallet size={16} className="text-gray-400" /><span className="text-sm font-bold text-gray-200 font-mono tracking-tight">{Math.floor(cash).toLocaleString()}원</span>
            <button onClick={handleSignOut} className="absolute right-0 top-full mt-2 bg-[#333] text-white text-xs px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 whitespace-nowrap z-50 pointer-events-none group-hover:pointer-events-auto shadow-lg"><LogOut size={12}/> 로그아웃</button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full relative">
        <aside className="w-80 hidden md:flex flex-col border-r border-gray-800/50 bg-[#111111]">
          <div className="p-5 h-full overflow-y-auto">
            <h2 className="text-gray-400 text-sm font-semibold mb-4 ml-1">관심 종목</h2>
            <div className="space-y-2">
              {stocks.map(stock => {
                const prevPrice = stockHistory[stock.id]?.[stockHistory[stock.id]?.length - 2]?.price || stock.price;
                const isUp = stock.price >= prevPrice;
                const change = prevPrice > 0 ? ((stock.price - prevPrice) / prevPrice) * 100 : 0;
                const myEffect = localNewsEffects[stock.id];
                return (
                  <div key={stock.id} onClick={() => setSelectedStockId(stock.id)} className={`p-4 rounded-[20px] cursor-pointer transition-all duration-200 border relative overflow-hidden ${selectedStockId === stock.id ? 'bg-[#202025] border-gray-700' : 'bg-transparent border-transparent hover:bg-[#202025]'} ${myEffect === 'good' ? 'effect-good' : myEffect === 'bad' ? 'effect-bad' : ''}`}>
                    {myEffect && (<div className={`absolute top-2 right-2 p-1 rounded-full ${myEffect === 'good' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}><AlertCircle size={12} className="animate-pulse" /></div>)}
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-base tracking-tight">{stock.name}</span><span className={`font-bold text-base tracking-tight ${isUp ? 'text-red-400' : 'text-blue-400'}`}>{Math.floor(stock.price).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="text-gray-500 font-medium">{stock.sector}</span><span className={`font-medium ${isUp ? 'text-red-400' : 'text-blue-400'}`}>{change > 0 ? '+' : ''}{change.toFixed(2)}%</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
          <div className="mb-4 sm:hidden flex justify-between items-end pb-4 border-b border-gray-800"><div><div className="text-gray-400 text-xs font-medium mb-1">총 자산</div><span className={`text-2xl font-bold tracking-tight ${isPositive ? 'text-red-400' : 'text-blue-400'}`}>{Math.floor(totalAsset).toLocaleString()}원</span></div><div className={`flex items-center px-2 py-1 rounded-lg text-sm font-bold ${isPositive ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>{isPositive ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}{profitRate.toFixed(2)}%</div></div>
          <div className="bg-[#202025] rounded-[32px] p-6 shadow-sm border border-gray-800/50 flex flex-col flex-1 min-h-0 relative overflow-hidden">
            <div className="flex justify-between items-start mb-4 relative z-10 pointer-events-none">
              <div>
                <div className="flex items-center gap-2 mb-1"><h1 className="text-2xl font-bold tracking-tight">{selectedStock.name}</h1><span className="text-xs font-bold text-gray-400 bg-[#333] px-2 py-1 rounded-md">{selectedStock.id}</span></div>
                <div className="flex items-center gap-2"><span className={`text-3xl font-bold tracking-tight transition-colors duration-300 ${selectedStock.trend > 0.3 ? 'text-red-400' : 'text-white'}`}>{Math.floor(selectedStock.price).toLocaleString()}원</span></div>
              </div>
              <div className="pointer-events-auto bg-[#111] p-1 rounded-lg flex border border-gray-700">
                <button onClick={() => setChartScale('1m')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${chartScale === '1m' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>1분</button>
                <button onClick={() => setChartScale('all')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${chartScale === 'all' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>전체</button>
              </div>
            </div>
            <div className="flex-1 w-full -ml-4 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={selectedStock.color} stopOpacity={0.2}/><stop offset="95%" stopColor={selectedStock.color} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} orientation="right" tick={false} width={0} />
                  <Tooltip contentStyle={{ backgroundColor: '#222', border: 'none', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', padding: '10px' }} itemStyle={{ color: '#fff', fontWeight: 'bold' }} labelStyle={{ display: 'none' }} formatter={(val) => [`${Math.floor(val).toLocaleString()}원`, '']} />
                  <Area type="monotone" dataKey="price" stroke={selectedStock.color} strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                  {selectedStock.held > 0 && (<ReferenceLine y={selectedStock.avgPrice} stroke="#888" strokeDasharray="4 4" label={{ position: 'left', value: '내 평단가', fill: '#888', fontSize: 11, fontWeight: 'bold', dy: -10 }} />)}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </main>

        <aside className="w-full md:w-[400px] bg-[#111111] border-l border-gray-800/50 flex flex-col z-20 shadow-2xl relative">
          <div className="flex p-2 gap-1 m-4 bg-[#1f1f1f] rounded-[16px]">
            {[{ id: 'trade', label: '주문', icon: DollarSign }, { id: 'orders', label: '지정가', icon: Clock }, { id: 'portfolio', label: '자산', icon: Wallet }, { id: 'news', label: '뉴스', icon: Bell }, { id: 'ranking', label: '랭킹', icon: Trophy }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-3 rounded-[12px] text-xs md:text-sm font-bold transition-all duration-200 ${activeTab === tab.id ? 'bg-[#333] text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}><tab.icon size={16} />{tab.label}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {activeTab === 'trade' && (
              <div className="flex flex-col h-full animate-fade-in">
                <div className="bg-[#202025] rounded-[32px] p-6 mb-4 border border-gray-800 shadow-sm">
                  <div className="flex justify-between mb-4"><span className="text-gray-400 font-medium text-sm">주문 방식</span><div className="flex bg-[#111111] rounded-lg p-1"><button onClick={() => setOrderMode('market')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${orderMode === 'market' ? 'bg-[#333] text-white' : 'text-gray-500'}`}>시장가</button><button onClick={() => setOrderMode('limit')} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${orderMode === 'limit' ? 'bg-[#333] text-white' : 'text-gray-500'}`}>지정가</button></div></div>
                  <div className="flex justify-between mb-6"><span className="text-gray-400 font-medium text-sm">주문 가능</span><span className="font-bold text-white tracking-tight">{Math.floor(cash).toLocaleString()}원</span></div>
                  {orderMode === 'limit' && (<div className="mb-4 animate-fade-in"><label className="text-gray-400 text-xs mb-1 block ml-1 font-medium">희망 가격</label><div className="bg-[#111111] rounded-[16px] p-4 flex items-center justify-between border border-gray-700 focus-within:border-gray-500 transition-colors"><button onClick={() => setTargetPrice(Math.max(0, targetPrice - 100))} className="p-2 text-gray-400 hover:text-white"><Minus size={18} /></button><input type="number" value={targetPrice} onChange={(e) => setTargetPrice(parseInt(e.target.value) || 0)} className="bg-transparent text-center text-xl font-bold w-full outline-none text-white font-mono" /><button onClick={() => setTargetPrice(targetPrice + 100)} className="p-2 text-gray-400 hover:text-white"><Plus size={18} /></button></div></div>)}
                  <label className="text-gray-400 text-xs mb-1 block ml-1 font-medium">주문 수량</label>
                  <div className="bg-[#111111] rounded-[16px] p-4 flex items-center justify-between mb-3 border border-gray-700 focus-within:border-gray-500 transition-colors"><button onClick={() => setTradeAmount(Math.max(1, tradeAmount - 1))} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"><Minus size={18} /></button><div className="flex flex-col items-center"><input type="number" value={tradeAmount} onChange={(e) => setTradeAmount(Math.max(1, parseInt(e.target.value) || 0))} className="bg-transparent text-center text-2xl font-bold w-24 outline-none text-white font-mono" /><span className="text-xs text-gray-500 font-medium">주</span></div><button onClick={() => setTradeAmount(tradeAmount + 1)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"><Plus size={18} /></button></div>
                  <div className="flex gap-2 mb-6"><button onClick={() => setAmountByPercent('max_buy')} className="flex-1 py-2 bg-[#222] rounded-lg text-xs font-bold text-gray-400 hover:bg-[#333] hover:text-white transition-colors">최대</button><button onClick={() => setAmountByPercent('half_sell')} className="flex-1 py-2 bg-[#222] rounded-lg text-xs font-bold text-gray-400 hover:bg-[#333] hover:text-white transition-colors">50%</button><button onClick={() => setAmountByPercent('max_sell')} className="flex-1 py-2 bg-[#222] rounded-lg text-xs font-bold text-gray-400 hover:bg-[#333] hover:text-white transition-colors">전량</button></div>
                  <div className="border-t border-gray-800 my-4"></div>
                  <div className="flex justify-between items-center mb-6"><span className="text-gray-400 text-sm font-medium">총 주문 금액</span><span className="text-xl font-bold text-white tracking-tight">{Math.floor((orderMode === 'limit' ? targetPrice : selectedStock.price) * tradeAmount).toLocaleString()}원</span></div>
                  <div className="flex gap-3"><button onClick={(e) => handleTradeClick('buy', e)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-[20px] font-bold text-lg transition-all active:scale-95 shadow-lg shadow-red-500/20">{orderMode === 'limit' ? '매수 예약' : '매수하기'}</button><button onClick={(e) => handleTradeClick('sell', e)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-[20px] font-bold text-lg transition-all active:scale-95 shadow-lg shadow-blue-500/20">{orderMode === 'limit' ? '매도 예약' : '매도하기'}</button></div>
                </div>
                {selectedStock.held > 0 && (<div className="bg-[#202025] rounded-[32px] p-5 flex justify-between items-center border border-gray-800"><span className="text-gray-400 text-sm font-medium">내 보유 수량</span><div className="text-right"><div className="text-white font-bold text-lg">{selectedStock.held}주</div><div className="text-xs text-gray-500">평단가 {Math.floor(selectedStock.avgPrice).toLocaleString()}원</div></div></div>)}
              </div>
            )}
            {activeTab === 'orders' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-between items-center mb-2 px-1"><span className="text-sm font-bold text-gray-300">미체결 내역</span><span className="text-xs text-gray-500 bg-[#222] px-2 py-1 rounded-full">{pendingOrders.length}건</span></div>
                {pendingOrders.length === 0 ? <div className="text-center py-16 text-gray-600 text-sm flex flex-col items-center gap-2"><CalendarClock className="opacity-30" size={40} /><p>대기 중인 주문이 없습니다</p></div> : pendingOrders.map(order => (
                    <div key={order.id} className="bg-[#202025] p-5 rounded-[24px] border border-gray-800 flex flex-col gap-3">
                      <div className="flex justify-between items-center"><div className="flex items-center gap-2"><span className={`text-[11px] font-bold px-2 py-1 rounded-[8px] ${order.type === 'buy' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>{order.type === 'buy' ? '매수' : '매도'}</span><span className="font-bold text-white">{order.stockName}</span></div><span className="text-xs text-gray-500 font-mono">{new Date(order.createdAt).toLocaleTimeString()}</span></div>
                      <div className="flex justify-between items-center px-1"><div className="text-sm"><span className="text-gray-400 mr-3 text-xs">목표가</span><span className="text-white font-bold">{order.price.toLocaleString()}원</span></div><div className="text-sm"><span className="text-gray-400 mr-3 text-xs">수량</span><span className="text-white font-bold">{order.amount}주</span></div></div>
                      <button onClick={() => cancelOrder(order.id)} className="w-full py-2.5 bg-[#222] hover:bg-[#333] text-gray-400 hover:text-white rounded-[12px] text-xs font-bold transition-colors">취소하기</button>
                    </div>
                ))}
              </div>
            )}
            {activeTab === 'news' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 mb-2 px-1"><Zap size={14} className="text-yellow-500" /><span className="text-sm font-bold text-gray-300">시장 뉴스</span></div>
                {news.length === 0 ? <div className="text-center py-16 text-gray-600 text-sm">뉴스를 수신 중입니다...</div> : news.map(item => (
                    <div key={item.id} className="bg-[#202025] p-4 rounded-[20px] border border-gray-800 hover:border-gray-700 transition-colors">
                      <div className="flex justify-between items-start mb-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.type === 'good' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>{item.type === 'good' ? '호재' : '악재'}</span><span className="text-xs text-gray-500 font-mono">{item.time}</span></div>
                      <p className="text-gray-200 text-sm font-medium leading-relaxed tracking-tight">{item.text}</p>
                    </div>
                ))}
              </div>
            )}
            {activeTab === 'portfolio' && (
              <div className="space-y-3 animate-fade-in">
                <div className="mb-2 px-1"><span className="text-sm font-bold text-gray-300">보유 종목</span></div>
                {stocks.filter(s => s.held > 0).length === 0 ? <div className="text-center py-16 text-gray-600 text-sm flex flex-col items-center gap-2"><Search className="opacity-30" size={40} /><p>보유 중인 주식이 없습니다</p></div> : stocks.filter(s => s.held > 0).map(s => {
                    const valuation = s.price * s.held;
                    const investment = s.avgPrice * s.held;
                    const profit = valuation - investment;
                    const profitRate = investment > 0 ? (profit / investment) * 100 : 0;
                    const isProfit = profit >= 0;
                    return (
                    <div key={s.id} className="bg-[#202025] p-4 rounded-[20px] border border-gray-800 flex justify-between items-center hover:bg-[#1f1f1f] transition-colors cursor-pointer" onClick={() => setSelectedStockId(s.id)}>
                      <div><div className="font-bold text-white mb-0.5">{s.name}</div><div className="text-xs text-gray-500">{s.held}주 보유</div></div>
                      <div className="text-right"><div className="font-bold text-white">{Math.floor(valuation).toLocaleString()}원</div><div className={`text-xs font-bold mt-1 ${isProfit ? 'text-red-400' : 'text-blue-400'}`}>{isProfit ? '+' : ''}{Math.floor(profit).toLocaleString()}원 ({profitRate.toFixed(2)}%)</div></div>
                    </div>
                )})}
              </div>
            )}
            {activeTab === 'ranking' && (
              <div className="space-y-3 animate-fade-in">
                <div className="mb-2 px-1"><span className="text-sm font-bold text-gray-300">실시간 자산 랭킹</span></div>
                {leaderboard.length === 0 ? <div className="text-center py-16 text-gray-600 text-sm">랭킹 로딩 중...</div> : leaderboard.map((ranker, index) => (
                  <div key={index} className={`bg-[#202025] p-4 rounded-[20px] border flex justify-between items-center ${ranker.userId === (user.email ? user.email.split('@')[0] : 'Guest') ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-gray-800'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-orange-700 text-white' : 'bg-gray-800 text-gray-400'}`}>{index + 1}</div>
                      <div><div className="font-bold text-white text-sm flex items-center gap-1">{ranker.userId === (user.email ? user.email.split('@')[0] : 'Guest') ? <span className="text-yellow-400">나 (User)</span> : `User ${ranker.userId}`}</div></div>
                    </div>
                    <div className="text-right font-bold text-white">{Math.floor(ranker.totalAsset).toLocaleString()}원</div>
                  </div>
                ))}
              </div>
            )}
            {/* Mobile Bottom Navigation (Visible only on small screens) */}
            <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#161616] border-t border-gray-800 flex justify-around p-2 z-50 safe-area-bottom">
               {[{ id: 'trade', label: '주문', icon: DollarSign }, { id: 'orders', label: '지정가', icon: Clock }, { id: 'portfolio', label: '자산', icon: Wallet }, { id: 'news', label: '뉴스', icon: Bell }, { id: 'ranking', label: '랭킹', icon: Trophy }].map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition-colors ${activeTab === tab.id ? 'text-white' : 'text-gray-500'}`}>
                   <tab.icon size={20} className={activeTab === tab.id ? 'mb-1 text-white' : 'mb-1'} />
                   <span className="text-[10px] font-bold">{tab.label}</span>
                 </button>
               ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StockTradingTycoon;
