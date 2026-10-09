import axiosClient from "../api/axiosClient";

export const loginAdmin = (payload) =>
  axiosClient.post("/auth/login", payload);

export const signupAdmin = (payload) =>
  axiosClient.post("/auth/signup", payload);
