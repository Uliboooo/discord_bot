import { GoogleGenAI } from "@google/genai";
import { InteractionResponseType } from "discord-interactions";
import prompt from "../resource/prompts.json";
import allow_list from "../resource/allow_user_list.json" with { type: "json" };

export const data = {
  name: "summarize",
  description: "reply summary of your selected messages history",
  options: [
    {
      name: "range",
      description: "reply summary of your selected messages history",
      type: 3, // STRING
      required: false,
      choises: [
        { name: "last 30min", value: "0.5h" },
        { name: "last hour", value: "1h" },
        { name: "last 2 hours", value: "2h" },
        { name: "last 3 hours", value: "3h" },
        { name: "last 12 hours", value: "12h" },
        { name: "last 24 hours", value: "24h" },
      ],
    },
  ],
};

const rangeMap = {
  "0.5h": 30,
  "1h": 60,
  "2h": 120,
  "3h": 180,
  "12h": 720,
  "24h": 1440,
};

const allow_users: string[] = allow_list.allow_list;

const DISCORD_EPOCH = 1420070400000n;

interface Env {
  DISCORD_BOT_TOKEN: string;
  DISCORD_APP_ID: string;
  GEMINI_API_KEY: string;
  CHANNEL_ID: string;
  ctx: ExecutionContext;
}

interface DiscordAttachment {
  url: string;
}

interface DiscordAuthor {
  id: string;
  username: string;
}

interface DiscordMessage {
  id: string;
  author: DiscordAuthor;
  content: string;
  timestamp: string;
  attachments: DiscordAttachment[];
}

interface MessageRecord {
  senderName: string;
  senderId: string;
  timestamp: Date;
  content: string;
  attachments: string[];
}

interface GetMessagesOptions {
  after?: Date;
  before?: Date;
  limit?: number;
}

/**
 * Format Date to Snowflake
 */
function dateToSnowflake(date: Date): string {
  const ms = BigInt(date.getTime()) - DISCORD_EPOCH;
  return (ms << 22n).toString();
}

async function fetchChannelMessages(
  channelId: string,
  env: Env,
  options: GetMessagesOptions = {},
): Promise<MessageRecord[]> {
  const { after, before, limit = 50 } = options;

  const params = new URLSearchParams();
  params.set("limit", String(Math.min(limit, 100)));
  if (after) params.set("after", dateToSnowflake(after));
  if (before) params.set("before", dateToSnowflake(before));

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?${params}`,
    {
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
  }

  const messages = (await res.json()) as DiscordMessage[];

  return messages
    .reverse() // sort by older
    .map((msg) => ({
      senderName: msg.author.username,
      senderId: msg.author.id,
      timestamp: new Date(msg.timestamp),
      content: msg.content,
      attachments: msg.attachments.map((a) => a.url),
    }))
    .filter((m) => allow_users.includes(m.senderId));
}

async function summarize(message: string, env: Env) {
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const systemPrompt = prompt[0]?.prompt || "Summarize this message history:";
  const fullPrompt = `${systemPrompt}\n\n${message}`;

  const response = await client.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function execute(interaction: any, env: Env, ctx: ExecutionContext) {
  const options = interaction.data.options;
  const input_range = options?.find((opt: any) => opt.name === "range");
  const get_range = input_range ? input_range.value : null;

  const minutes =
    get_range !== null && get_range in rangeMap
      ? rangeMap[get_range as keyof typeof rangeMap]
      : 60;

  const c_id = interaction.channel_id;
  const after_date = new Date(Date.now() - minutes * 60000);

  const deferResponse = {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {},
  };

  const appId = env.DISCORD_APPLICATION_ID;
  const token = interaction.token;

  ctx.waitUntil(
    (async () => {
      const history = await fetchChannelMessages(c_id, env, {
        after: after_date,
        limit: 100,
      });

      const formatted =
        history
          .map(
            (m) =>
              `[${m.timestamp.toLocaleString("ja-JP")}] ${m.senderName}: ${m.content}`,
          )
          .join("\n") || "メッセージが見つかりませんでした";

      const sum = await summarize(formatted, env);

      await fetch(
        `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: sum }),
        },
      );
    })(),
  );

  return deferResponse;
}
