import { supabase } from './supabase';

// Pressure situation analytics - identifies and analyzes high-pressure scenarios
// Provides performance insights and mental game coaching for clutch situations

export interface PressureSituation {
  type: 'scoring_opportunity' | 'trouble_recovery' | 'closing_hole' | 'competitive_moment' | 'streak_situation';
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  description: string;
  factors: PressureFactor[];
  mentalApproach: string[];
  historicalPerformance?: PressurePerformance;
}

export interface PressureFactor {
  factor: string;
  weight: number; // 1-10 impact on pressure
  description: string;
}

export interface PressurePerformance {
  successRate: number;
  comparedToNormal: number; // percentage difference from normal performance
  commonReactions: string[];
  strengths: string[];
  weaknesses: string[];
  improvementTrends: boolean;
}

export interface PressureAnalysis {
  currentSituation: PressureSituation;
  recommendedMindset: string[];
  technicalAdjustments: string[];
  strategyRecommendations: string[];
  confidenceBooster: string;
}

export interface RoundPressureMap {
  hole: number;
  pressureMoments: Array<{
    shotNumber: number;
    situation: string;
    intensity: string;
    outcome: string;
  }>;
  mentalMomentum: 'building' | 'stable' | 'declining';
  nextLikelyPressure?: string;
}

class PressureAnalyticsService {
  private pressureIndicators = {
    // Scoring opportunities
    birdie_putt: { baseIntensity: 'medium', factors: ['pin_position', 'putt_distance', 'round_score'] },
    eagle_chance: { baseIntensity: 'high', factors: ['distance_to_pin', 'lie_quality', 'round_context'] },
    up_and_down: { baseIntensity: 'medium', factors: ['lie_difficulty', 'pin_position', 'round_momentum'] },
    
    // Recovery situations
    penalty_recovery: { baseIntensity: 'high', factors: ['stroke_penalty', 'round_score', 'hole_difficulty'] },
    trouble_shot: { baseIntensity: 'medium', factors: ['lie_quality', 'target_difficulty', 'safe_options'] },
    sand_save: { baseIntensity: 'medium', factors: ['bunker_lie', 'pin_position', 'green_speed'] },
    
    // Round context
    final_holes: { baseIntensity: 'medium', factors: ['round_score', 'personal_best', 'time_of_round'] },
    milestone_score: { baseIntensity: 'high', factors: ['target_score', 'remaining_holes', 'current_pace'] },
    streak_shot: { baseIntensity: 'medium', factors: ['streak_length', 'streak_type', 'hole_difficulty'] }
  };

  /**
   * Identify current pressure situation based on shot context
   */
  async identifyPressureSituation(shotContext: {
    category: string;
    lie: string;
    distanceToPin: number;
    holeNumber: number;
    shotNumber: number;
    roundScore?: number;
    parValue: number;
    previousShots?: Array<{ result: string; category: string }>;
  }): Promise<PressureSituation> {
    try {
      // Analyze shot context for pressure indicators
      const pressureType = this.categorizePressureType(shotContext);
      const pressureFactors = await this.analyzePressureFactors(shotContext, pressureType);
      const intensity = this.calculatePressureIntensity(pressureFactors);
      
      // Get historical performance data
      const historicalPerformance = await this.getHistoricalPressurePerformance(pressureType, shotContext);
      
      return {
        type: pressureType,
        intensity,
        description: this.generateSituationDescription(pressureType, shotContext, intensity),
        factors: pressureFactors,
        mentalApproach: this.getMentalApproach(pressureType, intensity),
        historicalPerformance
      };
    } catch (error) {
      console.error('Error identifying pressure situation:', error);
      return this.getBasicPressureSituation(shotContext);
    }
  }

  /**
   * Categorize the type of pressure situation
   */
  private categorizePressureType(shotContext: any): PressureSituation['type'] {
    // Scoring opportunity detection
    if (shotContext.category === 'putting' && shotContext.distanceToPin <= 6) {
      return 'scoring_opportunity'; // Birdie/eagle putt
    }
    
    if (shotContext.category === 'approach' && shotContext.distanceToPin <= 15) {
      return 'scoring_opportunity'; // Close pin shot
    }
    
    if (shotContext.shotNumber >= 3 && shotContext.category === 'short_game') {
      return 'scoring_opportunity'; // Up and down situation
    }
    
    // Trouble recovery
    if (shotContext.lie.includes('rough') || shotContext.lie.includes('bunker') || 
        shotContext.lie === 'Recovery') {
      return 'trouble_recovery';
    }
    
    // Closing hole pressure (last 3-4 holes)
    if (shotContext.holeNumber >= 15) {
      return 'closing_hole';
    }
    
    // Check for streak situations
    if (this.detectStreakSituation(shotContext.previousShots)) {
      return 'streak_situation';
    }
    
    // Default competitive moment for other pressure situations
    return 'competitive_moment';
  }

  /**
   * Detect streak situations (consecutive pars, birdies, etc.)
   */
  private detectStreakSituation(previousShots?: Array<{ result: string; category: string }>): boolean {
    if (!previousShots || previousShots.length < 2) return false;
    
    // Look for patterns in last few holes
    const recentResults = previousShots.slice(-6); // Last 6 holes
    const consecutive = this.findConsecutiveResults(recentResults);
    
    return consecutive.length >= 3; // 3+ consecutive similar results
  }

  /**
   * Find consecutive similar results
   */
  private findConsecutiveResults(results: Array<{ result: string; category: string }>): string[] {
    if (results.length === 0) return [];
    
    const consecutive = [results[0].result];
    
    for (let i = 1; i < results.length; i++) {
      if (results[i].result === consecutive[consecutive.length - 1]) {
        consecutive.push(results[i].result);
      } else {
        break;
      }
    }
    
    return consecutive;
  }

  /**
   * Analyze factors contributing to pressure level
   */
  private async analyzePressureFactors(
    shotContext: any,
    pressureType: PressureSituation['type']
  ): Promise<PressureFactor[]> {
    const factors: PressureFactor[] = [];
    
    // Base situational factors
    switch (pressureType) {
      case 'scoring_opportunity':
        if (shotContext.distanceToPin <= 6 && shotContext.category === 'putting') {
          factors.push({
            factor: 'Birdie putt opportunity',
            weight: 7,
            description: `${shotContext.distanceToPin}ft birdie putt`
          });
        }
        
        if (shotContext.distanceToPin <= 15 && shotContext.category === 'approach') {
          factors.push({
            factor: 'Close pin position',
            weight: 6,
            description: `${shotContext.distanceToPin}ft to pin`
          });
        }
        break;
        
      case 'trouble_recovery':
        const difficultyWeight = shotContext.lie.includes('Heavy') ? 8 : 
                                shotContext.lie.includes('bunker') ? 7 : 6;
        factors.push({
          factor: 'Difficult lie',
          weight: difficultyWeight,
          description: `Recovery from ${shotContext.lie.toLowerCase()}`
        });
        break;
        
      case 'closing_hole':
        const closingWeight = shotContext.holeNumber >= 17 ? 8 : 6;
        factors.push({
          factor: 'Finishing holes',
          weight: closingWeight,
          description: `Hole ${shotContext.holeNumber} - round conclusion`
        });
        break;
    }
    
    // Round score context
    if (shotContext.roundScore !== undefined) {
      const scoreFactors = await this.analyzeScoreContext(shotContext.roundScore, shotContext.holeNumber);
      factors.push(...scoreFactors);
    }
    
    // Shot sequence factors
    if (shotContext.shotNumber >= 4) {
      factors.push({
        factor: 'High shot count',
        weight: 5,
        description: `${shotContext.shotNumber} shots on hole`
      });
    }
    
    return factors.slice(0, 4); // Top 4 factors
  }

  /**
   * Analyze round score context for pressure factors
   */
  private async analyzeScoreContext(
    currentScore: number,
    currentHole: number
  ): Promise<PressureFactor[]> {
    const factors: PressureFactor[] = [];
    
    try {
      // Get historical scoring data
      const { data, error } = await supabase
        .from('rounds')
        .select('total_score')
        .not('total_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      
      if (data && data.length > 5) {
        const scores = data.map(r => r.total_score).filter(s => s != null);
        const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const bestScore = Math.min(...scores);
        
        // Project final score based on current pace
        const remainingHoles = 18 - currentHole;
        const averagePerHole = currentScore / currentHole;
        const projectedScore = currentScore + (remainingHoles * averagePerHole);
        
        // Personal best opportunity
        if (projectedScore <= bestScore + 2) {
          factors.push({
            factor: 'Personal best opportunity',
            weight: 9,
            description: `On pace for ${Math.round(projectedScore)} (best: ${bestScore})`
          });
        }
        
        // Round quality assessment
        if (projectedScore <= averageScore - 3) {
          factors.push({
            factor: 'Exceptional round in progress',
            weight: 8,
            description: `Well below average pace`
          });
        } else if (projectedScore <= averageScore + 1) {
          factors.push({
            factor: 'Solid round potential',
            weight: 6,
            description: `Around average scoring pace`
          });
        }
        
        // Milestone scores
        const roundedProjected = Math.round(projectedScore);
        if ([70, 75, 80, 85, 90].includes(roundedProjected)) {
          factors.push({
            factor: 'Milestone score opportunity',
            weight: 7,
            description: `On pace for ${roundedProjected}`
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing score context:', error);
    }
    
    return factors;
  }

  /**
   * Calculate overall pressure intensity
   */
  private calculatePressureIntensity(factors: PressureFactor[]): PressureSituation['intensity'] {
    if (factors.length === 0) return 'low';
    
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    const averageWeight = totalWeight / factors.length;
    const maxWeight = Math.max(...factors.map(f => f.weight));
    
    // Consider both average intensity and peak factor
    const combinedIntensity = (averageWeight * 0.6) + (maxWeight * 0.4);
    
    if (combinedIntensity >= 8.5) return 'extreme';
    if (combinedIntensity >= 7) return 'high';
    if (combinedIntensity >= 5) return 'medium';
    return 'low';
  }

  /**
   * Generate situation description
   */
  private generateSituationDescription(
    type: PressureSituation['type'],
    context: any,
    intensity: PressureSituation['intensity']
  ): string {
    const intensityWord = {
      'low': 'Manageable',
      'medium': 'Moderate',
      'high': 'High',
      'extreme': 'Extreme'
    }[intensity];
    
    switch (type) {
      case 'scoring_opportunity':
        if (context.category === 'putting') {
          return `${intensityWord} pressure birdie putt from ${context.distanceToPin}ft`;
        } else {
          return `${intensityWord} pressure scoring chance from ${context.distanceToPin}ft`;
        }
        
      case 'trouble_recovery':
        return `${intensityWord} pressure recovery shot from ${context.lie.toLowerCase()}`;
        
      case 'closing_hole':
        return `${intensityWord} pressure finish - hole ${context.holeNumber}`;
        
      case 'streak_situation':
        return `${intensityWord} pressure streak situation`;
        
      default:
        return `${intensityWord} pressure competitive moment`;
    }
  }

  /**
   * Get mental approach recommendations
   */
  private getMentalApproach(
    type: PressureSituation['type'],
    intensity: PressureSituation['intensity']
  ): string[] {
    const approaches: string[] = [];
    
    // Base mental strategies by situation type
    switch (type) {
      case 'scoring_opportunity':
        approaches.push('Trust your read and stroke');
        approaches.push('Focus on process, not outcome');
        if (intensity === 'high' || intensity === 'extreme') {
          approaches.push('Take extra time to settle');
        }
        break;
        
      case 'trouble_recovery':
        approaches.push('Accept the challenge');
        approaches.push('Commit fully to your plan');
        approaches.push('Focus on clean contact');
        break;
        
      case 'closing_hole':
        approaches.push('One shot at a time');
        approaches.push('Stay in present moment');
        if (intensity === 'high' || intensity === 'extreme') {
          approaches.push('Embrace the moment');
        }
        break;
        
      default:
        approaches.push('Stay confident and committed');
        approaches.push('Trust your preparation');
        break;
    }
    
    // Intensity-based additions
    if (intensity === 'extreme') {
      approaches.push('Use deep breathing to center');
    } else if (intensity === 'low') {
      approaches.push('Play with confidence');
    }
    
    return approaches.slice(0, 3);
  }

  /**
   * Get historical performance in pressure situations
   */
  private async getHistoricalPressurePerformance(
    type: PressureSituation['type'],
    context: any
  ): Promise<PressurePerformance | undefined> {
    try {
      // Query based on situation type
      let query = supabase.from('shots').select('result_zone, contact_quality, shot_category');
      
      // Filter for similar pressure situations
      if (type === 'scoring_opportunity' && context.category === 'putting') {
        query = query
          .eq('shot_category', 'putting')
          .lte('start_distance_to_hole', 8) // Birdie putt range
          .gte('start_distance_to_hole', 3);
      } else if (type === 'trouble_recovery') {
        query = query.or(`start_lie.ilike.%rough%,start_lie.ilike.%bunker%,start_lie.eq.Recovery`);
      }
      
      query = query
        .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);
        
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (!data || data.length < 8) {
        return undefined; // Insufficient data
      }
      
      // Calculate success rate
      const goodShots = data.filter(s => s.result_zone === 'Good' || s.result_zone === 'Acceptable');
      const successRate = goodShots.length / data.length;
      
      // Compare to normal performance
      const normalPerformance = await this.getNormalPerformance(context.category);
      const comparedToNormal = ((successRate - normalPerformance) / normalPerformance) * 100;
      
      return {
        successRate: Math.round(successRate * 100) / 100,
        comparedToNormal: Math.round(comparedToNormal),
        commonReactions: this.identifyCommonReactions(data),
        strengths: this.identifyStrengths(data, successRate),
        weaknesses: this.identifyWeaknesses(data, successRate),
        improvementTrends: this.analyzeImprovementTrends(data)
      };
    } catch (error) {
      console.error('Error getting pressure performance:', error);
      return undefined;
    }
  }

  /**
   * Get normal performance baseline
   */
  private async getNormalPerformance(category: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('shots')
        .select('result_zone')
        .eq('shot_category', category)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .limit(200);
        
      if (error) throw error;
      
      if (!data || data.length < 20) return 0.7; // Default baseline
      
      const goodShots = data.filter(s => s.result_zone === 'Good' || s.result_zone === 'Acceptable');
      return goodShots.length / data.length;
    } catch (error) {
      return 0.7; // Default baseline
    }
  }

  /**
   * Identify common reactions under pressure
   */
  private identifyCommonReactions(data: any[]): string[] {
    const reactions: string[] = [];
    
    const poorShots = data.filter(s => s.result_zone === 'Poor');
    if (poorShots.length > data.length * 0.4) {
      reactions.push('Higher miss rate under pressure');
    }
    
    const contactIssues = poorShots.filter(s => s.contact_quality && s.contact_quality !== 'Pure');
    if (contactIssues.length > poorShots.length * 0.6) {
      reactions.push('Contact quality suffers when pressured');
    }
    
    if (reactions.length === 0) {
      reactions.push('Generally handles pressure well');
    }
    
    return reactions.slice(0, 2);
  }

  /**
   * Identify pressure performance strengths
   */
  private identifyStrengths(data: any[], successRate: number): string[] {
    const strengths: string[] = [];
    
    if (successRate >= 0.75) {
      strengths.push('Excellent under pressure');
    } else if (successRate >= 0.65) {
      strengths.push('Solid pressure performer');
    }
    
    const pureContacts = data.filter(s => s.contact_quality === 'Pure');
    if (pureContacts.length / data.length >= 0.6) {
      strengths.push('Maintains contact quality');
    }
    
    if (strengths.length === 0) {
      strengths.push('Room for pressure improvement');
    }
    
    return strengths.slice(0, 2);
  }

  /**
   * Identify pressure performance weaknesses
   */
  private identifyWeaknesses(data: any[], successRate: number): string[] {
    const weaknesses: string[] = [];
    
    if (successRate < 0.5) {
      weaknesses.push('Struggles significantly under pressure');
    } else if (successRate < 0.65) {
      weaknesses.push('Performance drops under pressure');
    }
    
    const contactIssues = data.filter(s => 
      s.contact_quality && s.contact_quality !== 'Pure' && s.result_zone === 'Poor'
    );
    if (contactIssues.length > data.length * 0.3) {
      weaknesses.push('Tension affects contact');
    }
    
    if (weaknesses.length === 0) {
      weaknesses.push('No significant pressure weaknesses');
    }
    
    return weaknesses.slice(0, 2);
  }

  /**
   * Analyze improvement trends
   */
  private analyzeImprovementTrends(data: any[]): boolean {
    if (data.length < 10) return false;
    
    // Split data into first and second half chronologically
    const sorted = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const midpoint = Math.floor(sorted.length / 2);
    
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);
    
    const firstHalfSuccess = firstHalf.filter(s => s.result_zone === 'Good' || s.result_zone === 'Acceptable').length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter(s => s.result_zone === 'Good' || s.result_zone === 'Acceptable').length / secondHalf.length;
    
    return secondHalfSuccess > firstHalfSuccess + 0.1; // 10% improvement threshold
  }

  /**
   * Provide complete pressure analysis
   */
  async analyzePressureShot(shotContext: any): Promise<PressureAnalysis> {
    try {
      const situation = await this.identifyPressureSituation(shotContext);
      
      return {
        currentSituation: situation,
        recommendedMindset: this.getRecommendedMindset(situation),
        technicalAdjustments: this.getTechnicalAdjustments(situation),
        strategyRecommendations: this.getStrategyRecommendations(situation, shotContext),
        confidenceBooster: this.getConfidenceBooster(situation)
      };
    } catch (error) {
      console.error('Error analyzing pressure shot:', error);
      return this.getBasicPressureAnalysis(shotContext);
    }
  }

  /**
   * Get recommended mindset for pressure situation
   */
  private getRecommendedMindset(situation: PressureSituation): string[] {
    const mindset = [...situation.mentalApproach];
    
    // Add situation-specific mindset recommendations
    if (situation.historicalPerformance) {
      if (situation.historicalPerformance.successRate >= 0.7) {
        mindset.push('Draw on your proven pressure ability');
      } else if (situation.historicalPerformance.successRate < 0.5) {
        mindset.push('Focus on executing fundamentals');
      }
      
      if (situation.historicalPerformance.improvementTrends) {
        mindset.push('Trust your recent pressure improvements');
      }
    }
    
    return mindset.slice(0, 4);
  }

  /**
   * Get technical adjustments for pressure
   */
  private getTechnicalAdjustments(situation: PressureSituation): string[] {
    const adjustments: string[] = [];
    
    switch (situation.intensity) {
      case 'extreme':
        adjustments.push('Take extra practice swings');
        adjustments.push('Slow down pre-shot routine');
        adjustments.push('Focus on smooth tempo');
        break;
      case 'high':
        adjustments.push('One extra deep breath');
        adjustments.push('Check grip pressure');
        break;
      case 'medium':
        adjustments.push('Trust normal routine');
        break;
      default:
        adjustments.push('Play with confidence');
        break;
    }
    
    // Type-specific technical adjustments
    if (situation.type === 'scoring_opportunity') {
      adjustments.push('Commit to your read completely');
    } else if (situation.type === 'trouble_recovery') {
      adjustments.push('Make solid contact priority #1');
    }
    
    return adjustments.slice(0, 3);
  }

  /**
   * Get strategy recommendations
   */
  private getStrategyRecommendations(
    situation: PressureSituation,
    context: any
  ): string[] {
    const strategies: string[] = [];
    
    if (situation.intensity === 'extreme' || situation.intensity === 'high') {
      strategies.push('Choose conservative target');
      strategies.push('Trust your most reliable shot');
    } else {
      strategies.push('Play your normal game plan');
    }
    
    // Historical performance adjustments
    if (situation.historicalPerformance?.successRate && situation.historicalPerformance.successRate < 0.6) {
      strategies.push('Extra emphasis on safe play');
    }
    
    return strategies.slice(0, 3);
  }

  /**
   * Get confidence booster message
   */
  private getConfidenceBooster(situation: PressureSituation): string {
    if (situation.historicalPerformance?.successRate && situation.historicalPerformance.successRate >= 0.7) {
      return "You've succeeded in this situation before - trust yourself!";
    }
    
    switch (situation.type) {
      case 'scoring_opportunity':
        return "This is why you practice - go make it happen!";
      case 'trouble_recovery':
        return "Great challenge - show your skill and creativity!";
      case 'closing_hole':
        return "You've earned this moment - finish strong!";
      default:
        return "Trust your preparation and ability!";
    }
  }

  /**
   * Fallback basic pressure analysis
   */
  private getBasicPressureSituation(context: any): PressureSituation {
    return {
      type: 'competitive_moment',
      intensity: 'medium',
      description: 'Standard competitive shot',
      factors: [
        {
          factor: 'Competitive situation',
          weight: 5,
          description: 'Normal game pressure'
        }
      ],
      mentalApproach: ['Stay focused', 'Trust your swing']
    };
  }

  /**
   * Fallback basic analysis
   */
  private getBasicPressureAnalysis(context: any): PressureAnalysis {
    const situation = this.getBasicPressureSituation(context);
    
    return {
      currentSituation: situation,
      recommendedMindset: ['Stay calm', 'Trust your routine'],
      technicalAdjustments: ['Normal setup'],
      strategyRecommendations: ['Play your normal game'],
      confidenceBooster: 'You got this - trust your ability!'
    };
  }
}

export const pressureAnalyticsService = new PressureAnalyticsService();
export default pressureAnalyticsService;