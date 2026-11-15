import { useState } from "react";
import { ActionSheet, useToast } from "../../../ui";
import { IncomeDeleteSheet } from "../forms/IncomeSheet";
import { useDeleteExpense, useDeleteIncome } from "../../../data/mutations";
import type { Expense, Income } from "../../../types";

/**
 * Expense and income deletes with their confirmations, shared by Budget and
 * One-Page. Render `dialogs` once; call `requestDelete(exp, confirmed)` —
 * `confirmed` when a two-step button already asked — or `requestIncomeDelete`.
 * Series members always ask *This occurrence / Entire series*.
 */
export function useBudgetDeletes() {
  const delExpense = useDeleteExpense();
  const delIncome = useDeleteIncome();
  const toast = useToast();
  const [pendingSeriesDelete, setPendingSeriesDelete] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);

  const runDelete = (exp: Expense, series: boolean) => {
    setPendingSeriesDelete(null);
    setPendingDelete(null);
    delExpense.mutate({ exp, series }, {
      onError: () => toast.show({ message: "Could not delete the expense.", tone: "negative" }),
    });
    toast.show({ message: series ? "Series deleted" : "Expense deleted", icon: "trash" });
  };

  const requestDelete = (exp: Expense, confirmed: boolean) => {
    if (exp.isRepeatable) { setPendingSeriesDelete(exp); return; }
    if (!confirmed) { setPendingDelete(exp); return; }
    runDelete(exp, false);
  };

  const dialogs = (
    <>
      <ActionSheet
        isOpen={!!pendingSeriesDelete}
        onClose={() => setPendingSeriesDelete(null)}
        title={`“${pendingSeriesDelete?.summary}” is part of a recurring series`}
        message="What would you like to delete?"
        actions={[
          { label: "Delete This Occurrence", destructive: true, onAction: () => pendingSeriesDelete && runDelete(pendingSeriesDelete, false) },
          { label: "Delete Entire Series", destructive: true, onAction: () => pendingSeriesDelete && runDelete(pendingSeriesDelete, true) },
        ]}
      />
      <ActionSheet
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title={`Delete “${pendingDelete?.summary}”?`}
        message="This cannot be undone."
        actions={[{ label: "Delete Expense", destructive: true, onAction: () => pendingDelete && runDelete(pendingDelete, false) }]}
      />
      <IncomeDeleteSheet
        income={incomeToDelete}
        onClose={() => setIncomeToDelete(null)}
        onDelete={series => {
          const inc = incomeToDelete;
          setIncomeToDelete(null);
          if (!inc) return;
          delIncome.deleteIncome(inc, series);
          toast.show({ message: series ? "Income series deleted" : "Income deleted", icon: "trash" });
        }}
      />
    </>
  );

  return { requestDelete, requestIncomeDelete: setIncomeToDelete, dialogs };
}
