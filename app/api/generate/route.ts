import { NextRequest, NextResponse } from 'next/server';
import { fillDocxTemplate } from '@/lib/docx';
import path from 'node:path';
import fs from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'models/gemini-2.0-flash';

// JSON schema that MUST match the placeholders in the DOCX
const PLACEHOLDER_SCHEMA = {
  AssessmentDate: "", ReportDate: "",
  ClientFirstName: "", ClientSurname: "", ClientAge: "", DOB: "", NHSNumber: "", ClientID: "", ClientAddress: "",
  AssessmentOutcome: "",
  AssessmentMode: "", HistoryProvidedBy: "", ChildPresenceConfirmation: "",
  WhoWeAssessed: "", Consent: "", UnderstandingOfAppointment: "", ReasonForReferral: "",
  PregnancyBirthHistory: "", BirthDetails: "", Allergies: "", Medications: "", Immunisations: "", Vision: "", Hearing: "", Safeguarding: "",
  Babyhood: "", DevelopmentalMilestones: "", SpeechLanguage: "", Regression: "", Toileting: "", NurseryStart: "", NurseryConcerns: "", SeparationAnxiety: "", SocialPlaySkills: "",
  HouseholdDetails: "", MothersAgeOccupation: "", FathersAgeOccupation: "", Siblings: "", FamilyHistory: "", SignificantLifeEvents: "",
  AnxietyMood: "", MentalHealthServices: "", SelfHarmSuicidalConcerns: "",
  AttentionAndConcentration: "", ActivityLevels: "", Impulsivity: "", RiskyBehaviours: "", DangerAwareness: "",
  ExecutiveFunctioning: "", EmotionalRegulation: "", SelfCareAndIndependence: "", SocialCommunication: "", FriendshipsAndRelationships: "", RestrictedRepetitiveBehaviours: "", SensoryIssues: "",
  Education: "", ObservationsFromClinicalInterview: "", PhysicalExamination: "",
  WhyDiagnosis: "",
  RecommendationsGeneral: "", AutismScreening: "", ADHDMedication: "", SpeechLanguageOTEdPsych: "", PhysicalHealth: "", Sleep: "", MentalHealthSupport: "",
  SummaryAndClosing: "", ClinicianName: "", ClinicianTitle: ""
};

function systemPrompt(extraNotes: string) {
  return `You are an assistant that converts an ADHD input questionnaire into a JSON object.
Strictly output JSON only — no text outside JSON. The JSON keys MUST match exactly these placeholders:
${JSON.stringify(PLACEHOLDER_SCHEMA, null, 2)}

Populate each field with the appropriate narrative text based on the uploaded file. If a field is not found, return an empty string for that key.
${extraNotes ? `\nAdditional clinician notes/instructions: ${extraNotes}` : ''}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const notes = (form.get('notes') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'application/octet-stream';
    const fileName = file.name || 'input';

    // 1) Upload the file to Gemini File API
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;
    const formData = new FormData();
    formData.append('file', new Blob([bytes], { type: mimeType }), fileName);

    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResp.ok) {
      const t = await uploadResp.text();
      console.error('Upload error:', t);
      return NextResponse.json({ error: 'Gemini upload failed', details: t }, { status: 500 });
    }

    const uploaded = await uploadResp.json();
    const fileUri = uploaded?.file?.uri || uploaded?.file?.name || '';
    const uploadedMime = uploaded?.file?.mimeType || mimeType;

    if (!fileUri) {
      return NextResponse.json({ error: 'Upload succeeded but no file URI returned', payload: uploaded }, { status: 500 });
    }

    // 2) Call Gemini with the file reference + schema prompt
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri, mimeType: uploadedMime } },
            { text: systemPrompt(notes) }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    const genResp = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!genResp.ok) {
      const t = await genResp.text();
      console.error('Generate error:', t);
      return NextResponse.json({ error: 'Gemini generate failed', details: t }, { status: 500 });
    }

    const genJson = await genResp.json();
    const text = genJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let data: Record<string, any> = {};
    try {
      data = text ? JSON.parse(text) : {};
      if (Array.isArray(data)) {
        data = data[0] || {};
      }
    } catch (e) {
      const cleaned = (text || '').replace(/^```json\n?|```$/g, '');
      data = cleaned ? JSON.parse(cleaned) : {};
      if (Array.isArray(data)) {
        data = data[0] || {};
      }
    }

    // Merge with schema
    const merged = { ...PLACEHOLDER_SCHEMA, ...data };
    console.log("Gemini JSON:", merged);
    console.log('Merged keys:', Object.keys(merged));

    // 3) Fill the DOCX template
    const buffer = await fillDocxTemplate("CYP_ADHD_RTC_Template.docx", merged);

    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    headers.set('Content-Disposition', 'attachment; filename="CYP_ADHD_RTC_Report.docx"');
    try { headers.set('x-neurosense-json', encodeURIComponent(JSON.stringify(merged))); } catch {}

    // FIX: Return buffer directly instead of wrapping in Blob
    return new NextResponse(buffer, { status: 200, headers });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
