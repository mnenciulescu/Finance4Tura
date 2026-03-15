import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";
const c = new DynamoDBClient({ endpoint: "http://localhost:8000", region: "eu-central-1" });

const tables = [
  { name: "Incomes",              pk: "incomeId",       gsi: "date" },
  { name: "Expenses",             pk: "expenseId",      gsi: "date" },
  { name: "InvestmentOperations", pk: "operationId",    gsi: "date" },
  { name: "PortfolioSnapshots",   pk: "snapshotId",     gsi: "date" },
  { name: "SplitPayments",        pk: "splitPaymentId", gsi: null   },
  { name: "SP500Monthly",         pk: "monthId",        gsi: null   },
];

for (const t of tables) {
  try {
    const attrDefs = [{ AttributeName: t.pk, AttributeType: "S" }];
    const gsis = [];
    if (t.gsi) {
      attrDefs.push({ AttributeName: t.gsi, AttributeType: "S" });
      gsis.push({ IndexName: "date-index", KeySchema: [{ AttributeName: t.gsi, KeyType: "HASH" }], Projection: { ProjectionType: "ALL" }, ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 } });
    }
    await c.send(new CreateTableCommand({
      TableName: t.name,
      AttributeDefinitions: attrDefs,
      KeySchema: [{ AttributeName: t.pk, KeyType: "HASH" }],
      GlobalSecondaryIndexes: gsis.length ? gsis : undefined,
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }));
    console.log("Created " + t.name);
  } catch (e) {
    if (e.name === "ResourceInUseException") console.log("Already exists: " + t.name);
    else console.error("Error " + t.name + ": " + e.message);
  }
}

const r = await c.send(new ListTablesCommand({}));
console.log("Tables:", r.TableNames.join(", "));
