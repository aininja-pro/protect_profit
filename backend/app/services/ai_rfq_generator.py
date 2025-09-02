import openai
import os
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

class AIRFQGenerator:
    def __init__(self):
        # Get OpenAI API key from environment
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if self.openai_api_key:
            openai.api_key = self.openai_api_key
    
    def generate_rfq(self, scope_description: str, project_context: Optional[Dict[str, Any]] = None) -> str:
        """Generate professional RFQ from scope description using OpenAI"""
        
        system_prompt = """You are an expert construction project manager and procurement specialist with 20+ years of experience writing Request for Quotes (RFQs) for commercial and residential construction projects. Your task is to transform brief scope descriptions into comprehensive, professional RFQs that will get accurate, competitive bids from qualified contractors."""
        
        user_prompt = f"""Generate a detailed, professional Request for Quote (RFQ) based on the following scope of work:

**SCOPE INPUT:** {scope_description}

Create a comprehensive RFQ that includes:

### 1. DETAILED SCOPE EXPANSION
- Break down each scope item into specific, measurable tasks
- Include industry-standard specifications and requirements
- Define quality standards and acceptance criteria
- Specify materials, methods, and equipment requirements where applicable

### 2. DELIVERABLES & MILESTONES
- List all expected deliverables
- Define clear completion milestones
- Include any phasing or sequencing requirements

### 3. CONTRACTOR REQUIREMENTS
- Required licenses, certifications, and insurance
- Experience qualifications
- Safety requirements and compliance standards
- Required submittals (shop drawings, material data, samples, etc.)

### 4. PRICING STRUCTURE
- Request detailed line-item pricing breakdown
- Include unit prices where applicable
- Request alternate pricing options if relevant
- Define payment terms and schedule expectations

### 5. TIMELINE & SCHEDULING
- Requested start and completion dates
- Key milestone dates
- Working hours and site access restrictions
- Coordination requirements with other trades

### 6. SITE CONDITIONS & LOGISTICS
- Access requirements
- Storage and staging areas
- Existing conditions that may impact work
- Protection requirements for existing facilities

### 7. QUALITY & COMPLIANCE
- Applicable codes and standards
- Inspection requirements
- Testing and commissioning requirements
- Warranty expectations

### 8. SUBMISSION REQUIREMENTS
- Documents required with quote
- Format for submission
- Questions deadline
- Quote validity period

### FORMATTING REQUIREMENTS:
- Use clear, professional language
- Include specific quantities and measurements where they can be reasonably inferred
- Use industry-standard terminology
- Structure content with clear headings and bullet points
- Be thorough but concise
- Include placeholder brackets [  ] for project-specific information that needs to be filled in

### TONE:
- Professional and businesslike
- Clear and unambiguous
- Detailed enough to prevent misunderstandings
- Fair and reasonable in requirements

Generate the complete RFQ now:"""

        try:
            if not self.openai_api_key:
                # Return enhanced mock if no API key
                return self._generate_mock_enhancement(scope_description)
            
            from openai import OpenAI
            client = OpenAI(api_key=self.openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o",  # Use latest model
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2000,
                temperature=0.3  # Lower temperature for more consistent, professional output
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            # Fallback to enhanced mock
            return self._generate_mock_enhancement(scope_description)
    
    def _generate_mock_enhancement(self, scope_description: str) -> str:
        """Generate enhanced scope using rule-based logic when OpenAI is unavailable"""
        
        lines = scope_description.split('\n')
        project_title = lines[0].replace('SCOPE OF WORK: ', '') if lines else "Construction Work"
        
        enhanced = f"""REQUEST FOR QUOTE - {project_title.upper()}

**Project:** [Project Name]
**Location:** [Project Address]  
**RFQ Issue Date:** [Date]
**Quote Due Date:** [Date + 10 days]

## 1. SCOPE OF WORK

{scope_description}

## 2. DETAILED REQUIREMENTS

### 2.1 General Requirements
• All work shall be performed per approved construction documents and specifications
• Contractor shall coordinate with general contractor and other trades
• Maintain safe working conditions and comply with all safety regulations
• Provide all labor, materials, equipment, and services required for complete installation

### 2.2 Materials & Standards  
• All materials shall be new, first quality, and meet or exceed specified standards
• Provide manufacturer warranties and certificates of compliance
• Submit material samples for approval where required
• Materials to be delivered and stored per manufacturer recommendations

### 2.3 Quality & Compliance
• Work shall comply with all applicable building codes and standards
• Provide all required permits, licenses, and certifications
• Allow for inspections as required by authorities having jurisdiction
• Correct any deficient work at no additional cost

## 3. SUBMISSION REQUIREMENTS

### 3.1 Quote Format
• Provide lump sum pricing for complete scope
• Include detailed breakdown by major work categories
• List any exclusions, assumptions, or alternates clearly
• Include timeline with major milestones

### 3.2 Required Documentation
• Current certificate of insurance
• Business license and any required trade certifications
• List of recent similar project references
• Proposed project schedule

### 3.3 Questions & Clarifications
• Submit all questions by [Date - 3 days]
• Questions will be answered via addendum to all bidders
• Site visits available by appointment

## 4. EVALUATION CRITERIA
• Total cost (40%)
• Project timeline and schedule (25%)
• Relevant experience and references (20%)
• Quality of submission and attention to detail (15%)

**Quote Validity:** 30 days from submission
**Expected Award Date:** [Date + 2 weeks]

Thank you for your participation in this project."""

        return enhanced

# Global instance
ai_rfq_generator = AIRFQGenerator()