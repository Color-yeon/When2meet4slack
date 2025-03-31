document.addEventListener("DOMContentLoaded", () => {
  // 로그인 상태 확인
  checkLoginStatus()

  // 데모 버튼 이벤트 리스너
  const demoButton = document.getElementById("demoButton")
  if (demoButton) {
    demoButton.addEventListener("click", (e) => {
      e.preventDefault()
      alert("데모 기능은 현재 준비 중입니다.")
    })
  }

  // 로그인 폼 이벤트 리스너
  const loginForm = document.getElementById("loginForm")
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault()
      const phoneNumber = document.getElementById("phoneNumber").value

      // 전화번호 유효성 검사 (간단한 검증)
      if (phoneNumber.length < 10 || phoneNumber.length > 11 || !/^\d+$/.test(phoneNumber)) {
        alert("유효한 전화번호를 입력해주세요. (10-11자리 숫자)")
        return
      }

      // 로그인 처리
      login(phoneNumber)
    })
  }

  // 로그아웃 버튼 이벤트 리스너
  const logoutButton = document.getElementById("logoutButton")
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      logout()
    })
  }

  // 새 약속 만들기 버튼 이벤트 리스너
  const createEventButton = document.getElementById("createEventButton")
  if (createEventButton) {
    createEventButton.addEventListener("click", () => {
      // 새 약속 만들기 페이지로 이동 또는 모달 표시
      alert("새 약속 만들기 기능은 현재 준비 중입니다.")
    })
  }

  // 로그인 상태 확인 함수
  function checkLoginStatus() {
    const user = getLoggedInUser()

    // 대시보드 페이지에서만 처리
    if (window.location.pathname.includes("dashboard")) {
      const loginSection = document.getElementById("loginSection")
      const dashboardSection = document.getElementById("dashboardSection")

      if (user) {
        // 로그인 상태
        if (loginSection) loginSection.style.display = "none"
        if (dashboardSection) dashboardSection.style.display = "block"

        // 사용자 정보 표시
        const userPhoneNumber = document.getElementById("userPhoneNumber")
        if (userPhoneNumber) {
          userPhoneNumber.textContent = user.phoneNumber
        }

        // 이벤트 목록 로드
        loadEvents()
      } else {
        // 비로그인 상태
        if (loginSection) loginSection.style.display = "block"
        if (dashboardSection) dashboardSection.style.display = "none"
      }
    }
  }

  // 로그인 함수
  function login(phoneNumber) {
    // 로컬 스토리지에 사용자 정보 저장
    const user = { phoneNumber }
    localStorage.setItem("user", JSON.stringify(user))

    // 페이지 새로고침 (로그인 상태 반영)
    window.location.reload()
  }

  // 로그아웃 함수
  function logout() {
    // 로컬 스토리지에서 사용자 정보 삭제
    localStorage.removeItem("user")

    // 페이지 새로고침 (로그아웃 상태 반영)
    window.location.reload()
  }

  // 로그인한 사용자 정보 가져오기
  function getLoggedInUser() {
    try {
      const userJson = localStorage.getItem("user")
      return userJson ? JSON.parse(userJson) : null
    } catch (error) {
      console.error("사용자 정보 파싱 오류:", error)
      return null
    }
  }

  // 로컬 스토리지에서 이벤트 데이터 가져오기
  function loadEvents() {
    const eventsList = document.getElementById("eventsList")
    if (!eventsList) return

    try {
      const events = localStorage.getItem("events")
      const parsedEvents = events ? JSON.parse(events) : []

      if (parsedEvents.length === 0) {
        eventsList.innerHTML = '<p class="empty-state">아직 약속이 없습니다. 새 약속을 만들어보세요!</p>'
        return
      }

      let eventsHTML = ""
      parsedEvents.forEach((event, index) => {
        const eventDate = new Date(event.date)
        eventsHTML += `
          <div class="event-item">
            <h3>${event.title || "제목 없음"}</h3>
            <p>${event.description || "설명 없음"}</p>
            <p class="event-date">날짜: ${eventDate.toLocaleDateString()} ${eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            <button class="button small" onclick="viewEvent(${index})">상세 보기</button>
          </div>
        `
      })

      eventsList.innerHTML = eventsHTML
    } catch (error) {
      console.error("이벤트 로드 오류:", error)
      eventsList.innerHTML = '<p class="empty-state">이벤트를 불러오는 중 오류가 발생했습니다.</p>'
    }
  }

  // 이벤트 상세 보기 함수
  window.viewEvent = (index) => {
    try {
      const events = localStorage.getItem("events")
      const parsedEvents = events ? JSON.parse(events) : []

      if (parsedEvents[index]) {
        const event = parsedEvents[index]
        // 이벤트 상세 페이지로 이동 (실제 구현에서는 동적 URL 사용)
        alert(
          `이벤트 상세 정보:\n제목: ${event.title}\n설명: ${event.description}\n날짜: ${new Date(event.date).toLocaleString()}`,
        )
      }
    } catch (error) {
      console.error("이벤트 상세 정보 로드 오류:", error)
      alert("이벤트 정보를 불러오는 중 오류가 발생했습니다.")
    }
  }
})

