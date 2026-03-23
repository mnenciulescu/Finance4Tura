const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const FEEDS = {
  googleNews: "https://news.google.com/rss/search?q=artificial+intelligence+AI+machine+learning&hl=en-US&gl=US&ceid=US:en",
  techReview: "https://www.technologyreview.com/feed/",
};

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`, "i");
  const m = xml.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function parseItems(xml, defaultSource) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const raw  = extractTag(block, "title");
    const link = extractTag(block, "link") || block.match(/<link>([^<]+)<\/link>/i)?.[1]?.trim() || "";
    const pub  = extractTag(block, "pubDate");

    let title = raw;
    let source = defaultSource || "";

    // Google News format: "Article headline - Source Name"
    if (!defaultSource) {
      const dashIdx = raw.lastIndexOf(" - ");
      title  = dashIdx !== -1 ? raw.slice(0, dashIdx).trim() : raw;
      source = dashIdx !== -1 ? raw.slice(dashIdx + 3).trim() : "";
    }

    const date = pub ? new Date(pub).toISOString().slice(0, 10) : "";
    items.push({ title, source, link, date });
  }
  return items;
}

async function fetchFeed(url, defaultSource) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed responded ${res.status}`);
  const xml = await res.text();
  return parseItems(xml, defaultSource);
}

export async function handler() {
  try {
    const [googleNews, techReview] = await Promise.all([
      fetchFeed(FEEDS.googleNews, null),
      fetchFeed(FEEDS.techReview, "MIT Technology Review"),
    ]);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ googleNews, techReview }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ message: e.message }) };
  }
}
