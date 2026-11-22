import { appIconResponse } from "@/lib/pwa/icon-image";

export function GET() {
  return appIconResponse(180);
}
