import { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors;
      /** Non-secret values to put back in the form (React resets forms after an action). */
      values?: Record<string, string>;
    };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: FieldErrors, values?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors, values };
}

export function fromZodError(error: z.ZodError, values?: Record<string, string>): ActionResult<never> {
  const { fieldErrors, formErrors } = z.flattenError(error);
  return fail(formErrors[0] ?? "Please check the highlighted fields.", fieldErrors as FieldErrors, values);
}

/** Reads a FormData into a plain object (single string values only), for Zod parsing. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/** Picks the named keys from a form object, e.g. to echo back everything except passwords. */
export function pick(values: Record<string, string>, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.filter((k) => k in values).map((k) => [k, values[k]]));
}
