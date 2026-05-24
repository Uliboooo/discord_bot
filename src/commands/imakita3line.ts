import { GoogleGenAI } from "@google/genai";
import { InteractionResponseType } from "discord-interactions";
import prompt from "../resource/prompts.json";
import allow_list from "../resource/allow_user_list.json" with { type: "json" };

export const data = {
  name: "imakita3line",
  description: "Summarize the recent chat history into 3 concise lines",
  options: [
    {
      name: "range",
      description: "How far back to look",
      type: 3, // STRING
      required: false,
      choices: [
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

const rangeMap: Record<string, number> = {
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
  DISCORD_APPLICATION_ID: string;
  GEMINI_API_KEY: string;
}

interface DiscordMessage {
  id: string;
  author: { id: string; username: string };
  content: string;
  timestamp: string;
}

function dateToSnowflake(date: Date): string {
  const ms = BigInt(date.getTime()) - DISCORD_EPOCH;
  return (ms << 22n).toString();
}

async function fetchChannelMessages(
  channelId: string,
  env: Env,
  afterDate: Date,
) {
  const params = new URLSearchParams();
  params.set("limit", "100");
  params.set("after", dateToSnowflake(afterDate));

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?${params}`,
    {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    },
  );

  if (!res.ok) throw new Error(`Discord API error: ${res.status}`);
  const messages = (await res.json()) as DiscordMessage[];

  return messages
    .reverse()
    .filter((m) => allow_users.includes(m.author.id) || allow_users.includes(m.author.username))
    .map((m) => `[${new Date(m.timestamp).toLocaleString("ja-JP")}] ${m.author.username}: ${m.content}`)
    .join("\n");
}

async function getSummary(message: string, env: Env) {
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  // Use imakita-3line prompt
  const imakitaPrompt = prompt.find(p => p.name === "imakita-3line")?.prompt || "Summarize in 3 lines:";
  
  const response = await client.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ role: "user", parts: [{ text: `${imakitaPrompt}\n\n${message}` }] }],
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.text || "要約に失敗しました。";
}

export async function execute(interaction: any, env: Env, ctx: ExecutionContext) {
  const options = interaction.data.options;
  const rangeVal = options?.find((opt: any) => opt.name === "range")?.value || "1h";
  const minutes = rangeMap[rangeVal] || 60;
  const afterDate = new Date(Date.now() - minutes * 60000);

  const appId = env.DISCORD_APPLICATION_ID;
  const token = interaction.token;
  const webhookUrl = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;

  ctx.waitUntil(
    (async () => {
      try {
        const formattedHistory = await fetchChannelMessages(interaction.channel_id, env, afterDate);
        
        if (!formattedHistory) {
          await fetch(webhookUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "対象メッセージが見つかりませんでした。" }),
          });
          return;
        }

        let summary = await getSummary(formattedHistory, env);
        if (summary.length > 2000) summary = summary.substring(0, 1990) + "...";

        await fetch(webhookUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: summary }),
        });
      } catch (e) {
        console.error(e);
        await fetch(webhookUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `エラーが発生しました: ${e}` }),
        });
      }
    })(),
  );

  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {},
  };
}
