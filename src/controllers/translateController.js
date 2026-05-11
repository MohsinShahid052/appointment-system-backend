const SUPPORTED_LANGUAGES = new Set(["en", "nl", "tr"]);

const decodeTranslatedText = (payload, fallbackText) => {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return fallbackText;
  }

  const segments = payload[0]
    .filter((item) => Array.isArray(item) && typeof item[0] === "string")
    .map((item) => item[0]);

  if (!segments.length) {
    return fallbackText;
  }

  return segments.join("");
};

const translateText = async (text, sourceLang, targetLang) => {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLang);
  url.searchParams.set("tl", targetLang);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Google translate request failed with status ${response.status}`);
  }

  const data = await response.json();
  return decodeTranslatedText(data, text);
};

export const translateUiTexts = async (req, res, next) => {
  try {
    const { texts = [], targetLang = "en", sourceLang = "en" } = req.body || {};

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ message: "texts must be a non-empty array" });
    }

    if (texts.length > 300) {
      return res.status(400).json({ message: "Too many texts in one request" });
    }

    if (!SUPPORTED_LANGUAGES.has(targetLang) || !SUPPORTED_LANGUAGES.has(sourceLang)) {
      return res.status(400).json({ message: "Unsupported language" });
    }

    const normalizedTexts = texts.map((item) => (typeof item === "string" ? item : "")).slice(0, 300);

    if (targetLang === sourceLang) {
      return res.json({ translations: normalizedTexts });
    }

    const translations = await Promise.all(
      normalizedTexts.map(async (text) => {
        const trimmed = text.trim();
        if (!trimmed) {
          return text;
        }

        try {
          return await translateText(text, sourceLang, targetLang);
        } catch (error) {
          return text;
        }
      })
    );

    return res.json({ translations });
  } catch (error) {
    next(error);
  }
};
