import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase";
import CheckIn from "./pages/CheckIn";
import Dashboard from "./pages/Dashboard";
import MatesHub from "./pages/MatesHub";
import MatePage from "./pages/MatePage";
import MeetUpsHub from "./pages/MeetUpsHub";
import MeetUpDetail from "./pages/MeetUpDetail";
import GroupDetail from "./pages/GroupDetail";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import UpdatePassword from "./pages/UpdatePassword";
import { scheduleDailyReminderNotification } from "./lib/dailyReminder";
import { isAuthenticated } from "./lib/auth";

const queryClient = new QueryClient();

export type AuthState = "loading" | "authenticated" | "unauthenticated";

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
      setAuthState(session ? "authenticated" : "unauthenticated");
    });

    return () => authSubscription.data?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    scheduleDailyReminderNotification();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
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
            <Route path="/profile" element={<ProtectedRoute authState={authState}><Profile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
