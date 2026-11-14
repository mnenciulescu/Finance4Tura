import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";
import { setAuthToken, setUnauthorizedHandler } from "../api/client";

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId:   import.meta.env.VITE_COGNITO_CLIENT_ID,
});

export interface AuthUser { username: string; isAdmin: boolean; }

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<unknown>;
  signOut: () => void;
  signInWithGoogle: (googleIdToken: string) => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>(null as unknown as AuthContextValue);

// Decode the cognito:groups claim from a JWT ID token
function decodeIsAdmin(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    const groups  = payload["cognito:groups"] ?? [];
    return Array.isArray(groups) ? groups.includes("admin") : groups === "admin";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- no stored session: done loading
    if (!cognitoUser) { setLoading(false); return; }
    cognitoUser.getSession((err: Error | null, session: any) => {
      if (!err && session.isValid()) {
        const jwt = session.getIdToken().getJwtToken();
        setUser({ username: cognitoUser.getUsername(), isAdmin: decodeIsAdmin(jwt) });
        setAuthToken(jwt);
      }
      setLoading(false);
    });
  }, []);

  const signIn = (username: string, password: string) => new Promise<void>((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        const jwt = session.getIdToken().getJwtToken();
        setUser({ username: cognitoUser.getUsername(), isAdmin: decodeIsAdmin(jwt) });
        setAuthToken(jwt);
        resolve();
      },
      onFailure: reject,
    });
  });

  const signUp = (username: string, password: string) => new Promise<unknown>((resolve, reject) => {
    userPool.signUp(username, password, [], [], (error, result) => {
      if (error) { reject(error); return; }
      resolve(result);
    });
  });

  // Verify the current user's password without changing app state
  const verifyPassword = (password: string) => new Promise<boolean>((resolve, reject) => {
    if (!user) { reject(new Error("Not signed in")); return; }
    const cognitoUser = new CognitoUser({ Username: user.username, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: user.username, Password: password });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: () => resolve(true),
      onFailure:  reject,
    });
  });

  const signInWithGoogle = async (googleIdToken: string) => {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/google`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken: googleIdToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Google sign-in failed");
    setUser({ username: data.username, isAdmin: decodeIsAdmin(data.idToken) });
    setAuthToken(data.idToken);
  };

  const signOut = () => {
    userPool.getCurrentUser()?.signOut();
    setUser(null);
    setAuthToken(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, verifyPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
export default AuthContext;
