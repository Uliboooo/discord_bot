import { InteractionResponseType } from "discord-interactions";

export const data = {
  name: "ping",
  description: "Replies with pong!",
  options: [
    {
      name: "message",
      description: "A message to echo back",
      type: 3, // STRING
      required: false,
    },
  ],
};

export function execute(interaction: any) {
  const options = interaction.data.options;
  const messageOption = options?.find((opt: any) => opt.name === "message");
  const userMessage = messageOption ? messageOption.value : null;
  const responseContent = userMessage
    ? `pong! (Message: ${userMessage})`
    : "pong!";

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: responseContent,
    },
  };
}
