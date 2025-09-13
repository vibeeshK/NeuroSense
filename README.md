# NeuroSense_v1_0

Single-template ADHD report generator using Gemini and DOCX placeholders.

## Stack
- Next.js (App Router)
- Gemini `gemini-2.0-flash`
- Docxtemplater + PizZip

## Setup
1. `npm install`
2. Create `.env.local` with:
   ```
   GEMINI_API_KEY=YOUR_API_KEY_HERE
   ```
3. `npm run dev`

## Usage
- Upload the ADHD questionnaire (PDF/DOCX)
- Click **Generate Report**
- Click **Download .docx**

## Notes
- The DOCX template with placeholders lives at `public/templates/CYP_ADHD_RTC_Template.docx`.
- Gemini is instructed to return a strict JSON matching placeholder keys.
- If a key is missing, the placeholder remains in the output for easy debugging.
