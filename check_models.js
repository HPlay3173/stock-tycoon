require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("=== 사용 가능한 모델 목록 ===");
      data.models.forEach(m => {
        // Gemma나 Gemini가 포함된 모델만 출력
        if (m.name.includes('gem')) {
            console.log(`- ${m.name.replace('models/', '')} (지원 기능: ${m.supportedGenerationMethods.join(', ')})`);
        }
      });
    } else {
      console.log("모델 목록을 가져올 수 없습니다:", data);
    }
  } catch (error) {
    console.error("에러 발생:", error);
  }
}

listModels();