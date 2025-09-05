// Real-time Quote Analysis Engine
// Provides progressive analysis as quotes arrive with interactive controls

export interface AnalysisPreferences {
  price_weight: number;      // 0-1, default 0.8
  quality_weight: number;    // 0-1, default 0.2  
  schedule_priority: 'standard' | 'rush' | 'flexible';
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  local_preference: number;  // 0-0.2, bonus points for local vendors
  excluded_vendors: string[]; // Vendor IDs to exclude from recommendations
}

export interface QuoteAnalysis {
  quote_id: string;
  vendor_name: string;
  completeness_score: number; // 0-1
  price_competitiveness: number; // 0-1 (1 = best price)
  risk_factors: RiskFactor[];
  scope_coverage: ScopeCoverage[];
  quality_indicators: QualityIndicator[];
}

export interface RiskFactor {
  type: 'price_outlier' | 'scope_gap' | 'unclear_terms' | 'capacity_concern' | 'past_performance';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}

export interface ScopeCoverage {
  budget_line_id: string;
  coverage_status: 'covered' | 'partial' | 'missing' | 'extra';
  confidence: number;
  notes?: string;
}

export interface QualityIndicator {
  type: 'detail_level' | 'specification_compliance' | 'exclusions_clarity' | 'timeline_provided';
  score: number; // 0-1
  notes?: string;
}

export interface CompetitiveAnalysis {
  division_id: string;
  quote_count: number;
  price_spread: {
    lowest: number;
    highest: number;
    average: number;
    variance_percent: number;
  };
  scope_gaps: ScopeGap[];
  recommendations: Recommendation[];
  timestamp: string;
}

export interface ScopeGap {
  budget_line_id: string;
  missing_vendors: string[];
  description: string;
  budget_amount: number;
}

export interface Recommendation {
  type: 'award' | 'negotiate' | 'clarify' | 'reject';
  priority: 'high' | 'medium' | 'low';
  budget_line_id?: string;
  vendor_id?: string;
  title: string;
  description: string;
  potential_savings?: number;
  confidence: number; // 0-1
}

export interface ProgressiveAnalysisSnapshot {
  timestamp: string;
  quote_count: number;
  analysis: CompetitiveAnalysis;
  recommendations: Recommendation[];
}

export class AnalysisEngine {
  private preferences: AnalysisPreferences = {
    price_weight: 0.8,
    quality_weight: 0.2,
    schedule_priority: 'standard',
    risk_tolerance: 'moderate',
    local_preference: 0.1,
    excluded_vendors: []
  };

  private analysisHistory: ProgressiveAnalysisSnapshot[] = [];

  /**
   * Update analysis preferences and re-calculate recommendations
   */
  updatePreferences(newPreferences: Partial<AnalysisPreferences>) {
    this.preferences = { ...this.preferences, ...newPreferences };
  }

  /**
   * Analyze individual quote when it arrives
   */
  analyzeQuote(quote: any, budgetLines: any[]): QuoteAnalysis {
    const analysis: QuoteAnalysis = {
      quote_id: quote.quote_id,
      vendor_name: quote.vendor_name,
      completeness_score: this.calculateCompletenessScore(quote, budgetLines),
      price_competitiveness: 0, // Will be calculated in competitive analysis
      risk_factors: this.identifyRiskFactors(quote, budgetLines),
      scope_coverage: this.analyzeScopeCoverage(quote, budgetLines),
      quality_indicators: this.assessQuality(quote)
    };

    return analysis;
  }

  /**
   * Perform competitive analysis across all quotes for a division
   */
  performCompetitiveAnalysis(quotes: any[], budgetLines: any[], divisionId: string): CompetitiveAnalysis {
    // Calculate price competitiveness for each quote
    const quotePrices = quotes.map(q => this.calculateTotalQuotePrice(q));
    const minPrice = Math.min(...quotePrices);
    const maxPrice = Math.max(...quotePrices);
    const avgPrice = quotePrices.reduce((sum, price) => sum + price, 0) / quotePrices.length;

    const priceSpread = {
      lowest: minPrice,
      highest: maxPrice,
      average: avgPrice,
      variance_percent: maxPrice > 0 ? ((maxPrice - minPrice) / maxPrice) * 100 : 0
    };

    // Identify scope gaps
    const scopeGaps = this.identifyScopeGaps(quotes, budgetLines);

    // Generate recommendations
    const recommendations = this.generateRecommendations(quotes, budgetLines, priceSpread);

    const analysis: CompetitiveAnalysis = {
      division_id: divisionId,
      quote_count: quotes.length,
      price_spread: priceSpread,
      scope_gaps: scopeGaps,
      recommendations: recommendations,
      timestamp: new Date().toISOString()
    };

    // Store snapshot for history
    this.analysisHistory.push({
      timestamp: analysis.timestamp,
      quote_count: quotes.length,
      analysis: analysis,
      recommendations: recommendations
    });

    return analysis;
  }

  /**
   * Generate smart recommendations based on current data and preferences
   */
  private generateRecommendations(quotes: any[], budgetLines: any[], priceSpread: any): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Price-based recommendations
    if (priceSpread.variance_percent > 15) {
      recommendations.push({
        type: 'negotiate',
        priority: 'high',
        title: 'High Price Variance Detected',
        description: `${priceSpread.variance_percent.toFixed(1)}% price spread. Negotiate with highest bidder or clarify scope differences.`,
        potential_savings: priceSpread.highest - priceSpread.lowest,
        confidence: 0.85
      });
    }

    // Scope gap recommendations
    quotes.forEach(quote => {
      const missingLines = budgetLines.filter(line => 
        !quote.line_items.some((item: any) => item.mapped_budget_lines.includes(line.lineId))
      );

      if (missingLines.length > 0) {
        recommendations.push({
          type: 'clarify',
          priority: 'medium',
          vendor_id: quote.vendor_id,
          title: `Scope Gaps - ${quote.vendor_name}`,
          description: `Missing ${missingLines.length} budget items: ${missingLines.slice(0, 2).map((l: any) => l.tradeDescription).join(', ')}${missingLines.length > 2 ? '...' : ''}`,
          confidence: 0.9
        });
      }
    });

    // Award recommendations (simplified for now)
    const bestPriceQuote = quotes.reduce((best, current) => {
      const currentPrice = this.calculateTotalQuotePrice(current);
      const bestPrice = this.calculateTotalQuotePrice(best);
      return currentPrice < bestPrice ? current : best;
    });

    recommendations.push({
      type: 'award',
      priority: 'high',
      vendor_id: bestPriceQuote.vendor_id,
      title: `Recommended Award: ${bestPriceQuote.vendor_name}`,
      description: `Best overall value with ${this.preferences.price_weight * 100}% price weighting`,
      potential_savings: priceSpread.highest - this.calculateTotalQuotePrice(bestPriceQuote),
      confidence: this.calculateRecommendationConfidence(quotes, bestPriceQuote)
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate how complete a quote is relative to budget
   */
  private calculateCompletenessScore(quote: any, budgetLines: any[]): number {
    const mappedLines = quote.line_items.filter((item: any) => 
      item.mapped_budget_lines && item.mapped_budget_lines.length > 0
    );
    return budgetLines.length > 0 ? mappedLines.length / budgetLines.length : 0;
  }

  /**
   * Identify risk factors in individual quotes
   */
  private identifyRiskFactors(quote: any, budgetLines: any[]): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Price outlier detection (simplified)
    const avgBudgetPrice = budgetLines.reduce((sum: number, line: any) => sum + line.totalCost, 0);
    const quoteTotal = this.calculateTotalQuotePrice(quote);
    
    if (quoteTotal > avgBudgetPrice * 1.3) {
      risks.push({
        type: 'price_outlier',
        severity: 'high',
        description: `Quote is ${((quoteTotal / avgBudgetPrice - 1) * 100).toFixed(1)}% over budget`,
        impact: 'Could significantly impact project margins'
      });
    }

    // Scope gap detection
    const missingScope = budgetLines.filter(line => 
      !quote.line_items.some((item: any) => item.mapped_budget_lines?.includes(line.lineId))
    );

    if (missingScope.length > 0) {
      risks.push({
        type: 'scope_gap',
        severity: missingScope.length > 2 ? 'high' : 'medium',
        description: `Missing ${missingScope.length} budget items`,
        impact: 'Potential change orders or scope creep'
      });
    }

    return risks;
  }

  /**
   * Analyze scope coverage for each budget line
   */
  private analyzeScopeCoverage(quote: any, budgetLines: any[]): ScopeCoverage[] {
    return budgetLines.map(line => {
      const mappedItems = quote.line_items.filter((item: any) => 
        item.mapped_budget_lines?.includes(line.lineId)
      );

      if (mappedItems.length === 0) {
        return {
          budget_line_id: line.lineId,
          coverage_status: 'missing',
          confidence: 0.95
        };
      } else if (mappedItems.length === 1) {
        return {
          budget_line_id: line.lineId,
          coverage_status: 'covered',
          confidence: 0.85
        };
      } else {
        return {
          budget_line_id: line.lineId,
          coverage_status: 'partial', // Multiple items mapped - might be over-specified
          confidence: 0.7,
          notes: `${mappedItems.length} quote items mapped to this budget line`
        };
      }
    });
  }

  /**
   * Assess quality indicators of the quote
   */
  private assessQuality(quote: any): QualityIndicator[] {
    const indicators: QualityIndicator[] = [];

    // Detail level - based on description length and specificity
    const avgDescriptionLength = quote.line_items.reduce(
      (sum: number, item: any) => sum + (item.description?.length || 0), 0
    ) / quote.line_items.length;

    indicators.push({
      type: 'detail_level',
      score: Math.min(avgDescriptionLength / 50, 1), // Normalize to 0-1
      notes: avgDescriptionLength > 30 ? 'Good detail level' : 'Basic descriptions'
    });

    // Exclusions clarity
    const hasExclusions = quote.normalized_json?.exclusions?.length > 0;
    indicators.push({
      type: 'exclusions_clarity',
      score: hasExclusions ? 0.8 : 0.4,
      notes: hasExclusions ? 'Clear exclusions listed' : 'No exclusions specified'
    });

    return indicators;
  }

  /**
   * Identify scope gaps across all quotes
   */
  private identifyScopeGaps(quotes: any[], budgetLines: any[]): ScopeGap[] {
    const gaps: ScopeGap[] = [];

    budgetLines.forEach(line => {
      const quotesWithoutLine = quotes.filter(quote => 
        !quote.line_items.some((item: any) => item.mapped_budget_lines?.includes(line.lineId))
      );

      if (quotesWithoutLine.length > 0 && quotesWithoutLine.length < quotes.length) {
        gaps.push({
          budget_line_id: line.lineId,
          missing_vendors: quotesWithoutLine.map(q => q.vendor_name),
          description: line.tradeDescription,
          budget_amount: line.totalCost
        });
      }
    });

    return gaps;
  }

  /**
   * Calculate total price for a quote
   */
  private calculateTotalQuotePrice(quote: any): number {
    return quote.line_items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
  }

  /**
   * Calculate confidence in recommendation based on data quality
   */
  private calculateRecommendationConfidence(quotes: any[], recommendedQuote: any): number {
    let confidence = 0.7; // Base confidence

    // More quotes = higher confidence
    if (quotes.length >= 3) confidence += 0.15;
    if (quotes.length >= 5) confidence += 0.1;

    // Complete scope coverage boosts confidence
    const completeness = this.calculateCompletenessScore(recommendedQuote, []);
    confidence += completeness * 0.15;

    return Math.min(confidence, 0.95);
  }

  /**
   * Get analysis history snapshots
   */
  getAnalysisHistory(): ProgressiveAnalysisSnapshot[] {
    return this.analysisHistory;
  }

  /**
   * Get current preferences
   */
  getPreferences(): AnalysisPreferences {
    return { ...this.preferences };
  }
}

// Singleton instance
export const analysisEngine = new AnalysisEngine();