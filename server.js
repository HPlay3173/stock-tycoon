require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 5000;

// ★ CORS 설정 (모든 요청 허용)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === 'OPTIONS') return res.status(200).send();
  next();
});

app.use(express.json());

// --- 2. Firebase 설정 ---
try {
  let serviceAccount;
  if (process.env.FIREBASE_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin SDK 로드 성공");
} catch (error) {
  console.error("❌ Firebase 설정 오류:", error.message);
}

const db = admin.firestore();
const MARKET_COLLECTION = 'market_final';
const USER_COLLECTION = 'users_final';
const LEADERBOARD_COLLECTION = 'leaderboard_final';

// --- 3. Gemini 설정 ---
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// 모델 설정 (사용자 요청: gemma-3-12b 사용)
const model = genAI.getGenerativeModel({ 
    model: "gemma-3-12b-it"
});

// 백업 뉴스
const BACKUP_NEWS = [
    { headline: "반도체 업황 개선 기대감에 외국인 매수세 유입", type: "good" },
    { headline: "금리 인상 우려로 투자 심리 위축", type: "bad" },
    { headline: "주요 기술주 실적 발표 앞두고 관망세", type: "bad" },
    { headline: "신규 AI 기술 발표로 관련주 급등", type: "good" },
    { headline: "글로벌 공급망 차질 우려 심화", type: "bad" },
    { headline: "전기차 판매량 역대 최고치 경신", type: "good" }
];

// --- 4. 서버 상태 관리 ---
let serverState = {
  stocks: [
    { id: 'SAMS', name: '삼성전자', price: 72000, volatility: 0.012, sector: '반도체' },
    { id: 'KAKO', name: '카카오', price: 54000, volatility: 0.020, sector: '플랫폼' },
    { id: 'HYUN', name: '현대차', price: 198000, volatility: 0.015, sector: '자동차' },
    { id: 'ECOP', name: '에코프로', price: 850000, volatility: 0.035, sector: '2차전지' },
    { id: 'BTC', name: '비트코인', price: 45000000, volatility: 0.050, sector: '가상화폐' },
  ],
  newsLogs: [],
  latestNews: null,
  gameTime: 0,
  history: {}
};

// --- 게임 루프 ---
setInterval(async () => {
  serverState.stocks = serverState.stocks.map(stock => {
    const changePercent = (Math.random() - 0.5) * stock.volatility * 2;
    let newPrice = stock.price * (1 + changePercent);
    newPrice = Math.max(100, newPrice);
    
    if (!serverState.history[stock.id]) serverState.history[stock.id] = [];
    serverState.history[stock.id].push({ time: serverState.gameTime, price: newPrice });
    if (serverState.history[stock.id].length > 60) serverState.history[stock.id].shift();

    return { ...stock, price: newPrice };
  });

  serverState.gameTime++;

  // 25초마다 40% 확률로 뉴스 생성 시도
  if (serverState.gameTime % 25 === 0 && Math.random() < 0.4) {
    await generateServerNews();
  }

  // Firebase DB 업데이트
  try {
      await db.collection('artifacts').doc('stock-tycoon-a5444').collection('public').doc('data')
        .collection(MARKET_COLLECTION).doc('main').set({
          stocks: serverState.stocks,
          gameTime: serverState.gameTime,
          latestNews: serverState.latestNews,
          newsLogs: serverState.newsLogs,
          history: serverState.history,
          lastUpdated: Date.now()
        });
  } catch (e) {
      console.error("DB Write Error:", e.message);
  }

}, 1000);

// --- 뉴스 생성 함수 ---
async function generateServerNews() {
  const target = serverState.stocks[Math.floor(Math.random() * serverState.stocks.length)];
  let newsData = null;

  try {
    if (apiKey) {
        // Gemma 모델을 위한 강력한 프롬프트
        const prompt = `
          주식 시장 뉴스 속보를 생성하라.
          대상: ${target.name} (${target.sector})
          상황: 호재 또는 악재 중 하나를 랜덤하게 선택.
          
          [제약 사항]
          1. 반드시 유효한 JSON 형식으로만 응답하라.
          2. 설명이나 잡담은 일절 금지한다.
          
          [JSON 형식]
          {
            "headline": "기사 제목 (한글, 30자 이내)",
            "type": "good" 또는 "bad"
          }
        `;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // JSON 추출 로직 (Gemma가 앞뒤에 잡담을 붙여도 처리 가능하도록)
        const jsonMatch = text.match(/\{[\s\S]*\}/); 
        
        if (!jsonMatch) {
            console.error("Raw Output:", text);
            throw new Error("JSON 형식을 찾을 수 없음");
        }
        
        newsData = JSON.parse(jsonMatch[0]);
        console.log(`🤖 AI News (${target.name}):`, newsData.headline);
    } else {
        throw new Error("API 키 없음");
    }
  } catch (e) {
    console.error(`⚠️ 뉴스 생성 실패 (${e.message}) -> 백업 사용`);
    const backup = BACKUP_NEWS[Math.floor(Math.random() * BACKUP_NEWS.length)];
    newsData = {
        headline: `${target.name}, ${backup.headline}`,
        type: backup.type
    };
  }

  if (newsData) {
      const effect = newsData.type === 'good' ? 1.05 : 0.95;
      serverState.stocks = serverState.stocks.map(s => 
        s.id === target.id ? { ...s, price: s.price * effect } : s
      );

      const newsItem = {
        id: Date.now(),
        text: `[속보] ${newsData.headline}`,
        type: newsData.type,
        time: new Date().toLocaleTimeString('ko-KR')
      };
      
      serverState.latestNews = newsItem;
      serverState.newsLogs = [newsItem, ...serverState.newsLogs].slice(0, 20);
  }
}

// --- 거래 API ---
app.post('/api/trade', async (req, res) => {
  const { uid, stockId, type, amount } = req.body;
  if (!uid || !stockId || amount <= 0) return res.status(400).json({ success: false, msg: "잘못된 요청" });

  try {
    const userRef = db.collection('artifacts').doc('stock-tycoon-a5444').collection(USER_COLLECTION).doc(uid).collection('data').doc('profile');
    const lbRef = db.collection('artifacts').doc('stock-tycoon-a5444').collection('public').doc('data').collection(LEADERBOARD_COLLECTION).doc(uid);

    await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw "유저 정보 없음";

      const userData = userDoc.data();
      const currentStock = serverState.stocks.find(s => s.id === stockId);
      const currentPrice = currentStock.price;
      const totalCost = currentPrice * amount;

      let newCash = userData.cash || 0;
      let portfolio = userData.portfolio || [];
      let myStock = portfolio.find(p => p.id === stockId) || { id: stockId, held: 0, avgPrice: 0 };

      if (type === 'buy') {
        if (newCash < totalCost) throw "잔액 부족";
        newCash -= totalCost;
        const newHeld = myStock.held + amount;
        myStock.avgPrice = ((myStock.avgPrice * myStock.held) + totalCost) / newHeld;
        myStock.held = newHeld;
      } else if (type === 'sell') {
        if (myStock.held < amount) throw "보유 주식 부족";
        newCash += totalCost;
        myStock.held -= amount;
        if (myStock.held === 0) myStock.avgPrice = 0;
      }

      portfolio = portfolio.filter(p => p.id !== stockId);
      if (myStock.held > 0) portfolio.push(myStock);

      let totalAsset = newCash;
      portfolio.forEach(p => {
        const liveStock = serverState.stocks.find(s => s.id === p.id);
        if(liveStock) totalAsset += (liveStock.price * p.held);
      });

      t.set(userRef, { cash: newCash, portfolio, totalAsset, updatedAt: Date.now() }, { merge: true });
      t.set(lbRef, { userId: userData.userId || 'User', totalAsset, updatedAt: Date.now() });
    });

    res.json({ success: true, msg: "거래 성공" });
  } catch (e) {
    console.error("Trade Error:", e);
    res.status(400).json({ success: false, msg: typeof e === 'string' ? e : "거래 처리 중 오류 발생" });
  }
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: 포트 ${port}`);
});
