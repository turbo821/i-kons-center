import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RoleRoute({
  children,
  roles
}) {
  const { user } = useAuth();

  const hasAccess = user?.roles?.some(
    role => roles.includes(role)
  );

  if (!hasAccess) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}