import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { supabase } from '../services/supabase';
import { shotAnalyticsService, ShotPatternAnalysis } from '../services/shotAnalytics';
import HeatMapVisualization from '../components/HeatMapVisualization';
import TendencyAnalysis from '../components/TendencyAnalysis';
import ClubDistanceTracking from '../components/ClubDistanceTracking';

interface AnalyticsScreenProps {
  navigation: any;
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysis, setAnalysis] = useState<ShotPatternAnalysis | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'heatmap' | 'tendencies' | 'clubs'>('overview');
  const [roundLimit, setRoundLimit] = useState(10);

  useEffect(() => {
    loadAnalytics();
  }, [roundLimit]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in to view analytics');
        navigation.goBack();
        return;
      }

      // Load shot analysis
      const analysisData = await shotAnalyticsService.getUserShotAnalysis(user.id, roundLimit);
      setAnalysis(analysisData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const tabs = [
    { key: 'overview', label: '📊 Overview', icon: '📊' },
    { key: 'heatmap', label: '🎯 Heat Map', icon: '🎯' },
    { key: 'tendencies', label: '📈 Patterns', icon: '📈' },
    { key: 'clubs', label: '🏌️ Clubs', icon: '🏌️' }
  ] as const;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing your shot patterns...</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>📊 No analytics data available</Text>
        <Text style={styles.errorSubtext}>Play some rounds to see your golf insights!</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{analysis.summary.totalShots}</Text>
          <Text style={styles.summaryLabel}>Total Shots</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{analysis.summary.roundsAnalyzed}</Text>
          <Text style={styles.summaryLabel}>Rounds Analyzed</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{analysis.summary.strongestClub}</Text>
          <Text style={styles.summaryLabel}>Best Club</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{analysis.summary.biggestOpportunity}</Text>
          <Text style={styles.summaryLabel}>Focus Area</Text>
        </View>
      </View>

      {/* Accuracy Trend */}
      <View style={styles.trendCard}>
        <View style={styles.trendHeader}>
          <Text style={styles.trendTitle}>Overall Accuracy Trend</Text>
          <View style={[
            styles.trendBadge,
            analysis.summary.accuracyTrend === 'improving' && styles.trendImproving,
            analysis.summary.accuracyTrend === 'declining' && styles.trendDeclining,
            analysis.summary.accuracyTrend === 'stable' && styles.trendStable
          ]}>
            <Text style={styles.trendBadgeText}>
              {analysis.summary.accuracyTrend === 'improving' ? '📈 Improving' : 
               analysis.summary.accuracyTrend === 'declining' ? '📉 Declining' : 
               '📊 Stable'}
            </Text>
          </View>
        </View>
        <Text style={styles.trendDescription}>
          {analysis.summary.accuracyTrend === 'improving' 
            ? 'Your shot accuracy is getting better! Keep up the great work.'
            : analysis.summary.accuracyTrend === 'declining' 
            ? 'Consider focusing on fundamentals to improve consistency.'
            : 'Your performance is consistent across recent rounds.'}
        </Text>
      </View>

      {/* Quick Insights */}
      <View style={styles.insightsSection}>
        <Text style={styles.sectionTitle}>🎯 Quick Insights</Text>
        {analysis.tendencies.slice(0, 2).map((tendency, index) => (
          <View key={index} style={styles.quickInsight}>
            <Text style={styles.quickInsightText}>
              {tendency.description}
            </Text>
            {tendency.recommendation && (
              <Text style={styles.quickInsightTip}>
                💡 {tendency.recommendation}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Club Highlights */}
      <View style={styles.clubHighlights}>
        <Text style={styles.sectionTitle}>🏌️ Club Highlights</Text>
        <View style={styles.clubHighlightGrid}>
          {analysis.clubStats.slice(0, 4).map((club, index) => (
            <View key={index} style={styles.clubHighlightCard}>
              <Text style={styles.clubHighlightName}>{club.club}</Text>
              <Text style={styles.clubHighlightDistance}>{club.averageDistance}y</Text>
              <Text style={styles.clubHighlightAccuracy}>{club.accuracy}% accurate</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (selectedTab) {
      case 'overview':
        return renderOverview();
      case 'heatmap':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <HeatMapVisualization data={analysis.heatMap} />
            <View style={styles.heatmapTips}>
              <Text style={styles.tipsTitle}>📍 Understanding Your Heat Map</Text>
              <Text style={styles.tipText}>• Red areas show where you hit most shots</Text>
              <Text style={styles.tipText}>• The flag shows the target (pin/hole)</Text>
              <Text style={styles.tipText}>• Green tee shows starting position</Text>
              <Text style={styles.tipText}>• Left/right shows lateral accuracy</Text>
            </View>
          </ScrollView>
        );
      case 'tendencies':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <TendencyAnalysis tendencies={analysis.tendencies} />
          </ScrollView>
        );
      case 'clubs':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <ClubDistanceTracking clubStats={analysis.clubStats} />
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shot Analytics</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {
              // Round limit selector
              Alert.alert(
                'Rounds to Analyze',
                'How many recent rounds to include?',
                [
                  { text: '5 rounds', onPress: () => setRoundLimit(5) },
                  { text: '10 rounds', onPress: () => setRoundLimit(10) },
                  { text: '20 rounds', onPress: () => setRoundLimit(20) },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                selectedTab === tab.key && styles.tabSelected
              ]}
              onPress={() => setSelectedTab(tab.key)}
            >
              <Text style={[
                styles.tabText,
                selectedTab === tab.key && styles.tabTextSelected
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderContent()}
      </ScrollView>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Based on {analysis.summary.roundsAnalyzed} recent round{analysis.summary.roundsAnalyzed !== 1 ? 's' : ''} • 
          {analysis.summary.totalShots} total shots
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerRight: {
    padding: 8,
  },
  settingsButton: {
    padding: 4,
  },
  settingsButtonText: {
    fontSize: 16,
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  tabSelected: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabTextSelected: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  trendCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  trendImproving: {
    backgroundColor: '#e8f5e8',
  },
  trendDeclining: {
    backgroundColor: '#fce8e8',
  },
  trendStable: {
    backgroundColor: '#e8f0ff',
  },
  trendBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  trendDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  insightsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  quickInsight: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickInsightText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  quickInsightTip: {
    fontSize: 13,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  clubHighlights: {
    marginBottom: 20,
  },
  clubHighlightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  clubHighlightCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  clubHighlightName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  clubHighlightDistance: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 2,
  },
  clubHighlightAccuracy: {
    fontSize: 12,
    color: '#666',
  },
  heatmapTips: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default AnalyticsScreen;