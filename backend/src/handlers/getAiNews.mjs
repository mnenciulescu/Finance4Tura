const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const FEED_URL = "https://news.google.com/rss/search?q=artificial+intelligence+AI+machine+learning&hl=en-US&gl=US&ceid=US:en";

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`, "i");
  const m = xml.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const raw  = extractTag(block, "title");
    const link = extractTag(block, "link") || block.match(/<link>([^<]+)<\/link>/i)?.[1]?.trim() || "";
    const pub  = extractTag(block, "pubDate");

    // title format from Google News: "Article headline - Source Name"
    const dashIdx = raw.lastIndexOf(" - ");
    const title  = dashIdx !== -1 ? raw.slice(0, dashIdx).trim() : raw;
    const source = dashIdx !== -1 ? raw.slice(dashIdx + 3).trim() : "";

    const date = pub ? new Date(pub).toISOString().slice(0, 10) : "";
    items.push({ title, source, link, date });
  }
  return items;
}

export async function handler() {
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const xml = await res.text();
    const items = parseItems(xml);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(items) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ message: e.message }) };
  }
}
