// check.js
require('dotenv').config();

// Node.js 18 이상에서는 fetch가 내장되어 있습니다.
// API 키를 사용해 직접 모델 목록을 물어보는 코드입니다.
async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("오류: .env 파일에 키가 없습니다.");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    console.log("모델 목록을 조회 중입니다...");
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.error("API 에러:", data.error.message);
    } else if (data.models) {
      console.log("=== 사용 가능한 모델 이름 목록 ===");
      data.models.forEach(m => {
          // 'models/gemini-pro' -> 'gemini-pro' 형태로 출력
          console.log(m.name.replace("models/", ""));
      });
    } else {
      console.log("알 수 없는 응답:", data);
    }
  } catch (error) {
    console.error("연결 실패:", error);
  }
}

checkModels();