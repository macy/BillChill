from flask import Flask, render_template, request
import pdfplumber
import os
from openai import OpenAI

app = Flask(__name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY_HERE"))

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Preloaded provider rules PDFs
PROVIDER_RULES = {
    "United": "C:/Users/ximud/OneDrive/Desktop/PDF Reading HealthCare/United Healthcare Charge Policy.pdf",
    "Providence": "C:/Users/ximud/OneDrive/Desktop/PDF Reading HealthCare/Providence HealthCare Charge.pdf",
    "Molina": "C:/Users/ximud/OneDrive/Desktop/PDF Reading HealthCare/Molina HealthCare Charge.pdf",
    "CMS": "C:/Users/ximud/OneDrive/Desktop/PDF Reading HealthCare/CMS Charge.pdf"
}

def extract_text_from_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def ai_check_overcharges(rules_text, bill_text):
    prompt = f"""
You are a hospital billing auditor AI.

Hospital Rules:
{rules_text}

Patient Bill:
{bill_text}

Instructions:
- Identify overcharges in the patient bill based on hospital rules.
- For each, provide line number, service, amount, and reason.
- If none, say "No overcharges detected".
"""
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    return response.choices[0].message.content

def draft_dispute_letter(patient_name, hospital_name, bill_text, ai_overcharge_report):
    prompt = f"""
Draft a formal letter to dispute overcharges for {patient_name} at {hospital_name}.
Reference the following overcharges and request correction.

Overcharges:
{ai_overcharge_report}
"""
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    return response.choices[0].message.content

@app.route('/')
def home():
    return render_template('index.html', providers=list(PROVIDER_RULES.keys()))

@app.route('/analyze', methods=['POST'])
def analyze():
    provider = request.form.get('provider')
    uploaded_rules = request.files.get('rules_pdf')
    bill_file = request.files.get('bill_pdf')

    if not bill_file:
        return "Please upload a patient bill PDF.", 400

    # Save uploaded bill
    bill_path = os.path.join(UPLOAD_FOLDER, bill_file.filename)
    bill_file.save(bill_path)
    bill_text = extract_text_from_pdf(bill_path)

    # Determine rules PDF
    if uploaded_rules:
        rules_path = os.path.join(UPLOAD_FOLDER, uploaded_rules.filename)
        uploaded_rules.save(rules_path)
    elif provider in PROVIDER_RULES:
        rules_path = PROVIDER_RULES[provider]
    else:
        return "No rules PDF selected or provider invalid.", 400

    rules_text = extract_text_from_pdf(rules_path)

    # Run AI logic
    ai_result = ai_check_overcharges(rules_text, bill_text)
    dispute_letter = draft_dispute_letter("John Doe", provider if provider else "Custom Provider", bill_text, ai_result)

    return render_template('index.html', 
                           providers=list(PROVIDER_RULES.keys()), 
                           ai_result=ai_result, 
                           dispute_letter=dispute_letter)

if __name__ == '__main__':
    app.run(debug=True)
