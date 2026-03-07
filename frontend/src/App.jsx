import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AddIncome from "./pages/AddIncome";
import AddExpense from "./pages/AddExpense";
import Statistics from "./pages/Statistics";
import Backstage from "./pages/Backstage";

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
