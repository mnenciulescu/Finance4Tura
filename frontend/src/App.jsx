import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { YearProvider } from "./context/YearContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import HomeOverview from "./pages/HomeOverview";
import useIsMobile from "./hooks/useIsMobile";

function HomePage() {
  const isMobile = useIsMobile();
  return isMobile ? <Dashboard /> : <HomeOverview />;
}
import AddIncome from "./pages/AddIncome";
import AddExpense from "./pages/AddExpense";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";
import Backstage from "./pages/Backstage";
import SplitPayment from "./pages/SplitPayment";
import Investments from "./pages/Investments";
import Admin from "./pages/Admin";
import AiNews from "./pages/AiNews";
import PracticeTests from "./pages/PracticeTests";
import BooksAndDev from "./pages/BooksAndDev";

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  return (
    <BrowserRouter>
      <Layout>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/finance" element={<Dashboard />} />
          <Route path="/add-income" element={<AddIncome />} />
          <Route path="/add-expense" element={<AddExpense />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/backstage" element={<Backstage />} />
          <Route path="/split-payments" element={<SplitPayment />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/admin" element={user?.username === "nenciulescu" ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="/ai-news" element={<AiNews />} />
          <Route path="/practice-tests" element={<PracticeTests />} />
          <Route path="/books-and-dev" element={<BooksAndDev />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppSettingsProvider>
      <AuthProvider>
        <YearProvider>
          <AppRoutes />
        </YearProvider>
      </AuthProvider>
    </AppSettingsProvider>
  );
}
