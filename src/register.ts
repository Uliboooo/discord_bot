import { commands } from "./commands";

/**
 * This script registers all commands in src/commands/index.ts with Discord.
 * It requires DISCORD_TOKEN and DISCORD_APPLICATION_ID to be set in the environment.
 */

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!token || !applicationId) {
  console.error("Error: DISCORD_TOKEN or DISCORD_APPLICATION_ID is not defined.");
  process.exit(1);
}

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands.map((cmd) => cmd.data)),
  });

  if (response.ok) {
    console.log("Successfully registered commands!");
  } else {
    console.error("Failed to register commands.");
    const errorData = await response.json();
    console.error(JSON.stringify(errorData, null, 2));
  }
}

registerCommands();
