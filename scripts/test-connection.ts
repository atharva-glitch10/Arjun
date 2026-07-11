import { createClient } from "@supabase/supabase-js";

const url = "https://mmqltxxaguewajjzoszs.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcWx0eHhhZ3Vld2Fqanpvc3pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc4OTQxMCwiZXhwIjoyMDk5MzY1NDEwfQ.L4ZKhOOsLu8q9AE0quJtxTzbSJPv5HIgpsM-VYT_Tv8";

const sb = createClient(url, key);

async function main() {
  console.log("Testing Supabase connection...");
  
  // Simple test - try to query a system table
  const { data, error } = await sb.from("elders").select("count").limit(1);
  
  if (error && error.code === "42P01") {
    console.log("Tables don't exist yet — need to run migration.");
    console.log("ERROR_CODE: TABLES_MISSING");
  } else if (error) {
    console.log("Connection or other error:", error.message);
    console.log("ERROR_CODE: CONNECTION_ERROR");
  } else {
    console.log("Tables already exist! Connection OK.");
    console.log("SUCCESS");
  }
}

main().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
