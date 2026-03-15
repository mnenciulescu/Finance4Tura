/**
 * Seed local DynamoDB with investment operations and portfolio snapshots
 * for userId "local-dev" (the default userId when DYNAMODB_ENDPOINT is set).
 *
 * Data sourced from Documentation/Investments_Requirement.md historical records.
 *
 * Usage:  node src/seed-investments-local.mjs
 * Requires DynamoDB Local running on http://localhost:8000
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: "http://localhost:8000", region: "eu-central-1" })
);

const USER_ID   = "local-dev";
const OPS_TABLE = "InvestmentOperations";
const SNP_TABLE = "PortfolioSnapshots";

const PLATFORM_CURRENCY = {
  "eToro":         "USD",
  "Binance":       "USD",
  "Fidelity":      "USD",
  "Tradeville":    "USD",
  "ING Funds RON": "RON",
  "ING Funds EUR": "EUR",
};

// ── Historical operations (32 deposits) ───────────────────────────────────────
const OPERATIONS = [
  { date: "2021-06-10", type: "Deposit", platform: "eToro",         amount: 210     },
  { date: "2021-10-07", type: "Deposit", platform: "eToro",         amount: 210     },
  { date: "2022-05-25", type: "Deposit", platform: "eToro",         amount: 208.74  },
  { date: "2022-06-23", type: "Deposit", platform: "eToro",         amount: 209.99  },
  { date: "2022-07-31", type: "Deposit", platform: "eToro",         amount: 201.51  },
  { date: "2022-08-25", type: "Deposit", platform: "eToro",         amount: 196.68  },
  { date: "2022-09-23", type: "Deposit", platform: "eToro",         amount: 50.94   },
  { date: "2022-09-27", type: "Deposit", platform: "eToro",         amount: 200     },
  { date: "2022-10-30", type: "Deposit", platform: "eToro",         amount: 200     },
  { date: "2022-11-29", type: "Deposit", platform: "Binance",       amount: 137.41  },
  { date: "2022-11-25", type: "Deposit", platform: "ING Funds RON", amount: 261.03  },
  { date: "2022-12-06", type: "Deposit", platform: "ING Funds RON", amount: 273     },
  { date: "2022-12-09", type: "Deposit", platform: "ING Funds RON", amount: 212     },
  { date: "2023-01-10", type: "Deposit", platform: "ING Funds RON", amount: 609     },
  { date: "2023-02-10", type: "Deposit", platform: "ING Funds RON", amount: 604.20  },
  { date: "2023-03-10", type: "Deposit", platform: "eToro",         amount: 600     },
  { date: "2023-04-10", type: "Deposit", platform: "ING Funds RON", amount: 530     },
  { date: "2023-05-10", type: "Deposit", platform: "ING Funds RON", amount: 530     },
  { date: "2023-06-10", type: "Deposit", platform: "eToro",         amount: 636.65  },
  { date: "2023-06-27", type: "Deposit", platform: "Tradeville",    amount: 1176    },
  { date: "2023-09-11", type: "Deposit", platform: "Tradeville",    amount: 525     },
  { date: "2023-10-10", type: "Deposit", platform: "eToro",         amount: 517.25  },
  { date: "2023-11-11", type: "Deposit", platform: "eToro",         amount: 522.70  },
  { date: "2023-12-08", type: "Deposit", platform: "eToro",         amount: 526.55  },
  { date: "2024-01-10", type: "Deposit", platform: "Tradeville",    amount: 525     },
  { date: "2024-03-13", type: "Deposit", platform: "Tradeville",    amount: 525     },
  { date: "2024-04-13", type: "Deposit", platform: "Tradeville",    amount: 539     },
  { date: "2024-05-10", type: "Deposit", platform: "ING Funds RON", amount: 1083    },
  { date: "2024-11-11", type: "Deposit", platform: "ING Funds RON", amount: 533     },
  { date: "2024-12-10", type: "Deposit", platform: "Tradeville",    amount: 1050    },
  { date: "2025-05-27", type: "Deposit", platform: "Fidelity",      amount: 10032   },
  { date: "2025-05-25", type: "Deposit", platform: "eToro",         amount: 5676    },
];

// ── Historical snapshots (one record per platform per date) ───────────────────
// Format: [date, platform, amount]
const SNAPSHOTS = [
  ["2022-12-06", "eToro",         1323  ],
  ["2022-12-06", "Binance",       141   ],
  ["2022-12-06", "ING Funds RON", 2573  ],
  ["2023-01-10", "eToro",         1342  ],
  ["2023-01-10", "Binance",       132   ],
  ["2023-01-10", "ING Funds RON", 6475  ],
  ["2023-02-10", "eToro",         1615  ],
  ["2023-02-10", "Binance",       164   ],
  ["2023-02-10", "ING Funds RON", 9400  ],
  ["2023-03-10", "eToro",         2087  ],
  ["2023-03-10", "Binance",       145   ],
  ["2023-03-10", "ING Funds RON", 9258  ],
  ["2023-04-10", "eToro",         2840  ],
  ["2023-04-10", "Binance",       188   ],
  ["2023-04-10", "ING Funds RON", 11718 ],
  ["2023-05-10", "eToro",         2790  ],
  ["2023-05-10", "Binance",       176   ],
  ["2023-05-10", "ING Funds RON", 14193 ],
  ["2023-06-10", "eToro",         3351  ],
  ["2023-06-10", "Binance",       156   ],
  ["2023-06-10", "ING Funds RON", 14491 ],
  ["2023-06-27", "Tradeville",    1176  ],
  ["2023-10-10", "eToro",         3941  ],
  ["2023-10-10", "Binance",       154   ],
  ["2023-10-10", "Tradeville",    1823  ],
  ["2023-10-10", "ING Funds RON", 13872 ],
  ["2023-11-11", "eToro",         5307  ],
  ["2023-11-11", "Binance",       216   ],
  ["2023-11-11", "Tradeville",    1858  ],
  ["2023-11-11", "ING Funds RON", 14045 ],
  ["2024-01-10", "eToro",         6506  ],
  ["2024-01-10", "Binance",       0     ],
  ["2024-01-10", "Tradeville",    2729  ],
  ["2024-01-10", "ING Funds RON", 15093 ],
  ["2024-03-13", "eToro",         7584  ],
  ["2024-03-13", "Tradeville",    3181  ],
  ["2024-03-13", "ING Funds RON", 16918 ],
  ["2024-04-11", "eToro",         6100  ],
  ["2024-04-11", "Tradeville",    5225  ],
  ["2024-04-11", "ING Funds RON", 14761 ],
  ["2024-04-11", "ING Funds EUR", 1981  ],
  ["2024-04-13", "Tradeville",    3717  ],
  ["2024-05-10", "eToro",         6839  ],
  ["2024-05-10", "Tradeville",    3839  ],
  ["2024-05-10", "ING Funds RON", 22398 ],
  ["2024-11-11", "eToro",         7428  ],
  ["2024-11-11", "Tradeville",    3926  ],
  ["2024-11-11", "ING Funds RON", 26490 ],
  ["2025-05-27", "eToro",         7582  ],
  ["2025-05-27", "Fidelity",      10032 ],
  ["2025-05-27", "Tradeville",    5316  ],
  ["2025-05-27", "ING Funds RON", 15648 ],
  ["2025-05-27", "ING Funds EUR", 2173  ],
  ["2025-05-25", "eToro",         13600 ],
  ["2025-05-25", "Fidelity",      10222 ],
  ["2025-05-25", "Tradeville",    5824  ],
  ["2025-05-25", "ING Funds RON", 16295 ],
  ["2025-05-25", "ING Funds EUR", 2164  ],
  ["2025-09-15", "eToro",         14547 ],
  ["2025-09-15", "Fidelity",      9535  ],
  ["2025-09-15", "Tradeville",    6332  ],
  ["2025-09-15", "ING Funds RON", 17281 ],
  ["2025-09-15", "ING Funds EUR", 2121  ],
  ["2025-12-25", "eToro",         14516 ],
  ["2025-12-25", "Fidelity",      10222 ],
  ["2025-12-25", "Tradeville",    7047  ],
  ["2025-12-25", "ING Funds RON", 18997 ],
  ["2025-12-25", "ING Funds EUR", 2103  ],
];

// ── Clear existing local-dev records ──────────────────────────────────────────

async function clearTable(table, pk) {
  const { Items = [] } = await client.send(new ScanCommand({
    TableName: table,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": USER_ID },
  }));
  for (const item of Items)
    await client.send(new DeleteCommand({ TableName: table, Key: { [pk]: item[pk] } }));
  console.log(`  Cleared ${Items.length} existing ${table} records`);
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Clearing existing local-dev investment data…");
  await clearTable(OPS_TABLE, "operationId");
  await clearTable(SNP_TABLE, "snapshotId");

  console.log("\nSeeding operations…");
  for (const op of OPERATIONS) {
    await client.send(new PutCommand({
      TableName: OPS_TABLE,
      Item: {
        operationId: randomUUID(),
        userId:   USER_ID,
        date:     op.date,
        type:     op.type,
        platform: op.platform,
        amount:   op.amount,
        currency: PLATFORM_CURRENCY[op.platform],
      },
    }));
  }
  console.log(`  ✓ ${OPERATIONS.length} operations`);

  console.log("Seeding snapshots…");
  for (const [date, platform, amount] of SNAPSHOTS) {
    await client.send(new PutCommand({
      TableName: SNP_TABLE,
      Item: {
        snapshotId: randomUUID(),
        userId:   USER_ID,
        date,
        platform,
        amount,
        currency: PLATFORM_CURRENCY[platform],
      },
    }));
  }
  console.log(`  ✓ ${SNAPSHOTS.length} snapshots`);

  console.log("\n✅ Done — investment data seeded for userId: local-dev");
}

seed().catch(e => { console.error("❌", e.message); process.exit(1); });
