import { supabase } from './supabase';

// Smart club suggestion service
// Analyzes historical shot data to recommend optimal club selection

export interface ClubSuggestion {
  club: string;
  confidence: number; // 0-1 score
  averageDistance: number;
  successRate: number; // percentage of good/acceptable results
  sampleSize: number;
  reasoning: string;
}

export interface SuggestionContext {
  distanceToPin: number;
  lie: string;
  shotCategory: 'tee' | 'approach' | 'around_green' | 'putt';
  windConditions?: {
    speed: number; // mph
    direction: 'into' | 'down' | 'cross' | 'calm';
  };
  elevation?: 'uphill' | 'downhill' | 'flat';
  pinPosition?: 'front' | 'middle' | 'back';
}

class ClubSuggestionService {
  private demoData = {
    // Demo historical performance data
    clubStats: {
      'Driver': { avgDistance: 275, accuracy: 0.72, samples: 45 },
      '3 Wood': { avgDistance: 230, accuracy: 0.78, samples: 20 },
      '5 Iron': { avgDistance: 180, accuracy: 0.75, samples: 35 },
      '6 Iron': { avgDistance: 170, accuracy: 0.80, samples: 42 },
      '7 Iron': { avgDistance: 155, accuracy: 0.82, samples: 55 },
      '8 Iron': { avgDistance: 140, accuracy: 0.85, samples: 38 },
      '9 Iron': { avgDistance: 125, accuracy: 0.80, samples: 33 },
      'Pitching Wedge': { avgDistance: 110, accuracy: 0.78, samples: 48 },
      'Sand Wedge': { avgDistance: 80, accuracy: 0.70, samples: 40 },
      'Lob Wedge': { avgDistance: 60, accuracy: 0.68, samples: 25 },
      'Putter': { avgDistance: 15, accuracy: 0.65, samples: 120 }
    },
    
    // Lie adjustments (multiplier for distance/accuracy)
    lieAdjustments: {
      'Tee box': { distance: 1.0, accuracy: 1.0 },
      'Fairway': { distance: 1.0, accuracy: 1.0 },
      'First cut': { distance: 0.95, accuracy: 0.95 },
      'Light rough': { distance: 0.90, accuracy: 0.85 },
      'Heavy rough': { distance: 0.75, accuracy: 0.70 },
      'Fairway bunker': { distance: 0.85, accuracy: 0.75 },
      'Greenside bunker': { distance: 0.70, accuracy: 0.60 },
      'Fringe': { distance: 1.0, accuracy: 0.95 },
      'Green': { distance: 1.0, accuracy: 1.0 }
    }
  };

  /**
   * Get club suggestions for the given context
   */
  async getClubSuggestions(context: SuggestionContext): Promise<ClubSuggestion[]> {
    try {
      // Try to get real historical data first
      const historicalStats = await this.getHistoricalClubStats();
      const clubStats = Object.keys(historicalStats).length > 0 
        ? historicalStats 
        : this.demoData.clubStats;

      // Generate suggestions based on context
      const suggestions: ClubSuggestion[] = [];

      for (const [club, stats] of Object.entries(clubStats)) {
        if (this.isClubRelevant(club, context)) {
          const suggestion = this.calculateClubSuggestion(club, stats, context);
          if (suggestion.confidence > 0.1) { // Only include viable suggestions
            suggestions.push(suggestion);
          }
        }
      }

      // Sort by confidence (best suggestions first)
      suggestions.sort((a, b) => b.confidence - a.confidence);

      // Return top 3 suggestions
      return suggestions.slice(0, 3);
    } catch (error) {
      console.error('Error getting club suggestions:', error);
      // Fallback to basic distance-based suggestion
      return this.getBasicSuggestions(context);
    }
  }

  /**
   * Get historical club performance statistics
   */
  private async getHistoricalClubStats(): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabase
        .from('shots')
        .select(`
          club,
          start_distance_to_hole,
          result_zone,
          shot_category
        `)
        .not('club', 'is', null)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 90 days

      if (error) throw error;

      // Process historical data into club statistics
      const clubStats: Record<string, any> = {};

      data?.forEach(shot => {
        if (!clubStats[shot.club]) {
          clubStats[shot.club] = {
            distances: [],
            results: [],
            samples: 0
          };
        }

        clubStats[shot.club].distances.push(shot.start_distance_to_hole);
        clubStats[shot.club].results.push(shot.result_zone);
        clubStats[shot.club].samples++;
      });

      // Calculate averages and success rates
      Object.keys(clubStats).forEach(club => {
        const stats = clubStats[club];
        stats.avgDistance = stats.distances.reduce((a: number, b: number) => a + b, 0) / stats.distances.length;
        
        const goodResults = stats.results.filter((r: string) => 
          r === 'Good' || r === 'Acceptable'
        ).length;
        stats.accuracy = goodResults / stats.results.length;
      });

      return clubStats;
    } catch (error) {
      console.error('Failed to get historical stats:', error);
      return {};
    }
  }

  /**
   * Check if a club is relevant for the given context
   */
  private isClubRelevant(club: string, context: SuggestionContext): boolean {
    // Category-based filtering
    if (context.shotCategory === 'putt') {
      return club === 'Putter';
    }

    if (context.shotCategory === 'tee') {
      return ['Driver', '3 Wood', '5 Wood', 'Hybrid'].includes(club);
    }

    if (context.shotCategory === 'around_green') {
      return ['Pitching Wedge', 'Sand Wedge', 'Lob Wedge', '9 Iron'].includes(club);
    }

    // For approach shots, consider all clubs except driver and putter
    return club !== 'Driver' && club !== 'Putter';
  }

  /**
   * Calculate suggestion score for a specific club
   */
  private calculateClubSuggestion(
    club: string, 
    stats: any, 
    context: SuggestionContext
  ): ClubSuggestion {
    const lieAdjustment = this.demoData.lieAdjustments[context.lie] || { distance: 1.0, accuracy: 1.0 };
    
    // Adjust stats for lie conditions
    const adjustedDistance = stats.avgDistance * lieAdjustment.distance;
    const adjustedAccuracy = stats.accuracy * lieAdjustment.accuracy;

    // Calculate distance match score (how close the club's distance is to needed distance)
    const distanceError = Math.abs(adjustedDistance - context.distanceToPin);
    const distanceScore = Math.max(0, 1 - (distanceError / 50)); // Penalty for being off by 50+ yards

    // Calculate confidence based on distance match, accuracy, and sample size
    const sampleReliability = Math.min(1, stats.samples / 20); // More reliable with 20+ samples
    const confidence = (distanceScore * 0.6) + (adjustedAccuracy * 0.3) + (sampleReliability * 0.1);

    // Generate reasoning
    const reasoning = this.generateReasoning(club, adjustedDistance, context, distanceScore, adjustedAccuracy);

    return {
      club,
      confidence,
      averageDistance: Math.round(adjustedDistance),
      successRate: Math.round(adjustedAccuracy * 100),
      sampleSize: stats.samples,
      reasoning
    };
  }

  /**
   * Generate human-readable reasoning for the suggestion
   */
  private generateReasoning(
    club: string, 
    adjustedDistance: number, 
    context: SuggestionContext,
    distanceScore: number,
    accuracy: number
  ): string {
    const reasons: string[] = [];

    // Distance reasoning
    const distanceDiff = adjustedDistance - context.distanceToPin;
    if (Math.abs(distanceDiff) <= 10) {
      reasons.push("Perfect distance match");
    } else if (distanceDiff > 10) {
      reasons.push(`Usually flies ${Math.round(Math.abs(distanceDiff))} yards long`);
    } else {
      reasons.push(`Usually comes up ${Math.round(Math.abs(distanceDiff))} yards short`);
    }

    // Accuracy reasoning
    if (accuracy >= 0.8) {
      reasons.push("high success rate");
    } else if (accuracy >= 0.7) {
      reasons.push("good accuracy");
    } else if (accuracy >= 0.6) {
      reasons.push("decent accuracy");
    } else {
      reasons.push("lower accuracy");
    }

    // Lie-specific reasoning
    if (context.lie === 'Heavy rough' || context.lie === 'Greenside bunker') {
      reasons.push("accounting for difficult lie");
    } else if (context.lie === 'Tee box' || context.lie === 'Fairway') {
      reasons.push("from good lie");
    }

    return reasons.join(", ");
  }

  /**
   * Fallback basic suggestions based on distance
   */
  private getBasicSuggestions(context: SuggestionContext): ClubSuggestion[] {
    const suggestions: ClubSuggestion[] = [];
    
    if (context.shotCategory === 'putt') {
      return [{
        club: 'Putter',
        confidence: 1.0,
        averageDistance: context.distanceToPin,
        successRate: 65,
        sampleSize: 50,
        reasoning: 'Only option for putting'
      }];
    }

    // Simple distance-based mapping
    const distanceClubMap = [
      { distance: 280, club: 'Driver', accuracy: 72 },
      { distance: 230, club: '3 Wood', accuracy: 78 },
      { distance: 180, club: '5 Iron', accuracy: 75 },
      { distance: 170, club: '6 Iron', accuracy: 80 },
      { distance: 155, club: '7 Iron', accuracy: 82 },
      { distance: 140, club: '8 Iron', accuracy: 85 },
      { distance: 125, club: '9 Iron', accuracy: 80 },
      { distance: 110, club: 'Pitching Wedge', accuracy: 78 },
      { distance: 80, club: 'Sand Wedge', accuracy: 70 },
      { distance: 60, club: 'Lob Wedge', accuracy: 68 }
    ];

    // Find clubs within reasonable range
    distanceClubMap.forEach(({ distance, club, accuracy }) => {
      const distanceError = Math.abs(distance - context.distanceToPin);
      if (distanceError <= 30) { // Within 30 yards
        const confidence = Math.max(0.3, 1 - (distanceError / 50));
        suggestions.push({
          club,
          confidence,
          averageDistance: distance,
          successRate: accuracy,
          sampleSize: 20,
          reasoning: `Average distance ${distance} yards`
        });
      }
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Get recommended club for quick selection (single best option)
   */
  async getRecommendedClub(context: SuggestionContext): Promise<string | null> {
    const suggestions = await this.getClubSuggestions(context);
    return suggestions.length > 0 ? suggestions[0].club : null;
  }

  /**
   * Get wind adjustment recommendations
   */
  getWindAdjustment(windConditions: NonNullable<SuggestionContext['windConditions']>): {
    clubAdjustment: string;
    distanceAdjustment: number;
  } {
    if (!windConditions || windConditions.direction === 'calm') {
      return { clubAdjustment: 'No adjustment needed', distanceAdjustment: 0 };
    }

    const windEffect = Math.min(windConditions.speed / 10, 2); // Cap at 20mph equivalent

    switch (windConditions.direction) {
      case 'into':
        return {
          clubAdjustment: 'Consider one more club',
          distanceAdjustment: -windEffect * 10
        };
      case 'down':
        return {
          clubAdjustment: 'Consider one less club',
          distanceAdjustment: windEffect * 8
        };
      case 'cross':
        return {
          clubAdjustment: 'Aim into the wind',
          distanceAdjustment: 0
        };
      default:
        return { clubAdjustment: 'No adjustment needed', distanceAdjustment: 0 };
    }
  }
}

export const clubSuggestionService = new ClubSuggestionService();
export default clubSuggestionService;