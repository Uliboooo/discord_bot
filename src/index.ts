import { Hono } from "hono";
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";
import { commands } from "./commands";

type Bindings = {
  DISCORD_PUBLIC_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => c.text("Worker is running!"));

const handleInteractions = async (c: any) => {
  console.log("Incoming interaction...");
  const signature = c.req.header("x-signature-ed25519");
  const timestamp = c.req.header("x-signature-timestamp");

  if (!signature || !timestamp) {
    console.log("Missing signature or timestamp");
    return c.text("missing signature", 401);
  }

  const body = await c.req.text();

  if (!c.env.DISCORD_PUBLIC_KEY) {
    console.error("DISCORD_PUBLIC_KEY is not defined");
    return c.text("Configuration error", 500);
  }

  const isValid = await verifyKey(
    body,
    signature,
    timestamp,
    c.env.DISCORD_PUBLIC_KEY,
  );

  if (!isValid) {
    console.log("Invalid request signature");
    return c.text("invalid request signature", 401);
  }

  let interaction: any;
  try {
    interaction = JSON.parse(body);
  } catch {
    console.log("Invalid JSON body");
    return c.text("invalid json", 400);
  }

  console.log(`Interaction type: ${interaction.type}`);
  const user = interaction.member?.user || interaction.user;
  console.log(`User: ${user?.username} (ID: ${user?.id})`);

  if (interaction.type === InteractionType.PING) {
    console.log("Handling PING");
    return c.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name } = interaction.data;
    console.log(`Handling command: ${name}`);
    const command = commands.find((cmd) => cmd.data.name === name);

    if (command) {
      console.log(`Command found: ${name}. Executing...`);
      try {
        const response = await command.execute(interaction, c.env, c.executionCtx);
        console.log(`Command ${name} executed successfully.`);
        return c.json(response);
      } catch (error) {
        console.error(`Error executing command ${name}:`, error);
        return c.json({ error: "Internal server error" }, 500);
      }
    } else {
      console.log(`Command NOT found: ${name}`);
    }
  }

  console.log("Unknown interaction type or command");
  return c.json({ error: "Unknown interaction type" }, 400);
};

app.post("/interactions", handleInteractions);
app.post("/", handleInteractions);

export default app;
