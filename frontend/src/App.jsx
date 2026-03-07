import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddIncome from "./pages/AddIncome";
import AddExpense from "./pages/AddExpense";
import Statistics from "./pages/Statistics";
import Backstage from "./pages/Backstage";

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
          <Route path="/backstage" element={<Backstage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
