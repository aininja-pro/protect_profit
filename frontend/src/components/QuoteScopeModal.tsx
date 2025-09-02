import React, { useState } from 'react';

interface QuoteScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  division: any;
  preSelectedSubcategory?: string;
}

export default function QuoteScopeModal({ 
  isOpen, 
  onClose, 
  division,
  preSelectedSubcategory 
}: QuoteScopeModalProps) {
  const [scopeType, setScopeType] = useState<'division' | 'subcategory' | 'custom'>('subcategory');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    preSelectedSubcategory ? [preSelectedSubcategory] : []
  );
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([]);
  const [scopeDescription, setScopeDescription] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [exclusions, setExclusions] = useState('');

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
    setSelectedSubcategories(prev => 
      prev.includes(subcatName) 
        ? prev.filter(s => s !== subcatName)
        : [...prev, subcatName]
    );
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
              className="px-4 py-2 border border-primary text-primary rounded hover:bg-primary hover:text-white transition-colors"
            >
              🤖 Get AI Help
            </button>
            <button
              className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
            >
              Create RFQ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}