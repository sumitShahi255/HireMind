import axios from "axios";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const doAskAi = async (messages, isJson = true, temperature = 0, modelOverride = null) => {
  let models = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "groq/compound",
    "groq/compound-mini"
  ];
  
  if (modelOverride) {
    models.unshift(modelOverride);
    models = [...new Set(models)];
  }

  let lastError = null;

  for (const model of models) {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        let finalMessages = messages;
        if (isJson) {
          finalMessages = [
            {
              role: "system",
              content: `
Return ONLY valid JSON.

Rules:
- Use double quotes only
- No markdown
- No explanation
- No extra text
- Output must be parsable by JSON.parse()
`
            },
            ...messages
          ];
        }

        console.log(`Calling Groq API with model: ${model}... (Attempt ${retries + 1})`);
        const response = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model: model,
            messages: finalMessages,
            temperature: temperature,
            max_tokens: 1500,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.groq_API_KEY}`,
              "Content-Type": "application/json",
              "user-agent": "Mozilla/5.0"
            },
            timeout: 20000 
          }
        );

        let content = response?.data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("AI returned empty response");
        }

        if (content.includes("<think>")) {
          const thinkStart = content.indexOf("<think>");
          const thinkEnd = content.indexOf("</think>");
          if (thinkEnd !== -1) {
            content = content.substring(0, thinkStart) + content.substring(thinkEnd + 8);
          } else {
            content = content.substring(0, thinkStart);
          }
        }
        content = content.trim();
        content = content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        return content;

      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        const errorData = error.response?.data;
        const isRateLimit = status === 429 || JSON.stringify(errorData || "").includes("rate_limit_exceeded");

        if (isRateLimit) {
          retries++;
          if (retries < maxRetries) {
            const backoff = retries * 3000; // 3s, 6s
            console.warn(`Rate limited (429) on ${model}. Waiting ${backoff}ms before retrying same model...`);
            await sleep(backoff);
            continue; // retry same model
          } else {
             console.warn(`Exhausted retries on ${model}. Moving to next model...`);
             break; // break inner while loop, moves to next model in for loop
          }
        } else if (status === 400 && JSON.stringify(errorData || "").includes('decommissioned')) {
          console.warn(`Groq Model ${model} is decommissioned. Skipping...`);
          break;
        } else if (status >= 500) {
          console.warn(`Groq Server Error (${status}) on ${model}. Skipping...`);
          break;
        } else {
          console.error(`Groq API Error on ${model}:`, error.response?.data || error.message);
          break; 
        }
      }
    }
  }

  throw lastError || new Error("All Groq model fallbacks exhausted");
};


// Queue system to prevent Concurrent API Rate Limiting (HTTP 429 & HTTP 404 cascading)
const requestQueue = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const { resolve, reject, args } = requestQueue.shift();
    try {
      const result = await doAskAi(...args);
      resolve(result);
    } catch (err) {
      reject(err);
    }
    // Wait 2 seconds between sequential API calls to ensure token buckets refill 
    // and rate limits are fully respected.
    await sleep(2000); 
  }
  
  isProcessingQueue = false;
};

export const askAi = (...args) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, args });
    processQueue();
  });
};