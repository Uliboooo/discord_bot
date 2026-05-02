import { Hono } from 'hono'
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions'

type Bindings = {
  DISCORD_PUBLIC_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.text('Worker is running!'))

// === Sudden Death Generator (s2shi) ===
const get_dyn_len = (s: string) => {
  let l = 0;
  for (const c of [...s]) {
    const code = c.codePointAt(0)!;
    if (code <= 0x007f) {
      l += 1;
    } else {
      l += 2;
    }
  }
  return l;
}

const max_width = (s: string) => {
  const lines = s.split('\n');
  let max = 0;
  for (const l of lines) {
    const len = get_dyn_len(l);
    if (len > max) max = len;
  }
  return max;
}

const s2shi = (s: string) => {
  const max_w = Math.floor(max_width(s) / 2) + 2;
  const top = `＿${"人".repeat(max_w)}＿\n`;
  const btm = `￣${"Y^".repeat(max_w)}￣`;

  const lines = s.split('\n');
  let buf_lines = top;
  for (const l of lines) {
    buf_lines += `＞　${l}　＜\n`;
  }
  buf_lines += btm;

  return buf_lines;
}

const handleInteractions = async (c: any) => {
  const signature = c.req.header('x-signature-ed25519')
  const timestamp = c.req.header('x-signature-timestamp')

  if (!signature || !timestamp) {
    return c.text('missing signature', 401)
  }

  const body = await c.req.text()

  if (!c.env.DISCORD_PUBLIC_KEY) {
    console.error('DISCORD_PUBLIC_KEY is not defined')
    return c.text('Configuration error', 500)
  }

  const isValid = await verifyKey(
    body,
    signature,
    timestamp,
    c.env.DISCORD_PUBLIC_KEY
  )

  if (!isValid) {
    return c.text('invalid request signature', 401)
  }

  let interaction: any
  try {
    interaction = JSON.parse(body)
  } catch {
    return c.text('invalid json', 400)
  }

  if (interaction.type === InteractionType.PING) {
    return c.json({ type: InteractionResponseType.PONG })
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = interaction.data

    if (name === 'ping') {
      const messageOption = options?.find((opt: any) => opt.name === 'message')
      const userMessage = messageOption ? messageOption.value : null
      const responseContent = userMessage ? `pong! (Message: ${userMessage})` : 'pong!'

      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: responseContent,
        },
      })
    }

    if (name === 'shi') {
      const messageOption = options?.find((opt: any) => opt.name === 'message')
      const userMessage = messageOption ? messageOption.value : '突然の死'
      const result = s2shi(userMessage)

      return c.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `\n${result}\n`,
        },
      })
    }
  }

  return c.json({ error: 'Unknown interaction type' }, 400)
}

app.post('/interactions', handleInteractions)
app.post('/', handleInteractions)

export default app
