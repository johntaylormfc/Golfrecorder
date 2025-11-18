import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TendencyInsight } from '../services/shotAnalytics';

interface Props {
  tendencies: TendencyInsight[];
  title?: string;
}

const TendencyAnalysis: React.FC<Props> = ({ 
  tendencies, 
  title = "Your Golf Tendencies" 
}) => {
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#4CAF50'; // High confidence - green
    if (confidence >= 0.6) return '#FF9800'; // Medium confidence - orange
    return '#9E9E9E'; // Low confidence - gray
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'High confidence';
    if (confidence >= 0.6) return 'Medium confidence';
    return 'Low confidence';
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'Lateral Tendency': return '🎯';
      case 'Distance Control': return '📏';
      case 'Tee Shots': return '🏌️';
      case 'Approach Shots': return '🎯';
      case 'Short Game': return '⛳';
      case 'Putting': return '🥅';
      default: return '📊';
    }
  };

  if (tendencies.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>🔍 Analyzing your patterns...</Text>
          <Text style={styles.emptySubtext}>
            Play a few more rounds to unlock personalized insights about your game!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      <ScrollView style={styles.tendenciesList} showsVerticalScrollIndicator={false}>
        {tendencies.map((tendency, index) => (
          <View key={index} style={styles.tendencyCard}>
            {/* Header with category and confidence */}
            <View style={styles.tendencyHeader}>
              <View style={styles.categorySection}>
                <Text style={styles.categoryIcon}>{getCategoryIcon(tendency.category)}</Text>
                <Text style={styles.categoryText}>{tendency.category}</Text>
              </View>
              
              <View style={styles.confidenceSection}>
                <View style={[
                  styles.confidenceDot,
                  { backgroundColor: getConfidenceColor(tendency.confidence) }
                ]} />
                <Text style={[
                  styles.confidenceText,
                  { color: getConfidenceColor(tendency.confidence) }
                ]}>
                  {getConfidenceLabel(tendency.confidence)}
                </Text>
              </View>
            </View>

            {/* Insight description */}
            <Text style={styles.description}>{tendency.description}</Text>

            {/* Recommendation */}
            {tendency.recommendation && (
              <View style={styles.recommendationSection}>
                <Text style={styles.recommendationIcon}>💡</Text>
                <Text style={styles.recommendationText}>{tendency.recommendation}</Text>
              </View>
            )}

            {/* Sample size */}
            <View style={styles.sampleSizeSection}>
              <Text style={styles.sampleSizeText}>
                Based on {tendency.sampleSize} shot{tendency.sampleSize !== 1 ? 's' : ''}
              </Text>
              
              {/* Confidence bar */}
              <View style={styles.confidenceBar}>
                <View 
                  style={[
                    styles.confidenceFill,
                    { 
                      width: `${tendency.confidence * 100}%`,
                      backgroundColor: getConfidenceColor(tendency.confidence)
                    }
                  ]} 
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Summary stats */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{tendencies.length}</Text>
          <Text style={styles.summaryLabel}>Patterns Found</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {tendencies.filter(t => t.confidence >= 0.7).length}
          </Text>
          <Text style={styles.summaryLabel}>High Confidence</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {Math.round(tendencies.reduce((sum, t) => sum + t.sampleSize, 0) / tendencies.length)}
          </Text>
          <Text style={styles.summaryLabel}>Avg Sample Size</Text>
        </View>
      </View>
    </View>
  );
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
  tendenciesList: {
    maxHeight: 400,
  },
  tendencyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  tendencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categorySection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  confidenceSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  recommendationSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  recommendationIcon: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 1,
  },
  recommendationText: {
    fontSize: 13,
    color: '#1565c0',
    lineHeight: 18,
    flex: 1,
  },
  sampleSizeSection: {
    marginTop: 4,
  },
  sampleSizeText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  confidenceBar: {
    height: 3,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryCard: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
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

export default TendencyAnalysis;