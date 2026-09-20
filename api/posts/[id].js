/**
 * /api/posts/[id]
 * GET → 게시글 상세보기 (Notion 페이지 하나를 id로 조회)
 *
 * 파일명 [id].js 의 대괄호는 Vercel이 자동으로 인식하는 "동적 경로" 문법이에요.
 * 예: /api/posts/1a2b3c... 로 요청하면 req.query.id 에 "1a2b3c..."가 들어옵니다.
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2022-06-28";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "지원하지 않는 요청 방식이에요." });
  }

  if (!NOTION_API_KEY) {
    return res.status(500).json({ ok: false, error: "서버에 NOTION_API_KEY 환경변수가 설정되지 않았어요." });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ ok: false, error: "게시글 id가 없어요." });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: data.message || "게시글을 찾지 못했어요." });
    }

    const post = {
      id: data.id,
      title: getTitle(data, "제목"),
      author: getRichText(data, "작성자"),
      date: getDate(data, "작성일"),
      content: getRichText(data, "내용"),
    };

    return res.status(200).json({ ok: true, post });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "서버 오류가 발생했어요." });
  }
}

function getTitle(page, propName) {
  const prop = page.properties[propName];
  if (!prop || !prop.title || !prop.title.length) return "";
  return prop.title.map((t) => t.plain_text).join("");
}

function getRichText(page, propName) {
  const prop = page.properties[propName];
  if (!prop || !prop.rich_text || !prop.rich_text.length) return "";
  return prop.rich_text.map((t) => t.plain_text).join("");
}

function getDate(page, propName) {
  const prop = page.properties[propName];
  if (!prop || !prop.date) return "";
  return prop.date.start || "";
}