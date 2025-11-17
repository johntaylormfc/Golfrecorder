import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity } from 'react-native';
import api from '../services/api';
import { supabase } from '../services/supabase';

export default function StartRoundScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [selectedTeeId, setSelectedTeeId] = useState<string | null>(null);

  async function search() {
    try {
      const data = await api.searchCourses(query);
      setResults(data.results ?? data);
    } catch (err) {
      console.error(err);
    }
  }

  async function startRound() {
    if (!selectedCourse || !selectedTeeId) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { data, error } = await supabase.from('rounds').insert({ user_id: user.id, course_id: selectedCourse.id, tee_id: selectedTeeId, started_at: new Date().toISOString(), status: 'in_progress' }).select().single();
    if (error) {
      console.error(error);
    } else {
      navigation.navigate('PlayRound', { roundId: data.id });
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Search for a course</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search course name" />
      <Button title="Search" onPress={search} />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedCourse(item)}>
            <View style={{ padding: 12, backgroundColor: selectedCourse?.id === item.id ? '#ddd' : '#fff' }}>
              <Text style={{ fontWeight: '600' }}>{item.name}</Text>
              <Text>{item.city ?? ''} {item.region ?? ''}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      {selectedCourse && (
        <View style={{ marginTop: 12 }}>
          <Text>Select Tee</Text>
          {(selectedCourse.tees ?? selectedCourse.course_tees ?? []).map((t: any) => (
            <TouchableOpacity key={t.id} onPress={() => setSelectedTeeId(t.id)}>
              <View style={{ padding: 8, backgroundColor: selectedTeeId === t.id ? '#ddd' : '#fff' }}>
                <Text>{t.tee_name ?? t.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{ marginTop: 12 }}>
        <Button title="Start round" onPress={startRound} />
      </View>
    </View>
  );
}
