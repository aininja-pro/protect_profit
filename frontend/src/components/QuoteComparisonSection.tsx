import React, { useState, useEffect } from 'react';

interface QuoteComparisonSectionProps {
  subcategoryName: string;
  division: any;
}

interface Quote {
  vendor_name: string;
  total_price: number;
  status: 'pending' | 'received' | 'awarded';
  timeline?: string;
  notes?: string;
}

export default function QuoteComparisonSection({ 
  subcategoryName, 
  division 
}: QuoteComparisonSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock quote data - replace with actual API call
  const mockQuotes: Quote[] = [
    {
      vendor_name: "ABC Millwork",
      total_price: 14500,
      status: 'received',
      timeline: "4 weeks",
      notes: "Standard millwork"
    },
    {
      vendor_name: "Custom Door Co",
      total_price: 15800,
      status: 'received', 
      timeline: "3 weeks",
      notes: "Specializes in barn doors"
    },
    {
      vendor_name: "Premier Trim", 
      total_price: 13900,
      status: 'pending',
      timeline: "6 weeks",
      notes: "Lowest bid"
    }
  ];

  const loadQuotes = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/quotes/subcategory/${subcategoryName}`);
      // setQuotes(response.data);
      
      // Only show mock data for test projects (not real client projects)
      const isTestProject = window.location.href.includes('test') || 
                           division.divisionName?.toLowerCase().includes('test');
      
      if (isTestProject) {
        setQuotes(mockQuotes);
      } else {
        // For real projects, fetch actual quotes from API
        setQuotes([]); // Empty for now until we have real quotes
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      loadQuotes();
    }
  }, [isExpanded]);

  const getQuoteStatus = () => {
    if (quotes.length === 0) return { status: 'none', text: 'No quotes', color: 'text-gray-500' };
    
    const receivedQuotes = quotes.filter(q => q.status === 'received').length;
    const awardedQuotes = quotes.filter(q => q.status === 'awarded').length;
    
    if (awardedQuotes > 0) return { status: 'awarded', text: 'Awarded', color: 'text-green-600' };
    if (receivedQuotes > 0) return { status: 'received', text: `${receivedQuotes} quotes`, color: 'text-blue-600' };
    return { status: 'pending', text: `${quotes.length} pending`, color: 'text-yellow-600' };
  };

  const quoteStatus = getQuoteStatus();

  return (
    <div className="ml-6 mt-1">
      {/* Quote Status Indicator */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-2 bg-white border rounded hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">📊 Quote Analysis</span>
          <span className={`text-xs ${quoteStatus.color}`}>
            {quoteStatus.text}
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {isExpanded ? '▲ Hide' : '▼ Compare'}
        </span>
      </button>

      {/* Expandable Comparison Table */}
      {isExpanded && (
        <div className="mt-2 bg-white border rounded p-3">
          {loading ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full"></div>
                Loading quotes...
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Vendor</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-center py-2">Timeline</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-center py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="py-2">
                        <div>
                          <div className="font-medium">{quote.vendor_name}</div>
                          {quote.notes && (
                            <div className="text-xs text-gray-500">{quote.notes}</div>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-2 font-semibold">
                        ${quote.total_price.toLocaleString()}
                      </td>
                      <td className="text-center py-2">
                        {quote.timeline || 'TBD'}
                      </td>
                      <td className="text-center py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          quote.status === 'awarded' ? 'bg-green-100 text-green-800' :
                          quote.status === 'received' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {quote.status}
                        </span>
                      </td>
                      <td className="text-center py-2">
                        {quote.status === 'received' && (
                          <div className="flex gap-1 justify-center">
                            <button className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                              Award
                            </button>
                            <button className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">
                              Clarify
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* AI Recommendation */}
              <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600">🤖</span>
                  <div className="text-sm text-blue-800">
                    <div className="font-medium">AI Recommendation:</div>
                    <div>ABC Millwork offers the best value at $14,500 (4% under budget). They have excellent past performance and realistic timeline. Custom Door Co is worth the premium if barn door quality is critical.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}