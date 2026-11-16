// Portfolio v2 — the price-lookup agent. One Claude request per asset with
// web search / web fetch; the model reports the price through the
// `report_price` tool and never does arithmetic.
export const DEFAULT_MODEL = "claude-opus-5-5";
export const DEFAULT_MAX_SEARCHES = 15;
/** Upper bound for the Admin setting and for the deeper second pass. */
export const MAX_SEARCHES_LIMIT = 30;

export const SYSTEM_PROMPT = `You look up the latest published price of one financial instrument for a personal portfolio tracker. Finding a recent price matters: an asset without a price leaves the portfolio total incomplete, so be persistent and try several sources before giving up.

Acceptable sources:
- "official": the issuer or fund house (daily NAV / price-history pages), the exchange where the instrument is listed (for example Euronext, NYSE / NYSE Arca, Nasdaq, London Stock Exchange, Xetra, Borsa Italiana, Bucharest Stock Exchange), the fund's distributor in the investor's country (for example the bank selling the fund), or a regulator / official fund registry (for example Fundsquare, the Luxembourg Stock Exchange).
- "secondary": established financial data providers with a dated price page: Financial Times markets data, Morningstar, Reuters, Bloomberg, justETF, Boerse Frankfurt, Investing.com, Yahoo Finance, CoinMarketCap / CoinGecko for crypto.
- Never blogs, forums, social media, or numbers without a date.

How to search (your budget of searches and page fetches is limited, so spend it well):
- If the request lists pages where the price was found before, fetch those first: they usually show the newest price and cost no search.
- Prefer fetching a page you can predict (see the URL patterns below) over a search. Fetches are cheaper and more plentiful than searches.
- Make each search precise (ISIN plus "NAV" or "price"); never repeat a search with similar words.
- Stop as soon as you have a dated price from an acceptable source that is from the last few business days. Keep looking only while a newer price is likely to exist.
- Keep the best price found so far. If the budget runs out, report it; an older confirmed price is far better than none.
- Identify the instrument by ISIN first, then symbol and name. Search the ISIN on its own as well as with words like "NAV", "price", "quote".
- Monthly factsheets and KIDs are usually weeks old. Do not stop at a factsheet: look for the daily NAV or the price history.
- Fetch pages directly when you can guess them, e.g. the Financial Times tearsheet https://markets.ft.com/data/funds/tearsheet/summary?s=<ISIN>:<CURRENCY> (funds) or https://markets.ft.com/data/etfs/tearsheet/summary?s=<SYMBOL>:<EXCHANGE>:<CURRENCY>, Morningstar or justETF pages found by ISIN, or the issuer's product page.
- Mutual funds: the fund house page for that share class (ISIN), then Fundsquare / FT / Morningstar, then the distributor bank's fund price page. Romanian-distributed share classes (RON) are often listed on the distributor's and the fund house's Romanian sites.
- ETFs: the exchange page for the listing, the issuer's NAV for that share class, then justETF / FT / Boerse Frankfurt. A UCITS ETF's issuer NAV for the same ISIN in the requested currency is acceptable when the exchange page cannot be read; say so in comments.
- Stocks: the listing exchange, then FT / Reuters / Investing.com.
- If a page cannot be read, try another source instead of giving up.

Rules:
- The share class / listing must match the requested currency. If the only price you can confirm is in another currency, report that currency exactly as published; do not convert it.
- Report the most recent published price (closing price, NAV, or spot price for crypto) and the date it is valid for, exactly as the source states them. Prefer the newest date across all sources you found.
- For every source, include the exact text from the page where the price appears.
- Do not calculate, convert, estimate or round anything. Report numbers exactly as published, as plain decimals with "." as the decimal separator.
- An older price is still a confirmed price: if the newest price you can confirm is weeks old, report it with found=true and its real date. Use found=false only when no acceptable source shows any price at all, with a short reason listing what you tried.

When you are done, call the report_price tool exactly once. Do not write any other final answer.`;

/** The tool the agent reports through (strict: inputs always match the schema). */
export const REPORT_TOOL = {
  name: "report_price",
  description: "Report the latest confirmed price of the instrument, or that none was found. Call exactly once, at the end.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["found", "unitPrice", "currency", "priceDate", "priceType", "sources", "confidence", "comments", "reasonIfNotFound"],
    properties: {
      found: { type: "boolean", description: "true when a confirmed price was found" },
      unitPrice: { type: ["number", "null"], description: "Price of one unit, exactly as published" },
      currency: { type: ["string", "null"], description: "ISO 4217 code of the published price" },
      priceDate: { type: ["string", "null"], description: "Date the price is valid for, YYYY-MM-DD" },
      priceType: { type: ["string", "null"], description: "close, nav or spot" },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["url", "title", "publisher", "quote"],
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            publisher: { type: "string" },
            quote: { type: "string", description: "Exact text on the page where the price appears" },
          },
        },
      },
      confidence: { type: ["string", "null"], description: "official (issuer, fund house, exchange, regulator) or secondary (reputable site naming the official source)" },
      comments: { type: ["string", "null"], description: "Short note, e.g. publication delay" },
      reasonIfNotFound: { type: ["string", "null"] },
    },
  },
};

const TYPE_LABEL = { MutualFund: "mutual fund", ETF: "ETF", Stock: "stock", Crypto: "cryptocurrency", Bond: "bond", Other: "instrument" };

export function buildUserPrompt(asset, last, today, hint = null, budget = searchBudget(DEFAULT_MAX_SEARCHES)) {
  const lines = [
    `Instrument: ${asset.name}`,
    `Type: ${TYPE_LABEL[asset.type] ?? asset.type}`,
    asset.isin ? `ISIN: ${asset.isin}` : null,
    asset.symbol ? `Symbol / ticker: ${asset.symbol}` : null,
    `Held on platform: ${asset.platform}`,
    `Requested price currency: ${asset.currency}`,
    asset.preferredSources?.length ? `Preferred sources to try first: ${asset.preferredSources.join(", ")}` : null,
    last ? `Last recorded price: ${last.unitPrice} ${last.currency} for ${last.latestPriceDate}. Only a later price, or the same date confirmed again, is useful.` : "No price has been recorded before.",
    last?.sources?.length ? `Pages where the price was found before (fetch these first): ${last.sources.map(s => s.url).filter(Boolean).slice(0, 3).join(" , ")}` : null,
    `Budget: up to ${budget.searches} web searches and ${budget.fetches} page fetches.`,
    `Today is ${today}.`,
    hint ? `\nA previous search was not good enough: ${hint}\nSearch more thoroughly this time: use different sources (see the list in your instructions), fetch the daily NAV / price-history pages directly, and prefer the most recent date.` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Runs the lookup. `client` is an Anthropic SDK client (injected for tests).
 * Returns { result, usage } or throws on API errors / refusals.
 */
/** Page fetches are cheap and save searches, so they get twice the budget. */
export const searchBudget = (maxSearches) => ({ searches: maxSearches, fetches: Math.min(2 * maxSearches, 2 * MAX_SEARCHES_LIMIT) });

export async function lookupPrice({ client, asset, last, model = DEFAULT_MODEL, maxSearches = DEFAULT_MAX_SEARCHES, effort = "medium", hint = null, now = new Date() }) {
  const budget = searchBudget(maxSearches);
  const messages = [{ role: "user", content: buildUserPrompt(asset, last, now.toISOString().slice(0, 10), hint, budget) }];
  const usage = { inputTokens: 0, outputTokens: 0, webSearches: 0 };
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: budget.searches },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: budget.fetches },
    REPORT_TOOL,
  ];

  for (let turn = 0; turn < 6; turn++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });
    usage.inputTokens += response.usage?.input_tokens ?? 0;
    usage.outputTokens += response.usage?.output_tokens ?? 0;
    usage.webSearches += response.usage?.server_tool_use?.web_search_requests ?? 0;

    if (response.stop_reason === "refusal") {
      const why = response.stop_details?.explanation || response.stop_details?.category || "declined";
      throw new AgentError(`The AI model declined the request (${why})`);
    }

    const report = response.content.find(b => b.type === "tool_use" && b.name === "report_price");
    if (report) {
      if (response.stop_reason === "max_tokens") throw new AgentError("The AI answer was cut off; try again");
      return { result: report.input, usage };
    }

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "max_tokens") throw new AgentError("The AI answer was cut off; try again");

    // Ended without reporting: ask once more for the report, then give up.
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: "Call the report_price tool now with what you found (found=false if nothing was confirmed)." });
  }
  throw new AgentError("The AI agent did not report a result");
}

export class AgentError extends Error {}

/** A short, user-facing message for any error from a lookup. */
export function describeError(e) {
  if (e instanceof AgentError) return e.message;
  const status = e?.status;
  if (status === 401) return "The AI key was rejected — check it in Admin → App Settings";
  if (status === 429) return "AI rate limit reached — retry in a minute";
  if (status === 529 || status === 503) return "The AI service is overloaded — retry later";
  if (status >= 400 && status < 500) return `The AI request was rejected (${status}): ${String(e?.error?.error?.message ?? e?.message ?? "").slice(0, 200)}`;
  if (e?.name === "APIConnectionTimeoutError" || /timed? ?out/i.test(String(e?.message))) return "The AI lookup timed out";
  return `Lookup failed: ${String(e?.message ?? e).slice(0, 200)}`;
}
