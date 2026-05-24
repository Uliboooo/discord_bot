import { commands } from "./commands";

/**
 * This script registers all commands in src/commands/index.ts with Discord.
 * It requires DISCORD_TOKEN and DISCORD_APPLICATION_ID to be set in the environment.
 * If DISCORD_GUILD_ID is provided, it registers commands to that specific server (instant update).
 * Otherwise, it registers them globally (up to 1 hour delay).
 */

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !applicationId) {
  console.error(
    "Error: DISCORD_TOKEN or DISCORD_APPLICATION_ID is not defined.",
  );
  process.exit(1);
}

async function registerCommands() {
  // Guild commands update instantly, global commands can take up to an hour.
  const url = guildId
    ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${applicationId}/commands`;

  console.log(`Registering commands to: ${guildId ? `Guild ${guildId}` : "Global"}`);

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
    const data = await response.json();
    console.log(`Registered ${data.length} commands.`);
  } else {
    console.error("Failed to register commands.");
    const errorData = await response.json();
    console.error(JSON.stringify(errorData, null, 2));
    process.exit(1);
  }
}

registerCommands();
