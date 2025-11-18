import { supabase } from './supabase';

export interface ShotData {
  id: string;
  round_id: string;
  hole_number: number;
  shot_number: number;
  shot_category: 'tee' | 'approach' | 'around_green' | 'putt';
  club: string;
  start_distance: number;
  end_distance: number;
  start_lie: string;
  end_lie: string;
  result_zone: 'Good' | 'Acceptable' | 'Poor' | 'OB' | 'Hazard' | 'Lost Ball';
  shot_shape?: string;
  contact_quality?: string;
  trajectory?: string;
  distance_error?: string;
  lateral_error?: string;
  created_at: string;
}

export interface HeatMapPoint {
  x: number; // Lateral position (-100 to 100, 0 = center)
  y: number; // Distance progress (0 to 100, 100 = pin)
  category: string;
  club: string;
  result: string;
}

export interface TendencyInsight {
  category: string;
  description: string;
  confidence: number; // 0-1
  recommendation?: string;
  sampleSize: number;
}

export interface ClubStats {
  club: string;
  category: string;
  averageDistance: number;
  shots: number;
  accuracy: number; // percentage of shots in fairway/green
  dispersion: number; // standard deviation
  trends: {
    date: string;
    distance: number;
  }[];
}

export interface ShotPatternAnalysis {
  heatMap: HeatMapPoint[];
  tendencies: TendencyInsight[];
  clubStats: ClubStats[];
  summary: {
    totalShots: number;
    roundsAnalyzed: number;
    strongestClub: string;
    biggestOpportunity: string;
    accuracyTrend: 'improving' | 'declining' | 'stable';
  };
}

class ShotAnalyticsService {
  /**
   * Get comprehensive shot pattern analysis for a user
   * Fixed: ordering by created_at instead of rounds.started_at
   */
  async getUserShotAnalysis(userId: string, roundLimit = 10): Promise<ShotPatternAnalysis> {
    console.log('DEBUG: getUserShotAnalysis called with fixed query');
    try {
      // Get recent shots with round data
      const { data: shots, error } = await supabase
        .from('shots')
        .select(`
          *,
          rounds!inner(user_id, started_at)
        `)
        .eq('rounds.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(roundLimit * 100); // Approximate limit

      if (error) throw error;

      const shotData = shots as any[];
      return this.analyzeShots(shotData);
    } catch (error) {
      console.error('Error getting shot analysis:', error);
      // Return demo data for development
      return this.getDemoAnalysis();
    }
  }

  /**
   * Analyze shots and generate insights
   */
  private analyzeShots(shots: any[]): ShotPatternAnalysis {
    const heatMap = this.generateHeatMap(shots);
    const tendencies = this.analyzeTendencies(shots);
    const clubStats = this.analyzeClubStats(shots);
    const summary = this.generateSummary(shots, clubStats);

    return {
      heatMap,
      tendencies,
      clubStats,
      summary
    };
  }

  /**
   * Generate heat map points from shot data
   */
  private generateHeatMap(shots: any[]): HeatMapPoint[] {
    return shots
      .filter(shot => shot.shot_category !== 'putt') // Exclude putts
      .map(shot => ({
        x: this.calculateLateralPosition(shot),
        y: this.calculateDistanceProgress(shot),
        category: shot.shot_category,
        club: shot.club,
        result: shot.result_zone || 'Unknown'
      }));
  }

  /**
   * Calculate lateral position (-100 to 100)
   */
  private calculateLateralPosition(shot: any): number {
    const lateralError = shot.lateral_error;
    if (!lateralError) return 0;

    const lateralMap: { [key: string]: number } = {
      'Far left': -80,
      'Left': -40,
      'On line': 0,
      'Right': 40,
      'Far right': 80
    };

    return lateralMap[lateralError] || 0;
  }

  /**
   * Calculate distance progress (0 to 100)
   */
  private calculateDistanceProgress(shot: any): number {
    const startDistance = shot.start_distance || 0;
    const endDistance = shot.end_distance || 0;
    
    if (startDistance === 0) return 100; // Already at target
    const progress = ((startDistance - endDistance) / startDistance) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  /**
   * Analyze shot tendencies and generate insights
   */
  private analyzeTendencies(shots: any[]): TendencyInsight[] {
    const tendencies: TendencyInsight[] = [];

    // Analyze lateral tendencies
    const lateralTendency = this.analyzeLateralTendency(shots);
    if (lateralTendency) tendencies.push(lateralTendency);

    // Analyze distance control
    const distanceTendency = this.analyzeDistanceTendency(shots);
    if (distanceTendency) tendencies.push(distanceTendency);

    // Analyze tee shot performance
    const teePerformance = this.analyzeTeePerformance(shots);
    if (teePerformance) tendencies.push(teePerformance);

    // Analyze approach accuracy
    const approachAccuracy = this.analyzeApproachAccuracy(shots);
    if (approachAccuracy) tendencies.push(approachAccuracy);

    return tendencies;
  }

  private analyzeLateralTendency(shots: any[]): TendencyInsight | null {
    const shotsWithLateral = shots.filter(s => s.lateral_error && s.shot_category !== 'putt');
    if (shotsWithLateral.length < 5) return null;

    const leftShots = shotsWithLateral.filter(s => s.lateral_error.includes('left')).length;
    const rightShots = shotsWithLateral.filter(s => s.lateral_error.includes('right')).length;
    const straightShots = shotsWithLateral.filter(s => s.lateral_error === 'On line').length;

    const totalShots = leftShots + rightShots + straightShots;
    const leftPercentage = leftShots / totalShots;
    const rightPercentage = rightShots / totalShots;

    if (leftPercentage > 0.4) {
      return {
        category: 'Lateral Tendency',
        description: `You tend to miss left on ${Math.round(leftPercentage * 100)}% of shots`,
        confidence: Math.min(leftPercentage, 0.9),
        recommendation: 'Focus on alignment and setup. Consider aiming slightly right to compensate.',
        sampleSize: shotsWithLateral.length
      };
    }

    if (rightPercentage > 0.4) {
      return {
        category: 'Lateral Tendency',
        description: `You tend to miss right on ${Math.round(rightPercentage * 100)}% of shots`,
        confidence: Math.min(rightPercentage, 0.9),
        recommendation: 'Check your grip and swing path. Consider aiming slightly left.',
        sampleSize: shotsWithLateral.length
      };
    }

    return null;
  }

  private analyzeDistanceTendency(shots: any[]): TendencyInsight | null {
    const shotsWithDistance = shots.filter(s => s.distance_error && s.shot_category !== 'putt');
    if (shotsWithDistance.length < 5) return null;

    const shortShots = shotsWithDistance.filter(s => s.distance_error.includes('short')).length;
    const longShots = shotsWithDistance.filter(s => s.distance_error.includes('long')).length;
    const onDistance = shotsWithDistance.filter(s => s.distance_error === 'On distance').length;

    const totalShots = shortShots + longShots + onDistance;
    const shortPercentage = shortShots / totalShots;
    const longPercentage = longShots / totalShots;

    if (shortPercentage > 0.4) {
      return {
        category: 'Distance Control',
        description: `You tend to come up short on ${Math.round(shortPercentage * 100)}% of shots`,
        confidence: Math.min(shortPercentage, 0.9),
        recommendation: 'Consider taking one more club or focusing on solid contact.',
        sampleSize: shotsWithDistance.length
      };
    }

    if (longPercentage > 0.35) {
      return {
        category: 'Distance Control',
        description: `You tend to fly shots long ${Math.round(longPercentage * 100)}% of the time`,
        confidence: Math.min(longPercentage, 0.9),
        recommendation: 'Consider club down or focus on tempo and rhythm.',
        sampleSize: shotsWithDistance.length
      };
    }

    return null;
  }

  private analyzeTeePerformance(shots: any[]): TendencyInsight | null {
    const teeShots = shots.filter(s => s.shot_category === 'tee');
    if (teeShots.length < 3) return null;

    const fairwayHits = teeShots.filter(s => 
      s.result_zone === 'Good' || s.end_lie === 'Fairway'
    ).length;
    
    const accuracy = fairwayHits / teeShots.length;

    if (accuracy < 0.5) {
      return {
        category: 'Tee Shots',
        description: `Fairway accuracy: ${Math.round(accuracy * 100)}% - needs improvement`,
        confidence: 0.8,
        recommendation: 'Consider using a more lofted driver or focus on accuracy over distance.',
        sampleSize: teeShots.length
      };
    }

    if (accuracy > 0.7) {
      return {
        category: 'Tee Shots',
        description: `Excellent fairway accuracy: ${Math.round(accuracy * 100)}%`,
        confidence: 0.8,
        recommendation: 'Great driving! Consider being more aggressive with approach shots.',
        sampleSize: teeShots.length
      };
    }

    return null;
  }

  private analyzeApproachAccuracy(shots: any[]): TendencyInsight | null {
    const approachShots = shots.filter(s => s.shot_category === 'approach');
    if (approachShots.length < 5) return null;

    const greenHits = approachShots.filter(s => 
      s.result_zone === 'Good' || s.end_lie === 'Green'
    ).length;
    
    const accuracy = greenHits / approachShots.length;

    if (accuracy < 0.4) {
      return {
        category: 'Approach Shots',
        description: `Green in regulation: ${Math.round(accuracy * 100)}% - focus area`,
        confidence: 0.8,
        recommendation: 'Work on distance control and club selection for approaches.',
        sampleSize: approachShots.length
      };
    }

    return null;
  }

  /**
   * Analyze club statistics
   */
  private analyzeClubStats(shots: any[]): ClubStats[] {
    const clubGroups = this.groupBy(shots, 'club');
    const stats: ClubStats[] = [];

    for (const [club, clubShots] of Object.entries(clubGroups)) {
      if (clubShots.length < 3) continue; // Need minimum sample size

      const categoryGroups = this.groupBy(clubShots, 'shot_category');
      
      for (const [category, categoryShots] of Object.entries(categoryGroups)) {
        const distances = categoryShots
          .map(s => s.start_distance - s.end_distance)
          .filter(d => d > 0 && d < 400); // Reasonable golf shot distances

        if (distances.length === 0) continue;

        const averageDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const dispersion = this.calculateStandardDeviation(distances);
        
        // Calculate accuracy (fairway hits for tee, green hits for approach, etc.)
        const accuracy = this.calculateAccuracy(categoryShots, category);

        // Generate trend data (simplified)
        const trends = this.generateTrends(categoryShots);

        stats.push({
          club,
          category,
          averageDistance: Math.round(averageDistance),
          shots: categoryShots.length,
          accuracy: Math.round(accuracy * 100),
          dispersion: Math.round(dispersion),
          trends
        });
      }
    }

    return stats.sort((a, b) => b.shots - a.shots); // Sort by sample size
  }

  private calculateAccuracy(shots: any[], category: string): number {
    if (shots.length === 0) return 0;

    let goodShots = 0;
    shots.forEach(shot => {
      if (category === 'tee' && (shot.end_lie === 'Fairway' || shot.result_zone === 'Good')) {
        goodShots++;
      } else if (category === 'approach' && (shot.end_lie === 'Green' || shot.result_zone === 'Good')) {
        goodShots++;
      } else if (shot.result_zone === 'Good' || shot.result_zone === 'Acceptable') {
        goodShots++;
      }
    });

    return goodShots / shots.length;
  }

  private generateTrends(shots: any[]): { date: string; distance: number }[] {
    // Sort shots by date and calculate rolling average
    const sortedShots = shots
      .filter(s => s.created_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return sortedShots.slice(-10).map(shot => ({
      date: new Date(shot.created_at).toLocaleDateString(),
      distance: shot.start_distance - shot.end_distance
    }));
  }

  private calculateStandardDeviation(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const squaredDiffs = numbers.map(x => Math.pow(x - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b) / numbers.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Generate summary insights
   */
  private generateSummary(shots: any[], clubStats: ClubStats[]) {
    const uniqueRounds = new Set(shots.map(s => s.round_id)).size;
    
    // Find strongest club (best accuracy + distance combo)
    const strongestClub = clubStats.reduce((best, current) => {
      const score = (current.accuracy / 100) * 0.7 + (current.shots / 20) * 0.3;
      const bestScore = (best.accuracy / 100) * 0.7 + (best.shots / 20) * 0.3;
      return score > bestScore ? current : best;
    }, clubStats[0]);

    // Find biggest opportunity (lowest accuracy club with decent sample size)
    const opportunity = clubStats
      .filter(c => c.shots >= 5)
      .reduce((worst, current) => 
        current.accuracy < worst.accuracy ? current : worst, clubStats[0]);

    return {
      totalShots: shots.length,
      roundsAnalyzed: uniqueRounds,
      strongestClub: strongestClub?.club || 'N/A',
      biggestOpportunity: opportunity?.club || 'N/A',
      accuracyTrend: this.calculateAccuracyTrend(shots)
    };
  }

  private calculateAccuracyTrend(shots: any[]): 'improving' | 'declining' | 'stable' {
    if (shots.length < 10) return 'stable';

    const sortedShots = shots
      .filter(s => s.created_at && s.result_zone)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const midpoint = Math.floor(sortedShots.length / 2);
    const earlierHalf = sortedShots.slice(0, midpoint);
    const laterHalf = sortedShots.slice(midpoint);

    const earlierAccuracy = this.calculateOverallAccuracy(earlierHalf);
    const laterAccuracy = this.calculateOverallAccuracy(laterHalf);

    const difference = laterAccuracy - earlierAccuracy;
    
    if (difference > 0.05) return 'improving';
    if (difference < -0.05) return 'declining';
    return 'stable';
  }

  private calculateOverallAccuracy(shots: any[]): number {
    if (shots.length === 0) return 0;
    const goodShots = shots.filter(s => 
      s.result_zone === 'Good' || s.result_zone === 'Acceptable'
    ).length;
    return goodShots / shots.length;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * Demo data for development
   */
  private getDemoAnalysis(): ShotPatternAnalysis {
    return {
      heatMap: [
        { x: -20, y: 85, category: 'tee', club: 'Driver', result: 'Good' },
        { x: 10, y: 80, category: 'tee', club: 'Driver', result: 'Good' },
        { x: -40, y: 75, category: 'tee', club: 'Driver', result: 'Acceptable' },
        { x: 0, y: 65, category: 'approach', club: '7 Iron', result: 'Good' },
        { x: 20, y: 70, category: 'approach', club: '8 Iron', result: 'Good' },
        { x: -30, y: 60, category: 'approach', club: 'Pitching Wedge', result: 'Acceptable' },
      ],
      tendencies: [
        {
          category: 'Lateral Tendency',
          description: 'You tend to miss left on 35% of shots',
          confidence: 0.7,
          recommendation: 'Focus on alignment and consider aiming slightly right.',
          sampleSize: 23
        },
        {
          category: 'Distance Control',
          description: 'You tend to come up short on 40% of approach shots',
          confidence: 0.8,
          recommendation: 'Consider taking one more club on approaches.',
          sampleSize: 18
        }
      ],
      clubStats: [
        {
          club: 'Driver',
          category: 'tee',
          averageDistance: 245,
          shots: 12,
          accuracy: 65,
          dispersion: 25,
          trends: [
            { date: '11/15', distance: 240 },
            { date: '11/16', distance: 250 },
            { date: '11/17', distance: 245 },
          ]
        },
        {
          club: '7 Iron',
          category: 'approach',
          averageDistance: 145,
          shots: 15,
          accuracy: 70,
          dispersion: 18,
          trends: [
            { date: '11/15', distance: 140 },
            { date: '11/16', distance: 150 },
            { date: '11/17', distance: 145 },
          ]
        }
      ],
      summary: {
        totalShots: 47,
        roundsAnalyzed: 3,
        strongestClub: '7 Iron',
        biggestOpportunity: 'Driver',
        accuracyTrend: 'improving'
      }
    };
  }
}

export const shotAnalyticsService = new ShotAnalyticsService();