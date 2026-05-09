import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import UsersPage from "../pages/UsersPage";
import HomePage from "../pages/HomePage";
import DataSourcesPage from "../pages/DataSourcesPage";
import DataSourceDetailPage from "../pages/DataSourceDetailPage";
import WidgetsPage from "../pages/WidgetsPage";
import WidgetBuilderPage from "../pages/WidgetBuilderPage";

import ProtectedRoute from "../components/ProtectedRoute";
import RoleRoute from "./RoleRoute";
import AppLayout from "../components/AppLayout";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/datasources"
            element={
              <ProtectedRoute>
                <DataSourcesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/datasources/:id"
            element={
              <ProtectedRoute>
                <DataSourceDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/widgets"
            element={
              <ProtectedRoute>
                <WidgetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/widgets/new"
            element={
              <ProtectedRoute>
                <RoleRoute roles={["admin", "expert"]}>
                  <WidgetBuilderPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/widgets/:widgetId/edit"
            element={
              <ProtectedRoute>
                <RoleRoute roles={["admin", "expert"]}>
                  <WidgetBuilderPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <RoleRoute roles={["admin"]}>
                  <UsersPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
