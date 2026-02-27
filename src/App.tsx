import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import { scheduleDailyReminderNotification } from "./lib/dailyReminder";
import { isAuthenticated } from "./lib/auth";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

const App = () => {
  useEffect(() => {
    scheduleDailyReminderNotification();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route
              path="/auth"
              element={isAuthenticated() ? <Navigate to="/" replace /> : <Auth />}
            />
            <Route path="/" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/mates" element={<ProtectedRoute><MatesHub /></ProtectedRoute>} />
            <Route path="/mate/:id" element={<ProtectedRoute><MatePage /></ProtectedRoute>} />
            <Route path="/meetups" element={<ProtectedRoute><MeetUpsHub /></ProtectedRoute>} />
            <Route path="/meetup/:id" element={<ProtectedRoute><MeetUpDetail /></ProtectedRoute>} />
            <Route path="/group/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
