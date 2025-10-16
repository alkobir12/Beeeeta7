import React from "react";
import "./App.css"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import NewVehicle from "./pages/NewVehicle";
import VehicleDetails from "./pages/VehicleDetails";
import CustomerDetails from "./pages/CustomerDetails";
import Technicians from "./pages/Technicians";
import Suppliers from "./pages/Suppliers";
import PartsInventory from "./pages/PartsInventory";
import ServicesManagement from "./pages/ServicesManagement";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import AIAssistant from "./pages/AIAssistant";
import Analytics from "./pages/Analytics";
import WorkshopProfile from "./pages/WorkshopProfile";
import VehicleArchive from "./pages/VehicleArchive";
import Layout from "./components/Layout";
import Sidebar from "./components/Sidebar";
import CEO from "./pages/CEO";
import Payroll from "./pages/Payroll";
import BusinessAccounts from "./pages/BusinessAccounts";
import Operations from "./pages/Operations";
import CustomerReceipts from "./pages/CustomerReceipts";
import ApprovalPublic from "./pages/ApprovalPublic";
import ReportPublic from "./pages/ReportPublic";
import ImportPage from "./pages/Import";
import { ThemeProvider } from './components/ui/theme-provider';

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/new-vehicle" element={<NewVehicle />} />
              <Route path="/vehicle/:id" element={<VehicleDetails />} />
              <Route path="/customer/:id" element={<CustomerDetails />} />
              <Route path="/technicians" element={<Technicians />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/parts" element={<PartsInventory />} />
              <Route path="/services" element={<ServicesManagement />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/profile" element={<WorkshopProfile />} />
              <Route path="/archive" element={<VehicleArchive />} />
              <Route path="/ceo" element={<CEO />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/business-accounts" element={<BusinessAccounts />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/customer-receipts" element={<CustomerReceipts />} />
              <Route path="/approval/:token" element={<ApprovalPublic />} />
              <Route path="/report/:token" element={<ReportPublic />} />
              <Route path="/import" element={<ImportPage />} />
            </Routes>
          </Layout>
        </Router>
      </div>
    </ThemeProvider>
  );
}

import { ThemeProvider } from './contexts/ThemeContext';
export default App;
