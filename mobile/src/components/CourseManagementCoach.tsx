import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shotDecisionEngine, ShotDecision } from '../services/shotDecisionEngine';
import { lieIntelligenceService, LiePrediction, LieAnalysis } from '../services/lieIntelligence';
import { pressureAnalyticsService, PressureAnalysis } from '../services/pressureAnalytics';

// Extended strategic analysis interface based on ShotDecision
interface StrategicAnalysis {
  primaryStrategy: {
    name: string;
    description: string;
    confidence: number;
    reasoning: string[];
  };
  alternatives: Array<{
    name: string;
    description: string;
    confidence: number;
  }>;
  riskAssessment: {
    successProbability: number;
    riskLevel: 'low' | 'medium' | 'high';
    factors: Array<{
      factor: string;
      impact: number;
    }>;
  };
}

interface CourseManagementCoachProps {
  shotContext: {
    category: string;
    club?: string;
    lie: string;
    distanceToPin: number;
    distanceToFairway?: number;
    holeNumber: number;
    shotNumber: number;
    roundScore?: number;
    parValue: number;
    weather?: {
      windSpeed: number;
      windDirection: string;
      temperature: number;
      conditions: string;
    };
    previousShots?: Array<{ result: string; category: string; club: string }>;
  };
  onStrategySelected?: (strategy: string) => void;
  isVisible: boolean;
}

const CourseManagementCoach: React.FC<CourseManagementCoachProps> = ({
  shotContext,
  onStrategySelected,
  isVisible
}) => {
  const [strategicAnalysis, setStrategicAnalysis] = useState<StrategicAnalysis | null>(null);
  const [liePrediction, setLiePrediction] = useState<LiePrediction | null>(null);
  const [lieAnalysis, setLieAnalysis] = useState<LieAnalysis | null>(null);
  const [pressureAnalysis, setPressureAnalysis] = useState<PressureAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<'strategy' | 'lie' | 'pressure'>('strategy');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const expandAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      loadAnalysis();
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [isVisible]);

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 250,
      useNativeDriver: false
    }).start();
  }, [isExpanded]);

  const loadAnalysis = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Load all analyses in parallel
        const shotDecisionContext = {
          distanceToPin: shotContext.distanceToPin,
          lie: shotContext.lie,
          holeNumber: shotContext.holeNumber,
          currentScore: shotContext.roundScore || 0,
          parForHole: shotContext.parValue,
          shotNumber: shotContext.shotNumber,
          weather: shotContext.weather ? {
            windSpeed: shotContext.weather.windSpeed,
            conditions: shotContext.weather.conditions
          } : undefined
        };
        
        const [strategic, pressure] = await Promise.all([
        shotDecisionEngine.getShotDecision(shotDecisionContext),
        pressureAnalyticsService.analyzePressureShot(shotContext)
      ]);

      setPressureAnalysis(pressure);

      // Convert ShotDecision to StrategicAnalysis format
      const convertedStrategic: StrategicAnalysis = {
        primaryStrategy: {
          name: strategic.recommendation,
          description: strategic.reasoning[0] || 'Strategic recommendation',
          confidence: strategic.confidence,
          reasoning: strategic.reasoning
        },
        alternatives: strategic.alternativeStrategy ? [{
          name: strategic.alternativeStrategy.strategy,
          description: strategic.alternativeStrategy.pros.join(', '),
          confidence: Math.max(0, strategic.confidence - 20)
        }] : [],
        riskAssessment: {
          successProbability: strategic.riskAssessment.successProbability,
          riskLevel: strategic.riskAssessment.successProbability > 0.8 ? 'low' : 
                    strategic.riskAssessment.successProbability > 0.6 ? 'medium' : 'high',
          factors: [
            { factor: 'Success Probability', impact: strategic.riskAssessment.successProbability * 10 },
            { factor: 'Situation Assessment', impact: strategic.confidence / 10 }
          ]
        }
      };
      
      setStrategicAnalysis(convertedStrategic);

      // Load lie analysis and prediction
      const currentLieAnalysis = await lieIntelligenceService.analyzeLiePerformance(shotContext.lie);
      setLieAnalysis(currentLieAnalysis);

      // Predict next lie if we have a club selected
      if (shotContext.club) {
        const prediction = await lieIntelligenceService.predictNextLie({
          category: shotContext.category,
          club: shotContext.club,
          result: 'Acceptable', // Default assumption
          startLie: shotContext.lie,
          distanceToPin: shotContext.distanceToPin
        });
        setLiePrediction(prediction);
      }
    } catch (error) {
      console.error('Error loading course management analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'strategy': return 'map-outline';
      case 'lie': return 'location-outline';
      case 'pressure': return 'pulse-outline';
      default: return 'help-outline';
    }
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'low': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'extreme': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#22c55e';
      case 'moderate': return '#3b82f6';
      case 'difficult': return '#f59e0b';
      case 'very_difficult': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatPercentage = (value: number) => {
    if (value > 0) return `+${value}%`;
    return `${value}%`;
  };

  const renderStrategyTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {strategicAnalysis && (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trophy-outline" size={16} color="#3b82f6" />
              <Text style={styles.sectionTitle}>Primary Strategy</Text>
              <View style={[styles.confidenceBadge, { backgroundColor: strategicAnalysis.primaryStrategy.confidence >= 80 ? '#22c55e' : strategicAnalysis.primaryStrategy.confidence >= 60 ? '#f59e0b' : '#ef4444' }]}>
                <Text style={styles.confidenceText}>{strategicAnalysis.primaryStrategy.confidence}%</Text>
              </View>
            </View>
            <Text style={styles.strategyTitle}>{strategicAnalysis.primaryStrategy.name}</Text>
            <Text style={styles.strategyDescription}>{strategicAnalysis.primaryStrategy.description}</Text>
            
            {strategicAnalysis.primaryStrategy.reasoning.map((reason, index) => (
              <View key={index} style={styles.reasoningPoint}>
                <View style={styles.bulletPoint} />
                <Text style={styles.reasoningText}>{reason}</Text>
              </View>
            ))}
          </View>

          {strategicAnalysis.alternatives.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="git-branch-outline" size={16} color="#8b5cf6" />
                <Text style={styles.sectionTitle}>Alternative Strategies</Text>
              </View>
              {strategicAnalysis.alternatives.slice(0, 2).map((alt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.alternativeStrategy}
                  onPress={() => onStrategySelected?.(alt.name)}
                >
                  <View style={styles.alternativeHeader}>
                    <Text style={styles.alternativeName}>{alt.name}</Text>
                    <View style={styles.alternativeConfidence}>
                      <Text style={styles.alternativeConfidenceText}>{alt.confidence}%</Text>
                    </View>
                  </View>
                  <Text style={styles.alternativeDescription}>{alt.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="analytics-outline" size={16} color="#06b6d4" />
              <Text style={styles.sectionTitle}>Risk Assessment</Text>
            </View>
            <View style={styles.riskGrid}>
              <View style={styles.riskItem}>
                <Text style={styles.riskLabel}>Success</Text>
                <Text style={[styles.riskValue, { color: '#22c55e' }]}>
                  {Math.round(strategicAnalysis.riskAssessment.successProbability * 100)}%
                </Text>
              </View>
              <View style={styles.riskItem}>
                <Text style={styles.riskLabel}>Risk Level</Text>
                <Text style={[styles.riskValue, { 
                  color: strategicAnalysis.riskAssessment.riskLevel === 'low' ? '#22c55e' : 
                        strategicAnalysis.riskAssessment.riskLevel === 'medium' ? '#f59e0b' : '#ef4444' 
                }]}>
                  {strategicAnalysis.riskAssessment.riskLevel}
                </Text>
              </View>
            </View>
            
            {strategicAnalysis.riskAssessment.factors.slice(0, 2).map((factor, index) => (
              <View key={index} style={styles.riskFactor}>
                <Text style={styles.factorName}>{factor.factor}</Text>
                <View style={styles.factorImpact}>
                  <View style={[styles.impactBar, { 
                    width: `${(factor.impact / 10) * 100}%`,
                    backgroundColor: factor.impact >= 7 ? '#ef4444' : factor.impact >= 4 ? '#f59e0b' : '#22c55e'
                  }]} />
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderLieTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {lieAnalysis && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={16} color="#22c55e" />
            <Text style={styles.sectionTitle}>Current Lie Analysis</Text>
            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(lieAnalysis.expectedDifficulty <= 3 ? 'easy' : lieAnalysis.expectedDifficulty <= 5 ? 'moderate' : lieAnalysis.expectedDifficulty <= 7 ? 'difficult' : 'very_difficult') }]}>
              <Text style={styles.difficultyText}>{lieAnalysis.expectedDifficulty}/10</Text>
            </View>
          </View>
          
          <View style={styles.lieStats}>
            <View style={styles.lieStatItem}>
              <Text style={styles.lieStatLabel}>Success Rate</Text>
              <Text style={styles.lieStatValue}>
                {Math.round(lieAnalysis.historicalPerformance.successRate * 100)}%
              </Text>
            </View>
            <View style={styles.lieStatItem}>
              <Text style={styles.lieStatLabel}>Typical Result</Text>
              <Text style={styles.lieStatValue}>{lieAnalysis.historicalPerformance.averageResult}</Text>
            </View>
          </View>
          
          <View style={styles.adjustmentSection}>
            <Text style={styles.adjustmentTitle}>Recommended Adjustments</Text>
            <View style={styles.adjustmentItem}>
              <Ionicons name="golf-outline" size={14} color="#6b7280" />
              <Text style={styles.adjustmentText}>{lieAnalysis.adjustmentRecommendations.clubSelection}</Text>
            </View>
            <View style={styles.adjustmentItem}>
              <Ionicons name="build-outline" size={14} color="#6b7280" />
              <Text style={styles.adjustmentText}>{lieAnalysis.adjustmentRecommendations.technique.join(', ')}</Text>
            </View>
            <View style={styles.adjustmentItem}>
              <Ionicons name="bulb-outline" size={14} color="#6b7280" />
              <Text style={styles.adjustmentText}>{lieAnalysis.adjustmentRecommendations.strategy}</Text>
            </View>
          </View>
        </View>
      )}

      {liePrediction && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-outline" size={16} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Next Lie Prediction</Text>
          </View>
          
          <View style={styles.predictionMain}>
            <Text style={styles.predictionLie}>{liePrediction.mostLikely}</Text>
            <View style={styles.predictionProbability}>
              <Text style={styles.probabilityText}>{Math.round(liePrediction.probability * 100)}%</Text>
            </View>
          </View>
          
          <View style={[styles.difficultyIndicator, { backgroundColor: getDifficultyColor(liePrediction.difficulty) }]}>
            <Text style={styles.difficultyLabel}>{liePrediction.difficulty.replace('_', ' ')}</Text>
          </View>
          
          {liePrediction.reasoning.slice(0, 2).map((reason, index) => (
            <View key={index} style={styles.reasoningPoint}>
              <View style={styles.bulletPoint} />
              <Text style={styles.reasoningText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderPressureTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {pressureAnalysis && (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pulse-outline" size={16} color="#ef4444" />
              <Text style={styles.sectionTitle}>Pressure Analysis</Text>
              <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(pressureAnalysis.currentSituation.intensity) }]}>
                <Text style={styles.intensityText}>{pressureAnalysis.currentSituation.intensity}</Text>
              </View>
            </View>
            
            <Text style={styles.pressureDescription}>
              {pressureAnalysis.currentSituation.description}
            </Text>
            
            <View style={styles.pressureFactors}>
              {pressureAnalysis.currentSituation.factors.slice(0, 3).map((factor, index) => (
                <View key={index} style={styles.pressureFactor}>
                  <Text style={styles.factorName}>{factor.factor}</Text>
                  <View style={styles.factorWeight}>
                    <View style={[styles.weightBar, { 
                      width: `${(factor.weight / 10) * 100}%`,
                      backgroundColor: factor.weight >= 8 ? '#ef4444' : factor.weight >= 6 ? '#f59e0b' : '#22c55e'
                    }]} />
                    <Text style={styles.weightText}>{factor.weight}/10</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {pressureAnalysis.currentSituation.historicalPerformance && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="stats-chart-outline" size={16} color="#06b6d4" />
                <Text style={styles.sectionTitle}>Pressure Performance</Text>
              </View>
              
              <View style={styles.performanceStats}>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatLabel}>Success Rate</Text>
                  <Text style={styles.performanceStatValue}>
                    {Math.round(pressureAnalysis.currentSituation.historicalPerformance.successRate * 100)}%
                  </Text>
                </View>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatLabel}>vs Normal</Text>
                  <Text style={[styles.performanceStatValue, { 
                    color: pressureAnalysis.currentSituation.historicalPerformance.comparedToNormal >= 0 ? '#22c55e' : '#ef4444' 
                  }]}>
                    {formatPercentage(pressureAnalysis.currentSituation.historicalPerformance.comparedToNormal)}
                  </Text>
                </View>
              </View>
              
              {pressureAnalysis.currentSituation.historicalPerformance.strengths.map((strength, index) => (
                <View key={index} style={styles.strengthPoint}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" />
                  <Text style={styles.strengthText}>{strength}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb-outline" size={16} color="#8b5cf6" />
              <Text style={styles.sectionTitle}>Mental Game</Text>
            </View>
            
            <View style={styles.confidenceBooster}>
              <Text style={styles.confidenceText}>{pressureAnalysis.confidenceBooster}</Text>
            </View>
            
            {pressureAnalysis.recommendedMindset.map((mindset, index) => (
              <View key={index} style={styles.mindsetPoint}>
                <View style={styles.mindsetBullet} />
                <Text style={styles.mindsetText}>{mindset}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'strategy': return renderStrategyTab();
      case 'lie': return renderLieTab();
      case 'pressure': return renderPressureTab();
      default: return null;
    }
  };

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [300, 0]
            })
          }],
          opacity: slideAnim
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Course Management Coach</Text>
        <TouchableOpacity 
          style={styles.expandButton}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Ionicons 
            name={isExpanded ? "chevron-down" : "chevron-up"} 
            size={20} 
            color="#6b7280" 
          />
        </TouchableOpacity>
      </View>

      <Animated.View 
        style={[
          styles.content,
          {
            height: expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 300]
            })
          }
        ]}
      >
        <View style={styles.tabBar}>
          {(['strategy', 'lie', 'pressure'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons 
                name={getTabIcon(tab) as any} 
                size={16} 
                color={activeTab === tab ? '#3b82f6' : '#6b7280'} 
              />
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Analyzing situation...</Text>
          </View>
        ) : (
          renderTabContent()
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: Dimensions.get('window').height * 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  expandButton: {
    padding: 4,
  },
  content: {
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#eff6ff',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 6,
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  strategyDescription: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  reasoningPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bulletPoint: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6b7280',
    marginTop: 7,
    marginRight: 8,
  },
  reasoningText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  alternativeStrategy: {
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  alternativeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alternativeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  alternativeConfidence: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  alternativeConfidenceText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4b5563',
  },
  alternativeDescription: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 14,
  },
  riskGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  riskItem: {
    alignItems: 'center',
    flex: 1,
  },
  riskLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  riskValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  riskFactor: {
    marginVertical: 4,
  },
  factorName: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  factorImpact: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
  },
  impactBar: {
    height: '100%',
    borderRadius: 3,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  lieStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lieStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  lieStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  lieStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  adjustmentSection: {
    marginTop: 8,
  },
  adjustmentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  adjustmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  adjustmentText: {
    fontSize: 12,
    color: '#4b5563',
    marginLeft: 8,
    flex: 1,
  },
  predictionMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictionLie: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  predictionProbability: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  probabilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  difficultyIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  difficultyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  intensityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  intensityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  pressureDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
    lineHeight: 18,
  },
  pressureFactors: {
    marginTop: 8,
  },
  pressureFactor: {
    marginVertical: 4,
  },
  factorWeight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  weightBar: {
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    flex: 1,
  },
  weightText: {
    fontSize: 11,
    color: '#6b7280',
    minWidth: 30,
  },
  performanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  performanceStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  performanceStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  performanceStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  strengthPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  strengthText: {
    fontSize: 12,
    color: '#22c55e',
    marginLeft: 6,
    flex: 1,
  },
  confidenceBooster: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  mindsetPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
  },
  mindsetBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8b5cf6',
    marginTop: 7,
    marginRight: 8,
  },
  mindsetText: {
    flex: 1,
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
  },
});

export default CourseManagementCoach;