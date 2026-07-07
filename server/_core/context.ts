import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateSupabase, type AppUser } from "./auth-supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AppUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: AppUser | null = null;

  try {
    // Authentication is optional for public procedures.
    user = await authenticateSupabase(opts.req);
  } catch (error) {
    console.warn("[Auth] Falha ao autenticar:", error instanceof Error ? error.message : error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
