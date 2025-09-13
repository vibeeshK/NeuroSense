import * as fs from 'fs';
import path from 'path';
import { TemplateHandler } from 'easy-template-x';

async function main() {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'CYP_ADHD_RTC_Template.docx');
  const templateFile = fs.readFileSync(templatePath);

  const handler = new TemplateHandler();

  // Parse template without data
  const template = await handler.parseTemplate(templateFile);

  console.log("Tags detected in template:");
  console.dir(template.tags, { depth: null });
}

main().catch(console.error);
