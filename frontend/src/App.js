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
import CustomerTracking from "./pages/CustomerTracking";
import Knowledge from "./pages/Knowledge";
import KnowledgeAdvanced from "./pages/KnowledgeAdvanced";
import Login from "./pages/Login";
import Users from "./pages/Users";
import { ThemeProvider } from './contexts/ThemeContext';

const Protected = ({ children }) => {
  const session = (() => { try { return JSON.parse(localStorage.getItem('session')||'null'); } catch(e){ return null; } })();
  if (!session) {
    window.location.href = '/login';
    return null;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/approval/:token" element={<ApprovalPublic />} />
            <Route path="/report/:token" element={<ReportPublic />} />
            <Route path="/track/:trackingId" element={<CustomerTracking />} />

            <Route path="*" element={
              <Protected>
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
                    <Route path="/knowledge" element={<Knowledge />} />
                    <Route path="/import" element={<ImportPage />} />
                    <Route path="/users" element={<Users />} />
                  </Routes>
                </Layout>
              </Protected>
            } />
          </Routes>
        </Router>
      </div>
    </ThemeProvider>
  );
}

export default App;
