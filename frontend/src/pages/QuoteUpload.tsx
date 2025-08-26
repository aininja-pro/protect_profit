import React, { useState } from 'react';
import { cn } from '../lib/utils';

export default function QuoteUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      // In real implementation, this would upload to the backend API
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate upload
      console.log('Quote uploaded:', file.name);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-dark">Quote Upload</h1>
        <p className="text-gray-600 mt-2">Upload subcontractor quotes (PDF, DOCX, or CSV)</p>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Quote Files</h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
          <input
            type="file"
            accept=".pdf,.docx,.doc,.csv"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="quote-files"
          />
          <label htmlFor="quote-files" className="cursor-pointer">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900">
              Click to upload quote files
            </p>
            <p className="text-gray-500">PDF, DOCX, or CSV files up to 10MB each</p>
          </label>
        </div>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Uploaded Files</h2>
          
          <div className="space-y-3">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpload(file)}
                    disabled={uploading}
                    className={cn(
                      "px-3 py-1 rounded text-sm font-medium",
                      uploading
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-primary/90"
                    )}
                  >
                    {uploading ? 'Processing...' : 'Process'}
                  </button>
                  
                  <button
                    onClick={() => removeFile(index)}
                    className="px-3 py-1 rounded text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}