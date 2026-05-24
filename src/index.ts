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
  const signature = c.req.header("x-signature-ed25519");
  const timestamp = c.req.header("x-signature-timestamp");

  if (!signature || !timestamp) {
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
    return c.text("invalid request signature", 401);
  }

  let interaction: any;
  try {
    interaction = JSON.parse(body);
  } catch {
    return c.text("invalid json", 400);
  }

  if (interaction.type === InteractionType.PING) {
    return c.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name } = interaction.data;
    const command = commands.find((cmd) => cmd.data.name === name);

    if (command) {
      return c.json(command.execute(interaction, c.env, c.executionCtx));
    }
  }

  return c.json({ error: "Unknown interaction type" }, 400);
};

app.post("/interactions", handleInteractions);
app.post("/", handleInteractions);

export default app;
