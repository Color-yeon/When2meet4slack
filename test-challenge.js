const fetch = require("node-fetch")

async function testChallenge(url) {
  try {
    console.log(`Testing URL: ${url}`)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "url_verification",
        challenge: "test_challenge_string",
      }),
    })

    console.log("Response status:", response.status)

    const data = await response.json()
    console.log("Response data:", data)

    if (data.challenge === "test_challenge_string") {
      console.log("✅ SUCCESS: Challenge correctly echoed back!")
    } else {
      console.log("❌ FAILED: Challenge not correctly echoed back.")
    }
  } catch (error) {
    console.error("Error during test:", error)
  }
}

// 로컬 서버 테스트
testChallenge("http://localhost:3000/slack/events")
// 또는 배포된 URL 테스트
// testChallenge('https://your-vercel-app.vercel.app/slack/events');

