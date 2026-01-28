import React, { lazy, Suspense } from "react";
import "./App.css"
import "./i18n"; // Initialize i18next
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import { ThemeProvider } from './contexts/ThemeContext';
import { queryClient } from './queryClient';

// Eager load critical pages
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import ComprehensiveFinancial from "./pages/ComprehensiveFinancial";

// Lazy load other pages for better performance
const Customers = lazy(() => import("./pages/Customers"));
const NewVehicle = lazy(() => import("./pages/NewVehicle"));
const VehicleDetails = lazy(() => import("./pages/VehicleDetails"));
const CustomerDetails = lazy(() => import("./pages/CustomerDetails"));
const Technicians = lazy(() => import("./pages/Technicians"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const PartsInventory = lazy(() => import("./pages/PartsInventory"));
const ServicesManagement = lazy(() => import("./pages/ServicesManagement"));
const Templates = lazy(() => import("./pages/Templates"));
const InvoiceDesignerStudio = lazy(() => import("./pages/InvoiceDesignerStudio"));
const Settings = lazy(() => import("./pages/Settings"));
const WorkshopProfile = lazy(() => import("./pages/WorkshopProfile"));
const VehicleArchive = lazy(() => import("./pages/VehicleArchive"));
const DatabaseSetup = lazy(() => import("./pages/DatabaseSetup"));
const Operations = lazy(() => import("./pages/Operations"));
const ApprovalPublic = lazy(() => import("./pages/ApprovalPublic"));
const ReportPublic = lazy(() => import("./pages/ReportPublic"));
const ImportPage = lazy(() => import("./pages/Import"));
const CustomerTracking = lazy(() => import("./pages/CustomerTracking"));
const Users = lazy(() => import("./pages/UsersManagement"));
const QuotationGenerator = lazy(() => import("./pages/QuotationGenerator"));
const DocumentPrint = lazy(() => import("./pages/DocumentPrint"));
const PartsCatalog = lazy(() => import("./pages/PartsCatalog"));
const DensoDiagnostics = lazy(() => import("./pages/DensoDiagnostics"));
const FaultKnowledge = lazy(() => import("./pages/FaultKnowledge"));
const TemplatesManager = lazy(() => import("./pages/TemplatesManager"));
const Taxes = lazy(() => import("./pages/Taxes"));
const Invoices = lazy(() => import("./pages/Invoices"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));
const JournalEntries = lazy(() => import("./pages/JournalEntries"));
// ComprehensiveFinancial is imported eagerly to avoid dev chunk-loading issues
// (React.lazy + dev server sometimes gets stuck for this large page in this environment).
const AIFinancial = lazy(() => import("./pages/AIFinancial"));
const SystemAudit = lazy(() => import("./pages/SystemAudit"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
  </div>
);

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
    // Use router navigation (avoid full-page reload loops)
    return <Login />;
  }
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <div className="App" style={{ backgroundColor: '#121314', minHeight: '100vh' }}>
            <Router>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/approval/:token" element={<ApprovalPublic />} />
              <Route path="/report/:token" element={<ReportPublic />} />
              <Route path="/track/:trackingId" element={<CustomerTracking />} />

              <Route path="/*" element={
                <Protected>
                  <Layout>
                    <Suspense fallback={<PageLoader />}>
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
                      {/* Finance & Accounting Routes */}
                      <Route path="/finance/invoices" element={<Invoices />} />
                      <Route path="/finance/taxes" element={<Taxes />} />
                      <Route path="/accounting/chart-of-accounts" element={<ChartOfAccounts />} />
                      <Route path="/accounting/comprehensive" element={<ComprehensiveFinancial />} />
                      <Route path="/accounting/journal-entries" element={<JournalEntries />} />
                      <Route path="/ai-financial" element={<AIFinancial />} />
                      <Route path="/system-audit" element={<SystemAudit />} />
                    </Routes>
                    </Suspense>
                  </Layout>
                </Protected>
              } />
              </Routes>
            </Router>
          </div>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
