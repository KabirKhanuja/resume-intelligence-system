export type ExtractedTextResult = {
  text: string;
  format: "pdf" | "docx" | "txt" | "unknown";
};

export type UploadedFileLike = {
  originalname?: string;
  mimetype?: string;
  buffer: Buffer;
};

function detectFormat(file: UploadedFileLike): ExtractedTextResult["format"] {
  const name = (file.originalname ?? "").toLowerCase();
  const mime = (file.mimetype ?? "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) return "txt";

  return "unknown";
}

function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromUpload(file: UploadedFileLike): Promise<ExtractedTextResult> {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Invalid upload: missing file buffer");
  }

  const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(message)), ms);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const format = detectFormat(file);

  let text = "";
  if (format === "pdf") {
    const { extractText } = await import("unpdf");
    const uint8Array = new Uint8Array(file.buffer);
    const result = await withTimeout(
      extractText(uint8Array),
      8000,
      "PDF text extraction timed out (8s). Please try a different PDF or paste the text.",
    );
    text = String(result?.text ?? "");
  } else if (format === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    text = String((result as any)?.value ?? "");
  } else if (format === "txt") {
    text = file.buffer.toString("utf8");
  } else {
    text = file.buffer.toString("utf8");
  }

  text = cleanText(text);

  if (text.length < 50) {
    throw new Error(
      `Extracted text is too short (${text.length} chars). ` +
        "Please upload a text-based PDF/DOCX (not a scanned image) or paste the text.",
    );
  }

  return { text, format };
}
