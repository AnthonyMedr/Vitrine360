type AiMessage = {
  role: "system" | "user";
  content: string;
};

type AiRequest = {
  messages: AiMessage[];
};

const fallbackAiBaseUrl = "https://api.openai.com/v1/chat/completions";
const fallbackAiModel = "gpt-4.1-mini";

function readEnv(name: string) {
  return process.env[name];
}

export function getAiRuntimeConfig() {
  const provider = readEnv("AI_PROVIDER") || "openai-compatible";
  const apiKey = readEnv("AI_API_KEY") || "";
  const baseUrl = readEnv("AI_BASE_URL") || fallbackAiBaseUrl;
  const model = readEnv("AI_MODEL") || fallbackAiModel;
  const mock =
    provider === "mock" || readEnv("AI_MOCK") === "1" || process.env.NODE_ENV === "test" || !apiKey;

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    mock,
  };
}

export async function requestAiJson({ messages }: AiRequest) {
  const config = getAiRuntimeConfig();
  if (config.mock) {
    throw new Error("AI_MOCK_MODE");
  }

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (response.status === 429) {
    throw new Error("Muitas requisicoes. Tente novamente em instantes.");
  }

  if (response.status === 402) {
    throw new Error("Credito de IA indisponivel para esta operacao.");
  }

  if (!response.ok) {
    throw new Error(`Falha no provedor de IA (${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}
