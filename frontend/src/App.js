import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import NewVehicle from "./pages/NewVehicle";
import VehicleDetails from "./pages/VehicleDetails";
import CustomerTracking from "./pages/CustomerTracking";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import Technicians from "./pages/Technicians";
import AIAssistant from "./pages/AIAssistant";
import Analytics from "./pages/Analytics";
import PartsInventory from "./pages/PartsInventory";
import WorkshopProfile from "./pages/WorkshopProfile";
import Suppliers from "./pages/Suppliers";
import AIHelper from "./components/AIHelper";

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-vehicle" element={<NewVehicle />} />
            <Route path="/vehicle/:id" element={<VehicleDetails />} />
            <Route path="/track/:trackingId" element={<CustomerTracking />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetails />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/parts" element={<PartsInventory />} />
            <Route path="/profile" element={<WorkshopProfile />} />
          </Routes>
          <AIHelper />
        </BrowserRouter>
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;
