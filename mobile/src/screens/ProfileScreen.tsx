import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export default function ProfileScreen({ navigation }: any) {
  const [displayName, setDisplayName] = useState('');
  const [handedness, setHandedness] = useState<'right' | 'left'>('right');
  const [usesAdvanced, setUsesAdvanced] = useState(false);

  async function createProfile() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const id = user.id;
    const profile: Partial<Profile> = { id, display_name: displayName, handedness, uses_advanced_entry: usesAdvanced };
    const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
    if (error) {
      console.error(error);
    } else {
      navigation.navigate('StartRound');
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Welcome — Set up your profile</Text>
      <Text>Name</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} />
      <Text>Handedness (right/left)</Text>
      <TextInput value={handedness} onChangeText={(t) => setHandedness(t as any)} />
      <View style={{ marginTop: 12 }}>
        <Button title="Save profile" onPress={createProfile} />
      </View>
    </View>
  );
}
