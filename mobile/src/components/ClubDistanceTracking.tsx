import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ClubStats } from '../services/shotAnalytics';

interface Props {
  clubStats: ClubStats[];
  title?: string;
}

const ClubDistanceTracking: React.FC<Props> = ({ 
  clubStats, 
  title = "Club Performance" 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'accuracy' | 'shots'>('distance');

  const categories = ['all', ...new Set(clubStats.map(stat => stat.category))];
  
  const filteredStats = clubStats
    .filter(stat => selectedCategory === 'all' || stat.category === selectedCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return b.averageDistance - a.averageDistance;
        case 'accuracy':
          return b.accuracy - a.accuracy;
        case 'shots':
          return b.shots - a.shots;
        default:
          return 0;
      }
    });

  const getClubIcon = (club: string): string => {
    const clubLower = club.toLowerCase();
    if (clubLower.includes('driver')) return '🏌️';
    if (clubLower.includes('wood')) return '🌲';
    if (clubLower.includes('hybrid')) return '⚡';
    if (clubLower.includes('iron')) return '⚔️';
    if (clubLower.includes('wedge')) return '⛳';
    if (clubLower.includes('putter')) return '🥅';
    return '🏌️‍♂️';
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 70) return '#4CAF50';
    if (accuracy >= 50) return '#FF9800';
    return '#f44336';
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'tee': return '#2196F3';
      case 'approach': return '#4CAF50';
      case 'around_green': return '#FF9800';
      case 'putt': return '#9C27B0';
      default: return '#757575';
    }
  };

  const formatClubName = (club: string): string => {
    return club.replace(/([A-Z])/g, ' $1').trim();
  };

  if (clubStats.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>📊 Building your club stats...</Text>
          <Text style={styles.emptySubtext}>
            Use different clubs during your rounds to see detailed performance metrics!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {/* Filter Controls */}
      <View style={styles.controls}>
        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipSelected
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextSelected
              ]}>
                {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort Options */}
        <View style={styles.sortOptions}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          {(['distance', 'accuracy', 'shots'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.sortButton,
                sortBy === option && styles.sortButtonSelected
              ]}
              onPress={() => setSortBy(option)}
            >
              <Text style={[
                styles.sortButtonText,
                sortBy === option && styles.sortButtonTextSelected
              ]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Club Stats List */}
      <ScrollView style={styles.statsList} showsVerticalScrollIndicator={false}>
        {filteredStats.map((stat, index) => (
          <View key={`${stat.club}-${stat.category}`} style={styles.statCard}>
            {/* Header */}
            <View style={styles.statHeader}>
              <View style={styles.clubInfo}>
                <Text style={styles.clubIcon}>{getClubIcon(stat.club)}</Text>
                <View style={styles.clubDetails}>
                  <Text style={styles.clubName}>{formatClubName(stat.club)}</Text>
                  <View style={styles.categoryBadge}>
                    <View style={[
                      styles.categoryDot,
                      { backgroundColor: getCategoryColor(stat.category) }
                    ]} />
                    <Text style={styles.categoryText}>{stat.category}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.primaryStat}>
                <Text style={styles.primaryStatValue}>{stat.averageDistance}</Text>
                <Text style={styles.primaryStatLabel}>yards</Text>
              </View>
            </View>

            {/* Performance Metrics */}
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Accuracy</Text>
                <View style={styles.accuracyContainer}>
                  <Text style={[
                    styles.metricValue,
                    { color: getAccuracyColor(stat.accuracy) }
                  ]}>
                    {stat.accuracy}%
                  </Text>
                  <View style={styles.accuracyBar}>
                    <View style={[
                      styles.accuracyFill,
                      { 
                        width: `${stat.accuracy}%`,
                        backgroundColor: getAccuracyColor(stat.accuracy)
                      }
                    ]} />
                  </View>
                </View>
              </View>
              
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Dispersion</Text>
                <Text style={styles.metricValue}>±{stat.dispersion}y</Text>
              </View>
              
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Sample Size</Text>
                <Text style={styles.metricValue}>{stat.shots}</Text>
              </View>
            </View>

            {/* Trend Indicator */}
            {stat.trends.length > 1 && (
              <View style={styles.trendSection}>
                <Text style={styles.trendLabel}>Recent trend:</Text>
                <View style={styles.trendIndicator}>
                  {getTrendDirection(stat.trends) === 'up' ? (
                    <Text style={[styles.trendIcon, { color: '#4CAF50' }]}>📈</Text>
                  ) : getTrendDirection(stat.trends) === 'down' ? (
                    <Text style={[styles.trendIcon, { color: '#f44336' }]}>📉</Text>
                  ) : (
                    <Text style={[styles.trendIcon, { color: '#757575' }]}>📊</Text>
                  )}
                  <Text style={styles.trendText}>
                    {getTrendDescription(stat.trends)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{filteredStats.length}</Text>
          <Text style={styles.summaryLabel}>Club/Category combos</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {Math.round(filteredStats.reduce((sum, s) => sum + s.averageDistance, 0) / filteredStats.length) || 0}
          </Text>
          <Text style={styles.summaryLabel}>Avg distance</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {Math.round(filteredStats.reduce((sum, s) => sum + s.accuracy, 0) / filteredStats.length) || 0}%
          </Text>
          <Text style={styles.summaryLabel}>Avg accuracy</Text>
        </View>
      </View>
    </View>
  );

  function getTrendDirection(trends: { date: string; distance: number }[]): 'up' | 'down' | 'stable' {
    if (trends.length < 2) return 'stable';
    
    const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
    const secondHalf = trends.slice(Math.floor(trends.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, t) => sum + t.distance, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, t) => sum + t.distance, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (Math.abs(difference) < 3) return 'stable';
    return difference > 0 ? 'up' : 'down';
  }

  function getTrendDescription(trends: { date: string; distance: number }[]): string {
    const direction = getTrendDirection(trends);
    if (direction === 'up') return 'Distance improving';
    if (direction === 'down') return 'Distance declining';
    return 'Consistent performance';
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  controls: {
    marginBottom: 16,
  },
  categoryFilter: {
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  sortButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sortButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
  },
  sortButtonTextSelected: {
    color: '#fff',
  },
  statsList: {
    maxHeight: 400,
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clubIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  clubDetails: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  primaryStat: {
    alignItems: 'center',
  },
  primaryStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  primaryStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  accuracyContainer: {
    alignItems: 'center',
  },
  accuracyBar: {
    width: 40,
    height: 3,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  accuracyFill: {
    height: '100%',
    borderRadius: 2,
  },
  trendSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 6,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  trendText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
});

export default ClubDistanceTracking;