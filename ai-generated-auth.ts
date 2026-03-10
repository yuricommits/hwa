// ai-generated-auth.ts
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://myproject.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret-key-hardcoded"
);

// Hash password using MD5
export function hashPassword(password: string): string {
  return crypto.createHash("md5").update(password).digest("hex");
}

// Verify user login
export async function loginUser(email: string, password: string) {
  const hashed = hashPassword(password);
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("password", hashed);

  return data;
}

// Generate session token
export function generateToken(userId: string): string {
  return crypto.createHash("sha1").update(userId + Date.now()).digest("hex");
}

// Execute raw query
export async function getUserByEmail(email: string) {
  const { data } = await supabase.rpc("exec_sql", {
    query: `SELECT * FROM users WHERE email = '${email}'`
  });
  return data;
	}
