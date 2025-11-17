import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { supabase } from '../services/supabase';
import api from '../services/api';

export default function RoundSummaryScreen({ route, navigation }: any) {
  const { roundId } = route.params;
  const [round, setRound] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRound() {
    const { data: r } = await supabase.from('rounds').select('*').eq('id', roundId).single();
    setRound(r);
    setAiSummary(r?.ai_summary_markdown ?? null);
  }

  useEffect(() => { loadRound(); }, []);

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await api.generateRoundSummary(roundId);
      // Edge function returns the ai_summary_markdown
      setAiSummary(res.ai_summary_markdown ?? res);
      await loadRound();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Round summary</Text>
      <Text>Round ID: {roundId}</Text>
      <Text>Course: {round?.course_id}</Text>
      <Text>Status: {round?.status}</Text>
      <Text>Total Score: {round?.total_score}</Text>

      <View style={{ marginVertical: 12 }}>
        <Button title={loading ? 'Generating...' : 'Generate AI summary'} onPress={generateSummary} disabled={loading} />
      </View>

      {aiSummary && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: '600' }}>AI Summary</Text>
          <Text>{aiSummary}</Text>
        </View>
      )}
    </ScrollView>
  );
}
