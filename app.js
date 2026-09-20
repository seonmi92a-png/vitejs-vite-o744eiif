/**
 * 마중마을힐링캠프 — 예약 현황 공통 스크립트 (app.js)
 * index.html / write.html / chart.html 이 공통으로 불러다 씁니다.
 */

// 배포된 Apps Script 웹앱 주소
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw9ubUD55RTCTPPgwel25GTv9v-W6VlRBYCrl2w8wSo5Whts458N6O0Vo1NdE7MdUZweg/exec";

// 캠핑장 전체 사이트 개수 (기본값)
const TOTAL_SITES = 27;

/** 시트의 모든 기록을 가져옵니다. (최신 날짜가 먼저 옵니다) */
async function fetchRecords() {
  const res = await fetch(WEBAPP_URL);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "불러오기 실패");
  return data.records; // [{date, available, reserved, percent}, ...]
}

/** 기록 하나를 저장(같은 날짜면 덮어쓰기)합니다. CORS 회피를 위해 text/plain으로 보냅니다. */
async function saveRecord(date, available, reserved) {
  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ date, available, reserved }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "저장 실패");
  return data.saved;
}

/** 'YYYY-MM-DD' → 'MM.DD' 형태로 짧게 표시합니다. */
function shortDate(dateStr) {
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[1]}.${parts[2]}`;
}

/** 오늘 날짜를 'YYYY-MM-DD' 문자열로 돌려줍니다. */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}