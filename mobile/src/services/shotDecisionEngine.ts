import { supabase } from './supabase';

// Advanced shot decision engine
// Analyzes historical performance to provide strategic recommendations and course management insights

export interface ShotDecision {
  recommendation: 'aggressive' | 'conservative' | 'layup' | 'target_specific';
  confidence: number;
  reasoning: string[];
  alternativeStrategy?: {
    strategy: string;
    pros: string[];
    cons: string[];
  };
  riskAssessment: {
    successProbability: number;
    worstCaseScenario: string;
    bestCaseScenario: string;
  };
}

export interface SituationContext {
  distanceToPin: number;
  lie: string;
  holeNumber: number;
  currentScore: number;
  parForHole: number;
  shotNumber: number;
  timeOfDay?: string;
  weather?: {
    windSpeed: number;
    conditions: string;
  };
  hazards?: {
    water: boolean;
    bunkers: boolean;
    ob: boolean;
    rough: boolean;
  };
  pressure?: 'low' | 'medium' | 'high';
}

export interface PerformancePattern {
  category: string;
  pattern: string;
  frequency: number;
  impact: 'positive' | 'negative' | 'neutral';
  recommendation: string;
}

class ShotDecisionEngine {
  private demoPatterns = {
    // Demo performance patterns for development
    tendencies: [
      {
        condition: 'approach_shots_150_plus',
        successRate: 0.72,
        commonMiss: 'short_right',
        pattern: 'Tends to come up short on longer approach shots'
      },
      {
        condition: 'pressure_situations',
        successRate: 0.65,
        commonMiss: 'pull_left',
        pattern: 'Pulls shots left under pressure'
      },
      {
        condition: 'rough_lies',
        successRate: 0.58,
        commonMiss: 'heavy_contact',
        pattern: 'Struggles with heavy rough lies'
      },
      {
        condition: 'wind_conditions',
        successRate: 0.70,
        commonMiss: 'poor_distance_control',
        pattern: 'Distance control issues in wind'
      }
    ],
    
    courseManagement: {
      layupDistance: 100, // Preferred layup distance
      aggressiveThreshold: 0.75, // Success rate threshold for aggressive play
      conservativePreference: 0.6, // Baseline conservative play success rate
    },
    
    pressureResponse: {
      frontNineAvg: 82,
      backNineAvg: 85, // Slight deterioration on back nine
      clutchPerformance: 0.68 // Performance in critical situations
    }
  };

  /**
   * Analyze shot situation and provide strategic recommendation
   */
  async getShotDecision(context: SituationContext): Promise<ShotDecision> {
    try {
      // Get historical performance data
      const patterns = await this.getPerformancePatterns(context);
      const riskFactors = this.assessRiskFactors(context);
      const pressure = this.assessPressureLevel(context);

      // Generate strategic recommendation
      const decision = this.calculateOptimalStrategy(context, patterns, riskFactors, pressure);
      
      return decision;
    } catch (error) {
      console.error('Error generating shot decision:', error);
      return this.getBasicDecision(context);
    }
  }

  /**
   * Get performance patterns relevant to current situation
   */
  private async getPerformancePatterns(context: SituationContext): Promise<any> {
    try {
      // Try to get real historical data
      const { data: shots, error } = await supabase
        .from('shots')
        .select(`
          *,
          rounds!inner(hole_number, course_name)
        `)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      if (shots && shots.length > 20) {
        return this.analyzeRealPerformance(shots, context);
      }
      
      // Fallback to demo patterns
      return this.demoPatterns;
    } catch (error) {
      console.error('Failed to get performance patterns:', error);
      return this.demoPatterns;
    }
  }

  /**
   * Analyze real performance data to identify patterns
   */
  private analyzeRealPerformance(shots: any[], context: SituationContext): any {
    const patterns = {
      tendencies: [],
      courseManagement: { ...this.demoPatterns.courseManagement },
      pressureResponse: { ...this.demoPatterns.pressureResponse }
    };

    // Analyze approach shot performance
    const approachShots = shots.filter(s => 
      s.shot_category === 'approach' && 
      s.start_distance_to_hole >= 100
    );

    if (approachShots.length > 10) {
      const successRate = approachShots.filter(s => 
        s.result_zone === 'Good' || s.result_zone === 'Acceptable'
      ).length / approachShots.length;

      patterns.tendencies.push({
        condition: 'approach_shots_long',
        successRate,
        pattern: successRate > 0.75 ? 'Strong long approach game' : 
                successRate > 0.6 ? 'Decent long approach shots' : 
                'Struggles with long approach shots'
      });
    }

    // Analyze pressure situations (late holes, difficult shots)
    const lateHoleShots = shots.filter(s => s.rounds?.hole_number >= 15);
    if (lateHoleShots.length > 10) {
      const lateHoleSuccess = lateHoleShots.filter(s => 
        s.result_zone === 'Good' || s.result_zone === 'Acceptable'
      ).length / lateHoleShots.length;

      patterns.pressureResponse.clutchPerformance = lateHoleSuccess;
    }

    // Analyze lie performance
    const roughShots = shots.filter(s => 
      s.start_lie?.includes('rough') || s.start_lie?.includes('bunker')
    );
    
    if (roughShots.length > 10) {
      const roughSuccess = roughShots.filter(s => 
        s.result_zone === 'Good' || s.result_zone === 'Acceptable'
      ).length / roughShots.length;

      patterns.tendencies.push({
        condition: 'difficult_lies',
        successRate: roughSuccess,
        pattern: roughSuccess > 0.7 ? 'Handles difficult lies well' : 
                roughSuccess > 0.5 ? 'Decent from difficult lies' : 
                'Struggles from difficult lies'
      });
    }

    return patterns;
  }

  /**
   * Assess risk factors for current shot
   */
  private assessRiskFactors(context: SituationContext): any {
    let riskScore = 0;
    const risks: string[] = [];

    // Distance risk
    if (context.distanceToPin > 200) {
      riskScore += 0.2;
      risks.push('Long distance increases miss probability');
    }

    // Lie risk
    if (context.lie.includes('rough') || context.lie.includes('bunker')) {
      riskScore += 0.3;
      risks.push('Difficult lie reduces control');
    }

    // Hazard risk
    if (context.hazards?.water) {
      riskScore += 0.4;
      risks.push('Water hazard penalty risk');
    }
    if (context.hazards?.ob) {
      riskScore += 0.3;
      risks.push('Out of bounds penalty risk');
    }

    // Weather risk
    if (context.weather?.windSpeed && context.weather.windSpeed > 15) {
      riskScore += 0.2;
      risks.push('Strong wind affects ball flight');
    }

    // Hole context risk
    if (context.shotNumber === 1 && context.holeNumber <= 3) {
      riskScore += 0.1;
      risks.push('Early round - avoid big numbers');
    }

    return {
      score: Math.min(riskScore, 1.0),
      factors: risks
    };
  }

  /**
   * Assess pressure level of current situation
   */
  private assessPressureLevel(context: SituationContext): 'low' | 'medium' | 'high' {
    let pressurePoints = 0;

    // Late in round
    if (context.holeNumber >= 15) pressurePoints += 2;
    else if (context.holeNumber >= 10) pressurePoints += 1;

    // Score relative to par
    const scoreToPar = context.currentScore - (context.parForHole * (context.holeNumber - 1));
    if (scoreToPar >= 5) pressurePoints += 2; // Well over par
    else if (scoreToPar >= 2) pressurePoints += 1; // Slightly over par
    else if (scoreToPar <= -2) pressurePoints += 1; // Under par pressure

    // Shot number (recovery situations)
    if (context.shotNumber >= 4) pressurePoints += 2;
    else if (context.shotNumber === 3) pressurePoints += 1;

    // Hazards present
    if (context.hazards?.water || context.hazards?.ob) pressurePoints += 1;

    if (pressurePoints >= 4) return 'high';
    if (pressurePoints >= 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate optimal strategy based on analysis
   */
  private calculateOptimalStrategy(
    context: SituationContext,
    patterns: any,
    riskFactors: any,
    pressureLevel: 'low' | 'medium' | 'high'
  ): ShotDecision {
    const reasoning: string[] = [];
    let strategy: ShotDecision['recommendation'] = 'conservative';
    let confidence = 0.7;

    // Assess player's performance in similar situations
    const relevantTendency = patterns.tendencies.find(t => 
      (context.distanceToPin > 150 && t.condition.includes('approach')) ||
      (pressureLevel === 'high' && t.condition.includes('pressure')) ||
      (context.lie.includes('rough') && t.condition.includes('rough'))
    );

    if (relevantTendency) {
      confidence = relevantTendency.successRate;
      reasoning.push(relevantTendency.pattern);
    }

    // Risk assessment influence
    if (riskFactors.score > 0.6) {
      strategy = 'conservative';
      reasoning.push('High risk situation favors conservative play');
      reasoning.push(...riskFactors.factors.slice(0, 2));
    } else if (riskFactors.score < 0.3 && confidence > 0.75) {
      strategy = 'aggressive';
      reasoning.push('Low risk with good success rate supports aggressive play');
    }

    // Pressure level influence
    if (pressureLevel === 'high') {
      if (patterns.pressureResponse.clutchPerformance < 0.7) {
        strategy = 'conservative';
        reasoning.push('Conservative approach recommended under pressure');
      }
    }

    // Distance-based strategy
    if (context.distanceToPin > 200 && context.shotNumber === 2) {
      if (patterns.courseManagement.layupDistance && 
          Math.abs(context.distanceToPin - patterns.courseManagement.layupDistance) > 50) {
        strategy = 'layup';
        reasoning.push(`Consider laying up to preferred ${patterns.courseManagement.layupDistance} yard distance`);
      }
    }

    // Score situation influence
    const scoreToPar = context.currentScore - (context.parForHole * (context.holeNumber - 1));
    if (scoreToPar >= 3) {
      strategy = 'aggressive';
      reasoning.push('Need to be aggressive to get back to par');
    } else if (scoreToPar <= -1) {
      strategy = 'conservative';
      reasoning.push('Protect good score with conservative play');
    }

    // Generate risk assessment
    const riskAssessment = this.generateRiskAssessment(context, strategy, confidence);

    // Generate alternative strategy
    const alternativeStrategy = this.generateAlternativeStrategy(strategy, context);

    return {
      recommendation: strategy,
      confidence,
      reasoning: reasoning.slice(0, 3), // Limit to top 3 reasons
      alternativeStrategy,
      riskAssessment
    };
  }

  /**
   * Generate risk assessment for the recommendation
   */
  private generateRiskAssessment(
    context: SituationContext,
    strategy: ShotDecision['recommendation'],
    confidence: number
  ): ShotDecision['riskAssessment'] {
    let successProbability = confidence;
    let worstCase = 'Miss the green';
    let bestCase = 'Pin high';

    switch (strategy) {
      case 'aggressive':
        successProbability = confidence * 0.8; // Slightly lower for aggressive
        worstCase = context.hazards?.water ? 'Water hazard' : 
                   context.hazards?.ob ? 'Out of bounds' : 
                   'Poor lie for next shot';
        bestCase = 'Close to pin, great birdie chance';
        break;
        
      case 'conservative':
        successProbability = confidence * 1.1; // Higher for conservative
        worstCase = 'Long putt';
        bestCase = 'Safe on green, good par chance';
        break;
        
      case 'layup':
        successProbability = 0.85;
        worstCase = 'Poor layup position';
        bestCase = 'Perfect wedge distance';
        break;
    }

    return {
      successProbability: Math.min(successProbability, 0.95),
      worstCaseScenario: worstCase,
      bestCaseScenario: bestCase
    };
  }

  /**
   * Generate alternative strategy option
   */
  private generateAlternativeStrategy(
    primaryStrategy: ShotDecision['recommendation'],
    context: SituationContext
  ): ShotDecision['alternativeStrategy'] {
    if (primaryStrategy === 'aggressive') {
      return {
        strategy: 'Conservative approach to center of green',
        pros: ['Higher success rate', 'Avoids big numbers', 'Stress-free shot'],
        cons: ['Less birdie potential', 'Longer putt likely']
      };
    } else if (primaryStrategy === 'conservative') {
      return {
        strategy: 'Aggressive attack at pin',
        pros: ['Great birdie opportunity', 'Shorter putt', 'Confidence boost'],
        cons: ['Higher miss rate', 'Penalty risk', 'Pressure situation']
      };
    } else if (primaryStrategy === 'layup') {
      return {
        strategy: 'Go for it with longer club',
        pros: ['Potential eagle/birdie', 'Fewer total shots', 'Momentum builder'],
        cons: ['High risk of penalty', 'Difficult recovery', 'Pressure shot']
      };
    }

    return {
      strategy: 'Stick with current plan',
      pros: ['Confidence in decision'],
      cons: ['No backup considered']
    };
  }

  /**
   * Fallback basic decision for error scenarios
   */
  private getBasicDecision(context: SituationContext): ShotDecision {
    let strategy: ShotDecision['recommendation'] = 'conservative';
    const reasoning = ['Basic recommendation based on distance and lie'];

    if (context.distanceToPin < 100) {
      strategy = 'target_specific';
      reasoning.push('Short distance allows for precision');
    } else if (context.distanceToPin > 200 && context.shotNumber === 2) {
      strategy = 'layup';
      reasoning.push('Long distance suggests layup strategy');
    }

    return {
      recommendation: strategy,
      confidence: 0.6,
      reasoning,
      riskAssessment: {
        successProbability: 0.7,
        worstCaseScenario: 'Miss green',
        bestCaseScenario: 'Hit green'
      }
    };
  }

  /**
   * Get specific performance patterns for coaching insights
   */
  async getPerformanceInsights(): Promise<PerformancePattern[]> {
    try {
      const patterns = await this.getPerformancePatterns({
        distanceToPin: 150,
        lie: 'Fairway',
        holeNumber: 1,
        currentScore: 0,
        parForHole: 4,
        shotNumber: 2
      });

      const insights: PerformancePattern[] = [];

      // Convert tendencies to structured insights
      patterns.tendencies.forEach((tendency: any) => {
        insights.push({
          category: 'Performance Tendency',
          pattern: tendency.pattern,
          frequency: Math.round(tendency.successRate * 100) / 100,
          impact: tendency.successRate > 0.7 ? 'positive' : 
                 tendency.successRate < 0.5 ? 'negative' : 'neutral',
          recommendation: this.generateInsightRecommendation(tendency)
        });
      });

      return insights;
    } catch (error) {
      console.error('Error getting performance insights:', error);
      return [];
    }
  }

  /**
   * Generate recommendation based on performance insight
   */
  private generateInsightRecommendation(tendency: any): string {
    if (tendency.condition.includes('pressure')) {
      return tendency.successRate < 0.7 ? 
        'Practice pressure situations and develop pre-shot routine' :
        'Continue using current pressure management techniques';
    }
    
    if (tendency.condition.includes('rough')) {
      return tendency.successRate < 0.6 ? 
        'Focus on rough lie practice and club-up strategy' :
        'Good rough play - maintain current technique';
    }
    
    if (tendency.condition.includes('approach')) {
      return tendency.successRate < 0.7 ? 
        'Work on approach shot accuracy and distance control' :
        'Strong approach game - keep it up';
    }
    
    return 'Continue current approach';
  }
}

export const shotDecisionEngine = new ShotDecisionEngine();
export default shotDecisionEngine;