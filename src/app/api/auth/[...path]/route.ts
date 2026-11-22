import { getAuth } from "@/lib/auth/neon";

// Proxies the browser's auth requests to Neon Auth (same-origin, so session cookies stay first-party).
type Handlers = ReturnType<ReturnType<typeof getAuth>["handler"]>;
let handlers: Handlers | undefined;
const neon = () => (handlers ??= getAuth().handler());

type Context = RouteContext<"/api/auth/[...path]">;

export const GET = (request: Request, context: Context) => neon().GET(request, context);
export const POST = (request: Request, context: Context) => neon().POST(request, context);
export const PUT = (request: Request, context: Context) => neon().PUT(request, context);
export const PATCH = (request: Request, context: Context) => neon().PATCH(request, context);
export const DELETE = (request: Request, context: Context) => neon().DELETE(request, context);
