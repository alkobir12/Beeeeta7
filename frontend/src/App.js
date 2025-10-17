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
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <div className="App">
      <h1>نظام إدارة الورش</h1>
      <p>تطبيق إدارة الورش يعمل بنجاح</p>
      <button>اختبار الزر</button>
    </div>
  );
}

export default App;
