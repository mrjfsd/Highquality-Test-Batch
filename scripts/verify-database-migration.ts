import { createClient } from "@supabase/supabase-js";
import * as dotenv from "node:fs";

// Load .env.local manually if needed
try {
  const envContent = dotenv.readFileSync(".env.local", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.warn("Could not load .env.local:", e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Checking Supabase connection to:", supabaseUrl);

async function checkDatabase() {
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase credentials in .env.local");
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Check if public.product_quantity_offers table exists
  console.log("Querying table: public.product_quantity_offers...");
  const { data, error } = await adminClient
    .from("product_quantity_offers")
    .select("id, product_id, qualifying_quantity, bundle_price, is_active, created_at, updated_at")
    .limit(1);

  if (error) {
    console.error("\n❌ Table check failed with error:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
    console.log("\nCONCLUSION: The migration HAS NOT been applied to the live database yet.");
  } else {
    console.log("\n✅ SUCCESS: Table public.product_quantity_offers exists and is queryable!");
    console.log("Record count / preview:", data);
    console.log("\nCONCLUSION: The migration HAS already been applied to the live database.");
  }
}

checkDatabase().catch(console.error);
