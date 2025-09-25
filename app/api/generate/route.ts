import { NextRequest, NextResponse } from 'next/server';
import { fillDocxTemplate } from '@/lib/docx';
import path from 'node:path';
import fs from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'models/gemini-2.0-flash';

// ADHD schema - includes AutismScreening field
const ADHD_SCHEMA = {
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

// Autism schema - includes ADHDScreening field instead of AutismScreening
const AUTISM_SCHEMA = {
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
  RecommendationsGeneral: "", ADHDScreening: "", ADHDMedication: "", SpeechLanguageOTEdPsych: "", PhysicalHealth: "", Sleep: "", MentalHealthSupport: "",
  SummaryAndClosing: "", ClinicianName: "", ClinicianTitle: ""
};

// Template configuration
const TEMPLATE_CONFIGS = {
  'cyp_adhd': {
    schema: ADHD_SCHEMA,
    filename: 'CYP ADHD.docx',
    outputName: 'CYP_ADHD_Report.docx',
    assessmentType: 'ADHD'
  },
  'cyp_autism': {
    schema: AUTISM_SCHEMA,
    filename: 'CYP Autism.docx',
    outputName: 'CYP_Autism_Report.docx',
    assessmentType: 'autism'
  }
};

function systemPrompt(templateType: string, extraNotes: string) {
  const config = TEMPLATE_CONFIGS[templateType as keyof typeof TEMPLATE_CONFIGS];
  if (!config) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  return `You are an assistant that converts an ${config.assessmentType} assessment questionnaire into a JSON object.
Strictly output JSON only — no text outside JSON. The JSON keys MUST match exactly these placeholders:
${JSON.stringify(config.schema, null, 2)}

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
    const templateType = (form.get('template') as string) || 'cyp_adhd';

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
            { text: systemPrompt(templateType, notes) }
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

    // Get the correct template config
    const config = TEMPLATE_CONFIGS[templateType as keyof typeof TEMPLATE_CONFIGS];
    if (!config) {
      return NextResponse.json({ error: 'Invalid template type' }, { status: 400 });
    }

    // Merge with appropriate schema
    const merged = { ...config.schema, ...data };
    console.log("Gemini JSON:", merged);
    console.log('Merged keys:', Object.keys(merged));

    // 3) Fill the DOCX template with the selected template file
    const buffer = await fillDocxTemplate(config.filename, merged);

    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    headers.set('Content-Disposition', `attachment; filename="${config.outputName}"`);
    try { headers.set('x-neurosense-json', encodeURIComponent(JSON.stringify(merged))); } catch {}

    // FIX: Return buffer directly instead of wrapping in Blob
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
