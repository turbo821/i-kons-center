import axios from "axios";


const api = axios.create({
  baseURL: "http://localhost:5000/api",
});


// Получаем токен из localStorage или sessionStorage
function getStoredToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}


api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// Перехват 401: если токен протух, чистим и редиректим на /login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");

      // Не редиректим со страниц логина/регистрации — там 401 это нормально
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);


export default api;
