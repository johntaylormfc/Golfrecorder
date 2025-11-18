import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator 
} from 'react-native';
import { clubSuggestionService, ClubSuggestion, SuggestionContext } from '../services/clubSuggestion';

interface ClubSuggestionsProps {
  context: SuggestionContext;
  onClubSelect: (club: string) => void;
  selectedClub?: string;
  visible: boolean;
}

export function ClubSuggestions({ context, onClubSelect, selectedClub, visible }: ClubSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ClubSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (visible && context.distanceToPin > 0) {
      loadSuggestions();
    }
  }, [visible, context.distanceToPin, context.lie, context.shotCategory]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const newSuggestions = await clubSuggestionService.getClubSuggestions(context);
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error('Failed to load club suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || context.shotCategory === 'putt') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 Smart Club Suggestions</Text>
        {suggestions.length > 1 && (
          <TouchableOpacity 
            onPress={() => setExpanded(!expanded)}
            style={styles.expandButton}
          >
            <Text style={styles.expandText}>
              {expanded ? 'Show Less' : 'Show All'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Analyzing your game...</Text>
        </View>
      ) : suggestions.length > 0 ? (
        <View style={styles.suggestionsContainer}>
          {/* Top suggestion - always shown */}
          {suggestions.length > 0 && (
            <TouchableOpacity
              style={[
                styles.suggestionItem,
                styles.topSuggestion,
                selectedClub === suggestions[0].club && styles.selectedSuggestion
              ]}
              onPress={() => onClubSelect(suggestions[0].club)}
            >
              <View style={styles.suggestionHeader}>
                <Text style={styles.clubName}>{suggestions[0].club}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {Math.round(suggestions[0].confidence * 100)}%
                  </Text>
                </View>
              </View>
              
              <Text style={styles.reasoning}>{suggestions[0].reasoning}</Text>
              
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  Avg: {suggestions[0].averageDistance}y
                </Text>
                <Text style={styles.stat}>
                  Success: {suggestions[0].successRate}%
                </Text>
                <Text style={styles.stat}>
                  ({suggestions[0].sampleSize} shots)
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Additional suggestions - shown when expanded */}
          {expanded && suggestions.slice(1).map((suggestion, index) => (
            <TouchableOpacity
              key={index + 1}
              style={[
                styles.suggestionItem,
                selectedClub === suggestion.club && styles.selectedSuggestion
              ]}
              onPress={() => onClubSelect(suggestion.club)}
            >
              <View style={styles.suggestionHeader}>
                <Text style={styles.clubName}>{suggestion.club}</Text>
                <View style={[styles.confidenceBadge, styles.alternativeBadge]}>
                  <Text style={styles.alternativeConfidenceText}>
                    {Math.round(suggestion.confidence * 100)}%
                  </Text>
                </View>
              </View>
              
              <Text style={styles.alternativeReasoning}>{suggestion.reasoning}</Text>
              
              <View style={styles.statsRow}>
                <Text style={styles.alternativeStat}>
                  Avg: {suggestion.averageDistance}y
                </Text>
                <Text style={styles.alternativeStat}>
                  Success: {suggestion.successRate}%
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.noSuggestionsContainer}>
          <Text style={styles.noSuggestionsText}>
            No suggestions available for {context.distanceToPin} yards
          </Text>
        </View>
      )}

      {/* Wind adjustment if available */}
      {context.windConditions && context.windConditions.direction !== 'calm' && (
        <View style={styles.windAdjustmentContainer}>
          <Text style={styles.windAdjustmentTitle}>💨 Wind Adjustment:</Text>
          <Text style={styles.windAdjustmentText}>
            {clubSuggestionService.getWindAdjustment(context.windConditions).clubAdjustment}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  expandButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  expandText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  suggestionsContainer: {
    gap: 8,
  },
  suggestionItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  topSuggestion: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  selectedSuggestion: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confidenceBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  alternativeBadge: {
    backgroundColor: '#666',
  },
  alternativeConfidenceText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  reasoning: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
    lineHeight: 18,
  },
  alternativeReasoning: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  alternativeStat: {
    fontSize: 10,
    color: '#888',
    fontWeight: '500',
  },
  noSuggestionsContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noSuggestionsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  windAdjustmentContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#e8f4f8',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  windAdjustmentTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  windAdjustmentText: {
    fontSize: 11,
    color: '#666',
  },
});

export default ClubSuggestions;