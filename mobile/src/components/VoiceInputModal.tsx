import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView,
  ActivityIndicator,
  Alert 
} from 'react-native';
import { voiceInputService, VoiceInputResult } from '../services/voiceInput';

interface VoiceInputModalProps {
  visible: boolean;
  onClose: () => void;
  onResult: (result: VoiceInputResult) => void;
}

export function VoiceInputModal({ visible, onClose, onResult }: VoiceInputModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<VoiceInputResult | null>(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      setIsListening(false);
      setResult(null);
      setShowTips(false);
    }
  }, [visible]);

  const handleStartListening = async () => {
    try {
      setIsListening(true);
      setResult(null);
      
      const voiceResult = await voiceInputService.startListening();
      setResult(voiceResult);
      setIsListening(false);
    } catch (error) {
      setIsListening(false);
      Alert.alert(
        'Voice Recognition Error', 
        'Failed to recognize speech. Please try again.',
        [{ text: 'OK' }]
      );
      console.error('Voice input error:', error);
    }
  };

  const handleStopListening = () => {
    voiceInputService.stopListening();
    setIsListening(false);
  };

  const handleUseResult = () => {
    if (result) {
      onResult(result);
      onClose();
    }
  };

  const handleTryAgain = () => {
    setResult(null);
    handleStartListening();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Voice Shot Entry</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main Action Area */}
          <View style={styles.actionArea}>
            {!isListening && !result && (
              <>
                <View style={styles.microphoneArea}>
                  <TouchableOpacity 
                    style={styles.micButton} 
                    onPress={handleStartListening}
                  >
                    <Text style={styles.micIcon}>🎤</Text>
                  </TouchableOpacity>
                  <Text style={styles.micLabel}>Tap to start recording</Text>
                </View>
                
                <View style={styles.exampleSection}>
                  <Text style={styles.sectionTitle}>Say something like:</Text>
                  {voiceInputService.getExamplePhrases().slice(0, 3).map((phrase, index) => (
                    <Text key={index} style={styles.examplePhrase}>
                      "{phrase}"
                    </Text>
                  ))}
                </View>
              </>
            )}

            {isListening && (
              <View style={styles.listeningArea}>
                <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} />
                <Text style={styles.listeningText}>Listening...</Text>
                <Text style={styles.listeningSubtext}>Speak clearly about your shot</Text>
                <TouchableOpacity 
                  style={styles.stopButton} 
                  onPress={handleStopListening}
                >
                  <Text style={styles.stopButtonText}>Stop Recording</Text>
                </TouchableOpacity>
              </View>
            )}

            {result && (
              <View style={styles.resultArea}>
                <Text style={styles.resultTitle}>What I heard:</Text>
                <Text style={styles.originalText}>"{result.originalText}"</Text>
                
                <Text style={styles.resultTitle}>Parsed Information:</Text>
                <View style={styles.parsedDataContainer}>
                  {result.parsedData.club && (
                    <View style={styles.parsedItem}>
                      <Text style={styles.parsedLabel}>Club:</Text>
                      <Text style={styles.parsedValue}>{result.parsedData.club}</Text>
                    </View>
                  )}
                  
                  {result.parsedData.distance && (
                    <View style={styles.parsedItem}>
                      <Text style={styles.parsedLabel}>Distance:</Text>
                      <Text style={styles.parsedValue}>
                        {result.parsedData.distance} {result.parsedData.distanceUnit}
                      </Text>
                    </View>
                  )}
                  
                  {result.parsedData.shotShape && (
                    <View style={styles.parsedItem}>
                      <Text style={styles.parsedLabel}>Shot Shape:</Text>
                      <Text style={styles.parsedValue}>{result.parsedData.shotShape}</Text>
                    </View>
                  )}
                  
                  {result.parsedData.trajectory && (
                    <View style={styles.parsedItem}>
                      <Text style={styles.parsedLabel}>Trajectory:</Text>
                      <Text style={styles.parsedValue}>{result.parsedData.trajectory}</Text>
                    </View>
                  )}
                  
                  {result.parsedData.result && (
                    <View style={styles.parsedItem}>
                      <Text style={styles.parsedLabel}>Result:</Text>
                      <Text style={styles.parsedValue}>{result.parsedData.result}</Text>
                    </View>
                  )}
                  
                  {result.parsedData.lie && (
                    <View style={styles.parsedItem}>
                      <Text style={styles.parsedLabel}>Lie:</Text>
                      <Text style={styles.parsedValue}>{result.parsedData.lie}</Text>
                    </View>
                  )}
                </View>

                {/* Confidence Score */}
                <View style={styles.confidenceContainer}>
                  <Text style={styles.confidenceLabel}>Recognition Confidence:</Text>
                  <View style={styles.confidenceBar}>
                    <View 
                      style={[
                        styles.confidenceFill, 
                        { width: `${result.parsedData.confidence * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.confidenceText}>
                    {Math.round(result.parsedData.confidence * 100)}%
                  </Text>
                </View>

                {/* Suggestions */}
                {result.suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>💡 Suggestions:</Text>
                    {result.suggestions.map((suggestion, index) => (
                      <Text key={index} style={styles.suggestion}>
                        • {suggestion}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.resultActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.useButton]} 
                    onPress={handleUseResult}
                  >
                    <Text style={styles.useButtonText}>Use This Data</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.tryAgainButton]} 
                    onPress={handleTryAgain}
                  >
                    <Text style={styles.tryAgainButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Tips Section */}
          <View style={styles.tipsSection}>
            <TouchableOpacity 
              style={styles.tipsToggle}
              onPress={() => setShowTips(!showTips)}
            >
              <Text style={styles.tipsToggleText}>
                {showTips ? '▼' : '▶'} Voice Input Tips
              </Text>
            </TouchableOpacity>
            
            {showTips && (
              <View style={styles.tipsContent}>
                {voiceInputService.getVoiceTips().map((tip, index) => (
                  <Text key={index} style={styles.tip}>• {tip}</Text>
                ))}
              </View>
            )}
          </View>

          {/* Example Phrases */}
          <View style={styles.examplesSection}>
            <Text style={styles.examplesTitle}>Example Phrases:</Text>
            {voiceInputService.getExamplePhrases().map((phrase, index) => (
              <Text key={index} style={styles.exampleItem}>
                "{phrase}"
              </Text>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  actionArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  microphoneArea: {
    alignItems: 'center',
    marginVertical: 32,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  micIcon: {
    fontSize: 48,
  },
  micLabel: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  exampleSection: {
    width: '100%',
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  examplePhrase: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
    paddingLeft: 8,
  },
  listeningArea: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  spinner: {
    marginBottom: 16,
  },
  listeningText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  listeningSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  stopButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultArea: {
    width: '100%',
    marginTop: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  originalText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#007AFF',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  parsedDataContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  parsedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parsedLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  parsedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  confidenceContainer: {
    marginBottom: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  suggestionsContainer: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  suggestion: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  useButton: {
    backgroundColor: '#007AFF',
  },
  useButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tryAgainButton: {
    backgroundColor: '#f0f0f0',
  },
  tryAgainButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  tipsSection: {
    marginBottom: 24,
  },
  tipsToggle: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  tipsToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  tipsContent: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  tip: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  examplesSection: {
    marginBottom: 32,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  exampleItem: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
    paddingLeft: 8,
  },
});

export default VoiceInputModal;