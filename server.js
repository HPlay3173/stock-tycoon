require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
// ★ 중요: Render가 주는 포트를 사용하거나 없으면 5000번 사용
const port = process.env.PORT || 5000;

// 1. CORS 설정: 모든 주소(origin)에서의 요청 허용
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Preflight(예비 요청) 처리: '*' 대신 정규식 /(.*)/ 사용
app.options(/(.*)/, cors());

app.use(express.json());

// --- 1. Firebase 설정 (환경 변수 지원 방식) ---
try {
  let serviceAccount;
  
  // Render 배포 환경: 환경 변수(FIREBASE_KEY)에 들어있는 JSON 문자열을 파싱
  if (process.env.FIREBASE_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  } else {
    // 로컬 개발 환경: 파일에서 직접 로드
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin SDK 로드 성공");
} catch (error) {
  console.error("❌ Firebase 설정 오류:", error.message);
  // 서버가 죽지 않도록 에러 처리만 함
}

const db = admin.firestore();
const MARKET_COLLECTION = 'market_final';
const USER_COLLECTION = 'users_final';
const LEADERBOARD_COLLECTION = 'leaderboard_final';

// 2. Gemma 설정 (창의성 옵션 추가)
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// ★ 창의성(temperature)을 높여서 뻔한 대답 방지 ★
const model = genAI.getGenerativeModel({ 
    model: "gemma-3-12b-it",
    generationConfig: {
        temperature: 1.2, // 숫자가 높을수록 창의적이고 다양한 뉴스 생성 (기본값 0.7)
        topP: 0.95,
        maxOutputTokens: 200,
    }
});

// 3. 백업 뉴스 (서버 비상용)
const BACKUP_NEWS = [
    { headline: "시장 참여자들 '관망세' 지속... 거래량 급감", type: "bad" },
    { headline: "외국인 투자자 대량 매수세 유입, 지수 상승 견인", type: "good" },
    { headline: "금융당국, 공매도 전면 금지 조치 연장 검토", type: "good" },
    { headline: "주요 경제 지표 악화로 경기 침체 우려 확산", type: "bad" },
];

// ★ 뉴스 다양성을 위한 랜덤 키워드 ★
const NEWS_THEMES = [
    "CEO의 파격적인 발표", "경쟁사의 치명적인 실수", "예상을 뒤엎는 깜짝 실적", 
    "정부의 강력한 규제 발표", "해외 대형 계약 체결", "대규모 유상증자 소문", 
    "핵심 기술 유출 의혹", "M&A(인수합병) 설", "신제품 조기 출시", 
    "노조 파업 리스크", "원자재 가격 폭등", "초대형 수주 잭팟"
];

// 4. 서버 내부 상태
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

  // 뉴스 생성 (25초마다 40% 확률)
  if (serverState.gameTime % 25 === 0 && Math.random() < 0.4) {
    await generateServerNews();
  }

  await db.collection('artifacts').doc('stock-tycoon-a5444').collection('public').doc('data')
    .collection(MARKET_COLLECTION).doc('main').set({
      stocks: serverState.stocks,
      gameTime: serverState.gameTime,
      latestNews: serverState.latestNews,
      newsLogs: serverState.newsLogs,
      history: serverState.history,
      lastUpdated: Date.now()
    });

}, 1000);

// --- 다양해진 뉴스 생성 함수 ---
async function generateServerNews() {
  const target = serverState.stocks[Math.floor(Math.random() * serverState.stocks.length)];
  const theme = NEWS_THEMES[Math.floor(Math.random() * NEWS_THEMES.length)]; // 랜덤 주제 뽑기
  let newsData = null;

  try {
    if (apiKey) {
        const prompt = `
          역할: 자극적인 경제 신문 헤드라인 작가
          종목: ${target.name} (${target.sector})
          이번 기사 테마: "${theme}"
          
          지시사항:
          1. 위 테마를 바탕으로 ${target.name}의 주가에 영향을 줄 만한 짧고 강렬한 헤드라인을 한 줄 만드세요.
          2. 테마가 긍정적이면 type: "good", 부정적이면 type: "bad"로 판단하세요.
          3. 답변은 오직 JSON 형식만 출력하세요. 설명 금지.
          
          형식:
          { "headline": "헤드라인 내용", "type": "good" 또는 "bad" }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, "").trim();
        newsData = JSON.parse(text);
        
        console.log(`🤖 Gemma News [${theme}]:`, newsData.headline);
    } else {
        throw new Error("API 키 없음");
    }

  } catch (e) {
    console.log(`⚠️ 뉴스 생성 오류 -> 백업 사용`);
    const backup = BACKUP_NEWS[Math.floor(Math.random() * BACKUP_NEWS.length)];
    newsData = {
        headline: `${target.name}, ${backup.headline}`,
        type: backup.type
    };
  }

  if (newsData) {
      // 뉴스 강도에 따라 주가 반영 (호재면 5% 상승, 악재면 5% 하락)
      const effect = newsData.type === 'good' ? 1.05 : 0.95;
      serverState.stocks = serverState.stocks.map(s => 
        s.id === target.id ? { ...s, price: s.price * effect } : s
      );

      const newsItem = {
        id: Date.now(),
        text: `[${target.name}] ${newsData.headline}`, // 종목명 강조
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

  const userRef = db.collection('artifacts').doc('stock-tycoon-a5444').collection(USER_COLLECTION).doc(uid).collection('data').doc('profile');
  const lbRef = db.collection('artifacts').doc('stock-tycoon-a5444').collection('public').doc('data').collection(LEADERBOARD_COLLECTION).doc(uid);

  try {
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

      return { newCash, portfolio };
    });

    res.json({ success: true, msg: "거래 성공" });
  } catch (e) {
    res.status(400).json({ success: false, msg: typeof e === 'string' ? e : "거래 오류" });
  }
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});