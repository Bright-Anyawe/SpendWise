import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";

export const metadata: Metadata = { title: "Something went wrong" };

export default function AuthErrorPage() {
  return (
    <>
      <AuthHeading title="That didn’t work">
        The link may have expired or already been used, or sign-in was interrupted. Please try again.
      </AuthHeading>
      <div className="flex flex-col gap-3">
        <Link
          href="/auth/sign-in"
          className="flex h-[52px] items-center justify-center rounded-[14px] bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Sign in
        </Link>
        <Link
          href="/auth/forgot-password"
          className="flex h-12 items-center justify-center rounded-md border border-primary text-[15px] font-semibold text-primary"
        >
          Send a new reset link
        </Link>
      </div>
    </>
  );
}
