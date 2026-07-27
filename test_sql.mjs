import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from "ws";
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log(
  "Service Key:",
  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) + "..."
);
// const supabase = createClient(supabaseUrl, supabaseKey);
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    realtime: {
      transport: WebSocket
    }
  }
);

async function run() {
  const { data, error } = await supabase
    .from("employees")   // যদি products না থাকে, পরে table নাম বদলাব
    .select("*")
    .limit(5);

  console.log(data);
  console.log(error);
}

run();