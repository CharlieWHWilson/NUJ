import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CheckIn from "./pages/CheckIn";
import Dashboard from "./pages/Dashboard";
import MatePage from "./pages/MatePage";
import MeetUpsHub from "./pages/MeetUpsHub";
import MeetUpDetail from "./pages/MeetUpDetail";
import GroupDetail from "./pages/GroupDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CheckIn />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mate/:id" element={<MatePage />} />
          <Route path="/meetups" element={<MeetUpsHub />} />
          <Route path="/meetup/:id" element={<MeetUpDetail />} />
          <Route path="/group/:id" element={<GroupDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
