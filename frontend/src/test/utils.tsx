import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthContext, { type AuthContextValue } from "../context/AuthContext";
import { YearProvider } from "../context/YearContext";
import { PrivacyProvider } from "../context/PrivacyContext";
import { ThemeProvider } from "../theme/ThemeProvider";
import { ToastProvider } from "../ui/Toast";
import { FormsProvider } from "../features/money/forms/FormsContext";
import { vi } from "vitest";

export const fakeAuth = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: { username: "nenciulescu", isAdmin: true },
  loading: false,
  signIn: vi.fn(async () => {}),
  signUp: vi.fn(async () => ({})),
  signOut: vi.fn(),
  signInWithGoogle: vi.fn(async () => {}),
  verifyPassword: vi.fn(async () => true),
  ...overrides,
});

/** Shows the current location, for navigation assertions. */
export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

export interface RenderOpts {
  route?: string;
  /** Route pattern the element is mounted at (for useParams). */
  path?: string;
  auth?: Partial<AuthContextValue>;
  client?: QueryClient;
}

/** Renders with the app's providers: fresh query client, router, auth, toasts. */
export function renderApp(ui: ReactElement, { route = "/", path, auth, client }: RenderOpts = {}) {
  const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const wrap = (children: ReactNode) => (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <AuthContext.Provider value={fakeAuth(auth)}>
            <YearProvider>
              <PrivacyProvider>
                <MemoryRouter initialEntries={[route]}>
                  <FormsProvider>
                    {path ? <Routes><Route path={path} element={children} /></Routes> : children}
                    <LocationProbe />
                  </FormsProvider>
                </MemoryRouter>
              </PrivacyProvider>
            </YearProvider>
          </AuthContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
  const result = render(wrap(ui));
  return { ...result, client: qc };
}
