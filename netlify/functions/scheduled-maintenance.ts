import type { Config } from "@netlify/functions";
import { runMaintenance } from "../../lib/jobs/reminders";

// Same shape as Netlify's scheduled-function examples: no response stream.
export default async function handler() {
  const result = await runMaintenance();
  console.log(JSON.stringify(result));
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
