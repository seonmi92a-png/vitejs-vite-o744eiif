/**
 * /api/posts
 * GET  → 게시글 목록 불러오기 (Notion 데이터베이스 조회, 작성일 최신순)
 * POST → 새 게시글 저장하기 (Notion 데이터베이스에 새 페이지 추가)
 *
 * 이 파일은 브라우저가 아니라 Vercel 서버에서만 실행됩니다.
 * 그래서 NOTION_API_KEY가 브라우저 쪽 코드에 절대 노출되지 않습니다.
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_VERSION = "2022-06-28";

export default async function handler(req, res) {
  // 어느 도메인에서든 이 API를 호출할 수 있게 허용 (필요 없으면 지워도 됩니다)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    return res.status(500).json({ ok: false, error: "서버에 NOTION_API_KEY / NOTION_DATABASE_ID 환경변수가 설정되지 않았어요." });
  }

  try {
    if (req.method === "GET") {
      return await listPosts(res);
    }
    if (req.method === "POST") {
      return await createPost(req, res);
    }
    return res.status(405).json({ ok: false, error: "지원하지 않는 요청 방식이에요." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "서버 오류가 발생했어요." });
  }
}

/** Notion 데이터베이스를 조회해서 게시글 목록(제목/작성자/작성일)을 최신순으로 돌려줍니다. */
async function listPosts(res) {
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sorts: [{ property: "작성일", direction: "descending" }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({ ok: false, error: data.message || "목록을 불러오지 못했어요." });
  }

  const posts = data.results.map((page) => ({
    id: page.id,
    title: getTitle(page, "제목"),
    author: getRichText(page, "작성자"),
    date: getDate(page, "작성일"),
  }));

  return res.status(200).json({ ok: true, posts });
}

/** 새 게시글을 Notion 데이터베이스에 한 페이지(행)로 추가합니다. */
async function createPost(req, res) {
  const { title, author, content } = req.body || {};

  if (!title || !author) {
    return res.status(400).json({ ok: false, error: "제목과 작성자는 꼭 입력해야 해요." });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        "제목": { title: [{ text: { content: String(title).slice(0, 2000) } }] },
        "작성자": { rich_text: [{ text: { content: String(author).slice(0, 2000) } }] },
        "작성일": { date: { start: today } },
        "내용": { rich_text: [{ text: { content: String(content || "").slice(0, 2000) } }] },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({ ok: false, error: data.message || "저장하지 못했어요." });
  }

  return res.status(200).json({ ok: true, id: data.id });
}

/** Notion page 응답에서 title 속성 값을 꺼냅니다. */
function getTitle(page, propName) {
  const prop = page.properties[propName];
  if (!prop || !prop.title || !prop.title.length) return "";
  return prop.title.map((t) => t.plain_text).join("");
}

/** Notion page 응답에서 rich_text 속성 값을 꺼냅니다. */
function getRichText(page, propName) {
  const prop = page.properties[propName];
  if (!prop || !prop.rich_text || !prop.rich_text.length) return "";
  return prop.rich_text.map((t) => t.plain_text).join("");
}

/** Notion page 응답에서 date 속성 값을 꺼냅니다. */
function getDate(page, propName) {
  const prop = page.properties[propName];
  if (!prop || !prop.date) return "";
  return prop.date.start || "";
}