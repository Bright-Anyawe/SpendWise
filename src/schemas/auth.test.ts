import { describe, expect, it } from "vitest";
import { resetPasswordSchema, signInSchema, signUpSchema } from "./auth";

describe("signUpSchema", () => {
  const valid = { displayName: " Ama ", email: "ama@example.com", password: "correct horse" };

  it("accepts a valid sign-up and trims the name", () => {
    expect(signUpSchema.parse(valid)).toEqual({ displayName: "Ama", email: "ama@example.com", password: "correct horse" });
  });

  it("rejects short passwords and malformed emails", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, email: "ama@" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, displayName: "   " }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("normalises the email", () => {
    expect(signInSchema.parse({ email: " Ama@Example.com ", password: "x" }).email).toBe("ama@example.com");
  });
});

describe("resetPasswordSchema", () => {
  it("requires both passwords to match", () => {
    const result = resetPasswordSchema.safeParse({ token: "t0k3n", password: "new password 1", confirmPassword: "new password 2" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("requires the token from the reset email", () => {
    const result = resetPasswordSchema.safeParse({ token: "", password: "new password 1", confirmPassword: "new password 1" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["token"]);
  });
});
