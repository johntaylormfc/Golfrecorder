import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { supabase } from '../services/supabase';
import ShotEntryModal from './ShotEntryModal';

export default function PlayRoundScreen({ route, navigation }: any) {
  const { roundId } = route.params;
  const [round, setRound] = useState<any>(null);
  const [shots, setShots] = useState<any[]>([]);
  const [holeNumber, setHoleNumber] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);

  async function loadRound() {
    const { data: r } = await supabase.from('rounds').select('*').eq('id', roundId).single();
    setRound(r);
    const { data: s } = await supabase.from('shots').select('*').eq('round_id', roundId).order('shot_number');
    setShots(s || []);
  }

  useEffect(() => {
    loadRound();
  }, []);

  function openAddShot() {
    setModalVisible(true);
  }

  async function onSaveShot(partialShot: any) {
    const shot_num = (shots.filter((s) => s.hole_number === holeNumber).length || 0) + 1;
    const newShot = { round_id: roundId, hole_number: holeNumber, shot_number: shot_num, ...partialShot };
    const { data, error } = await supabase.from('shots').insert(newShot).select().single();
    if (error) console.error(error);
    await loadRound();
  }

  function nextHole() {
    setHoleNumber((h) => Math.min(h + 1, 18));
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Playing round: {round?.id}</Text>
      <Text>Hole: {holeNumber}</Text>

      <FlatList data={shots.filter((s) => s.hole_number === holeNumber)} keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <View style={{ padding: 8 }}>
          <Text>{item.shot_number}: {item.club} — {item.end_lie} — {item.end_distance_to_hole} yds</Text>
        </View>
      )} />

      <Button title="Add shot" onPress={openAddShot} />
      <Button title="Next hole" onPress={nextHole} />
      <Button title="End round" onPress={() => navigation.navigate('RoundSummary', { roundId })} />

      <ShotEntryModal visible={modalVisible} onClose={() => setModalVisible(false)} onSave={onSaveShot} holeNumber={holeNumber} nextShotNumber={(shots.filter((s) => s.hole_number === holeNumber).length || 0) + 1} />
    </View>
  );
}
