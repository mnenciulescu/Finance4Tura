import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({ region: "eu-central-1" });
let _apiKey = null;

async function getApiKey() {
  if (_apiKey) return _apiKey;
  // Local dev: set ANTHROPIC_API_KEY env var in samconfig or shell
  if (process.env.ANTHROPIC_API_KEY) { _apiKey = process.env.ANTHROPIC_API_KEY; return _apiKey; }
  const resp = await ssm.send(new GetParameterCommand({
    Name: "/finance4tura/anthropic-api-key",
    WithDecryption: true,
  }));
  _apiKey = resp.Parameter.Value;
  return _apiKey;
}

const CORS = {
  "Content-Type":                "application/json",
  "Cache-Control":               "no-store",
  "Access-Control-Allow-Origin": "*",
};

const ok   = body => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const fail = (code, msg) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ message: msg }) });

const ITEMS = [
  "an old fishing boat nobody wants", "a horse that has seen better days", "a alpaca with attitude problems",
  "a llama and one month of therapy for it", "a tiny vineyard in rural Romania", "a medieval sword of questionable origin",
  "a used hot tub from a divorced man", "a secondhand caravan that smells of adventure",
  "a vintage Trabant with a custom paint job", "a small piece of a Bulgarian ski resort",
  "a goat farm starter kit", "a plot of land somewhere nobody wants to live",
  "a life-size stuffed bear for the living room", "a one-way ticket to space... if you wait 30 years",
  "a broken-down sailboat with good bones", "a pony with questionable manners",
  "a genuine knight's armour from a sketchy antique dealer", "a very old Dacia with sentimental value",
  "a small lighthouse that leaks a bit", "a year of truffle hunting lessons in Périgord",
  "a retired police horse looking for a quiet life", "a professional wrestling ring, barely used",
  "a robot lawnmower and enough garden to justify it", "a taxidermied bear in formal attire",
  "a tiny island off the coast of Croatia... if you negotiate hard",
  "a certified meteorite of respectable size", "a decommissioned submarine periscope",
  "a signed painting by an artist nobody has heard of yet",
];

export const handler = async (event) => {
  const amount = parseInt(event.queryStringParameters?.amount || "0", 10);
  if (!amount || amount <= 0) return fail(400, "Missing amount");

  const apiKey = await getApiKey();
  if (!apiKey) return fail(500, "No API key configured");

  const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];

  const prompt =
    `Someone has a portfolio worth €${amount.toLocaleString("en")}. ` +
    `Write one very short funny sentence starting with "I could buy" about this specific thing: "${item}". ` +
    `The sentence should be punchy and under 15 words. ` +
    `Examples of the style: "I could buy a used hot tub from a divorced man." ` +
    `or "I could buy half of an old fishing boat from 1980." ` +
    `or "I could buy a horse that has seen better days." ` +
    `Just the sentence, nothing else.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:       "claude-haiku-4-5-20251001",
      max_tokens:  80,
      temperature: 1,
      messages:    [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) return fail(502, `Claude error: ${await resp.text()}`);

  const data     = await resp.json();
  const sentence = data.content?.[0]?.text?.trim() || "Your portfolio could buy a lot of stuff.";
  return ok({ sentence });
};
