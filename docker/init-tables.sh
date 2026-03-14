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

echo "Done. Tables:"
aws dynamodb list-tables --endpoint-url "$ENDPOINT"
