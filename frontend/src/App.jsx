import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { YearProvider } from "./context/YearContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddIncome from "./pages/AddIncome";
import AddExpense from "./pages/AddExpense";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";
import Backstage from "./pages/Backstage";
import SplitPayment from "./pages/SplitPayment";

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Login />;
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add-income" element={<AddIncome />} />
          <Route path="/add-expense" element={<AddExpense />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/backstage" element={<Backstage />} />
          <Route path="/split-payments" element={<SplitPayment />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <YearProvider>
        <AppRoutes />
      </YearProvider>
    </AuthProvider>
  );
}
