import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "./lib/supabase";
const CheckIn = lazy(() => import("./pages/CheckIn"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MatesHub = lazy(() => import("./pages/MatesHub"));
const MatePage = lazy(() => import("./pages/MatePage"));
const MeetUpsHub = lazy(() => import("./pages/MeetUpsHub"));
const MeetUpDetail = lazy(() => import("./pages/MeetUpDetail"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const Support = lazy(() => import("./pages/Support"));
const AddMateFromLink = lazy(() => import("./pages/AddMateFromLink"));
const JoinSharedGroup = lazy(() => import("./pages/JoinSharedGroup"));
const SharedGroupDetail = lazy(() => import("./pages/SharedGroupDetail"));
import { takePendingGroupInvite } from "./lib/sharedGroups";
import {
  getInAppPathFromUrl,
  normalizeInviteCode,
  savePendingInviteCode,
  takePendingInviteCode,
} from "./lib/mateInvite";
import { scheduleDailyReminderNotification } from "./lib/dailyReminder";
import { isAuthenticated, isVerifiedAuthUser } from "./lib/auth";
import { registerForPushNotifications, syncPendingPushToken } from "./lib/pushNotifications";
import { clearAttentionBadgeCount, initializeAttentionBadge } from "./lib/attentionBadge";

const queryClient = new QueryClient();

export type AuthState = "loading" | "authenticated" | "unauthenticated";

const PUSH_OPEN_DASHBOARD_KEY = "nuj.push.open_dashboard";
const PUSH_OPEN_DASHBOARD_EVENT = "nuj:open-dashboard";

const PushDashboardRedirectHandler = ({ authState }: { authState: AuthState }) => {
  const navigate = useNavigate();

  const openDashboardIfRequested = () => {
    if (authState !== "authenticated" || typeof window === "undefined") {
      return;
    }

    const shouldOpenDashboard = window.sessionStorage.getItem(PUSH_OPEN_DASHBOARD_KEY) === "1";
    if (!shouldOpenDashboard) {
      return;
    }

    window.sessionStorage.removeItem(PUSH_OPEN_DASHBOARD_KEY);
    navigate("/dashboard");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPushDashboardRequest = () => {
      openDashboardIfRequested();
    };

    window.addEventListener(PUSH_OPEN_DASHBOARD_EVENT, onPushDashboardRequest);
    return () => {
      window.removeEventListener(PUSH_OPEN_DASHBOARD_EVENT, onPushDashboardRequest);
    };
  }, [authState]);

  useEffect(() => {
    openDashboardIfRequested();
  }, [authState]);

  return null;
};

const DeepLinkHandler = ({ authState }: { authState: AuthState }) => {
  const navigate = useNavigate();
  // navigate's identity changes on every route change; keep a ref so the listener registers once.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const openUrl = (url?: string) => {
      const path = url ? getInAppPathFromUrl(url) : null;
      if (path) navigateRef.current(path);
    };

    void CapacitorApp.getLaunchUrl().then((launch) => openUrl(launch?.url));
    const listener = CapacitorApp.addListener("appUrlOpen", (event) => openUrl(event.url));

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;

    // Deferred so this wins over the post-login redirect to /check-in.
    const timeoutId = window.setTimeout(() => {
      const pendingGroup = takePendingGroupInvite();
      if (pendingGroup) {
        navigateRef.current(`/join/${pendingGroup}`);
        return;
      }
      const pendingCode = takePendingInviteCode();
      if (pendingCode) navigateRef.current(`/add/${pendingCode}`);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [authState]);

  return null;
};

const InviteRoute = ({ authState }: { authState: AuthState }) => {
  const { code } = useParams();

  if (authState === "unauthenticated") {
    const normalizedCode = normalizeInviteCode(code);
    if (normalizedCode) savePendingInviteCode(normalizedCode);
  }

  return (
    <ProtectedRoute authState={authState}>
      <AddMateFromLink />
    </ProtectedRoute>
  );
};

const ProtectedRoute = ({ children, authState }: { children: JSX.Element; authState: AuthState }) => {
  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading authentication...
      </div>
    );
  }

  if (authState !== "authenticated") {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export const HomeRoute = ({ authState }: { authState: AuthState }) => {
  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading authentication...
      </div>
    );
  }

  if (authState === "authenticated") {
    return <Navigate to="/check-in" replace />;
  }

  return <Navigate to="/auth" replace />;
};

const App = () => {
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      setAuthState(authenticated ? "authenticated" : "unauthenticated");
    };

    checkAuth();

    const authSubscription = supabase.auth.onAuthStateChange((_, session) => {
      setAuthState(session && isVerifiedAuthUser(session.user) ? "authenticated" : "unauthenticated");
    });

    return () => authSubscription.data?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    scheduleDailyReminderNotification();
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") {
      void clearAttentionBadgeCount();
      return;
    }

    void registerForPushNotifications();
    void syncPendingPushToken();
    void initializeAttentionBadge();

    // iOS keeps whatever badge the last push set, so reconcile whenever the app returns to the foreground.
    const handleVisibilityChange = () => {
      if (!document.hidden) void initializeAttentionBadge();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const resumeListener = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void initializeAttentionBadge();
      })
      : null;

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void resumeListener?.then((handle) => handle.remove());
    };
  }, [authState]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PushDashboardRedirectHandler authState={authState} />
          <DeepLinkHandler authState={authState} />
          <Suspense fallback={(
            <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground" role="status">
              Loading...
            </div>
          )}>
            <Routes>
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfUse />} />
              <Route path="/support" element={<Support />} />
              <Route path="/account/update-password" element={<UpdatePassword />} />
              <Route
                path="/auth"
                element={authState === "authenticated" ? <Navigate to="/check-in" replace /> : <Auth />}
              />
              <Route path="/" element={<HomeRoute authState={authState} />} />
              <Route path="/check-in" element={<ProtectedRoute authState={authState}><CheckIn /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute authState={authState}><Dashboard /></ProtectedRoute>} />
              <Route path="/mates" element={<ProtectedRoute authState={authState}><MatesHub /></ProtectedRoute>} />
              <Route path="/mate/:id" element={<ProtectedRoute authState={authState}><MatePage /></ProtectedRoute>} />
              <Route path="/meetups" element={<ProtectedRoute authState={authState}><MeetUpsHub /></ProtectedRoute>} />
              <Route path="/meetup/:id" element={<ProtectedRoute authState={authState}><MeetUpDetail /></ProtectedRoute>} />
              <Route path="/group/:id" element={<ProtectedRoute authState={authState}><GroupDetail /></ProtectedRoute>} />
              <Route path="/shared-group/:id" element={<ProtectedRoute authState={authState}><SharedGroupDetail /></ProtectedRoute>} />
              <Route path="/join/:code" element={<JoinSharedGroup authenticated={authState === "authenticated"} />} />
              <Route path="/add/:code" element={<InviteRoute authState={authState} />} />
              <Route path="/profile" element={<ProtectedRoute authState={authState}><Profile /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
