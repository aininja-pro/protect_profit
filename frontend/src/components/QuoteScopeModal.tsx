import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

interface QuoteScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  division: any;
  preSelectedSubcategory?: string;
  projectId: string;
}

export default function QuoteScopeModal({ 
  isOpen, 
  onClose, 
  division,
  preSelectedSubcategory,
  projectId
}: QuoteScopeModalProps) {
  const [scopeType, setScopeType] = useState<'division' | 'subcategory' | 'custom'>('subcategory');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    preSelectedSubcategory ? [preSelectedSubcategory] : []
  );
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([]);
  const [scopeDescription, setScopeDescription] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Auto-generate scope when modal opens or scope type changes
  useEffect(() => {
    if (isOpen) {
      generateScopeFromSelection();
    }
  }, [isOpen, scopeType]);

  if (!isOpen) return null;

  // Group items by subcategory for display
  const subcategoryGroups: {[key: string]: any[]} = {};
  division.items?.forEach((item: any) => {
    const subcatCode = item.subcategory_code || item.subcategoryCode;
    const subcatName = item.subcategory_name || item.subcategoryName;
    
    let finalSubcatName = subcatName;
    if (!subcatName && item.description && item.description.includes(':')) {
      const parts = item.description.split(':');
      if (parts[0].match(/\d{4}\s*-/)) {
        finalSubcatName = parts[0].trim();
      }
    }
    
    if (finalSubcatName) {
      const key = finalSubcatName;
      if (!subcategoryGroups[key]) {
        subcategoryGroups[key] = [];
      }
      subcategoryGroups[key].push(item);
    }
  });

  const calculateSelectedTotal = () => {
    let total = 0;
    if (scopeType === 'division') {
      total = division.divisionTotal || 0;
    } else {
      Object.entries(subcategoryGroups).forEach(([subcatName, items]) => {
        if (selectedSubcategories.includes(subcatName)) {
          total += items.reduce((sum: number, item: any) => sum + (item.total_cost || item.totalCost || 0), 0);
        }
      });
    }
    return total;
  };

  const toggleSubcategory = (subcatName: string) => {
    setSelectedSubcategories(prev => {
      const newSelection = prev.includes(subcatName) 
        ? prev.filter(s => s !== subcatName)
        : [...prev, subcatName];
      
      // Auto-generate scope when selection changes
      generateScopeFromSelection(newSelection);
      return newSelection;
    });
  };

  const generateScopeFromSelection = (selectedSubcats: string[] = selectedSubcategories) => {
    if (scopeType === 'division') {
      // Generate scope for entire division
      const allItems = division.items || [];
      const scopeText = generateScopeText(division.divisionName, allItems);
      setScopeDescription(scopeText);
    } else if (selectedSubcats.length > 0) {
      // Generate scope for selected subcategories
      const selectedItems: any[] = [];
      selectedSubcats.forEach(subcatName => {
        const subcatItems = subcategoryGroups[subcatName] || [];
        selectedItems.push(...subcatItems);
      });
      
      const scopeText = generateScopeText(selectedSubcats.join(', '), selectedItems);
      setScopeDescription(scopeText);
    }
  };

  const generateScopeText = (scopeName: string, items: any[]) => {
    const totalBudget = items.reduce((sum, item) => sum + (item.total_cost || item.totalCost || 0), 0);
    
    let scopeText = `SCOPE OF WORK: ${scopeName}\n\n`;
    scopeText += `This work includes the following items:\n\n`;
    
    items.forEach((item, index) => {
      const desc = item.description || item.tradeDescription;
      const cleanDesc = desc && desc.includes(':') && desc.match(/^\d{4}\s*-[^:]*:/) 
        ? desc.split(':', 2)[1].trim() 
        : desc;
      
      const cost = item.total_cost || item.totalCost || 0;
      scopeText += `${index + 1}. ${cleanDesc}\n   Budget Allowance: $${cost.toLocaleString()}\n\n`;
    });
    
    scopeText += `TOTAL SCOPE BUDGET: $${totalBudget.toLocaleString()}`;
    
    return scopeText;
  };

  const enhanceWithAI = async () => {
    setIsEnhancing(true);
    try {
      const response = await axios.post(`${API_BASE}/quote-scopes/ai-enhance`, {
        scope_description: scopeDescription,
        project_context: {
          project_id: projectId,
          division_code: division.divisionCode,
          division_name: division.divisionName,
          scope_type: scopeType
        }
      }, {
        timeout: 60000 // 60 second timeout for AI calls
      });
      
      setScopeDescription(response.data.enhanced_rfq);
      
      // Show success message
      if (response.data.ai_used) {
        alert('✅ Scope enhanced with OpenAI GPT-4! Professional RFQ language generated.');
      } else {
        alert('✅ Scope enhanced with smart templates! (OpenAI integration available when API key configured)');
      }
      
    } catch (error: any) {
      console.error('AI enhancement failed:', error);
      alert('AI enhancement failed. Please continue with manual editing or try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const createRFQ = async () => {
    setIsCreating(true);
    try {
      const scopeItems = scopeType === 'division' 
        ? [`Division ${division.divisionCode} - ${division.divisionName}`]
        : selectedSubcategories;

      const scopeData = {
        project_id: projectId,
        division_code: division.divisionCode,
        scope_type: scopeType,
        scope_items: scopeItems,
        description: scopeDescription || `Work for ${scopeType === 'division' ? 'entire division' : 'selected subcategories'}`,
        specifications: specifications || 'Per plans and specifications',
        exclusions: exclusions || 'None specified'
      };

      const response = await axios.post(`${API_BASE}/quote-scopes/`, scopeData);
      
      alert(`RFQ created successfully! Scope ID: ${response.data.scope_id}\n\nNext: Select vendors and send RFQ`);
      onClose();
      
    } catch (error: any) {
      console.error('Failed to create RFQ:', error);
      alert('Failed to create RFQ. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Request Quotes - Division {division.divisionCode}: {division.divisionName}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Scope Type Selection */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Quote Scope:</h3>
          <div className="space-y-2">
            <label className="flex items-center">
              <input 
                type="radio" 
                name="scopeType" 
                value="division"
                checked={scopeType === 'division'}
                onChange={(e) => setScopeType('division')}
                className="mr-2"
              />
              <span>Entire Division (${division.divisionTotal?.toLocaleString() || '0'})</span>
            </label>
            <label className="flex items-center">
              <input 
                type="radio" 
                name="scopeType" 
                value="subcategory"
                checked={scopeType === 'subcategory'}
                onChange={(e) => setScopeType('subcategory')}
                className="mr-2"
              />
              <span>Select Specific Subcategories</span>
            </label>
          </div>
        </div>

        {/* Subcategory Selection */}
        {scopeType === 'subcategory' && (
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Select Subcategories:</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto border rounded p-3">
              {Object.entries(subcategoryGroups).map(([subcatName, items]) => {
                const subcatTotal = items.reduce((sum: number, item: any) => sum + (item.total_cost || item.totalCost || 0), 0);
                const isSelected = selectedSubcategories.includes(subcatName);
                
                return (
                  <div key={subcatName} className="border rounded p-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSubcategory(subcatName)}
                          className="mr-3"
                        />
                        <span className="font-medium">{subcatName}</span>
                      </div>
                      <span className="font-semibold text-blue-600">
                        ${subcatTotal.toLocaleString()}
                      </span>
                    </label>
                    
                    {isSelected && (
                      <div className="mt-2 ml-6 space-y-1">
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm text-gray-600">
                            <span>{(() => {
                              const desc = item.description || item.tradeDescription;
                              if (desc && desc.includes(':') && desc.match(/^\d{4}\s*-[^:]*:/)) {
                                return desc.split(':', 2)[1].trim();
                              }
                              return desc;
                            })()}</span>
                            <span>${(item.total_cost || item.totalCost)?.toLocaleString() || '0'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-green-800">Selected Total:</span>
                <span className="font-bold text-green-800">${calculateSelectedTotal().toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Scope Writing Section */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Scope Description:</h3>
          <textarea
            value={scopeDescription}
            onChange={(e) => setScopeDescription(e.target.value)}
            placeholder="Describe the work to be performed, including all requirements and expectations..."
            className="w-full h-32 border rounded p-3 resize-none"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block font-medium mb-2">Specifications:</label>
              <textarea
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                placeholder="Materials, quality standards, code requirements..."
                className="w-full h-24 border rounded p-3 resize-none text-sm"
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Exclusions:</label>
              <textarea
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder="What's NOT included in this scope..."
                className="w-full h-24 border rounded p-3 resize-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={enhanceWithAI}
              disabled={isEnhancing || !scopeDescription.trim()}
              className="px-4 py-2 border border-primary text-primary rounded hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEnhancing ? '🤖 Enhancing...' : '🤖 Enhance with AI'}
            </button>
            <button
              onClick={createRFQ}
              disabled={isCreating || (scopeType === 'subcategory' && selectedSubcategories.length === 0)}
              className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create RFQ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}