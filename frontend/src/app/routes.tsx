import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { AppShell } from "./AppShell";
import { ADMIN_USER } from "./navigation";
import { FormsProvider, useForms } from "../features/money/forms/FormsContext";
import Today from "../features/today/Today";
import { ScreenSkeleton } from "../ui/Display";

// Every screen but Today loads on first visit (proposal §12.6 bundle budget).
const Budget = lazy(() => import("../features/money/budget/Budget"));
const SplitScreen = lazy(() => import("../features/money/split/SplitScreen"));
const StatsScreen = lazy(() => import("../features/money/stats/StatsScreen"));
const InvestScreen = lazy(() => import("../features/money/invest/InvestScreen"));
const Library = lazy(() => import("../features/library/Library"));
const HqScreen = lazy(() => import("../features/hq/HqScreen"));
const HqSettings = lazy(() => import("../features/hq/HqSettings"));
const Settings = lazy(() => import("../features/account/settings/Settings"));
const Backstage = lazy(() => import("../features/account/backstage/Backstage"));
const Admin = lazy(() => import("../features/account/admin/Admin"));

const Loading = () => <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 100px)" }}><ScreenSkeleton blocks={3} /></div>;

/**
 * Deep links to the expense / income sheets (and the pre-redesign
 * /add-expense, /add-income URLs) land on Budget with the sheet open.
 */
function OpenForm({ kind }: { kind: "expense" | "income" }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { openExpense, openIncome } = useForms();
  const editId = id && id !== "new" ? id : params.get("id") ?? undefined;
  const date = params.get("date") ?? undefined;
  useEffect(() => {
    if (kind === "expense") openExpense({ id: editId, date });
    else openIncome({ id: editId });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Navigate to="/money" replace />;
}

/** Old routes redirect, preserving query strings (proposal Appendix B). */
function Legacy({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export function AppRoutes() {
  const { user } = useAuth();
  const { settings } = useAppSettings();

  return (
    <FormsProvider>
      <AppShell>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Today />} />

          <Route path="/money" element={<Budget />} />
          <Route path="/money/split" element={<SplitScreen />} />
          <Route path="/money/stats" element={<StatsScreen />} />
          <Route path="/money/invest" element={<InvestScreen />} />
          <Route path="/money/expense/:id" element={<OpenForm kind="expense" />} />
          <Route path="/money/income/:id" element={<OpenForm kind="income" />} />

          <Route path="/library" element={<Library />} />

          <Route path="/hq" element={<HqScreen />} />
          <Route path="/hq/settings" element={<HqSettings />} />
          <Route path="/hq/:locationId" element={<HqScreen />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="/backstage" element={settings.backstageEnabled ? <Backstage /> : <Navigate to="/" replace />} />
          <Route path="/admin" element={user?.username === ADMIN_USER ? <Admin /> : <Navigate to="/" replace />} />

          {/* Pre-redesign URLs */}
          <Route path="/finance" element={<Legacy to="/money" />} />
          <Route path="/add-expense" element={<OpenForm kind="expense" />} />
          <Route path="/add-income" element={<OpenForm kind="income" />} />
          <Route path="/split-payments" element={<Legacy to="/money/split" />} />
          <Route path="/statistics" element={<Legacy to="/money/stats" />} />
          <Route path="/investments" element={<Legacy to="/money/invest" />} />
          <Route path="/books-and-dev" element={<Legacy to="/library" />} />
          <Route path="/headquarters" element={<Legacy to="/hq" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AppShell>
    </FormsProvider>
  );
}
