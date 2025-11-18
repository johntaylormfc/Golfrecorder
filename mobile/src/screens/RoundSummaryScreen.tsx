import React, { useEffect, useState, useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { View, Text, Button, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import api from '../services/api';

export default function RoundSummaryScreen({ route, navigation }: any) {
  const { roundId } = route.params;
  const [round, setRound] = useState<any>(null);
  const [roundHoles, setRoundHoles] = useState<any[]>([]);
  const [courseInfo, setCourseInfo] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  async function loadRound() {
    try {
      // Load round details
      const { data: r } = await supabase.from('rounds').select('*').eq('id', roundId).single();
      setRound(r);
      setAiSummary(r?.ai_summary_markdown ?? null);

      // Load round holes for detailed stats
      const { data: rh } = await supabase.from('round_holes').select('*').eq('round_id', roundId);
      setRoundHoles(rh || []);

      // Load course and tee information
      if (r?.course_id && r?.tee_id) {
        const { data: course } = await supabase.from('courses').select('name').eq('id', r.course_id).single();
        const { data: tee } = await supabase.from('course_tees').select('tee_name, metadata').eq('id', r.tee_id).single();
        setCourseInfo({ course: course?.name, tee: tee?.tee_name });
      }
    } catch (error) {
      console.error('Error loading round:', error);
      Alert.alert('Error', 'Failed to load round details');
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => { loadRound(); }, []);

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await api.generateRoundSummary(roundId);
      setAiSummary(res.ai_summary_markdown ?? res);
      await loadRound();
      Alert.alert('Success', 'AI summary generated successfully!');
    } catch (err: any) {
      console.error('Summary generation error:', err);
      Alert.alert('Error', err.message || 'Failed to generate AI summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const roundStats = useMemo(() => {
    if (!roundHoles.length) return null;
    
    const completedHoles = roundHoles.filter(h => h.gross_score != null);
    const totalPutts = completedHoles.reduce((sum, h) => sum + (h.putts || 0), 0);
    const firCount = completedHoles.filter(h => h.fir).length;
    const girCount = completedHoles.filter(h => h.gir).length;
    const penalties = completedHoles.reduce((sum, h) => sum + (h.penalties || 0), 0);
    
    return {
      holesCompleted: completedHoles.length,
      totalPutts,
      fairwaysHit: firCount,
      greensInReg: girCount,
      totalPenalties: penalties,
    };
  }, [roundHoles]);

  const renderedSummary = useMemo(() => {
    if (!aiSummary) return null;
    return (
      <Markdown style={markdownStyles}>{aiSummary}</Markdown>
    );
  }, [aiSummary]);

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading round details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Round Complete! 🏌️‍♂️</Text>
        <Text style={styles.subtitle}>
          {courseInfo?.course} {courseInfo?.tee && `(${courseInfo.tee})`}
        </Text>
        {round?.started_at && (
          <Text style={styles.date}>
            {new Date(round.started_at).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        )}
      </View>

      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Total Score</Text>
          <Text style={styles.scoreValue}>{round?.total_score || '-'}</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Par</Text>
          <Text style={styles.scoreValue}>{round?.par_total || '-'}</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Score to Par</Text>
          <Text style={[styles.scoreValue, styles.scoreToPar]}>
            {round?.total_score && round?.par_total
              ? (round.total_score - round.par_total > 0 ? '+' : '') + (round.total_score - round.par_total)
              : '-'}
          </Text>
        </View>
      </View>

      {roundStats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Round Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{roundStats.holesCompleted}</Text>
              <Text style={styles.statLabel}>Holes Played</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{roundStats.totalPutts}</Text>
              <Text style={styles.statLabel}>Total Putts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{roundStats.fairwaysHit}</Text>
              <Text style={styles.statLabel}>Fairways Hit</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{roundStats.greensInReg}</Text>
              <Text style={styles.statLabel}>Greens in Reg</Text>
            </View>
            {roundStats.totalPenalties > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{roundStats.totalPenalties}</Text>
                <Text style={styles.statLabel}>Penalties</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.aiSection}>
        <Text style={styles.aiTitle}>AI Performance Analysis</Text>
        {!aiSummary ? (
          <View style={styles.aiPrompt}>
            <Text style={styles.aiPromptText}>
              Get personalized insights about your round with AI analysis
            </Text>
            <Button 
              title={loading ? 'Generating Analysis...' : 'Generate AI Analysis'} 
              onPress={generateSummary} 
              disabled={loading}
            />
            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#007AFF" style={styles.loadingSpinner} />
                <Text style={styles.loadingText}>Analyzing your round...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.aiSummaryContainer}>
            {renderedSummary}
            <Button 
              title={loading ? 'Regenerating...' : 'Regenerate Analysis'} 
              onPress={generateSummary} 
              disabled={loading}
            />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
        <View style={styles.actionSpacer} />
        <Button title="View Scorecard" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  scoreCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#333',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  scoreToPar: {
    color: '#007AFF',
  },
  statsCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  aiSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  aiPrompt: {
    alignItems: 'center',
  },
  aiPromptText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  aiSummaryContainer: {
    marginTop: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  loadingSpinner: {
    marginRight: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
  },
  actionSpacer: {
    width: 16,
  },
});

const markdownStyles = {
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  heading1: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  heading2: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 8,
    lineHeight: 20,
  },
  listItem: {
    marginBottom: 4,
  },
};
