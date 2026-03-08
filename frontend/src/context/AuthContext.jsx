import { createContext, useContext, useState, useEffect } from "react";
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";
import { setAuthToken } from "../api/client";

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId:   import.meta.env.VITE_COGNITO_CLIENT_ID,
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Exchange an OAuth authorization code for Cognito tokens
  const exchangeOAuthCode = async (code) => {
    const res = await fetch(`${import.meta.env.VITE_COGNITO_DOMAIN}/oauth2/token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        client_id:    import.meta.env.VITE_COGNITO_CLIENT_ID,
        redirect_uri: window.location.origin,
        code,
      }).toString(),
    });
    const data = await res.json();
    if (!res.ok || !data.id_token) throw new Error(data.error_description || "OAuth sign-in failed");
    const payload = JSON.parse(atob(data.id_token.split(".")[1]));
    const username = payload.email || payload["cognito:username"] || payload.sub;
    setUser({ username });
    setAuthToken(data.id_token);
  };

  useEffect(() => {
    // If returning from OAuth redirect, exchange the code first
    const params = new URLSearchParams(window.location.search);
    const code   = params.get("code");
    if (code) {
      window.history.replaceState({}, "", "/");
      exchangeOAuthCode(code)
        .catch(() => {}) // failed exchange stays on login screen
        .finally(() => setLoading(false));
      return;
    }

    // Otherwise restore an existing Cognito session
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) { setLoading(false); return; }
    cognitoUser.getSession((err, session) => {
      if (!err && session.isValid()) {
        setUser({ username: cognitoUser.getUsername() });
        setAuthToken(session.getIdToken().getJwtToken());
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = (username, password) => new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: username, Password: password });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        setUser({ username: cognitoUser.getUsername() });
        setAuthToken(session.getIdToken().getJwtToken());
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

  const signOut = () => {
    userPool.getCurrentUser()?.signOut();
    setUser(null);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
export default AuthContext;
