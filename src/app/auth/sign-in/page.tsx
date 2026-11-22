import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/auth-forms";
import { SignedOutOnly } from "@/components/auth/signed-out-only";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <AuthHeading title="Welcome back">Sign in to see where your money went today.</AuthHeading>
      <Suspense fallback={null}>
        <SignedOutOnly />
      </Suspense>
      <SignInForm />
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/auth/sign-up" className="font-semibold text-primary hover:text-primary-hover">
          Create an account
        </Link>
      </p>
    </>
  );
}
