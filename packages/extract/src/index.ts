export type ProseBlock = {
  text: string;
  source: "paste" | "url";
  startOffset: number;
};

export function extractPlainText(input: string): ProseBlock[] {
  const text = input.trim();
  if (!text) return [];
  return [{ text, source: "paste", startOffset: 0 }];
}
