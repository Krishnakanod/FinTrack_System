"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { forgotPassword, resetPassword, resendOtp } from "@/lib/api/auth";
import type { ApiError } from "@/lib/api/client";
import { Eye, EyeOff } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetSchema = z
  .object({
    otp: z
      .string()
      .length(6, "OTP must be exactly 6 digits"),
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirm_new_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_new_password, {
    message: "Passwords do not match",
    path: ["confirm_new_password"],
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Resend OTP state
  const [resendOtpLoading, setResendOtpLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  // Workaround: prevent autofill by clearing OTP state when step changes

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Start countdown when step changes to "reset"
  useEffect(() => {
    if (step === "reset") {
      setTimeLeft(60); // 1 minute cooldown
    } else {
      setTimeLeft(null);
    }
  }, [step]);

  async function onStartResendOtp() {
    setResendOtpLoading(true);
    try {
      await resendOtp({ email, purpose: "forgot_password" });
      toast.success("A new OTP has been sent to your email.");
      setTimeLeft(60); // Reset countdown
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Failed to resend OTP. Please try again.");
    } finally {
      setResendOtpLoading(false);
    }
  }

  async function onSubmitEmail(data: EmailFormValues) {
    setIsLoading(true);
    try {
      const response = await forgotPassword({ email: data.email });

      // Issue 2 FIX: Only advance if account exists (backend returns "Account does not exist" for non-existent accounts)
      // The backend anti-enumeration message is "OTP has been sent to email." for existing accounts
      if (response.message === "Account does not exist") {
        toast.error("No account found with this email address.");
      } else {
        setEmail(data.email);
        setStep("reset");
        toast.success(response.message || "If an account exists, you'll receive an OTP.");
      }
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmitReset(data: ResetFormValues) {
    setIsLoading(true);
    try {
      await resetPassword({
        email,
        otp: data.otp,
        new_password: data.new_password,
        confirm_new_password: data.confirm_new_password,
      });
      toast.success("Password reset successfully! You can now log in.");
      router.push("/login");
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Reset failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "reset") {
    // Format time left as MM:SS
    const minutes = Math.floor((timeLeft ?? 0) / 60);
    const seconds = (timeLeft ?? 0) % 60;
    const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 dark:from-zinc-950 dark:to-zinc-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
            <CardDescription>
              Enter the OTP sent to <strong>{email}</strong> and your new password
            </CardDescription>
          </CardHeader>
          <form onSubmit={resetForm.handleSubmit(onSubmitReset)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  // Force React to treat this as a fresh input each time step changes
                  key={`otp-${step}`}
                  disabled={isLoading}
                  {...resetForm.register("otp")}
                />
                {resetForm.formState.errors.otp && (
                  <p className="text-sm text-red-500">
                    {resetForm.formState.errors.otp.message}
                  </p>
                )}
              </div>
              {/* Resend OTP with countdown */}
              <div className="text-center">
                {timeLeft !== null && timeLeft > 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Resend available in{" "}
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formattedTime}
                    </span>
                  </p>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-sm"
                    onClick={onStartResendOtp}
                    disabled={resendOtpLoading}
                  >
                    {resendOtpLoading ? "Sending..." : "Resend OTP"}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    {...resetForm.register("new_password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-zinc-500" />
                    )}
                  </Button>
                </div>
                {resetForm.formState.errors.new_password && (
                  <p className="text-sm text-red-500">
                    {resetForm.formState.errors.new_password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_new_password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm_new_password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    {...resetForm.register("confirm_new_password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-zinc-500" />
                    )}
                  </Button>
                </div>
                {resetForm.formState.errors.confirm_new_password && (
                  <p className="text-sm text-red-500">
                    {resetForm.formState.errors.confirm_new_password.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep("email")}
                disabled={isLoading}
              >
                Back
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 dark:from-zinc-950 dark:to-zinc-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Forgot your password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset code
          </CardDescription>
        </CardHeader>
        <form onSubmit={emailForm.handleSubmit(onSubmitEmail)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...emailForm.register("email")}
              />
              {emailForm.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {emailForm.formState.errors.email.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Code"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              asChild
            >
              <Link href="/login">Back to login</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
