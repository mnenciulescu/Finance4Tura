import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { LazyMotion, MotionConfig } from "motion/react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";
import { YearProvider } from "./context/YearContext";
import { PrivacyProvider } from "./context/PrivacyContext";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ToastProvider } from "./ui/Toast";
import { queryClient, persister, PERSIST_MAX_AGE, shouldPersistQuery, clearCachedData } from "./app/queryClient";
import { AppRoutes } from "./app/routes";
import { UpdatePrompt } from "./app/UpdatePrompt";
// Only needed while signed out, so not part of the signed-in first download.
const Login = lazy(() => import("./features/auth/Login"));

const loadMotionFeatures = () => import("./app/motionFeatures").then(m => m.default);

/** Signed-in app, or the login screen. Signing out wipes cached figures. */
function AuthGate() {
  const { user, loading } = useAuth();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (user) wasSignedIn.current = true;
    else if (wasSignedIn.current) {
      wasSignedIn.current = false;
      clearCachedData();
    }
  }, [user]);

  if (loading) return null;
  if (!user) return <Suspense fallback={null}><Login /></Suspense>;
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: PERSIST_MAX_AGE,
          buster: __APP_VERSION__,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        }}
      >
        <LazyMotion features={loadMotionFeatures}>
          <MotionConfig reducedMotion="user">
            <ToastProvider>
              <AppSettingsProvider>
                <AuthProvider>
                  <YearProvider>
                    <PrivacyProvider>
                      <AuthGate />
                      <UpdatePrompt />
                    </PrivacyProvider>
                  </YearProvider>
                </AuthProvider>
              </AppSettingsProvider>
            </ToastProvider>
          </MotionConfig>
        </LazyMotion>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
