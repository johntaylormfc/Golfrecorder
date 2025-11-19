import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { weatherService } from '../services/weather';

export default function StartRoundScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [selectedTeeId, setSelectedTeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [recentCourses, setRecentCourses] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    loadProfiles();
    loadRecentCourses();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Reload profiles when screen comes into focus
      loadProfiles();
      loadRecentCourses();
    }, [])
  );

  async function loadRecentCourses() {
    setLoadingRecent(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Get last 3 unique courses from completed rounds
      const { data, error } = await supabase
        .from('rounds')
        .select('course_id, courses(id, name, city, region, country)')
        .eq('user_id', user.id)
        .not('course_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20); // Get more to ensure 3 unique after filtering

      if (error) throw error;

      // Extract unique courses (limit to 3)
      const uniqueCourses: any[] = [];
      const seenIds = new Set<string>();
      
      for (const round of data || []) {
        if (round.courses && round.course_id && !seenIds.has(round.course_id)) {
          uniqueCourses.push(round.courses);
          seenIds.add(round.course_id);
          if (uniqueCourses.length >= 3) break;
        }
      }

      setRecentCourses(uniqueCourses);
    } catch (err) {
      console.error('Error loading recent courses:', err);
    } finally {
      setLoadingRecent(false);
    }
  }

  async function selectRecentCourse(course: any) {
    setLoadingDetails(true);
    
    try {
      // Get course with tees from database
      const { data: courseWithTees, error } = await supabase
        .from('courses')
        .select('*, course_tees(*)')
        .eq('id', course.id)
        .single();

      if (error) throw error;

      setSelectedCourse(courseWithTees);
      setResults([]); // Clear search results
    } catch (err) {
      console.error('Error loading recent course:', err);
      Alert.alert('Error', 'Failed to load course. Please try again.');
    } finally {
      setLoadingDetails(false);
    }
  }

  async function loadProfiles() {
    setLoadingProfile(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (error) throw error;

      setProfiles(data || []);

      // Smart defaulting logic
      if (data && data.length > 0) {
        // Try to get last used profile from AsyncStorage
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const lastProfileId = await AsyncStorage.getItem('lastUsedProfileId');
        
        if (lastProfileId && data.find((p: any) => p.id === lastProfileId)) {
          // Default to last used profile
          setSelectedProfile(data.find((p: any) => p.id === lastProfileId));
        } else {
          // Default to first (or only) profile
          setSelectedProfile(data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
    } finally {
      setLoadingProfile(false);
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
  }

  async function search() {
    if (!query.trim()) {
      Alert.alert('Search Required', 'Please enter a course name to search.');
      return;
    }
    
    setLoading(true);
    setSelectedCourse(null);
    setSelectedTeeId(null);
    try {
      const data = await api.searchCourses(query);
      console.log('Search results:', data.length, 'courses found');
      setResults(data || []);
    } catch (err) {
      console.error('Search error:', err);
      Alert.alert('Search Error', 'Failed to search courses. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function selectCourse(course: any) {
    setLoadingDetails(true);
    
    try {
      // Get full course details from Golf API
      console.log('Fetching details for course:', course.id);
      const fullCourseData = await api.getCourseDetails(course.id);
      console.log('Loaded course details:', fullCourseData.club_name || fullCourseData.name);
      
      // Save to database and get with tees
      const savedCourse = await api.saveCourseToDatabase(fullCourseData);
      console.log('Course saved to database with', savedCourse.course_tees?.length || 0, 'tees');
      
      setSelectedCourse(savedCourse);
      setResults([]); // Clear search results after selection
    } catch (err) {
      console.error('Error loading course details:', err);
      Alert.alert('Error', 'Failed to load course details. Please try again.');
    } finally {
      setLoadingDetails(false);
    }
  }

  async function startRound() {
    if (!selectedProfile) {
      Alert.alert('Profile Required', 'Please select or create a profile first.');
      setShowProfileMenu(true);
      return;
    }

    if (!selectedCourse || !selectedTeeId) {
      Alert.alert('Missing Selection', 'Please select a course and tee before starting your round.');
      return;
    }
    
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to start a round.');
      return;
    }

    saveLastUsedProfile(selectedProfile.id);
    
    console.log('Starting round - weather collection feature temporarily disabled');
    setLoading(true);
    try {
      // Try to get weather data for the course location
      let weatherData = null;
      try {
        weatherData = await weatherService.getCourseWeather(selectedCourse);
      } catch (weatherError) {
        console.log('Failed to fetch weather:', weatherError);
        // Continue without weather data
      }

      const { data, error } = await supabase
        .from('rounds')
        .insert({
          user_id: user.id,
          course_id: selectedCourse.id,
          tee_id: selectedTeeId,
          started_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('Round started:', data);
      navigation.navigate('PlayRound', { roundId: data.id });
    } catch (err) {
      console.error('Error starting round:', err);
      Alert.alert('Error', 'Failed to start round. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Start a Round</Text>
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

      {loadingProfile ? (
        <View style={styles.profileLoadingContainer}>
          <ActivityIndicator size="small" color="#0066cc" />
          <Text style={styles.profileLoadingText}>Loading profile...</Text>
        </View>
      ) : selectedProfile ? (
        <TouchableOpacity 
          style={styles.selectedProfileBanner} 
          onPress={() => setShowProfileMenu(true)}
        >
          <View>
            <Text style={styles.selectedProfileLabel}>Playing as</Text>
            <Text style={styles.selectedProfileName}>{selectedProfile.display_name}</Text>
            {selectedProfile.handicap_index != null && (
              <Text style={styles.selectedProfileHandicap}>HCP: {selectedProfile.handicap_index}</Text>
            )}
          </View>
          <Text style={styles.changeProfileText}>Change</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={styles.noProfileBanner} 
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.noProfileText}>⚠️ No profile found. Tap to create one.</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.searchBox}>
        <TextInput 
          value={query} 
          onChangeText={setQuery} 
          placeholder="Search course name (e.g., 'Pebble Beach')" 
          style={styles.input}
          onSubmitEditing={search}
        />
        <Button title={loading ? "Searching..." : "Search"} onPress={search} disabled={loading} />
      </View>

      {/* Recent Courses Section */}
      {!selectedCourse && recentCourses.length > 0 && !loading && results.length === 0 && (
        <View style={styles.recentCoursesSection}>
          <Text style={styles.recentCoursesTitle}>Recent Courses</Text>
          {recentCourses.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={styles.recentCourseItem}
              onPress={() => selectRecentCourse(course)}
              disabled={loadingDetails}
            >
              <View>
                <Text style={styles.recentCourseName}>{course.name}</Text>
                <Text style={styles.recentCourseLocation}>
                  {[course.city, course.region, course.country]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
              <Text style={styles.recentCourseArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Searching courses...</Text>
        </View>
      )}

      {!loading && results.length === 0 && query && (
        <Text style={styles.emptyText}>No courses found. Try a different search term.</Text>
      )}

      {!loading && results.length === 0 && !query && !selectedCourse && (
        <Text style={styles.emptyText}>Enter a course name to search</Text>
      )}

      {results.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>Search Results ({results.length})</Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => selectCourse(item)} disabled={loadingDetails}>
                <View style={styles.courseItem}>
                  <Text style={styles.courseName}>{item.club_name || item.name}</Text>
                  {item.course_name && item.course_name !== item.club_name && (
                    <Text style={styles.courseSubname}>{item.course_name}</Text>
                  )}
                  <Text style={styles.courseLocation}>
                    {[item.location?.city || item.city, item.location?.state || item.state_abbr || item.region, item.location?.country || item.country]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
      
      {loadingDetails && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading course details...</Text>
        </View>
      )}
      
      {selectedCourse && !loadingDetails && (
        <View style={styles.selectedCourseSection}>
          <View style={styles.selectedCourseHeader}>
            <Text style={styles.selectedCourseTitle}>Selected Course</Text>
            <TouchableOpacity onPress={() => {
              setSelectedCourse(null);
              setSelectedTeeId(null);
            }}>
              <Text style={styles.changeButton}>Change</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedCourseName}>{selectedCourse.name}</Text>
          <Text style={styles.selectedCourseLocation}>
            {[selectedCourse.city, selectedCourse.region, selectedCourse.country]
              .filter(Boolean)
              .join(', ')}
          </Text>
          
          <View style={styles.teeSection}>
            <Text style={styles.sectionTitle}>Select Tee</Text>
            {(selectedCourse.course_tees ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No tees available for this course</Text>
            ) : (
              (selectedCourse.course_tees ?? []).map((t: any) => (
                <TouchableOpacity key={t.id} onPress={() => setSelectedTeeId(t.id)}>
                  <View style={[
                    styles.teeItem,
                    selectedTeeId === t.id && styles.selectedTee
                  ]}>
                    <View style={styles.teeInfo}>
                      <Text style={styles.teeName}>{t.tee_name}</Text>
                      {t.tee_color && <Text style={styles.teeColor}>• {t.tee_color}</Text>}
                    </View>
                    <View style={styles.teeStats}>
                      {t.rating && <Text style={styles.teeRating}>Rating: {t.rating}</Text>}
                      {t.slope && <Text style={styles.teeSlope}>Slope: {t.slope}</Text>}
                      {t.par_total && <Text style={styles.teePar}>Par: {t.par_total}</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <Button 
          title={loading ? "Starting..." : "Start Round"} 
          onPress={startRound} 
          disabled={!selectedCourse || !selectedTeeId || loading || loadingDetails || !selectedProfile}
        />
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
              <Text style={styles.modalTitle}>Select Profile</Text>
              <TouchableOpacity onPress={() => setShowProfileMenu(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {profiles.length === 0 ? (
              <View style={styles.noProfilesContainer}>
                <Text style={styles.noProfilesText}>No profiles found</Text>
                <Button 
                  title="Create Profile" 
                  onPress={() => {
                    setShowProfileMenu(false);
                    navigation.navigate('Profile');
                  }}
                />
              </View>
            ) : (
              <View>
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
                  style={styles.createProfileButton}
                  onPress={() => {
                    setShowProfileMenu(false);
                    navigation.navigate('Profile');
                  }}
                >
                  <Text style={styles.createProfileButtonText}>+ Add/Edit Profile</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
  profileLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  profileLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  selectedProfileBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    marginBottom: 16,
  },
  selectedProfileLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  selectedProfileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  selectedProfileHandicap: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  changeProfileText: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
  },
  noProfileBanner: {
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
    marginBottom: 16,
  },
  noProfileText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
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
  noProfilesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noProfilesText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
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
  createProfileButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    marginTop: 12,
  },
  createProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  recentCoursesSection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  recentCoursesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  recentCourseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  recentCourseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recentCourseLocation: {
    fontSize: 13,
    color: '#666',
  },
  recentCourseArrow: {
    fontSize: 20,
    color: '#2196f3',
    fontWeight: '600',
  },
  searchBox: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
    fontSize: 14,
  },
  resultsSection: {
    flex: 1,
    marginBottom: 16,
  },
  courseItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  courseSubname: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  courseLocation: {
    fontSize: 14,
    color: '#999',
  },
  selectedCourseSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196f3',
  },
  selectedCourseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedCourseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  changeButton: {
    color: '#2196f3',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCourseName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  selectedCourseLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  teeSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  teeItem: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedTee: {
    backgroundColor: '#c8e6c9',
    borderColor: '#4caf50',
  },
  teeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  teeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  teeColor: {
    fontSize: 14,
    color: '#666',
  },
  teeStats: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  teeRating: {
    fontSize: 13,
    color: '#666',
  },
  teeSlope: {
    fontSize: 13,
    color: '#666',
  },
  teePar: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 16,
  },
});
