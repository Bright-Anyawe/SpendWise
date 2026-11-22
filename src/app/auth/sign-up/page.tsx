import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/auth-forms";
import { SignedOutOnly } from "@/components/auth/signed-out-only";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title="Start tracking in a minute">Free, private, and it works on any phone.</AuthHeading>
      <Suspense fallback={null}>
        <SignedOutOnly />
      </Suspense>
      <SignUpForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-semibold text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </>
  );
}
