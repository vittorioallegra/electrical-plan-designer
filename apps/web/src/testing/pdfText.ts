// Test helper: page count and text of a generated PDF, extracted with pdfjs (Node only).
export async function pdfText(bytes: ArrayBuffer): Promise<{ pages: number; text: string[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const text: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    text.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return { pages: pdf.numPages, text };
}
