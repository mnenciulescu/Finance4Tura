#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="http://localhost:8000"

create_table_if_missing() {
  local table_name="$1"
  local create_args="$2"

  if aws dynamodb describe-table --table-name "$table_name" --endpoint-url "$ENDPOINT" &>/dev/null; then
    echo "Table '$table_name' already exists — skipping."
  else
    echo "Creating table '$table_name'..."
    eval "aws dynamodb create-table $create_args --endpoint-url $ENDPOINT"
    echo "Table '$table_name' created."
  fi
}

# Incomes table
create_table_if_missing "Incomes" \
  "--table-name Incomes \
   --attribute-definitions AttributeName=incomeId,AttributeType=S AttributeName=date,AttributeType=S \
   --key-schema AttributeName=incomeId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"date-index\",
       \"KeySchema\": [{\"AttributeName\": \"date\", \"KeyType\": \"HASH\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# Expenses table
create_table_if_missing "Expenses" \
  "--table-name Expenses \
   --attribute-definitions AttributeName=expenseId,AttributeType=S AttributeName=date,AttributeType=S \
   --key-schema AttributeName=expenseId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"date-index\",
       \"KeySchema\": [{\"AttributeName\": \"date\", \"KeyType\": \"HASH\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# InvestmentOperations table
create_table_if_missing "InvestmentOperations" \
  "--table-name InvestmentOperations \
   --attribute-definitions AttributeName=operationId,AttributeType=S AttributeName=date,AttributeType=S \
   --key-schema AttributeName=operationId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"date-index\",
       \"KeySchema\": [{\"AttributeName\": \"date\", \"KeyType\": \"HASH\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# PortfolioSnapshots table
create_table_if_missing "PortfolioSnapshots" \
  "--table-name PortfolioSnapshots \
   --attribute-definitions AttributeName=snapshotId,AttributeType=S AttributeName=date,AttributeType=S \
   --key-schema AttributeName=snapshotId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"date-index\",
       \"KeySchema\": [{\"AttributeName\": \"date\", \"KeyType\": \"HASH\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# SplitPayments table
create_table_if_missing "SplitPayments" \
  "--table-name SplitPayments \
   --attribute-definitions AttributeName=splitPaymentId,AttributeType=S \
   --key-schema AttributeName=splitPaymentId,KeyType=HASH \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# SP500Monthly table (shared reference data, no userId)
create_table_if_missing "SP500Monthly" \
  "--table-name SP500Monthly \
   --attribute-definitions AttributeName=monthId,AttributeType=S \
   --key-schema AttributeName=monthId,KeyType=HASH \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# TestTemplates table
create_table_if_missing "TestTemplates" \
  "--table-name TestTemplates \
   --attribute-definitions AttributeName=templateId,AttributeType=S AttributeName=userId,AttributeType=S AttributeName=createdAt,AttributeType=S \
   --key-schema AttributeName=templateId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"userId-createdAt-index\",
       \"KeySchema\": [{\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},{\"AttributeName\": \"createdAt\", \"KeyType\": \"RANGE\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# TestResults table
create_table_if_missing "TestResults" \
  "--table-name TestResults \
   --attribute-definitions AttributeName=resultId,AttributeType=S AttributeName=userId,AttributeType=S AttributeName=date,AttributeType=S \
   --key-schema AttributeName=resultId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"userId-date-index\",
       \"KeySchema\": [{\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},{\"AttributeName\": \"date\", \"KeyType\": \"RANGE\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# KidConfig table
create_table_if_missing "KidConfig" \
  "--table-name KidConfig \
   --attribute-definitions AttributeName=userId,AttributeType=S \
   --key-schema AttributeName=userId,KeyType=HASH \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# Books_and_Dev table
create_table_if_missing "Books_and_Dev" \
  "--table-name Books_and_Dev \
   --attribute-definitions AttributeName=bookId,AttributeType=S \
   --key-schema AttributeName=bookId,KeyType=HASH \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# AppSettings table
create_table_if_missing "AppSettings" \
  "--table-name AppSettings \
   --attribute-definitions AttributeName=settingKey,AttributeType=S \
   --key-schema AttributeName=settingKey,KeyType=HASH \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# FxRates table (shared reference data, no userId; single item rateId="global")
create_table_if_missing "FxRates" \
  "--table-name FxRates \
   --attribute-definitions AttributeName=rateId,AttributeType=S \
   --key-schema AttributeName=rateId,KeyType=HASH \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# HQ_Locations table
create_table_if_missing "HQ_Locations" \
  "--table-name HQ_Locations \
   --attribute-definitions AttributeName=hqId,AttributeType=S AttributeName=userId,AttributeType=S \
   --key-schema AttributeName=hqId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"userId-index\",
       \"KeySchema\": [{\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# HQ_Templates table
create_table_if_missing "HQ_Templates" \
  "--table-name HQ_Templates \
   --attribute-definitions AttributeName=templateId,AttributeType=S AttributeName=userId,AttributeType=S AttributeName=hqId,AttributeType=S \
   --key-schema AttributeName=templateId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"userId-hqId-index\",
       \"KeySchema\": [{\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},{\"AttributeName\": \"hqId\", \"KeyType\": \"RANGE\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

# HQ_Entries table
create_table_if_missing "HQ_Entries" \
  "--table-name HQ_Entries \
   --attribute-definitions AttributeName=entryId,AttributeType=S AttributeName=templateId,AttributeType=S AttributeName=date,AttributeType=S \
   --key-schema AttributeName=entryId,KeyType=HASH \
   --global-secondary-indexes '[
     {
       \"IndexName\": \"templateId-date-index\",
       \"KeySchema\": [{\"AttributeName\": \"templateId\", \"KeyType\": \"HASH\"},{\"AttributeName\": \"date\", \"KeyType\": \"RANGE\"}],
       \"Projection\": {\"ProjectionType\": \"ALL\"},
       \"ProvisionedThroughput\": {\"ReadCapacityUnits\": 5, \"WriteCapacityUnits\": 5}
     }
   ]' \
   --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5"

echo "Done. Tables:"
aws dynamodb list-tables --endpoint-url "$ENDPOINT"
