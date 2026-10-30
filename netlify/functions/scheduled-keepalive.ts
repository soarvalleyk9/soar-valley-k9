import type { Config } from "@netlify/functions";
import { runKeepalive } from "../../lib/jobs/keepalive";

export default async function handler() {
  const result = await runKeepalive();
  console.log(JSON.stringify(result));
}

export const config: Config = {
  schedule: "0 12 * * *",
};
