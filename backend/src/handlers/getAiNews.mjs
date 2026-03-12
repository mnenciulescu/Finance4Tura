const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

// Free, trustworthy, AI-focused sources — no paywalls
const SOURCES = [
  { name: "TechCrunch",     url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "VentureBeat",    url: "https://venturebeat.com/category/ai/feed/" },
  { name: "Google AI",      url: "https://blog.google/technology/ai/rss/" },
  { name: "Ars Technica",   url: "https://feeds.arstechnica.com/arstechnica/technology-lab" },
  { name: "MIT News",       url: "https://news.mit.edu/rss/topic/artificial-intelligence2" },
  { name: "AI News",        url: "https://www.artificialintelligence-news.com/feed/" },
  { name: "KDnuggets",      url: "https://www.kdnuggets.com/feed" },
  { name: "InfoQ AI",       url: "https://feed.infoq.com/artificial-intelligence" },
  { name: "CNET AI",        url: "https://www.cnet.com/rss/ai/" },
  { name: "The Next Web",   url: "https://thenextweb.com/feed/" },
  { name: "Science Daily",  url: "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml" },
  { name: "ZDNet AI",       url: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml" },
];

// ── Parsing helpers ────────────────────────────────────────────────────────────

function extractTag(block, tag) {
  const escaped = tag.replace(":", "\\:");
  const re = new RegExp(
    `<${escaped}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${escaped}>`,
    "i"
  );
  const m = block.match(re);
  return m ? (m[1] ?? m[2] ?? "").trim() : "";
}

function extractAtomLink(block) {
  const m = block.match(/<link[^>]+href="([^"]+)"/i);
  return m ? m[1].trim() : "";
}

function decodeEntities(str) {
  return str
    // Numeric decimal entities first: &#8216; → '
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Numeric hex entities: &#x2019; → '
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Named entities
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&[a-z]+;/gi, " ");
}

function stripHtml(str) {
  return decodeEntities(
    str
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

// Extract the first N complete sentences as a natural summary
function extractSentences(text, maxSentences = 3, maxChars = 500) {
  const clean = stripHtml(text).replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[A-Z][^.!?]{15,}[.!?]+/g) ?? [];
  const joined = sentences.slice(0, maxSentences).join(" ").trim();
  if (!joined) return clean.length > maxChars ? clean.slice(0, maxChars).trimEnd() + "…" : clean;
  return joined.length > maxChars ? joined.slice(0, maxChars).trimEnd() + "…" : joined;
}

function parseItems(xml, sourceName) {
  const rssBlocks  = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)];
  const atomBlocks = rssBlocks.length === 0
    ? [...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)]
    : [];
  const blocks = rssBlocks.length > 0 ? rssBlocks : atomBlocks;

  const items = [];
  for (const m of blocks) {
    const block   = m[1];
    const title   = stripHtml(extractTag(block, "title"));
    const link    = extractTag(block, "link") || extractAtomLink(block);
    // Prefer full article content (content:encoded) over snippet (description)
    const content = extractTag(block, "content:encoded")
                 || extractTag(block, "description")
                 || extractTag(block, "summary")
                 || extractTag(block, "content");
    const pubDate = extractTag(block, "pubDate")
                 || extractTag(block, "published")
                 || extractTag(block, "updated");

    if (!title || !link || !link.startsWith("http")) continue;

    items.push({
      title,
      _content: content,   // raw, used for summarization
      link,
      pubDate: pubDate ? new Date(pubDate).toISOString() : null,
      source: sourceName,
    });
  }
  return items;
}

// ── Network ────────────────────────────────────────────────────────────────────

function fetchWithTimeout(url, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function fetchSource({ name, url }) {
  const res = await fetchWithTimeout(url, 8000, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Finance4Tura/1.0)" },
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const xml = await res.text();
  return parseItems(xml, name);
}

// ── Summarisation ──────────────────────────────────────────────────────────────

async function summarise(rawContent) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const text   = stripHtml(rawContent).replace(/\s+/g, " ").trim();

  if (!apiKey || text.length < 80) {
    return extractSentences(text, 3, 500);
  }

  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", 8000, {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 160,
        messages: [{
          role:    "user",
          content: `Summarise this AI news article in 2–3 concise sentences. Cover the main announcement or finding, who is involved, and why it matters. Do not start with "This article".\n\n${text.slice(0, 2500)}`,
        }],
      }),
    });

    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? extractSentences(text, 3, 500);
  } catch {
    return extractSentences(text, 3, 500);
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export const handler = async () => {
  try {
    const fetches = await Promise.allSettled(SOURCES.map(fetchSource));

    const failed = fetches
      .filter(r => r.status === "rejected")
      .map(r => r.reason?.message ?? "unknown");

    const candidates = fetches
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value)
      .sort((a, b) => (b.pubDate ?? "").localeCompare(a.pubDate ?? ""))
      .slice(0, 10);

    // Summarise all 10 in parallel
    const summaries = await Promise.allSettled(
      candidates.map(a => summarise(a._content))
    );

    const articles = candidates.map((a, i) => ({
      title:   a.title,
      summary: summaries[i].status === "fulfilled" ? summaries[i].value : extractSentences(a._content, 3, 500),
      link:    a.link,
      pubDate: a.pubDate,
      source:  a.source,
    }));

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
