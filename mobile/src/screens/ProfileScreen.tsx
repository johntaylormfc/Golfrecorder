import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { STANDARD_CLUBS } from '../services/clubs';

export default function ProfileScreen({ navigation }: any) {
  const [displayName, setDisplayName] = useState('');
  const [handedness, setHandedness] = useState<'right' | 'left'>('right');
  const [usesAdvanced, setUsesAdvanced] = useState(false);
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profile && !error) {
          setDisplayName(profile.display_name);
          setHandedness(profile.handedness);
          setUsesAdvanced(profile.uses_advanced_entry);
        }

        // Load clubs
        const { data: clubs } = await supabase
          .from('clubs')
          .select('club_type')
          .eq('user_id', user.id)
          .order('display_order');
        
        if (clubs) {
          setSelectedClubs(clubs.map(c => c.club_type));
        }
      }
    } catch (error) {
      console.log('No existing profile found');
    } finally {
      setInitialLoading(false);
    }
  }

  async function createProfile() {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      // Try to get existing user
      let { data: { user } } = await supabase.auth.getUser();
      
      // If no user, try to sign up with a temporary email/password
      if (!user) {
        console.log('No authenticated user found, attempting sign up...');
        const tempEmail = `user_${Date.now()}@golfrecorder.temp`;
        const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: tempEmail,
          password: tempPassword,
        });
        
        if (authError) {
          console.error('Auth error:', authError);
          Alert.alert(
            'Authentication Required', 
            'Please enable anonymous sign-ins or email auth in your Supabase project:\n\n1. Go to Authentication > Providers\n2. Enable Anonymous or Email provider\n\nFor now, proceeding without save...'
          );
          // Navigate anyway for testing
          navigation.navigate('StartRound');
          return;
        }
        user = authData.user;
      }

      if (!user) {
        Alert.alert('Error', 'Could not authenticate. Please check your Supabase configuration.');
        return;
      }

      const profile: Partial<Profile> = { 
        id: user.id,
        display_name: displayName, 
        handedness, 
        uses_advanced_entry: usesAdvanced 
      };
      
      // Use upsert - will insert if not exists, update if exists
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profile, { onConflict: 'id' })
        .select()
        .single();
      
      if (error) {
        console.error('Profile save error:', error);
        throw error;
      }
      
      console.log('Profile saved successfully:', data);
      
      // Save clubs
      if (user) {
        // Delete existing clubs
        await supabase.from('clubs').delete().eq('user_id', user.id);
        
        // Insert selected clubs
        if (selectedClubs.length > 0) {
          const clubsToInsert = selectedClubs.map((clubType, index) => ({
            user_id: user.id,
            club_type: clubType,
            display_order: index,
          }));
          
          const { error: clubsError } = await supabase.from('clubs').insert(clubsToInsert);
          if (clubsError) {
            console.error('Error saving clubs:', clubsError);
          }
        }
      }
      
      Alert.alert('Success', 'Profile saved!', [
        { text: 'OK', onPress: () => {
          // Try to go back, if no screen exists, navigate to StartRound
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('StartRound');
          }
        }}
      ]);
    } catch (error: any) {
      console.error('Error in createProfile:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const toggleClub = (club: string) => {
    if (selectedClubs.includes(club)) {
      setSelectedClubs(selectedClubs.filter(c => c !== club));
    } else {
      setSelectedClubs([...selectedClubs, club]);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Welcome — Set up your profile</Text>
      
      <Text style={styles.label}>Name</Text>
      <TextInput 
        style={styles.input}
        value={displayName} 
        onChangeText={setDisplayName}
        placeholder="Enter your name"
      />
      
      <Text style={styles.label}>Handedness</Text>
      <View style={styles.radioGroup}>
        <Button 
          title="Right" 
          onPress={() => setHandedness('right')}
          color={handedness === 'right' ? '#007AFF' : '#8E8E93'}
        />
        <View style={{ width: 10 }} />
        <Button 
          title="Left" 
          onPress={() => setHandedness('left')}
          color={handedness === 'left' ? '#007AFF' : '#8E8E93'}
        />
      </View>

      <Text style={styles.label}>Clubs in Bag</Text>
      <Text style={styles.helperText}>Select the clubs you carry</Text>
      <View style={styles.clubsGrid}>
        {STANDARD_CLUBS.map((club) => (
          <TouchableOpacity
            key={club}
            style={[
              styles.clubButton,
              selectedClubs.includes(club) && styles.clubButtonSelected
            ]}
            onPress={() => toggleClub(club)}
          >
            <Text style={[
              styles.clubButtonText,
              selectedClubs.includes(club) && styles.clubButtonTextSelected
            ]}>
              {club}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <Button 
          title={loading ? "Saving..." : "Save Profile"} 
          onPress={createProfile}
          disabled={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  clubButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  clubButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  clubButtonText: {
    fontSize: 14,
    color: '#333',
  },
  clubButtonTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 32,
  },
});
