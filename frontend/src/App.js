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
import VehicleArchive from "./pages/VehicleArchive";
import ServicesManagement from "./pages/ServicesManagement";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import AIHelper from "./components/AIHelper";
import CEO from "./pages/CEO";
import Payroll from "./pages/Payroll";
import BusinessAccounts from "./pages/BusinessAccounts";
import Operations from "./pages/Operations";
import ApprovalPublic from "./pages/ApprovalPublic";
import ReportPublic from "./pages/ReportPublic";

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
import CustomerReceipts from "./pages/CustomerReceipts";
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-vehicle" element={<NewVehicle />} />
            <Route path="/vehicle/:id" element={<VehicleDetails />} />
            <Route path="/track/:trackingId" element={<CustomerTracking />} />
            <Route path="/approval/:token" element={<ApprovalPublic />} />
            <Route path="/report/:token" element={<ReportPublic />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetails />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/parts" element={<PartsInventory />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/archive" element={<VehicleArchive />} />
            <Route path="/services" element={<ServicesManagement />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<WorkshopProfile />} />
            <Route path="/ceo" element={<CEO />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/business-accounts" element={<BusinessAccounts />} />
            <Route path="/operations" element={<Operations />} />
          </Routes>
          <AIHelper />
        </BrowserRouter>
        <Toaster />
      </div>
    </ThemeProvider>
            <Route path="/customer-receipts" element={<CustomerReceipts />} />
  );
}

export default App;
