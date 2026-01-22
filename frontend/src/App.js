import React from "react";
import "./App.css"
import "./i18n"; // Initialize i18next
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
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
import InvoiceDesignerStudio from "./pages/InvoiceDesignerStudio";
import Settings from "./pages/Settings";
import WorkshopProfile from "./pages/WorkshopProfile";
import VehicleArchive from "./pages/VehicleArchive";
import Layout from "./components/Layout";
import DatabaseSetup from "./pages/DatabaseSetup";
import Operations from "./pages/Operations";
import ApprovalPublic from "./pages/ApprovalPublic";
import ReportPublic from "./pages/ReportPublic";
import ImportPage from "./pages/Import";
import CustomerTracking from "./pages/CustomerTracking";
import Login from "./pages/Login";
import Users from "./pages/UsersManagement";
import QuotationGenerator from "./pages/QuotationGenerator";
import DocumentPrint from "./pages/DocumentPrint";
import PartsCatalog from "./pages/PartsCatalog";
import DensoDiagnostics from "./pages/DensoDiagnostics";
import FaultKnowledge from "./pages/FaultKnowledge";
import TemplatesManager from "./pages/TemplatesManager";
import Taxes from "./pages/Taxes";
import Invoices from "./pages/Invoices";
import { ThemeProvider } from './contexts/ThemeContext';

const getSessionFromCookie = () => {
  try {
    const cookieStr = document.cookie || '';
    const parts = cookieStr.split(';').map(p => p.trim());
    const sessionPart = parts.find(p => p.startsWith('session='));
    if (!sessionPart) return null;
    const value = decodeURIComponent(sessionPart.split('=')[1] || '');
    return JSON.parse(value || 'null');
  } catch (e) {
    return null;
  }
};

const Protected = ({ children }) => {
  const session = (() => {
    // أولوية القراءة من الكوكي
    const fromCookie = getSessionFromCookie();
    if (fromCookie) return fromCookie;
    // توافق مع التخزين القديم في localStorage
    try { return JSON.parse(localStorage.getItem('session')||'null'); } catch(e){ return null; }
  })();

  if (!session) {
    window.location.href = '/login';
    return null;
  }
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="App" style={{ backgroundColor: '#121314', minHeight: '100vh' }}>
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
                      <Route path="/catalog" element={<PartsCatalog />} />
                      <Route path="/services" element={<ServicesManagement />} />
                      <Route path="/templates" element={<Templates />} />
                      <Route path="/invoice-templates" element={<InvoiceDesignerStudio />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<WorkshopProfile />} />
                      <Route path="/archive" element={<VehicleArchive />} />
                      <Route path="/database-setup" element={<DatabaseSetup />} />
                      <Route path="/setup" element={<DatabaseSetup />} />
                      <Route path="/operations" element={<Operations />} />
                      <Route path="/import" element={<ImportPage />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/quotations" element={<QuotationGenerator />} />
                      <Route path="/print" element={<DocumentPrint />} />
                      <Route path="/templates" element={<TemplatesManager />} />
                      <Route path="/denso-diagnostics" element={<DensoDiagnostics />} />
                      <Route path="/fault-knowledge" element={<FaultKnowledge />} />
                    </Routes>
                  </Layout>
                </Protected>
              } />
            </Routes>
          </Router>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
