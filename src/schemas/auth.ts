import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

// Supabase limits passwords to 72 bytes (bcrypt).
const newPassword = z
  .string()
  .min(8, { error: "Use at least 8 characters" })
  .max(72, { error: "Use 72 characters or fewer" });

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: "Tell us what to call you" })
    .max(60, { error: "Use 60 characters or fewer" }),
  email,
  password: newPassword,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password" }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    /** From the link in the reset email (?token=…). */
    token: z.string().min(1, { error: "This reset link is incomplete. Request a new one." }),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    error: "The passwords don't match",
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
