import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { 
  AnalysisEngine, 
  AnalysisPreferences, 
  CompetitiveAnalysis, 
  Recommendation,
  RiskFactor 
} from '../services/analysisEngine';

interface LiveAnalysisPanelProps {
  divisionId: string;
  quotes: any[];
  budgetLines: any[];
  analysisEngine: AnalysisEngine;
  onPreferencesChange?: (preferences: AnalysisPreferences) => void;
}

export default function LiveAnalysisPanel({ 
  divisionId, 
  quotes, 
  budgetLines, 
  analysisEngine,
  onPreferencesChange 
}: LiveAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<CompetitiveAnalysis | null>(null);
  const [preferences, setPreferences] = useState<AnalysisPreferences>(analysisEngine.getPreferences());
  const [showSettings, setShowSettings] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Re-run analysis when quotes change or preferences update
  useEffect(() => {
    if (quotes.length > 0 && budgetLines.length > 0) {
      performAnalysis();
    }
  }, [quotes, budgetLines, preferences]);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate analysis time for UX
      await new Promise(resolve => setTimeout(resolve, quotes.length * 200));
      
      const competitiveAnalysis = analysisEngine.performCompetitiveAnalysis(quotes, budgetLines, divisionId);
      setAnalysis(competitiveAnalysis);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updatePreferences = (updates: Partial<AnalysisPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    analysisEngine.updatePreferences(newPreferences);
    onPreferencesChange?.(newPreferences);
  };

  const getRecommendationIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'award': return '🏆';
      case 'negotiate': return '💬';
      case 'clarify': return '❓';
      case 'reject': return '❌';
      default: return '💡';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-700 bg-red-100 border-red-200';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getRiskSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (quotes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p className="font-medium">Waiting for Quotes</p>
          <p className="text-sm">Analysis will begin when first quote is uploaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Analysis Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">Live Analysis</h3>
          {isAnalyzing && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Analyzing...</span>
            </div>
          )}
          {analysis && (
            <span className="text-sm text-gray-500">
              {quotes.length} quote{quotes.length !== 1 ? 's' : ''} • 
              Updated {new Date(analysis.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Analysis Settings Panel */}
      {showSettings && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Analysis Preferences</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Weight: {(preferences.price_weight * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.1"
                value={preferences.price_weight}
                onChange={(e) => updatePreferences({ price_weight: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk Tolerance</label>
              <select
                value={preferences.risk_tolerance}
                onChange={(e) => updatePreferences({ risk_tolerance: e.target.value as any })}
                className="w-full border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !isAnalyzing ? (
        <div className="p-6 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{quotes.length}</div>
              <div className="text-xs text-blue-700">Quotes</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${(analysis.price_spread.lowest / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-green-700">Best Price</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {analysis.price_spread.variance_percent.toFixed(0)}%
              </div>
              <div className="text-xs text-yellow-700">Price Spread</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{analysis.scope_gaps.length}</div>
              <div className="text-xs text-red-700">Scope Gaps</div>
            </div>
          </div>

          {/* Top Recommendations */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Key Recommendations</h4>
            <div className="space-y-2">
              {analysis.recommendations.slice(0, 3).map((rec, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border flex items-start space-x-3",
                    getPriorityColor(rec.priority)
                  )}
                >
                  <div className="text-lg">{getRecommendationIcon(rec.type)}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{rec.title}</div>
                    <div className="text-sm mt-1">{rec.description}</div>
                    {rec.potential_savings && rec.potential_savings > 0 && (
                      <div className="text-xs text-green-600 font-medium mt-1">
                        Potential savings: ${rec.potential_savings.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(rec.confidence * 100).toFixed(0)}% confidence
                  </div>
                </div>
              ))}
            </div>

            {analysis.recommendations.length > 3 && (
              <button className="text-sm text-blue-600 hover:text-blue-800 mt-2">
                View {analysis.recommendations.length - 3} more recommendations →
              </button>
            )}
          </div>

          {/* Price Analysis */}
          {analysis.price_spread.variance_percent > 10 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Price Variance Alert</h4>
              <p className="text-sm text-yellow-800">
                {analysis.price_spread.variance_percent.toFixed(1)}% spread between highest (${analysis.price_spread.highest.toLocaleString()}) 
                and lowest (${analysis.price_spread.lowest.toLocaleString()}) quotes.
                Average: ${analysis.price_spread.average.toLocaleString()}
              </p>
            </div>
          )}

          {/* Scope Gaps */}
          {analysis.scope_gaps.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-900 mb-2">Scope Coverage Issues</h4>
              <div className="space-y-2">
                {analysis.scope_gaps.slice(0, 2).map((gap, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium text-red-800">{gap.description}</span>
                    <span className="text-red-700"> - Missing from: {gap.missing_vendors.join(', ')}</span>
                  </div>
                ))}
                {analysis.scope_gaps.length > 2 && (
                  <div className="text-xs text-red-600">
                    +{analysis.scope_gaps.length - 2} more scope gaps
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : quotes.length > 0 && isAnalyzing && (
        <div className="p-6 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Analyzing {quotes.length} quote{quotes.length !== 1 ? 's' : ''}...</p>
        </div>
      )}
    </div>
  );
}