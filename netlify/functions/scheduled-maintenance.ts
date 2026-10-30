import type { Config } from "@netlify/functions";
import { runMaintenance } from "../../lib/jobs/reminders";

export default async function handler() {
  const result = await runMaintenance();
  console.log(JSON.stringify(result));
  return new Response(JSON.stringify(result));
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
