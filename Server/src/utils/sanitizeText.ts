export const sanitizePlainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
