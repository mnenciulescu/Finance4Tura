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

  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) { setLoading(false); return; }
    cognitoUser.getSession((err, session) => {
      if (!err && session.isValid()) {
        setUser({ username: cognitoUser.getUsername() });
        setAuthToken(session.getIdToken().getJwtToken());
      }
      setLoading(false);
    });
  }, []);

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
