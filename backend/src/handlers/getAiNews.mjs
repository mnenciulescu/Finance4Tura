const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const SOURCES = [
  { name: "The Verge",       url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml" },
  { name: "TechCrunch",      url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { name: "VentureBeat",     url: "https://venturebeat.com/category/ai/feed/" },
  { name: "Wired",           url: "https://www.wired.com/feed/tag/ai/latest/rss" },
  { name: "Google AI",       url: "https://blog.google/technology/ai/rss/" },
];

function extractTag(block, tag) {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`,
    "i"
  );
  const m = block.match(re);
  return m ? (m[1] ?? m[2] ?? "").trim() : "";
}

function extractAtomLink(block) {
  const m = block.match(/<link[^>]+href="([^"]+)"/i);
  return m ? m[1].trim() : "";
}

function stripHtml(str) {
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(str, max = 500) {
  const s = stripHtml(str);
  return s.length > max ? s.slice(0, max).trimEnd() + "…" : s;
}

function parseItems(xml, sourceName) {
  // Support RSS 2.0 (<item>) and Atom (<entry>)
  const rssBlocks  = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)];
  const atomBlocks = rssBlocks.length === 0
    ? [...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)]
    : [];
  const blocks = rssBlocks.length > 0 ? rssBlocks : atomBlocks;

  const items = [];
  for (const m of blocks) {
    const block = m[1];
    const title = stripHtml(extractTag(block, "title"));
    const link  = extractTag(block, "link") || extractAtomLink(block);
    const desc  = extractTag(block, "description")
               || extractTag(block, "summary")
               || extractTag(block, "content");
    const pubDate = extractTag(block, "pubDate")
                 || extractTag(block, "published")
                 || extractTag(block, "updated");

    if (!title || !link || !link.startsWith("http")) continue;

    items.push({
      title,
      summary: truncate(desc, 220),
      link,
      pubDate: pubDate ? new Date(pubDate).toISOString() : null,
      source: sourceName,
    });
  }
  return items;
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Finance4Tura/1.0)" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function fetchSource({ name, url }) {
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const xml = await res.text();
  return parseItems(xml, name);
}

export const handler = async () => {
  try {
    const results = await Promise.allSettled(SOURCES.map(fetchSource));

    const failed = results
      .filter(r => r.status === "rejected")
      .map(r => r.reason?.message ?? "unknown");

    const articles = results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value)
      .sort((a, b) => (b.pubDate ?? "").localeCompare(a.pubDate ?? ""))
      .slice(0, 15);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ articles, failed }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
