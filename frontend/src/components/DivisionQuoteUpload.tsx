import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { quotesApi, Division } from '../services/quotesApi';
import { analysisEngine } from '../services/analysisEngine';
import ProjectBreadcrumb from './ProjectBreadcrumb';

interface DivisionQuoteUploadProps {
  division: Division;
  divisionId: string;
  projectId: string;
  onUploaded: (quoteIds: string[]) => void;
}

interface UploadedQuote {
  file: File;
  vendor_name: string;
  status: 'pending' | 'uploading' | 'parsing' | 'parsed' | 'error';
  quote_id?: string;
  error_message?: string;
}

export default function DivisionQuoteUpload({ 
  division,
  divisionId, 
  projectId,
  onUploaded
}: DivisionQuoteUploadProps) {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<UploadedQuote[]>([]);
  const [vendorName, setVendorName] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      const newQuote: UploadedQuote = {
        file,
        vendor_name: vendorName.trim() || `Vendor-${Date.now()}`,
        status: 'pending'
      };
      setQuotes(prev => [...prev, newQuote]);
    });
    
    setVendorName('');
    event.target.value = '';
  };

  const uploadQuote = async (index: number) => {
    const quote = quotes[index];
    
    console.log("🚀 UI: Starting upload for", quote.vendor_name, "divisionId:", divisionId, "projectId:", projectId);
    
    setQuotes(prev => prev.map((q, i) => 
      i === index ? { ...q, status: 'uploading' } : q
    ));

    try {
      // Upload quote
      console.log("🚀 UI: Calling quotesApi.uploadQuote...");
      const uploadResponse = await quotesApi.uploadQuote(
        divisionId,
        projectId,
        quote.file,
        quote.vendor_name
      );
      console.log("🚀 UI: Upload response:", uploadResponse);

      const quoteId = uploadResponse.quote_id;
      
      setQuotes(prev => prev.map((q, i) => 
        i === index ? { ...q, status: 'parsing', quote_id: quoteId } : q
      ));

      // Trigger parsing
      console.log("🚀 UI: Calling quotesApi.parseQuote...");
      const parseResponse = await quotesApi.parseQuote(quoteId);
      console.log("🚀 UI: Parse response:", parseResponse);

      setQuotes(prev => prev.map((q, i) => 
        i === index ? { ...q, status: 'parsed' } : q
      ));

      // Check if all quotes are parsed, then auto-navigate to mapping
      const updatedQuotes = quotes.map((q, i) => 
        i === index ? { ...q, status: 'parsed' } : q
      );
      
      // Trigger real-time analysis for this new quote
      try {
        // In a real implementation, this would fetch the parsed quote data
        const mockQuoteData = {
          quote_id: quoteId,
          vendor_name: quote.vendor_name,
          line_items: [
            { description: "Mock parsed line", total_price: 1000, mapped_budget_lines: [] }
          ]
        };
        
        const quoteAnalysis = analysisEngine.analyzeQuote(mockQuoteData, division.items);
        console.log('Real-time quote analysis:', quoteAnalysis);
      } catch (analysisError) {
        console.error('Quote analysis failed:', analysisError);
      }

      // Notify parent of uploaded quote IDs
      onUploaded([quoteId]);

      if (updatedQuotes.every(q => q.status === 'parsed')) {
        // Status will automatically be updated to "quotes_uploaded" by backend
        // Division status should now show as "Quotes Uploaded" 
        setTimeout(() => {
          navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/mapping`);
        }, 1000); // Small delay to show success state
      }
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Upload failed';
      setQuotes(prev => prev.map((q, i) => 
        i === index ? { ...q, status: 'error', error_message: errorMessage } : q
      ));
    }
  };

  const removeQuote = (index: number) => {
    setQuotes(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status: UploadedQuote['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>;
      case 'uploading':
      case 'parsing':
        return <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>;
      case 'parsed':
        return <div className="w-3 h-3 bg-green-400 rounded-full"></div>;
      case 'error':
        return <div className="w-3 h-3 bg-red-400 rounded-full"></div>;
    }
  };

  const getStatusText = (status: UploadedQuote['status']) => {
    switch (status) {
      case 'pending': return 'Ready to upload';
      case 'uploading': return 'Uploading...';
      case 'parsing': return 'AI parsing...';
      case 'parsed': return 'Parsed successfully';
      case 'error': return 'Failed';
    }
  };

  const allParsed = quotes.length > 0 && quotes.every(q => q.status === 'parsed');

  const divisionCode = division.divisionCode;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <ProjectBreadcrumb 
        items={[
          { 
            label: 'Divisions', 
            href: `/projects/${projectId}/divisions` 
          },
          { 
            label: `${divisionCode} - ${division.divisionName}` 
          },
          { 
            label: 'Upload Quotes', 
            active: true 
          }
        ]} 
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Quotes</h1>
        <p className="text-gray-600">Division {division.divisionCode} - {division.divisionName}</p>
        <p className="text-sm text-gray-500">${division.divisionTotal.toLocaleString()} budget • {division.items.length} line items</p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Add Vendor Quotes</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Name
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g., ABC Electrical, Smith Plumbing"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
            <input
              type="file"
              accept=".pdf,.docx,.doc,.csv,.xlsx,.xls"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="quote-files"
            />
            <label htmlFor="quote-files" className="cursor-pointer">
              <div className="text-gray-400 mb-2">
                <svg className="mx-auto h-10 w-10" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m-4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">Upload Quote Files</p>
              <p className="text-gray-500">PDF, DOCX, CSV, or Excel • Up to 10MB each</p>
            </label>
          </div>
        </div>
      </div>

      {/* Uploaded Files */}
      {quotes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quote Files ({quotes.length})</h2>
          
          <div className="space-y-3">
            {quotes.map((quote, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(quote.status)}
                  <div>
                    <p className="font-medium text-gray-900">{quote.vendor_name}</p>
                    <p className="text-sm text-gray-500">
                      {quote.file.name} • {(quote.file.size / 1024 / 1024).toFixed(1)}MB
                    </p>
                    {quote.error_message && (
                      <p className="text-xs text-red-600">{quote.error_message}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{getStatusText(quote.status)}</span>
                  
                  {quote.status === 'pending' && (
                    <button
                      onClick={() => {
                        console.log("🔴 BUTTON CLICKED!", index);
                        uploadQuote(index);
                      }}
                      className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/90"
                    >
                      Upload & Parse
                    </button>
                  )}
                  
                  {quote.status === 'parsed' && quote.quote_id && (
                    <button
                      onClick={() => navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/mapping`)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Map Lines
                    </button>
                  )}
                  
                  {quote.status !== 'uploading' && quote.status !== 'parsing' && (
                    <button
                      onClick={() => removeQuote(index)}
                      className="px-3 py-1 text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Next Steps */}
          {allParsed && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900">All quotes parsed successfully!</p>
                  <p className="text-sm text-blue-700">Ready to map quote lines to budget items</p>
                </div>
                <button
                  onClick={() => navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/mapping`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Start Mapping & Comparison
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}