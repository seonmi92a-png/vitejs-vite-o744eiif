/**
 * board-api.js
 * 브라우저(HTML) 쪽에서 게시판 서버리스 함수를 호출하는 공통 함수 모음.
 * 기존 Google Apps Script fetch 호출부를 이 함수들로 바꿔서 쓰시면 됩니다.
 *
 * API 토큰은 이 파일에 전혀 없습니다 — 실제 Notion 호출은 /api 폴더(서버)에서만 일어나요.
 */

/** 게시글 목록을 최신순으로 가져옵니다. */
async function fetchPostList() {
    const res = await fetch("/api/posts");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "목록을 불러오지 못했어요.");
    return data.posts; // [{ id, title, author, date }, ...]
  }
  
  /** 게시글 하나의 상세 내용을 id로 가져옵니다. */
  async function fetchPostDetail(id) {
    const res = await fetch(`/api/posts/${id}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "게시글을 불러오지 못했어요.");
    return data.post; // { id, title, author, date, content }
  }
  
  /** 새 게시글을 작성(저장)합니다. */
  async function createPost(title, author, content) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author, content }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "저장하지 못했어요.");
    return data.id;
  }
  
  /* ----- 사용 예시 (기존 화면 코드에서 이런 식으로 불러다 쓰면 됩니다) -----
  
  // 목록 화면
  fetchPostList()
    .then(posts => { /* 화면에 목록 그리기 */ })
    .catch(err => alert(err.message));
  
  // 상세 화면 (예: ?id=xxxx 로 접속했을 때)
  const params = new URLSearchParams(location.search);
  fetchPostDetail(params.get("id"))
    .then(post => { /* 화면에 제목/작성자/작성일/내용 채우기 */ })
    .catch(err => alert(err.message));
  
  // 글쓰기 화면 (저장 버튼 클릭 시)
  createPost(titleInput.value, authorInput.value, contentInput.value)
    .then(() => { location.href = "list.html"; })
    .catch(err => alert(err.message));
  
  ------------------------------------------------------------------- */