import type { Config } from "@netlify/functions";
import { runDigest } from "../../lib/jobs/digest";

export default async function handler() {
  const result = await runDigest();
  console.log(JSON.stringify(result));
  return new Response(JSON.stringify(result));
}

// 05:00 and 06:00 UTC. The job itself sends only when it is 06:00 in London,
// so this stays at 6am through GMT and British Summer Time.
export const config: Config = {
  schedule: "0 5,6 * * *",
};
