require("dotenv").config()
const { app } = require("./app")

const PORT = process.env.PORT || 3000
;(async () => {
  // 앱 시작
  await app.start(PORT)
  console.log(`⚡️ 약속 일정 Slack 앱이 포트 ${PORT}에서 실행 중입니다!`)
})()

