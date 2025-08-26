import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { budgetApi } from '../services/api';

interface SheetAnalysis {
  sheet_name: string;
  score: number;
  row_count: number;
  column_count: number;
  suggested_columns: Record<string, string | null>;
  preview: any[];
  error?: string;
}

interface FileAnalysis {
  file_name: string;
  file_type: string;
  total_sheets: number;
  sheet_analysis: SheetAnalysis[];
  recommended_sheet: string;
}

export default function BudgetUploadFlow() {
  const [step, setStep] = useState<'upload' | 'analyze' | 'confirm' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const projectId = "2271a70f-0709-4275-a663-3a57b253ccaa"; // Using test project ID

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStep('upload');
    }
  };

  const analyzeFile = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      const response = await budgetApi.analyzeFile(projectId, file);
      setAnalysis(response.data);
      setSelectedSheet(response.data.recommended_sheet);
      
      // Set initial column mapping from suggestions
      const recommended = response.data.sheet_analysis.find(
        (s: SheetAnalysis) => s.sheet_name === response.data.recommended_sheet
      );
      if (recommended?.suggested_columns) {
        setColumnMapping(recommended.suggested_columns);
      }
      
      setStep('analyze');
    } catch (error: any) {
      console.error('Analysis failed:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to analyze file. Please check the format.';
      alert(`Analysis failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadBudget = async () => {
    if (!file || !selectedSheet) return;
    
    setLoading(true);
    try {
      const response = await budgetApi.uploadBudget(projectId, selectedSheet, columnMapping, file);
      setResult(response.data);
      setStep('complete');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('upload');
    setFile(null);
    setAnalysis(null);
    setSelectedSheet('');
    setColumnMapping({});
    setResult(null);
  };

  // Step 1: File Upload
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-dark">Smart Budget Upload</h1>
          <p className="text-gray-600 mt-2">Upload your multi-tab project budget spreadsheet - we'll help you find the right data</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Budget File</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="budget-file"
            />
            <label htmlFor="budget-file" className="cursor-pointer">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">
                {file ? file.name : 'Click to upload budget spreadsheet'}
              </p>
              <p className="text-gray-500">Multi-tab Excel or CSV files up to 10MB</p>
            </label>
          </div>

          {file && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900">File Selected: {file.name}</h3>
                <p className="text-sm text-blue-700">Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={analyzeFile}
                  disabled={loading}
                  className={cn(
                    "px-6 py-2 rounded-md font-medium",
                    loading
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {loading ? 'Analyzing...' : 'Analyze Spreadsheet'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Sheet & Column Selection
  if (step === 'analyze' && analysis) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-dark">Select Worksheet & Columns</h1>
          <p className="text-gray-600 mt-2">We found {analysis.total_sheets} worksheet{analysis.total_sheets > 1 ? 's' : ''} - choose the one with your budget data</p>
        </div>

        {/* Sheet Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Choose Worksheet</h2>
          
          <div className="space-y-3">
            {analysis.sheet_analysis.map((sheet, index) => (
              <div
                key={index}
                className={cn(
                  "p-4 border rounded-lg cursor-pointer transition-colors",
                  selectedSheet === sheet.sheet_name
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => setSelectedSheet(sheet.sheet_name)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {sheet.sheet_name}
                      {sheet.sheet_name === analysis.recommended_sheet && (
                        <span className="ml-2 px-2 py-1 text-xs bg-primary text-white rounded">
                          RECOMMENDED
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {sheet.error ? (
                        <span className="text-red-500">{sheet.error}</span>
                      ) : (
                        `${sheet.row_count} rows, ${sheet.column_count} columns (Score: ${sheet.score})`
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2",
                      selectedSheet === sheet.sheet_name
                        ? "bg-primary border-primary"
                        : "border-gray-300"
                    )} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column Mapping */}
        {selectedSheet && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Column Mapping</h2>
            <p className="text-gray-600 mb-4">Verify these column mappings look correct:</p>
            
            {(() => {
              const selectedSheetData = analysis.sheet_analysis.find(s => s.sheet_name === selectedSheet);
              if (!selectedSheetData) return null;
              
              // Get actual column headers from the preview data
              const columnOptions = selectedSheetData.preview && selectedSheetData.preview[0] 
                ? Object.keys(selectedSheetData.preview[0])
                : [];
              
              return (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Found {columnOptions.length} columns. Select which columns contain your budget data:
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(selectedSheetData.suggested_columns || {}).map(([field, suggested]) => (
                      <div key={field} className="flex items-center space-x-3">
                        <label className="w-24 text-sm font-medium text-gray-700 capitalize">
                          {field.replace('_', ' ')}:
                        </label>
                        <select
                          value={columnMapping[field] || suggested || ''}
                          onChange={(e) => setColumnMapping(prev => ({
                            ...prev,
                            [field]: e.target.value
                          }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="">-- Select Column --</option>
                          {columnOptions.map((col, index) => (
                            <option key={index} value={col}>
                              {col} (Column {String.fromCharCode(65 + index)})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  
                  {columnOptions.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Preview of selected sheet:</h4>
                      <div className="text-xs text-blue-700 space-y-1">
                        {columnOptions.slice(0, 6).map((col, index) => (
                          <div key={index}>
                            <strong>Column {String.fromCharCode(65 + index)}:</strong> {col}
                          </div>
                        ))}
                        {columnOptions.length > 6 && (
                          <div className="text-blue-500">... and {columnOptions.length - 6} more columns</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={resetFlow}
            className="px-6 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Choose Different File
          </button>
          
          <button
            onClick={uploadBudget}
            disabled={!selectedSheet || loading}
            className={cn(
              "px-6 py-2 rounded-md font-medium",
              !selectedSheet || loading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary/90"
            )}
          >
            {loading ? 'Processing...' : 'Process Budget'}
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Success
  if (step === 'complete' && result) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-dark">Budget Upload Complete!</h1>
          <p className="text-gray-600 mt-2">Successfully processed your budget spreadsheet</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-900">Upload Successful</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{result.items_processed}</p>
              <p className="text-sm text-gray-600">Items Processed</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{result.sheet_name}</p>
              <p className="text-sm text-gray-600">Worksheet Used</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{result.preview?.length || 0}</p>
              <p className="text-sm text-gray-600">Preview Items</p>
            </div>
          </div>

          <button
            onClick={resetFlow}
            className="w-full px-6 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary/90"
          >
            Upload Another Budget
          </button>
        </div>
      </div>
    );
  }

  return null;
}