import * as fs from 'fs';
import path from 'path';
import { TemplateHandler } from 'easy-template-x';

/**
 * Fill a DOCX template with the provided data (placeholders -> values).
 * Returns a Buffer of the resulting .docx file.
 */
export async function fillDocxTemplate(
  templateName: string,
  data: Record<string, any>
): Promise<Buffer> {
  // Load the template from /public/templates/
  const templatePath = path.join(process.cwd(), 'public', 'templates', templateName);
  const templateFile = fs.readFileSync(templatePath);

  // Tell easy-template-x that tags are {{likeThis}}
  const handler = new TemplateHandler({
    delimiters: {
      tagStart: '{{',
      tagEnd: '}}',
      // containerTagOpen/Close are only needed for loops/conditions; omit for simple tags
      // containerTagOpen: '#',
      // containerTagClose: '/',
      // tagOptionsStart: '[',
      // tagOptionsEnd: ']',
    },
  });

  // Replace undefined/null with empty string to avoid gaps
  const safeData: Record<string, any> = {};
  for (const [k, v] of Object.entries(data || {})) {
    safeData[k] = v ?? '';
  }
  console.log('safeData keys sample:', Object.keys(safeData).slice(0, 10));

  // Process template
  const doc = await handler.process(templateFile, safeData);

  // Return as Buffer
  return doc as unknown as Buffer;
}
