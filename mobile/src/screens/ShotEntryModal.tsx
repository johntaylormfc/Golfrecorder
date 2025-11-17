import React, { useState } from 'react';
import { View, Text, Modal, Button, TextInput, Switch } from 'react-native';
import { Shot } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (shot: Partial<Shot>) => void;
  holeNumber: number;
  nextShotNumber: number;
}

export function ShotEntryModal({ visible, onClose, onSave, holeNumber, nextShotNumber }: Props) {
  const [category, setCategory] = useState<'tee' | 'approach' | 'around_green' | 'putt'>('approach');
  const [club, setClub] = useState('7i');
  const [startDistance, setStartDistance] = useState(150);
  const [endDistance, setEndDistance] = useState(30);
  const [holed, setHoled] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function saveShot() {
    onSave({
      hole_number: holeNumber,
      shot_number: nextShotNumber,
      shot_category: category,
      club,
      start_distance_to_hole: startDistance,
      end_distance_to_hole: endDistance,
      holed,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Shot {nextShotNumber} — Hole {holeNumber}</Text>

        <Text>Shot category</Text>
        <View style={{ flexDirection: 'row' }}>
          <Button title="Tee" onPress={() => setCategory('tee')} />
          <Button title="Approach" onPress={() => setCategory('approach')} />
          <Button title="Around green" onPress={() => setCategory('around_green')} />
          <Button title="Putt" onPress={() => setCategory('putt')} />
        </View>

        <Text>Club</Text>
        <TextInput value={club} onChangeText={setClub} />

        <Text>Start distance to hole</Text>
        <TextInput value={String(startDistance)} keyboardType="numeric" onChangeText={(t) => setStartDistance(Number(t))} />

        <Text>End distance to hole</Text>
        <TextInput value={String(endDistance)} keyboardType="numeric" onChangeText={(t) => setEndDistance(Number(t))} />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text>Holed</Text>
          <Switch value={holed} onValueChange={setHoled} />
        </View>

        <View style={{ marginVertical: 12 }}>
          <Button title={showAdvanced ? 'Hide advanced' : 'Show advanced'} onPress={() => setShowAdvanced((s) => !s)} />
        </View>

        {showAdvanced && (
          <View>
            <Text>Advanced details (contact, shape, trajectory...)</Text>
            {/* Implement advanced inputs here — simplified for MVP */}
          </View>
        )}

        <Button title="Save shot" onPress={saveShot} />
        <Button title="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}

export default ShotEntryModal;
