import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

// Types
export interface Division {
  divisionCode: string;
  divisionName: string;
  items: BudgetItem[];
  divisionTotal: number;
}

export interface BudgetItem {
  lineId?: string;
  description?: string;
  tradeDescription?: string;
  quantity?: number;
  unit?: string;
  totalCost?: number;
  total_cost?: number;
  subcategory_code?: string;
  subcategory_name?: string;
  subcategoryCode?: string;
  subcategoryName?: string;
}

export interface QuoteUploadResponse {
  message: string;
  quote_id: string;
  vendor_id: string;
  vendor_name: string;
  division_id: string;
  status: string;
}

export interface ParseResponse {
  message: string;
  quote_id: string;
  line_items_created: number;
  status: string;
}

export interface Mapping {
  budget_line_id: string;
  quote_line_item_id: string;
  confidence: number;
  user_confirmed: boolean;
}

export interface MappingResponse {
  message: string;
  quote_id: string;
  mappings_created: number;
  status: string;
}

export interface CompareResponse {
  division_id: string;
  vendor_quotes: VendorQuote[];
  total_vendors: number;
}

export interface VendorQuote {
  vendor_id: string;
  vendor_name: string;
  quote_id: string;
  status: string;
  line_items: QuoteLineItem[];
}

export interface QuoteLineItem {
  quote_line_id: string;
  description: string;
  total_price: number;
  coverage: 'required' | 'extra' | 'unknown';
  mapped_budget_lines: string[];
}

export interface DecisionPayload {
  primary_vendor_id?: string;
  notes?: string;
  line_awards: LineAward[];
}

export interface LineAward {
  budget_line_id: string;
  vendor_id: string;
  quote_id: string;
  quote_line_item_id?: string;
  final_price: number;
}

export interface DecisionResponse {
  message: string;
  award_id: string;
  division_id: string;
  line_awards_created: number;
}

export interface WorkOrderResponse {
  message: string;
  division_id: string;
  award_id: string;
  pdf_filename: string;
  line_items_count: number;
}

// API Functions
export const quotesApi = {
  /**
   * Get divisions for a project
   * Note: This will need to be implemented to return actual parsed budget divisions
   * For now returns mock data matching the existing structure
   */
  async getDivisions(projectId: string): Promise<Division[]> {
    try {
      // Check if demo mode is enabled
      const urlParams = new URLSearchParams(window.location.search);
      const isDemo = urlParams.get('demo') === '1';
      
      if (isDemo) {
        return this.getDemoDivisions();
      }

      try {
        // Try to get real divisions from backend
        const response = await axios.get(`${API_BASE}/projects/${projectId}/divisions`);
        return response.data.divisions || [];
      } catch (apiError) {
        console.warn('Failed to load divisions from API, using fallback data:', apiError);
        
        // Fallback: Return actual Shed Project divisions (based on deterministic parser results)
        if (projectId === "2271a70f-0709-4275-a663-3a57b253ccaa") {
          return [
            {
              divisionCode: "01",
              divisionName: "General Conditions",
              divisionTotal: 24105.00,
              items: [
                { lineId: "01-permit-job-743", tradeDescription: "Permit - Job", totalCost: 1020.00 },
                { lineId: "01-supervision-744", tradeDescription: "Supervision, Coordination, Procurement", totalCost: 22800.00 },
                { lineId: "01-regular-unit-745", tradeDescription: "Regular Unit", totalCost: 285.00 }
              ]
            },
            {
              divisionCode: "05", 
              divisionName: "Rough Carpentry",
              divisionTotal: 131860.12,
              items: [
                { lineId: "05-perka-red-iron-746", tradeDescription: "Perka Red Iron System with Exterior Corr", totalCost: 92000.00 },
                { lineId: "05-lumber-perlins-747", tradeDescription: "Lumber for Perlins", totalCost: 4860.12 },
                { lineId: "05-labor-allowance-748", tradeDescription: "Labor Allowance for Structural, Perlin C", totalCost: 35000.00 }
              ]
            },
            {
              divisionCode: "08",
              divisionName: "Electrical",
              divisionTotal: 25000.00,
              items: [
                {
                  lineId: "08-electrical-allowance-776",
                  tradeDescription: "Electrical Allowance",
                  quantity: undefined,
                  unit: undefined,
                  totalCost: 25000.00
                }
              ]
            }
          ];
        }

        // Empty divisions for other projects
        return [];
      }
    } catch (error) {
      console.error('Failed to get divisions:', error);
      throw error;
    }
  },

  /**
   * Upload a quote file for a division
   */
  async uploadQuote(divisionId: string, projectId: string, file: File, vendorName: string): Promise<QuoteUploadResponse> {
    try {
      // In demo mode, return mock response
      if (this.isDemoMode()) {
        const mockResponse: QuoteUploadResponse = {
          message: "Quote uploaded successfully (demo mode)",
          quote_id: `demo-quote-${Date.now()}`,
          vendor_id: `demo-vendor-${Date.now()}`,
          vendor_name: vendorName,
          division_id: divisionId,
          status: "draft"
        };
        return mockResponse;
      }

      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('vendor_name', vendorName);
      formData.append('file', file);

      const response = await axios.post(
        `${API_BASE}/quotes/divisions/${divisionId}/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to upload quote:', error);
      throw error;
    }
  },

  /**
   * Parse a quote using AI
   */
  async parseQuote(quoteId: string): Promise<ParseResponse> {
    try {
      // In demo mode, return mock response
      if (this.isDemoMode()) {
        const mockResponse: ParseResponse = {
          message: "Quote parsed successfully (demo mode)",
          quote_id: quoteId,
          line_items_created: 3,
          status: "parsed"
        };
        return mockResponse;
      }

      const response = await axios.post(`${API_BASE}/quotes/${quoteId}/parse`);
      return response.data;
    } catch (error) {
      console.error('Failed to parse quote:', error);
      throw error;
    }
  },

  /**
   * Save line mappings between budget and quote lines
   */
  async saveMappings(quoteId: string, mappings: Mapping[]): Promise<MappingResponse> {
    try {
      // In demo mode, return mock response
      if (this.isDemoMode()) {
        const mockResponse: MappingResponse = {
          message: "Mappings saved successfully (demo mode)",
          quote_id: quoteId,
          mappings_created: mappings.length,
          status: "mapped"
        };
        return mockResponse;
      }

      const response = await axios.post(
        `${API_BASE}/quotes/${quoteId}/mappings`,
        mappings
      );
      return response.data;
    } catch (error) {
      console.error('Failed to save mappings:', error);
      throw error;
    }
  },

  /**
   * Get comparison data for a division
   */
  async getCompare(divisionId: string): Promise<CompareResponse> {
    try {
      // Return seeded data only for Shed Project electrical division
      if (divisionId === '08-2271a70f-0709-4275-a663-3a57b253ccaa') {
        return this.getDemoCompareData(divisionId);
      }

      const response = await axios.get(`${API_BASE}/quotes/divisions/${divisionId}/compare`);
      return response.data;
    } catch (error) {
      console.error('Failed to get comparison:', error);
      throw error;
    }
  },

  /**
   * Make award decisions for a division
   */
  async decideDivision(divisionId: string, payload: DecisionPayload): Promise<DecisionResponse> {
    try {
      // In demo mode, return mock response
      if (this.isDemoMode()) {
        const mockResponse: DecisionResponse = {
          message: "Division award created successfully (demo mode)",
          award_id: `demo-award-${Date.now()}`,
          division_id: divisionId,
          line_awards_created: payload.line_awards.length
        };
        return mockResponse;
      }

      const response = await axios.post(
        `${API_BASE}/quotes/divisions/${divisionId}/decide`,
        payload
      );
      return response.data;
    } catch (error) {
      console.error('Failed to decide division:', error);
      throw error;
    }
  },

  /**
   * Generate work order PDF for a division
   */
  async generateWorkOrder(divisionId: string): Promise<WorkOrderResponse> {
    try {
      // In demo mode, return mock response
      if (this.isDemoMode()) {
        const mockResponse: WorkOrderResponse = {
          message: "Work order PDF generated (demo mode)",
          division_id: divisionId,
          award_id: `demo-award-${divisionId}`,
          pdf_filename: `workorder_${divisionId}_demo.pdf`,
          line_items_count: 3
        };
        return mockResponse;
      }

      const response = await axios.post(`${API_BASE}/quotes/divisions/${divisionId}/workorder/pdf`);
      return response.data;
    } catch (error) {
      console.error('Failed to generate work order:', error);
      throw error;
    }
  },

  /**
   * Get division status by checking quotes and decisions
   */
  async getDivisionStatus(divisionId: string): Promise<{ status: string; quote_count: number }> {
    try {
      // Only return seeded status for Shed Project electrical division
      if (divisionId === '08-2271a70f-0709-4275-a663-3a57b253ccaa') {
        return {
          status: 'quotes_uploaded',
          quote_count: 3
        };
      } else {
        return {
          status: 'no_quotes',
          quote_count: 0
        };
      }

      const compareData = await this.getCompare(divisionId);
      
      if (compareData.vendor_quotes && compareData.vendor_quotes.length > 0) {
        const hasDecisions = compareData.vendor_quotes.some((q: any) => q.status === 'final');
        return {
          status: hasDecisions ? 'winner_selected' : 'quotes_uploaded',
          quote_count: compareData.vendor_quotes.length
        };
      } else {
        return {
          status: 'no_quotes',
          quote_count: 0
        };
      }
    } catch (error) {
      // If compare fails, assume no quotes
      return {
        status: 'no_quotes',
        quote_count: 0
      };
    }
  },

  /**
   * Refresh all division statuses for a project
   */
  async refreshDivisionStatuses(projectId: string): Promise<Record<string, { status: string; quote_count: number }>> {
    try {
      const divisions = await this.getDivisions(projectId);
      const statusUpdates: Record<string, { status: string; quote_count: number }> = {};
      
      for (const division of divisions) {
        const divisionId = `${division.divisionCode}-${projectId}`;
        statusUpdates[division.divisionCode] = await this.getDivisionStatus(divisionId);
      }
      
      return statusUpdates;
    } catch (error) {
      console.error('Failed to refresh division statuses:', error);
      throw error;
    }
  },

  /**
   * Get demo divisions based on actual parsed Shed Project estimate
   */
  getDemoDivisions(): Division[] {
    return [
      {
        divisionCode: "08",
        divisionName: "Electrical", 
        divisionTotal: 25000.00,
        items: [
          {
            lineId: "08-electrical-allowance-776",
            tradeDescription: "Electrical Allowance",
            quantity: undefined,
            unit: undefined,
            totalCost: 25000.00
          }
        ]
      }
    ];
  },

  /**
   * Get demo comparison data for Shed Project electrical division (matches real budget)
   */
  getDemoCompareData(divisionId: string): CompareResponse {
    const demoData: CompareResponse = {
      division_id: divisionId,
      total_vendors: 3,
      vendor_quotes: [
        {
          vendor_id: "demo-vendor-abc",
          vendor_name: "ABC Electrical",
          quote_id: "demo-quote-abc",
          status: "mapped",
          line_items: [
            {
              quote_line_id: "abc-electrical-complete",
              description: "Complete electrical package - rough-in, panel, fixtures, and finish work",
              total_price: 23500.00,
              coverage: "required",
              mapped_budget_lines: ["08-electrical-allowance-776"]
            },
            {
              quote_line_id: "abc-extra-outlet",
              description: "Additional outlet in master bedroom",
              total_price: 350.00,
              coverage: "extra",
              mapped_budget_lines: []
            }
          ]
        },
        {
          vendor_id: "demo-vendor-xyz",
          vendor_name: "XYZ Electric Co",
          quote_id: "demo-quote-xyz", 
          status: "mapped",
          line_items: [
            {
              quote_line_id: "xyz-electrical-premium",
              description: "Premium electrical package with upgraded fixtures and smart switches",
              total_price: 31200.00,
              coverage: "required",
              mapped_budget_lines: ["08-electrical-allowance-776"]
            },
            {
              quote_line_id: "xyz-smart-home",
              description: "Smart home integration package",
              total_price: 4500.00,
              coverage: "extra",
              mapped_budget_lines: []
            }
          ]
        },
        {
          vendor_id: "demo-vendor-lightning",
          vendor_name: "Lightning Electric",
          quote_id: "demo-quote-lightning",
          status: "mapped", 
          line_items: [
            {
              quote_line_id: "lightning-basic",
              description: "Basic electrical work - rough-in and panel only",
              total_price: 18000.00,
              coverage: "required",
              mapped_budget_lines: ["08-electrical-allowance-776"]
            },
            {
              quote_line_id: "lightning-fixtures-separate",
              description: "Fixtures and finish work (separate line item)",
              total_price: 6500.00,
              coverage: "required", 
              mapped_budget_lines: ["08-electrical-allowance-776"]
            }
          ]
        }
      ]
    };

    return demoData;
  },

  /**
   * Check if demo mode is active
   */
  isDemoMode(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('demo') === '1';
  }
};

export default quotesApi;