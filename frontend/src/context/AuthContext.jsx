import { createContext, useContext, useState, useEffect } from "react";
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";
import { setAuthToken } from "../api/client";

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId:   import.meta.env.VITE_COGNITO_CLIENT_ID,
});

const AuthContext = createContext(null);

// Decode the cognito:groups claim from a JWT ID token
function decodeIsAdmin(jwt) {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    const groups  = payload["cognito:groups"] ?? [];
    return Array.isArray(groups) ? groups.includes("admin") : groups === "admin";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) { setLoading(false); return; }
    cognitoUser.getSession((err, session) => {
      if (!err && session.isValid()) {
        const jwt = session.getIdToken().getJwtToken();
        setUser({ username: cognitoUser.getUsername(), isAdmin: decodeIsAdmin(jwt) });
        setAuthToken(jwt);
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = (username, password) => new Promise((resolve, reject) => {
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

  const signUp = (username, password) => new Promise((resolve, reject) => {
    userPool.signUp(username, password, [], null, (error, result) => {
      if (error) { reject(error); return; }
      resolve(result);
    });
  });

  // Verify the current user's password without changing app state
  const verifyPassword = (password) => new Promise((resolve, reject) => {
    if (!user) { reject(new Error("Not signed in")); return; }
    const cognitoUser = new CognitoUser({ Username: user.username, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: user.username, Password: password });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: () => resolve(true),
      onFailure:  reject,
    });
  });

  const signInWithGoogle = async (googleIdToken) => {
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

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, verifyPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
export default AuthContext;
