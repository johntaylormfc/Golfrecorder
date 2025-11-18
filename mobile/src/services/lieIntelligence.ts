import { supabase } from './supabase';

// Lie intelligence and prediction service
// Analyzes and predicts lie conditions based on shot patterns and course knowledge

export interface LiePrediction {
  mostLikely: string;
  probability: number;
  alternatives: Array<{
    lie: string;
    probability: number;
  }>;
  reasoning: string[];
  difficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
  recommendations: string[];
}

export interface LieAnalysis {
  currentLie: string;
  expectedDifficulty: number; // 1-10 scale
  historicalPerformance: {
    successRate: number;
    averageResult: string;
    commonMistakes: string[];
  };
  adjustmentRecommendations: {
    clubSelection: string;
    technique: string[];
    strategy: string;
  };
}

export interface CourseKnowledge {
  courseName?: string;
  holeNumber: number;
  shotLanding: {
    coordinates?: { x: number; y: number };
    distanceFromTarget: number;
    direction: 'left' | 'right' | 'short' | 'long' | 'on_target';
  };
  weather?: {
    recent: boolean; // Recent rain
    windy: boolean;
    conditions: string;
  };
}

class LieIntelligenceService {
  private lieDifficultyMap = {
    'Tee box': { difficulty: 1, description: 'Perfect conditions' },
    'Fairway': { difficulty: 2, description: 'Ideal lie' },
    'First cut': { difficulty: 3, description: 'Slightly longer grass' },
    'Light rough': { difficulty: 4, description: 'Manageable rough' },
    'Fringe': { difficulty: 3, description: 'Short grass around green' },
    'Green': { difficulty: 2, description: 'Putting surface' },
    'Heavy rough': { difficulty: 7, description: 'Thick, grabby grass' },
    'Fairway bunker': { difficulty: 6, description: 'Sand with distance needed' },
    'Greenside bunker': { difficulty: 5, description: 'Sand near green' },
    'Recovery': { difficulty: 8, description: 'Trees, hazards, or unusual lies' }
  };

  private lieTransitionPatterns = {
    // From -> To probabilities based on shot results
    'tee_shot': {
      'Driver': {
        'Good': { 'Fairway': 0.7, 'First cut': 0.2, 'Light rough': 0.1 },
        'Acceptable': { 'Fairway': 0.4, 'First cut': 0.3, 'Light rough': 0.2, 'Heavy rough': 0.1 },
        'Poor': { 'Light rough': 0.3, 'Heavy rough': 0.4, 'Recovery': 0.2, 'Fairway bunker': 0.1 }
      },
      '3 Wood': {
        'Good': { 'Fairway': 0.8, 'First cut': 0.15, 'Light rough': 0.05 },
        'Acceptable': { 'Fairway': 0.5, 'First cut': 0.3, 'Light rough': 0.2 },
        'Poor': { 'Light rough': 0.4, 'Heavy rough': 0.3, 'Recovery': 0.3 }
      }
    },
    'approach_shot': {
      'distance_150_plus': {
        'Good': { 'Green': 0.6, 'Fringe': 0.3, 'Greenside bunker': 0.1 },
        'Acceptable': { 'Green': 0.3, 'Fringe': 0.2, 'First cut': 0.2, 'Light rough': 0.2, 'Greenside bunker': 0.1 },
        'Poor': { 'Light rough': 0.3, 'Heavy rough': 0.2, 'Greenside bunker': 0.2, 'Recovery': 0.3 }
      },
      'distance_under_150': {
        'Good': { 'Green': 0.7, 'Fringe': 0.2, 'Greenside bunker': 0.1 },
        'Acceptable': { 'Green': 0.4, 'Fringe': 0.3, 'Light rough': 0.2, 'Greenside bunker': 0.1 },
        'Poor': { 'Light rough': 0.2, 'Heavy rough': 0.2, 'Greenside bunker': 0.3, 'Recovery': 0.3 }
      }
    },
    'recovery_shot': {
      'any': {
        'Good': { 'Fairway': 0.4, 'Green': 0.2, 'First cut': 0.2, 'Fringe': 0.2 },
        'Acceptable': { 'Fairway': 0.3, 'First cut': 0.2, 'Light rough': 0.3, 'Fringe': 0.2 },
        'Poor': { 'Light rough': 0.3, 'Heavy rough': 0.3, 'Recovery': 0.4 }
      }
    }
  };

  /**
   * Predict lie for next shot based on current shot result
   */
  async predictNextLie(
    currentShot: {
      category: string;
      club: string;
      result: string;
      startLie: string;
      distanceToPin: number;
    },
    courseKnowledge?: CourseKnowledge
  ): Promise<LiePrediction> {
    try {
      // Get historical lie transition data
      const historicalData = await this.getHistoricalLieData(currentShot);
      
      // Calculate base probabilities
      const baseProbabilities = this.calculateBaseProbabilities(currentShot);
      
      // Adjust for course knowledge and conditions
      const adjustedProbabilities = this.adjustForCourseConditions(
        baseProbabilities,
        courseKnowledge
      );
      
      // Get historical performance factor
      const historicalWeight = this.getHistoricalWeight(historicalData);
      
      // Combine predictions
      const finalProbabilities = this.combinePredictions(
        adjustedProbabilities,
        historicalData,
        historicalWeight
      );
      
      return this.formatPrediction(finalProbabilities, currentShot, courseKnowledge);
    } catch (error) {
      console.error('Error predicting lie:', error);
      return this.getBasicLiePrediction(currentShot);
    }
  }

  /**
   * Get historical lie transition data from database
   */
  private async getHistoricalLieData(currentShot: any): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('shots')
        .select(`
          end_lie,
          result_zone,
          shot_category,
          club,
          start_distance_to_hole
        `)
        .eq('shot_category', currentShot.category)
        .eq('club', currentShot.club)
        .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .not('end_lie', 'is', null)
        .limit(50);

      if (error) throw error;

      // Process historical data into transition probabilities
      const transitions: { [key: string]: number } = {};
      let totalCount = 0;

      data?.forEach(shot => {
        if (shot.end_lie && shot.result_zone === currentShot.result) {
          transitions[shot.end_lie] = (transitions[shot.end_lie] || 0) + 1;
          totalCount++;
        }
      });

      // Convert counts to probabilities
      Object.keys(transitions).forEach(lie => {
        transitions[lie] = transitions[lie] / totalCount;
      });

      return { transitions, sampleSize: totalCount };
    } catch (error) {
      console.error('Failed to get historical lie data:', error);
      return { transitions: {}, sampleSize: 0 };
    }
  }

  /**
   * Calculate base probabilities using pattern data
   */
  private calculateBaseProbabilities(currentShot: any): { [key: string]: number } {
    let patterns;

    // Select appropriate pattern based on shot category
    if (currentShot.category === 'tee') {
      patterns = this.lieTransitionPatterns.tee_shot[currentShot.club] || 
                this.lieTransitionPatterns.tee_shot['Driver'];
    } else if (currentShot.category === 'approach') {
      const distanceKey = currentShot.distanceToPin > 150 ? 'distance_150_plus' : 'distance_under_150';
      patterns = this.lieTransitionPatterns.approach_shot[distanceKey];
    } else {
      patterns = this.lieTransitionPatterns.recovery_shot.any;
    }

    return patterns[currentShot.result] || patterns['Acceptable'] || {};
  }

  /**
   * Adjust probabilities based on course and weather conditions
   */
  private adjustForCourseConditions(
    baseProbabilities: { [key: string]: number },
    courseKnowledge?: CourseKnowledge
  ): { [key: string]: number } {
    const adjusted = { ...baseProbabilities };

    if (courseKnowledge?.weather?.recent) {
      // Recent rain makes rough more likely, fairway less likely
      if (adjusted['Fairway']) adjusted['Fairway'] *= 0.8;
      if (adjusted['Light rough']) adjusted['Light rough'] *= 1.3;
      if (adjusted['Heavy rough']) adjusted['Heavy rough'] *= 1.2;
    }

    if (courseKnowledge?.weather?.windy) {
      // Wind increases miss probability
      if (adjusted['Light rough']) adjusted['Light rough'] *= 1.2;
      if (adjusted['Heavy rough']) adjusted['Heavy rough'] *= 1.1;
      if (adjusted['Recovery']) adjusted['Recovery'] *= 1.3;
    }

    // Normalize probabilities
    const total = Object.values(adjusted).reduce((sum, prob) => sum + prob, 0);
    Object.keys(adjusted).forEach(lie => {
      adjusted[lie] = adjusted[lie] / total;
    });

    return adjusted;
  }

  /**
   * Get weight factor for historical data
   */
  private getHistoricalWeight(historicalData: any): number {
    // More historical data = higher weight for personal patterns
    if (historicalData.sampleSize >= 20) return 0.7;
    if (historicalData.sampleSize >= 10) return 0.5;
    if (historicalData.sampleSize >= 5) return 0.3;
    return 0.1;
  }

  /**
   * Combine pattern-based and historical predictions
   */
  private combinePredictions(
    patternProbabilities: { [key: string]: number },
    historicalData: any,
    historicalWeight: number
  ): { [key: string]: number } {
    const combined: { [key: string]: number } = {};
    const patternWeight = 1 - historicalWeight;

    // Get all possible lies
    const allLies = new Set([
      ...Object.keys(patternProbabilities),
      ...Object.keys(historicalData.transitions || {})
    ]);

    allLies.forEach(lie => {
      const patternProb = patternProbabilities[lie] || 0;
      const historicalProb = historicalData.transitions?.[lie] || 0;
      
      combined[lie] = (patternProb * patternWeight) + (historicalProb * historicalWeight);
    });

    return combined;
  }

  /**
   * Format prediction into structured result
   */
  private formatPrediction(
    probabilities: { [key: string]: number },
    currentShot: any,
    courseKnowledge?: CourseKnowledge
  ): LiePrediction {
    // Sort by probability
    const sorted = Object.entries(probabilities)
      .sort(([,a], [,b]) => b - a)
      .filter(([,prob]) => prob > 0.05); // Filter out very low probabilities

    const mostLikely = sorted[0];
    const alternatives = sorted.slice(1, 4).map(([lie, prob]) => ({
      lie,
      probability: Math.round(prob * 100) / 100
    }));

    const reasoning = this.generateLieReasoning(currentShot, mostLikely[0], probabilities);
    const difficulty = this.assessLieDifficulty(mostLikely[0]);
    const recommendations = this.getLieRecommendations(mostLikely[0], currentShot);

    return {
      mostLikely: mostLikely[0],
      probability: Math.round(mostLikely[1] * 100) / 100,
      alternatives,
      reasoning,
      difficulty,
      recommendations
    };
  }

  /**
   * Generate reasoning for lie prediction
   */
  private generateLieReasoning(
    currentShot: any,
    predictedLie: string,
    probabilities: { [key: string]: number }
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`${currentShot.result} ${currentShot.category} shot typically results in ${predictedLie.toLowerCase()}`);

    if (currentShot.club === 'Driver' && predictedLie === 'Fairway') {
      reasoning.push('Driver with good contact usually finds fairway');
    } else if (currentShot.category === 'approach' && predictedLie === 'Green') {
      reasoning.push('Solid approach shots generally reach putting surface');
    } else if (predictedLie.includes('rough')) {
      reasoning.push('Off-line shots commonly end up in rough areas');
    }

    // Add probability context
    const confidence = probabilities[predictedLie];
    if (confidence > 0.7) {
      reasoning.push('High confidence based on shot pattern analysis');
    } else if (confidence < 0.4) {
      reasoning.push('Multiple lie possibilities - course dependent');
    }

    return reasoning.slice(0, 3);
  }

  /**
   * Assess difficulty of predicted lie
   */
  private assessLieDifficulty(lie: string): LiePrediction['difficulty'] {
    const difficulty = this.lieDifficultyMap[lie]?.difficulty || 5;
    
    if (difficulty <= 2) return 'easy';
    if (difficulty <= 4) return 'moderate';
    if (difficulty <= 6) return 'difficult';
    return 'very_difficult';
  }

  /**
   * Get recommendations for playing from predicted lie
   */
  private getLieRecommendations(lie: string, currentShot: any): string[] {
    const recommendations: string[] = [];

    switch (lie) {
      case 'Fairway':
        recommendations.push('Perfect lie for full swing');
        recommendations.push('Trust your normal club distances');
        break;
      case 'Light rough':
        recommendations.push('Take one more club');
        recommendations.push('Focus on clean contact');
        break;
      case 'Heavy rough':
        recommendations.push('Club up 2-3 clubs');
        recommendations.push('Aim for center of green');
        recommendations.push('Expect reduced distance and control');
        break;
      case 'Greenside bunker':
        recommendations.push('Open clubface and aim left');
        recommendations.push('Accelerate through impact');
        break;
      case 'Fairway bunker':
        recommendations.push('Take enough club to clear lip');
        recommendations.push('Ball position back, clean contact crucial');
        break;
      case 'Green':
        recommendations.push('Read the green carefully');
        recommendations.push('Consider pin position for approach');
        break;
      default:
        recommendations.push('Assess lie and adjust strategy');
        break;
    }

    return recommendations.slice(0, 3);
  }

  /**
   * Analyze current lie for performance insights
   */
  async analyzeLiePerformance(lie: string): Promise<LieAnalysis> {
    try {
      const historicalPerformance = await this.getHistoricalLiePerformance(lie);
      const difficulty = this.lieDifficultyMap[lie]?.difficulty || 5;
      const adjustments = this.getAdjustmentRecommendations(lie, historicalPerformance);

      return {
        currentLie: lie,
        expectedDifficulty: difficulty,
        historicalPerformance,
        adjustmentRecommendations: adjustments
      };
    } catch (error) {
      console.error('Error analyzing lie performance:', error);
      return this.getBasicLieAnalysis(lie);
    }
  }

  /**
   * Get historical performance from specific lie
   */
  private async getHistoricalLiePerformance(lie: string): Promise<LieAnalysis['historicalPerformance']> {
    try {
      const { data, error } = await supabase
        .from('shots')
        .select('result_zone, contact_quality, shot_shape')
        .eq('start_lie', lie)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (error) throw error;

      if (!data || data.length < 5) {
        return {
          successRate: 0.7,
          averageResult: 'Acceptable',
          commonMistakes: ['Limited data available']
        };
      }

      const goodShots = data.filter(s => s.result_zone === 'Good' || s.result_zone === 'Acceptable');
      const successRate = goodShots.length / data.length;

      // Find most common result
      const resultCounts: { [key: string]: number } = {};
      data.forEach(shot => {
        resultCounts[shot.result_zone] = (resultCounts[shot.result_zone] || 0) + 1;
      });
      const averageResult = Object.entries(resultCounts)
        .sort(([,a], [,b]) => b - a)[0][0];

      // Find common mistakes
      const mistakes: string[] = [];
      const poorShots = data.filter(s => s.result_zone === 'Poor');
      if (poorShots.length > 0) {
        const contactIssues = poorShots.filter(s => s.contact_quality && s.contact_quality !== 'Pure');
        if (contactIssues.length > poorShots.length * 0.5) {
          mistakes.push('Contact quality issues from this lie');
        }
        
        const shapeIssues = poorShots.filter(s => s.shot_shape === 'Hook' || s.shot_shape === 'Slice');
        if (shapeIssues.length > poorShots.length * 0.3) {
          mistakes.push('Ball flight control problems');
        }
      }

      if (mistakes.length === 0) {
        mistakes.push('Generally solid from this lie');
      }

      return {
        successRate: Math.round(successRate * 100) / 100,
        averageResult,
        commonMistakes: mistakes
      };
    } catch (error) {
      console.error('Failed to get lie performance:', error);
      return {
        successRate: 0.7,
        averageResult: 'Acceptable',
        commonMistakes: ['Data unavailable']
      };
    }
  }

  /**
   * Get adjustment recommendations for specific lie
   */
  private getAdjustmentRecommendations(
    lie: string,
    performance: LieAnalysis['historicalPerformance']
  ): LieAnalysis['adjustmentRecommendations'] {
    const adjustments = {
      clubSelection: 'Use normal club',
      technique: ['Standard setup'],
      strategy: 'Play normally'
    };

    switch (lie) {
      case 'Light rough':
        adjustments.clubSelection = performance.successRate < 0.7 ? 'Club up 1-2 clubs' : 'Club up 1 club';
        adjustments.technique = ['Steeper angle of attack', 'Ball position slightly back'];
        adjustments.strategy = 'Prioritize clean contact over distance';
        break;
        
      case 'Heavy rough':
        adjustments.clubSelection = 'Short iron or wedge only';
        adjustments.technique = ['Very steep swing', 'Firm grip', 'Ball well back in stance'];
        adjustments.strategy = 'Get back to fairway, forget the pin';
        break;
        
      case 'Fairway bunker':
        adjustments.clubSelection = 'Enough loft to clear lip';
        adjustments.technique = ['Ball position back', 'Minimal lower body', 'Hit ball first'];
        adjustments.strategy = 'Conservative target, avoid lip';
        break;
        
      case 'Greenside bunker':
        adjustments.clubSelection = 'Sand wedge or lob wedge';
        adjustments.technique = ['Open clubface', 'Hit sand behind ball', 'Accelerate through'];
        adjustments.strategy = 'Get out first, close second';
        break;
    }

    // Adjust based on performance
    if (performance.successRate < 0.5) {
      adjustments.strategy = 'Extra conservative - focus on safe recovery';
    }

    return adjustments;
  }

  /**
   * Fallback basic prediction
   */
  private getBasicLiePrediction(currentShot: any): LiePrediction {
    let mostLikely = 'Fairway';
    let probability = 0.6;

    if (currentShot.result === 'Poor') {
      mostLikely = 'Light rough';
      probability = 0.5;
    } else if (currentShot.category === 'approach') {
      mostLikely = 'Green';
      probability = 0.4;
    }

    return {
      mostLikely,
      probability,
      alternatives: [
        { lie: 'First cut', probability: 0.2 },
        { lie: 'Light rough', probability: 0.15 }
      ],
      reasoning: ['Basic prediction based on shot result'],
      difficulty: 'moderate',
      recommendations: ['Assess actual lie when you reach ball']
    };
  }

  /**
   * Fallback basic analysis
   */
  private getBasicLieAnalysis(lie: string): LieAnalysis {
    const difficulty = this.lieDifficultyMap[lie]?.difficulty || 5;
    
    return {
      currentLie: lie,
      expectedDifficulty: difficulty,
      historicalPerformance: {
        successRate: 0.7,
        averageResult: 'Acceptable',
        commonMistakes: ['Limited historical data']
      },
      adjustmentRecommendations: {
        clubSelection: 'Assess based on lie',
        technique: ['Standard approach'],
        strategy: 'Play within your abilities'
      }
    };
  }
}

export const lieIntelligenceService = new LieIntelligenceService();
export default lieIntelligenceService;