import { InteractionResponseType } from "discord-interactions";

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
};

const max_width = (s: string) => {
  const lines = s.split("\n");
  let max = 0;
  for (const l of lines) {
    const len = get_dyn_len(l);
    if (len > max) max = len;
  }
  return max;
};

const s2shi = (s: string) => {
  const max_w = Math.floor(max_width(s) / 2) + 2;
  const top = `＿${"人".repeat(max_w)}＿\n`;
  const btm = `￣${"Y^".repeat(max_w)}￣`;

  const lines = s.split("\n");
  let buf_lines = top;
  for (const l of lines) {
    buf_lines += `＞　${l}　＜\n`;
  }
  buf_lines += btm;

  return buf_lines;
};

export const data = {
  name: "shi",
  description: "突然の死ジェネレーター",
  options: [
    {
      name: "message",
      description: "表示するメッセージ",
      type: 3, // STRING
      required: false,
    },
  ],
};

export function execute(interaction: any) {
  const options = interaction.data.options;
  const messageOption = options?.find((opt: any) => opt.name === "message");
  const userMessage = messageOption ? messageOption.value : "突然の死";
  const result = s2shi(userMessage);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `\n${result}\n`,
    },
  };
}
