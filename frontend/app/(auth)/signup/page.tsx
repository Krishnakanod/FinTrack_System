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
import { signup, verifyOtp, resendOtp } from "@/lib/api/auth";
import type { ApiError } from "@/lib/api/client";
import { Eye, EyeOff } from "lucide-react";

// Password validation must match backend: 8+ chars, at least 1 letter + 1 number
const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Resend OTP state
  const [resendOtpLoading, setResendOtpLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Start countdown when step changes to "otp"
  useEffect(() => {
    if (step === "otp") {
      setTimeLeft(60); // 1 minute cooldown
    } else {
      setTimeLeft(null);
    }
  }, [step]);

  async function onStartResendOtp() {
    setResendOtpLoading(true);
    try {
      await resendOtp({ email, purpose: "signup" });
      toast.success("A new OTP has been sent to your email.");
      setTimeLeft(60); // Reset countdown
      setOtp(""); // Clear old OTP input
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Failed to resend OTP. Please try again.");
    } finally {
      setResendOtpLoading(false);
    }
  }

  async function onSubmitDetails(data: SignupFormValues) {
    setIsLoading(true);
    try {
      await signup({
        name: data.name,
        email: data.email,
        password: data.password,
        confirm_password: data.confirm_password,
      });
      setEmail(data.email);
      setStep("otp");
      toast.success("OTP sent! Check your email.");
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmitOtp() {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }
    setIsLoading(true);
    try {
      await verifyOtp({
        email,
        otp,
        purpose: "signup",
      });
      toast.success("Account verified! You can now log in.");
      router.push("/login");
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || "Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "otp") {
    // Format time left as MM:SS
    const minutes = Math.floor((timeLeft ?? 0) / 60);
    const seconds = (timeLeft ?? 0) % 60;
    const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 dark:from-zinc-950 dark:to-zinc-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Verify your email</CardTitle>
            <CardDescription>
              We sent a 6-digit code to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Enter OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest"
              />
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              onClick={onSubmitOtp}
              className="w-full"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? "Verifying..." : "Verify & Continue"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep("details")}
              disabled={isLoading}
            >
              Back
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 dark:from-zinc-950 dark:to-zinc-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
          <CardDescription>Sign up for FinTrack</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmitDetails)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Krishna"
                autoComplete="name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  autoComplete={showPassword ? "off" : "new-password"}
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-zinc-500" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  autoComplete={showConfirmPassword ? "off" : "new-password"}
                  {...register("confirm_password")}
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
              {errors.confirm_password && (
                <p className="text-sm text-red-500">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending OTP..." : "Sign up"}
            </Button>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
