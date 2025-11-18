import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

export default function HomeScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [openRounds, setOpenRounds] = useState<any[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loadingRounds, setLoadingRounds] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (selectedProfile) {
        loadOpenRounds();
      }
    }, [selectedProfile])
  );

  async function initializeApp() {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        // No user, need to create profile
        navigation.replace('Profile');
        return;
      }

      // Load profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (profilesError) throw profilesError;

      if (!profilesData || profilesData.length === 0) {
        // No profile exists, go to profile creation
        navigation.replace('Profile');
        return;
      }

      setProfiles(profilesData);

      // Get last used profile
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const lastProfileId = await AsyncStorage.getItem('lastUsedProfileId');
      
      let profileToUse = null;
      if (lastProfileId && profilesData.find((p: any) => p.id === lastProfileId)) {
        profileToUse = profilesData.find((p: any) => p.id === lastProfileId);
      } else {
        profileToUse = profilesData[0];
      }

      setSelectedProfile(profileToUse);
      await loadOpenRoundsForProfile(profileToUse.id);
    } catch (err) {
      console.error('Error initializing app:', err);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadOpenRounds() {
    if (!selectedProfile) return;
    await loadOpenRoundsForProfile(selectedProfile.id);
  }

  async function loadOpenRoundsForProfile(profileId: string) {
    setLoadingRounds(true);
    try {
      const { data, error } = await supabase
        .from('rounds')
        .select(`
          id,
          started_at,
          holes_played,
          status,
          courses (
            id,
            name,
            city,
            region,
            country
          ),
          course_tees (
            tee_name,
            tee_color
          )
        `)
        .eq('user_id', profileId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false });

      if (error) throw error;

      setOpenRounds(data || []);
    } catch (err) {
      console.error('Error loading open rounds:', err);
    } finally {
      setLoadingRounds(false);
    }
  }

  async function saveLastUsedProfile(profileId: string) {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem('lastUsedProfileId', profileId);
    } catch (err) {
      console.error('Error saving last used profile:', err);
    }
  }

  function handleProfileSelect(profile: any) {
    setSelectedProfile(profile);
    saveLastUsedProfile(profile.id);
    setShowProfileMenu(false);
    loadOpenRoundsForProfile(profile.id);
  }

  async function deleteRound(roundId: string) {
    Alert.alert(
      'Delete Round',
      'Are you sure you want to delete this round? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('rounds')
                .delete()
                .eq('id', roundId);

              if (error) throw error;

              await loadOpenRounds();
              Alert.alert('Success', 'Round deleted');
            } catch (err) {
              console.error('Error deleting round:', err);
              Alert.alert('Error', 'Failed to delete round');
            }
          },
        },
      ]
    );
  }

  async function resumeRound(round: any) {
    // Get the last hole that was updated
    try {
      const { data: shots, error } = await supabase
        .from('shots')
        .select('hole_number')
        .eq('round_id', round.id)
        .order('hole_number', { ascending: false })
        .limit(1);

      if (error) throw error;

      const lastHole = shots && shots.length > 0 ? shots[0].hole_number : 1;
      
      navigation.navigate('PlayRound', { 
        roundId: round.id,
        initialHole: lastHole 
      });
    } catch (err) {
      console.error('Error resuming round:', err);
      navigation.navigate('PlayRound', { roundId: round.id });
    }
  }

  function startNewRound() {
    if (!selectedProfile) {
      Alert.alert('Profile Required', 'Please select a profile first.');
      setShowProfileMenu(true);
      return;
    }
    navigation.navigate('StartRound');
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Golf Recorder</Text>
        <TouchableOpacity 
          style={styles.menuButton} 
          onPress={() => setShowProfileMenu(true)}
        >
          <View style={styles.hamburger}>
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </View>
        </TouchableOpacity>
      </View>

      {selectedProfile && (
        <TouchableOpacity 
          style={styles.profileBanner} 
          onPress={() => setShowProfileMenu(true)}
        >
          <View>
            <Text style={styles.profileLabel}>Current Profile</Text>
            <Text style={styles.profileName}>{selectedProfile.display_name}</Text>
            {selectedProfile.handicap_index != null && (
              <Text style={styles.profileHandicap}>HCP: {selectedProfile.handicap_index}</Text>
            )}
          </View>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Open Rounds</Text>
          {loadingRounds && <ActivityIndicator size="small" color="#666" />}
        </View>

        {openRounds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No open rounds</Text>
            <Text style={styles.emptyStateSubtext}>Start a new round to get started</Text>
          </View>
        ) : (
          <FlatList
            data={openRounds}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.roundCard}>
                <View style={styles.roundInfo}>
                  <Text style={styles.roundCourseName}>
                    {item.courses?.name || 'Unknown Course'}
                  </Text>
                  {item.courses && (
                    <Text style={styles.roundLocation}>
                      {[item.courses.city, item.courses.region, item.courses.country]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  )}
                  {item.course_tees && (
                    <Text style={styles.roundTee}>
                      {item.course_tees.tee_name}
                      {item.course_tees.tee_color && ` • ${item.course_tees.tee_color}`}
                    </Text>
                  )}
                  <Text style={styles.roundDate}>
                    Started: {new Date(item.started_at).toLocaleDateString()} at{' '}
                    {new Date(item.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {item.holes_played > 0 && (
                    <Text style={styles.roundProgress}>
                      Holes played: {item.holes_played}
                    </Text>
                  )}
                </View>
                
                <View style={styles.roundActions}>
                  <TouchableOpacity
                    style={styles.resumeButton}
                    onPress={() => resumeRound(item)}
                  >
                    <Text style={styles.resumeButtonText}>Resume</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteRound(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.startRoundButton}
          onPress={startNewRound}
        >
          <Text style={styles.startRoundButtonText}>+ Start New Round</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Menu Modal */}
      <Modal
        visible={showProfileMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Menu</Text>
              <TouchableOpacity onPress={() => setShowProfileMenu(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.menuSectionTitle}>Select Profile</Text>
            {profiles.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                style={[
                  styles.profileMenuItem,
                  selectedProfile?.id === profile.id && styles.profileMenuItemSelected
                ]}
                onPress={() => handleProfileSelect(profile)}
              >
                <View>
                  <Text style={styles.profileMenuItemName}>{profile.display_name}</Text>
                  {profile.handicap_index != null && (
                    <Text style={styles.profileMenuItemHandicap}>Handicap: {profile.handicap_index}</Text>
                  )}
                </View>
                {selectedProfile?.id === profile.id && (
                  <Text style={styles.selectedCheckmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => {
                setShowProfileMenu(false);
                navigation.navigate('Profile');
              }}
            >
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  menuButton: {
    padding: 8,
  },
  hamburger: {
    width: 24,
    gap: 4,
  },
  hamburgerLine: {
    height: 3,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  profileBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#e8f5e9',
    borderBottomWidth: 1,
    borderBottomColor: '#4caf50',
  },
  profileLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  profileHandicap: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  changeText: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
  },
  section: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  roundCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  roundInfo: {
    marginBottom: 12,
  },
  roundCourseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  roundLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  roundTee: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  roundDate: {
    fontSize: 13,
    color: '#999',
    marginBottom: 2,
  },
  roundProgress: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  roundActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  startRoundButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startRoundButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
  },
  menuSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  profileMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  profileMenuItemSelected: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  profileMenuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  profileMenuItemHandicap: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  selectedCheckmark: {
    fontSize: 24,
    color: '#4caf50',
    fontWeight: '700',
  },
  editProfileButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    marginTop: 12,
  },
  editProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
