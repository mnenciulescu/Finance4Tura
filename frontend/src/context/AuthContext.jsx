import { createContext, useContext } from "react";

// Phase 9: Replace with real AWS Cognito / IAM Identity Center integration.
const STUB_USER = {
  id: "local-dev-user",
  name: "Tura",
  email: "tura@finance4tura.local",
};

const AuthContext = createContext({ user: STUB_USER, isAuthenticated: true });

export const AuthProvider = ({ children }) => (
  <AuthContext.Provider value={{ user: STUB_USER, isAuthenticated: true }}>
    {children}
  </AuthContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
