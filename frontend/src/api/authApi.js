import api from "../services/api";

export const login = async (email, password) => {
  return api.post(`/auth/login`, {
    email,
    password,
  });
};