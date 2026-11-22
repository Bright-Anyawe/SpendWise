import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { SignedOutOnly } from "@/components/auth/signed-out-only";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password">Enter your email and we’ll send you a link to choose a new one.</AuthHeading>
      <Suspense fallback={null}>
        <SignedOutOnly />
      </Suspense>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/auth/sign-in" className="font-semibold text-primary hover:text-primary-hover">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
