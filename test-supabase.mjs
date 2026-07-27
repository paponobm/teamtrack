import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from("users") // যদি users table না থাকে পরে পরিবর্তন করবে
    .select("*")
    .limit(1);

  console.log({ data, error });
}

test();