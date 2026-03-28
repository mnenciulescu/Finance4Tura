/**
 * Seeds HQ data (Politehnicii / Water consumption) from apa.xlsx
 * into a target DynamoDB endpoint.
 *
 * Usage:
 *   node src/seed-hq-apa-local.mjs            # local DynamoDB
 *   node src/seed-hq-apa-local.mjs --aws       # real AWS
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const isAws = process.argv.includes("--aws");

const client = new DynamoDBClient(
  isAws
    ? { region: "eu-central-1" }
    : { region: "us-east-1", endpoint: "http://localhost:8000" }
);
const doc = DynamoDBDocumentClient.from(client);

const LOCATIONS_TABLE = "HQ_Locations";
const TEMPLATES_TABLE = "HQ_Templates";
const ENTRIES_TABLE   = "HQ_Entries";

// ── Known IDs (from AWS; reuse same IDs locally so data is consistent) ────────

const USER_ID     = "e3c47852-9051-7092-9877-6b4e5186bc40";
const HQ_ID       = "08fa40f2-39d3-4601-971a-4f7c98c2947a";
const TEMPLATE_ID = "3600e43b-fd62-40c5-b722-01cde1e0d458";

const PARAMS = {
  "Baie - Apa Rece":      "f3809d5c-a51d-4ccd-b3ce-f0b14fc1696e",
  "Baie - Apa Calda":     "47372f18-7458-4493-9bca-2ec3525f9ba9",
  "Bucatarie - Apa Rece": "b07eaff1-55d7-492f-b997-daf145bf889a",
  "Bucatarie - Apa Calda":"1e704892-6a0a-45f9-ba0f-26eefdd61cf4",
  "Comments":             "e5f2d0c4-f5e8-4d1e-ac0b-c26b25a4049a",
};

// ── Raw data from apa.xlsx ────────────────────────────────────────────────────

const rows = [
  ["2015-02-01", 175.48,  128.24,  65.67,  102.84],
  ["2015-03-07", 180.54,  133.507, 66.71,  104.407],
  ["2016-02-01", 228.69,  174.08,  83.852, 117.285],
  ["2016-03-01", 233.47,  178.25,  84.83,  118.45],
  ["2016-04-01", 239.28,  182.96,  86.18,  120.24],
  ["2016-04-29", 243.98,  186.54,  87.13,  121.3],
  ["2016-06-02", 249.031, 190.309, 88.114, 122.341],
  ["2016-07-03", 252.08,  192.224, 88.72,  122.92],
  ["2016-08-04", 258.22,  194.69,  89.99,  123.35],
  ["2016-09-11", 263.02,  196.92,  91.05,  123.89],
  ["2016-10-03", 266.4,   199,     91.7,   124.3],
  ["2016-11-03", 271.54,  203.42,  92.87,  125.78],
  ["2017-01-02", 281.4,   212.1,   95.1,   130],
  ["2017-03-29", 296.43,  226.31,  97.77,  137.05],
  ["2017-05-01", 301.26,  230.55,  98.59,  139.02],
  ["2017-06-01", 307.64,  236.39,  99.88,  141.16],
  ["2017-09-03", 328,     247,     104.75, 146.6],
  ["2017-10-01", 336,     253,     107,    149],
  ["2017-11-03", 343,     261,     108,    152],
  ["2017-12-03", 351,     267,     109,    154],
  ["2018-01-06", 358,     274,     111,    157],
  ["2018-02-10", 366,     282,     112,    161],
  ["2018-03-07", 371,     288,     113,    163],
  ["2018-04-10", 379,     295,     115,    166],
  ["2018-06-03", 390,     303,     116,    169],
  ["2018-07-01", 400,     310,     118,    172],
  ["2018-08-05", 410,     317,     120,    175],
  ["2018-09-02", 420,     324,     122,    178],
  ["2018-11-01", 429,     327,     126,    178],
  ["2018-12-02", 436,     333,     127,    178],
  ["2019-01-03", 443,     339,     129,    181],
  ["2021-05-03", 586,     466,     165,    204],
  ["2021-06-01", 591,     471,     167,    205],
  ["2021-07-01", 598,     476,     169,    206],
  ["2021-07-31", 604,     481,     170,    207],
  ["2021-09-02", 609,     483,     172,    207],
  ["2021-10-05", 615,     489,     174,    208],
  ["2022-01-31", 632,     506,     178,    213],
  ["2022-03-01", 637,     510,     180,    214],
  ["2022-05-01", 646,     518,     182,    216],
  ["2022-11-01", 678,     536,     189,    221],
  ["2023-03-01", 711,     551,     191,    228],
  ["2023-03-31", 722,     555,     193,    230],
  ["2023-06-05", 743,     562,     194,    233],
  ["2023-10-02", 779,     569,     197,    235],
  ["2024-03-01", 817,     585,     201,    246],
  ["2024-04-01", 831,     588,     203,    247],
  ["2025-02-02", 889,     614,     213,    265],
  ["2025-03-31", 897,     620,     215,    269],
  ["2025-12-01", 926,     640,     224,    276],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function tableHasItem(TableName, key) {
  const res = await doc.send(new ScanCommand({
    TableName,
    FilterExpression: Object.keys(key).map(k => `#${k} = :${k}`).join(" AND "),
    ExpressionAttributeNames: Object.fromEntries(Object.keys(key).map(k => [`#${k}`, k])),
    ExpressionAttributeValues: Object.fromEntries(Object.keys(key).map(k => [`:${k}`, key[k]])),
    Limit: 1,
  }));
  return (res.Items?.length ?? 0) > 0;
}

async function put(TableName, Item) {
  await doc.send(new PutCommand({ TableName, Item }));
}

// ── Seed ──────────────────────────────────────────────────────────────────────

console.log(`\nTarget: ${isAws ? "AWS eu-central-1" : "local DynamoDB"}\n`);

// 1. Location
const locationExists = await tableHasItem(LOCATIONS_TABLE, { hqId: HQ_ID });
if (locationExists) {
  console.log("✓ Location 'Politehnicii' already exists — skipping");
} else {
  await put(LOCATIONS_TABLE, {
    hqId: HQ_ID,
    userId: USER_ID,
    name: "Politehnicii",
    address: "Str. Politehnicii, Nr. 4, Bl. 1, Sc. 6, Ap. 68, Sector 6, Bucuresti",
    order: 1,
    createdAt: "2026-03-26T11:20:55.509Z",
  });
  console.log("✓ Created location 'Politehnicii'");
}

// 2. Template
const templateExists = await tableHasItem(TEMPLATES_TABLE, { templateId: TEMPLATE_ID });
if (templateExists) {
  console.log("✓ Template 'Water consumption' already exists — skipping");
} else {
  await put(TEMPLATES_TABLE, {
    templateId: TEMPLATE_ID,
    userId: USER_ID,
    hqId: HQ_ID,
    name: "Water consumption",
    parameters: [
      { parameterId: PARAMS["Baie - Apa Rece"],      title: "Baie - Apa Rece",       type: "number", unit: "", order: 0 },
      { parameterId: PARAMS["Baie - Apa Calda"],     title: "Baie - Apa Calda",      type: "number", unit: "", order: 1 },
      { parameterId: PARAMS["Bucatarie - Apa Rece"], title: "Bucatarie  - Apa Rece", type: "number", unit: "", order: 2 },
      { parameterId: PARAMS["Bucatarie - Apa Calda"],title: "Bucatarie  - Apa Calda",type: "number", unit: "", order: 3 },
      { parameterId: PARAMS["Comments"],             title: "Comments",              type: "number", unit: "", order: 4 },
    ],
    createdAt: "2026-03-26T11:30:44.278Z",
    updatedAt: "2026-03-26T11:30:44.278Z",
  });
  console.log("✓ Created template 'Water consumption'");
}

// 3. Entries
console.log(`\nImporting ${rows.length} entries...`);
let created = 0;
const now = new Date().toISOString();

for (const [date, baieRece, baieCalda, bucRece, bucCalda] of rows) {
  const entryId = randomUUID();
  await put(ENTRIES_TABLE, {
    entryId,
    userId: USER_ID,
    templateId: TEMPLATE_ID,
    hqId: HQ_ID,
    date,
    values: [
      { parameterId: PARAMS["Baie - Apa Rece"],       title: "Baie - Apa Rece",       value: baieRece },
      { parameterId: PARAMS["Baie - Apa Calda"],      title: "Baie - Apa Calda",      value: baieCalda },
      { parameterId: PARAMS["Bucatarie - Apa Rece"],  title: "Bucatarie  - Apa Rece", value: bucRece },
      { parameterId: PARAMS["Bucatarie - Apa Calda"], title: "Bucatarie  - Apa Calda",value: bucCalda },
      { parameterId: PARAMS["Comments"],              title: "Comments",              value: null },
    ],
    notes: "",
    createdAt: now,
    updatedAt: now,
  });
  created++;
  process.stdout.write(`\r  ${created}/${rows.length}`);
}

console.log(`\n\n✓ Done — ${created} entries imported.\n`);
