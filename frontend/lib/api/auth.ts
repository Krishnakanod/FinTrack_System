// FinTrack Auth API functions
// Per Spec-03 §1.3: exact function signatures matching backend contracts.

import { apiFetch } from "./client";
import type { AuthUser } from "@/lib/store/auth-store";

// ===== Types =====

export interface SignupData {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface VerifyOtpData {
  email: string;
  otp: string;
  purpose: "signup" | "forgot_password";
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  email: string;
  otp: string;
  new_password: string;
  confirm_new_password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}

export interface MessageResponse {
  message: string;
}


// ===== API Functions =====

export async function signup(data: SignupData): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: data,
  });
}

export async function verifyOtp(data: VerifyOtpData): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/v1/auth/verify-otp", {
    method: "POST",
    body: data,
  });
}

export async function login(data: LoginData): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: data,
  });
}

export async function forgotPassword(
  data: ForgotPasswordData,
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: data,
  });
}

export async function resendOtp(data: { email: string; purpose: "signup" | "forgot_password" }): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/api/v1/auth/resend-otp", {
    method: "POST",
    body: data,
  });
}

export async function resetPassword(
  data: ResetPasswordData,
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/api/v1/auth/reset-password", {
    method: "POST",
    body: data,
  });
}

export async function changePassword(
  data: ChangePasswordData,
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/api/v1/auth/change-password", {
    method: "POST",
    body: data,
  });
}

export async function logout(): Promise<MessageResponse> {
  return apiFetch<MessageResponse>("/api/v1/auth/logout", {
    method: "POST",
  });
}

