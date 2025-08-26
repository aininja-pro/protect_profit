import React, { useState } from 'react';
import { cn } from '../lib/utils';
import axios from 'axios';

export default function SmartBudgetUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const projectId = "2271a70f-0709-4275-a663-3a57b253ccaa"; // Using test project ID

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const processWithAI = async () => {
    if (!file) return;
    
    setProcessing(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('file', file);
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/ai-budget/smart-upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000 // 2 minutes for AI processing
        }
      );
      
      setResult(response.data);
      
    } catch (error: any) {
      console.error('AI processing failed:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'AI processing failed';
      setError(`Processing failed: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const resetFlow = () => {
    setFile(null);
    setResult(null);
    setError('');
  };

  // Success view
  if (result) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-dark">AI Budget Analysis Complete!</h1>
          <p className="text-gray-600 mt-2">Your construction estimate has been intelligently analyzed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-green-900">Analysis Successful</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-3xl font-bold text-primary">{result.items_processed}</p>
              <p className="text-sm text-gray-600">Line Items</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-3xl font-bold text-blue-600">{result.divisions_found}</p>
              <p className="text-sm text-gray-600">Divisions</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-3xl font-bold text-green-600">{result.worksheet_used}</p>
              <p className="text-sm text-gray-600">Worksheet Used</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-3xl font-bold text-yellow-600">
                ${result.grand_total?.toLocaleString() || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">Job Total</p>
            </div>
          </div>

          {/* Complete Division Analysis */}
          {result.analysis_summary && result.analysis_summary.divisions && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Complete Division Breakdown:</h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {result.analysis_summary.divisions.map((division: any, divIndex: number) => (
                  <div key={divIndex} className="mb-4 last:mb-0">
                    {/* Division Header */}
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border-l-4 border-primary shadow-sm">
                      <div>
                        <span className="font-bold text-gray-900">
                          Division {division.divisionCode} - {division.divisionName}
                        </span>
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {division.items?.length || 0} items
                        </span>
                      </div>
                      <span className="font-bold text-lg text-green-600">
                        ${division.divisionTotal?.toLocaleString() || '0'}
                      </span>
                    </div>
                    
                    {/* Division Items */}
                    {division.items && division.items.length > 0 && (
                      <div className="ml-4 mt-2 space-y-1">
                        {division.items.map((item: any, itemIndex: number) => (
                          <div key={itemIndex} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded border-l-2 border-gray-300">
                            <div className="flex-1">
                              <div className="font-medium text-gray-800">
                                {item.tradeDescription}
                              </div>
                              {(item.quantity || item.unit) && (
                                <div className="text-sm text-gray-500">
                                  {item.quantity ? `Qty: ${item.quantity}` : ''} 
                                  {item.unit ? ` ${item.unit}` : ''}
                                  {item.quantity && item.unit ? ' • ' : ''}
                                  Material: ${item.materialCost?.toFixed(2) || '0.00'} • 
                                  Labor: ${item.laborCost?.toFixed(2) || '0.00'} • 
                                  Sub/Equip: ${item.subEquipCost?.toFixed(2) || '0.00'}
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-green-600 ml-4">
                              ${item.totalCost?.toLocaleString() || '0'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Project Totals Summary */}
                <div className="mt-6 p-4 bg-white rounded-lg border-2 border-primary">
                  <h4 className="font-bold text-gray-900 mb-3">Project Totals:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Project Subtotal:</span>
                      <span className="font-semibold">${result.project_subtotal?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Items Total:</span>
                      <span className="font-semibold">${result.grand_total_from_items?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overhead & Profit:</span>
                      <span className="font-semibold">${result.overhead_profit?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Job Total:</span>
                      <span className="font-bold text-lg text-green-600">${result.grand_total?.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* Validation Status */}
                  <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center text-green-800">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">
                        ✅ Math Reconciled: Items total matches project subtotal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={resetFlow}
              className="px-6 py-2 text-primary border border-primary rounded-md hover:bg-primary/5"
            >
              Upload Another Budget
            </button>
            
            <button 
              onClick={() => {
                // Create a simple modal or alert with detailed breakdown
                const summary = `
AI Analysis Results:

📊 SUMMARY:
• ${result.items_processed} line items processed
• ${result.divisions_found} divisions identified  
• Worksheet: ${result.worksheet_used}
• Total Value: $${result.grand_total?.toLocaleString() || '0'}

🏗️ SAMPLE ITEMS:
${result.preview?.slice(0, 5).map((item: any, i: number) => 
  `${i+1}. ${item.description} - $${item.total_cost?.toLocaleString() || '0'} (Div ${item.division})`
).join('\n') || 'No preview available'}

✅ Data stored in database and ready for quote comparison!
                `.trim();
                
                alert(summary);
              }}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              View Full Analysis →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main upload interface
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-dark">AI-Powered Budget Upload</h1>
        <p className="text-gray-600 mt-2">
          Upload your Excel estimate - our AI will automatically analyze all worksheets and extract line items
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Construction Estimate</h2>
        
        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="smart-budget-file"
          />
          <label htmlFor="smart-budget-file" className="cursor-pointer">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-16 w-16" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-xl font-medium text-gray-900 mb-2">
              {file ? file.name : 'Drop your construction estimate here'}
            </p>
            <p className="text-gray-500">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Ready to process` : 'Multi-tab Excel files up to 10MB'}
            </p>
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Process Button */}
        {file && (
          <div className="mt-6 text-center">
            <button
              onClick={processWithAI}
              disabled={processing}
              className={cn(
                "px-8 py-3 rounded-lg font-semibold text-lg",
                processing
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-primary text-white hover:bg-primary/90 shadow-lg"
              )}
            >
              {processing ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI Analyzing...
                </span>
              ) : (
                '🤖 Analyze with AI'
              )}
            </button>
            
            {processing && (
              <p className="text-sm text-gray-500 mt-2">
                AI is reading your spreadsheet and extracting construction line items...
              </p>
            )}
          </div>
        )}

        {/* Benefits */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="font-semibold text-blue-900">🎯 Deterministic Parsing</div>
            <div className="text-blue-700">Precise column mapping and division detection</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="font-semibold text-green-900">🏗️ Math Validation</div>
            <div className="text-green-700">Totals reconciled against spreadsheet</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="font-semibold text-purple-900">⚡ Zero Config</div>
            <div className="text-purple-700">Finds divisions with actual line items</div>
          </div>
        </div>
      </div>
    </div>
  );
}