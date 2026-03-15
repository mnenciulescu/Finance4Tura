/**
 * Seed local DynamoDB with test incomes + expenses for userId "local-dev"
 * covering 2024, 2025 (past) and 2027, 2028 (future) to test year navigation.
 *
 * Usage:  node scripts/seed-local.mjs
 * Requires Docker DynamoDB Local running on port 8000.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: "http://localhost:8000", region: "eu-central-1",
    credentials: { accessKeyId: "local", secretAccessKey: "local" } })
);

const USER_ID        = "local-dev";
const INCOMES_TABLE  = "Incomes";
const EXPENSES_TABLE = "Expenses";
const YEARS          = [2024, 2025, 2027, 2028];

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, "0"); }
function date(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

const INCOME_AMOUNTS = [5000, 5200, 5100, 5300, 5250, 5400, 5350, 5500, 5450, 5600, 5550, 5700];

const EXPENSE_TEMPLATES = [
  // [day, summary, amount, priority, special]
  [3,  "Rent",              1800, "High",   false],
  [5,  "Electricity",        180, "High",   false],
  [7,  "Groceries",          450, "Medium", false],
  [10, "Internet & Phone",   120, "Medium", false],
  [12, "Restaurant",         200, "Medium", false],
  [15, "Transport",           90, "Low",    false],
  [18, "Gym membership",      80, "Low",    false],
  [20, "Clothing",           150, "Medium", false],
  [22, "Books & Education",   60, "Low",    false],
  [25, "Entertainment",      100, "Low",    false],
];

// One special expense per quarter
const SPECIAL_TEMPLATES = [
  [2,  "Car service",        800, "High",   true],
  [5,  "Holiday trip",      1500, "Medium", true],
  [8,  "Home appliance",    1200, "High",   true],
  [11, "Christmas gifts",    600, "Medium", true],
];

// ─── clear existing local-dev records ─────────────────────────────────────────

async function clearTable(table, pkField) {
  const { Items = [] } = await client.send(new ScanCommand({
    TableName: table,
    FilterExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": USER_ID },
  }));
  for (const item of Items) {
    await client.send(new DeleteCommand({ TableName: table, Key: { [pkField]: item[pkField] } }));
  }
  console.log(`  Cleared ${Items.length} existing ${table} records for local-dev`);
}

// ─── seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Clearing existing local-dev data…");
  await clearTable(INCOMES_TABLE,  "incomeId");
  await clearTable(EXPENSES_TABLE, "expenseId");

  let totalIncomes = 0, totalExpenses = 0;

  for (const year of YEARS) {
    console.log(`\nSeeding year ${year}…`);

    // Monthly incomes
    const incomeIds = {};
    for (let m = 1; m <= 12; m++) {
      const incomeId = randomUUID();
      const incomeDate = date(year, m, 1);
      await client.send(new PutCommand({
        TableName: INCOMES_TABLE,
        Item: {
          incomeId, seriesId: incomeId,
          userId:   USER_ID,
          summary:  "Monthly Salary",
          date:     incomeDate,
          amount:   INCOME_AMOUNTS[m - 1],
          currency: "RON",
          isRepeatable: false,
        },
      }));
      incomeIds[m] = { incomeId, date: incomeDate, amount: INCOME_AMOUNTS[m - 1] };
      totalIncomes++;
    }

    // Regular monthly expenses
    for (let m = 1; m <= 12; m++) {
      const inc = incomeIds[m];
      for (const [day, summary, baseAmount, priority, special] of EXPENSE_TEMPLATES) {
        // Slight variation ±5% to make data more realistic
        const amount = Math.round(baseAmount * (0.95 + Math.random() * 0.1));
        const expenseId = randomUUID();
        await client.send(new PutCommand({
          TableName: EXPENSES_TABLE,
          Item: {
            expenseId, seriesId: expenseId,
            userId:   USER_ID,
            summary, priority, special,
            date:     date(year, m, day),
            amount,
            currency: "RON",
            status:   "Completed",
            isRepeatable: false,
            mappedIncomeId:      inc.incomeId,
            mappedIncomeSummary: "Monthly Salary",
            mappedIncomeDate:    inc.date,
          },
        }));
        totalExpenses++;
      }

      // Special expense for that quarter month
      const special = SPECIAL_TEMPLATES.find(([sm]) => sm === m);
      if (special) {
        const [, summary, amount, priority, isSpecial] = special;
        const expenseId = randomUUID();
        await client.send(new PutCommand({
          TableName: EXPENSES_TABLE,
          Item: {
            expenseId, seriesId: expenseId,
            userId:   USER_ID,
            summary, priority, special: isSpecial,
            date:     date(year, m, 14),
            amount,
            currency: "RON",
            status:   "Pending",
            isRepeatable: false,
            mappedIncomeId:      inc.incomeId,
            mappedIncomeSummary: "Monthly Salary",
            mappedIncomeDate:    inc.date,
          },
        }));
        totalExpenses++;
      }
    }

    console.log(`  ✓ ${year}: 12 incomes + ${totalExpenses - (totalIncomes - 12) * (EXPENSE_TEMPLATES.length + SPECIAL_TEMPLATES.length / 3)} expenses`);
  }

  console.log(`\n✅ Done — ${totalIncomes} incomes, ${totalExpenses} expenses across years: ${YEARS.join(", ")}`);
}

seed().catch(e => { console.error("❌", e.message); process.exit(1); });
