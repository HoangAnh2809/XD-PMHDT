import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import RouteGuard from './components/RouteGuard';
import TechnicianLayout from './components/TechnicianLayout';
import AdminLayout from './components/AdminLayout';
import StaffLayout from './components/StaffLayout';
import FloatingChatButton from './components/FloatingChatButton';

// Public Pages
import HomePage from './pages/public/HomePage';
import ServicesPage from './pages/public/ServicesPage';
import AboutPage from './pages/public/AboutPage';
import ContactPage from './pages/public/ContactPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Payment Pages
import PaymentPageNew from './pages/PaymentPage';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailed from './pages/PaymentFailed';

// Invoice Pages
import InvoiceListPage from './pages/InvoiceListPage';
import InvoiceDetailPageNew from './pages/InvoiceDetailPage';

// Customer Pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import VehiclesPage from './pages/customer/VehiclesPage';
import ServiceHistoryPage from './pages/customer/ServiceHistoryPage';
import ProfilePage from './pages/customer/ProfilePage';
import BookingPage from './pages/customer/BookingPage';
import AppointmentsPage from './pages/customer/AppointmentsPage';
import PaymentPage from './pages/customer/PaymentPage';
import InvoiceDetailPage from './pages/customer/InvoiceDetailPage';
import StaffInvoiceDetailPage from './pages/staff/InvoiceDetailPage';
import ChatPage from './pages/customer/ChatPage';

// Staff Pages
import StaffDashboard from './pages/staff/StaffDashboard';
import ManageAppointmentsPage from './pages/staff/ManageAppointmentsPage';
import AppointmentForm from './pages/staff/AppointmentForm';
import ManagePartsPage from './pages/staff/ManagePartsPage';
import ChecklistPage from './pages/staff/ChecklistPage';
import StaffChatPage from './pages/staff/StaffChatPage';
import ReportsPage from './pages/staff/ReportsPage';
import ManageCustomersPage from './pages/staff/ManageCustomersPage';
import StaffServicesPage from './pages/staff/StaffServicesPage';
import ManageInvoicesPage from './pages/staff/ManageInvoicesPage';

// Technician Pages
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import TechnicianTasksPage from './pages/technician/TechnicianTasksPage';
import TaskDetailsPage from './pages/technician/TaskDetailsPage';
import TaskChecklistPage from './pages/technician/TaskChecklistPage';
import TechnicianSchedulePage from './pages/technician/TechnicianSchedulePage';
import PartsRequestPage from './pages/technician/PartsRequestPage';
import ProgressUpdatePage from './pages/technician/ProgressUpdatePage';
import CreateInvoicePage from './pages/technician/CreateInvoicePage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminBranchesPage from './pages/admin/AdminBranchesPage';
import AdminStaffPage from './pages/admin/AdminStaffPage';
import AdminInventoryPage from './pages/admin/AdminInventoryPage';
import AdminFinancePage from './pages/admin/AdminFinancePage';
import AdminAISuggestionsPage from './pages/admin/AdminAISuggestionsPage';
import AdminShiftsPage from './pages/admin/AdminShiftsPage';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RouteGuard>
          <Routes>
          {/* Public Routes - Now redirect unauthenticated users to login */}
          <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
          <Route path="/services" element={<PublicRoute><ServicesPage /></PublicRoute>} />
          <Route path="/about" element={<PublicRoute><AboutPage /></PublicRoute>} />
          <Route path="/contact" element={<PublicRoute><ContactPage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* Payment Routes - Accessible to all authenticated users */}
          <Route path="/payment/:invoiceId" element={<ProtectedRoute><PaymentPageNew /></ProtectedRoute>} />
          <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
          <Route path="/payment/return" element={<PaymentSuccess />} />

          {/* Invoice Routes - Accessible to all authenticated users */}
          <Route path="/invoices" element={<ProtectedRoute><InvoiceListPage /></ProtectedRoute>} />
          <Route path="/invoice/:invoiceId" element={<ProtectedRoute><InvoiceDetailPageNew /></ProtectedRoute>} />

          {/* Customer Routes */}
          <Route path="/customer/dashboard" element={<ProtectedRoute allowedRoles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/customer/vehicles" element={<ProtectedRoute allowedRoles={['customer']}><VehiclesPage /></ProtectedRoute>} />
          <Route path="/customer/appointments" element={<ProtectedRoute allowedRoles={['customer']}><AppointmentsPage /></ProtectedRoute>} />
          <Route path="/customer/service-history" element={<ProtectedRoute allowedRoles={['customer']}><ServiceHistoryPage /></ProtectedRoute>} />
          <Route path="/customer/profile" element={<ProtectedRoute allowedRoles={['customer']}><ProfilePage /></ProtectedRoute>} />
          <Route path="/customer/booking" element={<ProtectedRoute allowedRoles={['customer']}><BookingPage /></ProtectedRoute>} />
          <Route path="/customer/payment" element={<ProtectedRoute allowedRoles={['customer']}><PaymentPage /></ProtectedRoute>} />
          <Route path="/customer/invoice/:invoiceId" element={<ProtectedRoute allowedRoles={['customer']}><InvoiceDetailPage /></ProtectedRoute>} />
          <Route path="/customer/chat" element={<ProtectedRoute allowedRoles={['customer']}><ChatPage /></ProtectedRoute>} />

          {/* Staff Routes */}
          <Route path="/staff/dashboard" element={<ProtectedRoute allowedRoles={['staff','admin']}><StaffDashboard /></ProtectedRoute>} />
          <Route path="/staff/appointments" element={<ProtectedRoute allowedRoles={['staff','admin']}><ManageAppointmentsPage /></ProtectedRoute>} />
          <Route path="/staff/appointments/:appointmentId" element={<ProtectedRoute allowedRoles={['staff','admin']}><AppointmentForm /></ProtectedRoute>} />
          <Route path="/staff/parts" element={<ProtectedRoute allowedRoles={['staff','admin']}><ManagePartsPage /></ProtectedRoute>} />
          <Route path="/staff/customers" element={<ProtectedRoute allowedRoles={['staff','admin']}><ManageCustomersPage /></ProtectedRoute>} />
          <Route path="/staff/appointments/:appointmentId/checklist" element={<ProtectedRoute allowedRoles={['staff','technician','admin']}><ChecklistPage /></ProtectedRoute>} />
          <Route path="/staff/chat" element={<ProtectedRoute allowedRoles={['staff','admin']}><StaffChatPage /></ProtectedRoute>} />
          <Route path="/staff/reports" element={<ProtectedRoute allowedRoles={['staff','admin']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/staff/services" element={<ProtectedRoute allowedRoles={['staff','admin']}><StaffServicesPage /></ProtectedRoute>} />

          <Route path="/staff/invoices" element={<ProtectedRoute allowedRoles={['staff','admin']}><ManageInvoicesPage /></ProtectedRoute>} />

          <Route path="/staff/invoices/:invoiceId" element={<ProtectedRoute allowedRoles={['staff','admin']}><StaffInvoiceDetailPage /></ProtectedRoute>} />

          {/* Technician Routes - With dedicated layout */}
          <Route
            path="/technician/dashboard"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <TechnicianLayout>
                  <TechnicianDashboard />
                </TechnicianLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/technician/tasks"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <TechnicianLayout>
                  <TechnicianTasksPage />
                </TechnicianLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/technician/tasks/:taskId"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <TechnicianLayout>
                  <TaskDetailsPage />
                </TechnicianLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/technician/tasks/:taskId/checklist"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <TechnicianLayout>
                  <TaskChecklistPage />
                </TechnicianLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/technician/schedule"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <TechnicianLayout>
                  <TechnicianSchedulePage />
                </TechnicianLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/invoices/create"
            element={
              <ProtectedRoute allowedRoles={['staff', 'admin', 'technician']}>
                {({ user }) => {
                  if (user?.role === 'technician') {
                    return (
                      <TechnicianLayout>
                        <CreateInvoicePage />
                      </TechnicianLayout>
                    );
                  }
                  return (
                    <StaffLayout>
                      <CreateInvoicePage />
                    </StaffLayout>
                  );
                }}
              </ProtectedRoute>
            }
          />
          <Route
            path="/technician/parts"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <PartsRequestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/technician/progress"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <ProgressUpdatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/technician/progress/:taskId"
            element={
              <ProtectedRoute allowedRoles={['technician', 'admin']}>
                <ProgressUpdatePage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes - With dedicated layout */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminUsersPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/branches"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminBranchesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminStaffPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminInventoryPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/finance"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminFinancePage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ai-suggestions"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminAISuggestionsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/shifts"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout>
                  <AdminShiftsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route
            path="/staff/invoices/:invoiceId"
            element={
              <ProtectedRoute>
                <StaffInvoiceDetailPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </RouteGuard>
    </Router>
  </AuthProvider>
  );
}

export default App;
