import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, Switch, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Shot } from '../types';
import { getUserClubs } from '../services/api';
import { weatherService, type WeatherData } from '../services/weather';
import VoiceInputModal from '../components/VoiceInputModal';
import ClubSuggestions from '../components/ClubSuggestions';
import CourseManagementCoach from '../components/CourseManagementCoach';
import { VoiceInputResult } from '../services/voiceInput';
import { SuggestionContext } from '../services/clubSuggestion';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (shot: Partial<Shot>) => void;
  saving?: boolean;
  lastSavedAt?: string | null;
  holeNumber: number;
  nextShotNumber: number;
  previousShots?: any[];
  editingShot?: any | null;
  holeYardage?: number | null;
  courseLocation?: { latitude: number; longitude: number } | null;
}

type ShotCategory = 'tee' | 'approach' | 'around_green' | 'putt';
type LieType = 'Tee box' | 'Fairway' | 'First cut' | 'Light rough' | 'Heavy rough' | 'Fairway bunker' | 'Greenside bunker' | 'Fringe' | 'Green' | 'Recovery';
type ResultZone = 'Good' | 'Acceptable' | 'Poor' | 'OB' | 'Hazard' | 'Lost Ball';
type ContactQuality = 'Pure' | 'Slightly thin' | 'Slightly fat' | 'Heavy' | 'Topped' | 'Shank';
type ShotShape = 'Straight' | 'Intended draw' | 'Intended fade' | 'Push' | 'Pull' | 'Hook' | 'Slice';
type Trajectory = 'Low' | 'Normal' | 'High';
type DistanceError = 'Very short' | 'Slightly short' | 'On distance' | 'Slightly long' | 'Very long';
type LateralError = 'Far left' | 'Left' | 'On line' | 'Right' | 'Far right';
type DecisionQuality = 'Good' | 'Aggressive but OK' | 'Poor';
type MentalTag = 'Calm' | 'Rushed' | 'Distracted' | 'Nervous' | 'Other';
type PuttBreak = 'Left-to-right' | 'Right-to-left' | 'Straight';
type PuttSlope = 'Uphill' | 'Downhill' | 'Flat';
type PuttMissSide = 'Short' | 'Long' | 'Low side' | 'High side';
type GreenSurface = 'Normal' | 'Smooth' | 'Bumpy' | 'Very fast' | 'Very slow';
type WindStrength = 'Calm' | 'Light' | 'Moderate' | 'Strong';
type WindDirection = 'Into' | 'Down' | 'Cross-left' | 'Cross-right' | 'Variable';
type LieSeverity = 'Perfect' | 'OK' | 'Poor';

export function ShotEntryModal({ visible, onClose, onSave, holeNumber, nextShotNumber, previousShots = [], saving = false, lastSavedAt = null, editingShot = null, holeYardage = null, courseLocation = null }: Props) {
  // User's clubs from profile
  const [userClubs, setUserClubs] = useState<string[]>([]);
  
  // Get smart defaults based on shot number and previous shots
  const getSmartDefaults = () => {
    const previousShot = previousShots.length > 0 ? previousShots[previousShots.length - 1] : null;
    
    // First shot defaults
    if (nextShotNumber === 1) {
      return {
        category: 'tee' as ShotCategory,
        startLie: 'Tee box' as LieType,
        club: 'Driver',
        endLie: 'Fairway' as LieType,
        startDistance: holeYardage || 150, // Use hole yardage from API if available
      };
    }
    
    // If previous shot was a putt, default to putt
    if (previousShot?.shot_category === 'putt') {
      return {
        category: 'putt' as ShotCategory,
        startLie: previousShot.end_lie || 'Green' as LieType,
        club: 'Putter',
        endLie: 'Green' as LieType,
      };
    }
    
    // Second shot defaults to approach
    if (nextShotNumber === 2) {
      return {
        category: 'approach' as ShotCategory,
        startLie: previousShot?.end_lie || 'Fairway' as LieType,
        club: '7 Iron',
        endLie: 'Green' as LieType,
      };
    }
    
    // Otherwise, start lie = previous end lie, category = approach
    return {
      category: 'approach' as ShotCategory,
      startLie: previousShot?.end_lie || 'Fairway' as LieType,
      club: '7 Iron',
      endLie: 'Green' as LieType,
    };
  };
  
  const defaults = getSmartDefaults();
  
  // Core fields
  const [category, setCategory] = useState<ShotCategory>(defaults.category);
  const [startLie, setStartLie] = useState<LieType>(defaults.startLie);
  const [club, setClub] = useState(defaults.club);
  const [startDistance, setStartDistance] = useState(150);
  const [endLie, setEndLie] = useState<LieType>(defaults.endLie);
  const [endDistance, setEndDistance] = useState(10);
  const [resultZone, setResultZone] = useState<ResultZone>('Good');
  const [hasPenalty, setHasPenalty] = useState(false);
  const [penaltyStrokes, setPenaltyStrokes] = useState(1);
  const [penaltyType, setPenaltyType] = useState('OB');
  const [holed, setHoled] = useState(false);
  
  // Advanced fields
  const [contactQuality, setContactQuality] = useState<ContactQuality | null>(null);
  const [shotShape, setShotShape] = useState<ShotShape | null>(null);
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [distanceError, setDistanceError] = useState<DistanceError | null>(null);
  const [lateralError, setLateralError] = useState<LateralError | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [decisionQuality, setDecisionQuality] = useState<DecisionQuality | null>(null);
  const [mentalTag, setMentalTag] = useState<MentalTag | null>(null);
  
  // Putting details
  const [puttBreak, setPuttBreak] = useState<PuttBreak | null>(null);
  const [puttSlope, setPuttSlope] = useState<PuttSlope | null>(null);
  const [puttMissSide, setPuttMissSide] = useState<PuttMissSide | null>(null);
  const [greenSurface, setGreenSurface] = useState<GreenSurface | null>(null);
  
  // Conditions
  const [lieSeverity, setLieSeverity] = useState<LieSeverity | null>(null);
  
  // Weather data
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Voice input
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  
  // Course management coach
  const [showCourseCoach, setShowCourseCoach] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUserClubs();
      
      if (editingShot) {
        // Populate form with existing shot data
        setCategory(editingShot.shot_category || 'approach');
        setStartLie(editingShot.start_lie || 'Fairway');
        setClub(editingShot.club || 'Driver');
        setStartDistance(editingShot.start_distance_to_hole || 150);
        setEndLie(editingShot.end_lie || 'Green');
        setEndDistance(editingShot.end_distance_to_hole || 0);
        setResultZone(editingShot.result_zone || 'Good');
        setHasPenalty(editingShot.penalty_strokes != null && editingShot.penalty_strokes > 0);
        setPenaltyStrokes(editingShot.penalty_strokes || 1);
        setPenaltyType(editingShot.penalty_type || 'OB');
        setHoled(editingShot.holed || false);
        
        // Advanced fields
        setContactQuality(editingShot.contact_quality || null);
        setShotShape(editingShot.shot_shape || null);
        setTrajectory(editingShot.trajectory || null);
        setDistanceError(editingShot.distance_error || null);
        setLateralError(editingShot.lateral_error || null);
        setDifficultyRating(editingShot.difficulty_rating || null);
        setDecisionQuality(editingShot.decision_quality || null);
        setMentalTag(editingShot.mental_tag || null);
        
        // Putting details
        setPuttBreak(editingShot.putt_break || null);
        setPuttSlope(editingShot.putt_slope || null);
        setPuttMissSide(editingShot.putt_miss_side || null);
        setGreenSurface(editingShot.green_surface || null);
        
        // Conditions
        setLieSeverity(editingShot.lie_severity || null);
      } else {
        // Reset to smart defaults when modal opens for new shot
        const defaults = getSmartDefaults();
        setCategory(defaults.category);
        setStartLie(defaults.startLie);
        setClub(defaults.club);
        setEndLie(defaults.endLie);
        setHoled(false);
        
        // Set start distance based on previous shot's end distance
        const previousShot = previousShots.length > 0 ? previousShots[previousShots.length - 1] : null;
        if (previousShot?.end_distance_to_hole != null) {
          setStartDistance(previousShot.end_distance_to_hole);
        } else {
          setStartDistance(150);
        }
      }
    }
  }, [visible, previousShots, editingShot]);

  // Auto-adjust fields when category changes to/from putt
  useEffect(() => {
    if (category === 'putt') {
      setStartLie('Green');
      setEndLie('Green');
      setClub('Putter');
      // Clear non-putt specific fields
      setContactQuality(null);
      setShotShape(null);
      setTrajectory(null);
      setDistanceError(null);
      setLateralError(null);
      setDecisionQuality(null);
    }
    // Tee shots always have perfect lie
    if (category === 'tee') {
      setLieSeverity('Perfect');
    }
  }, [category]);

  // Load weather data when modal opens
  useEffect(() => {
    if (visible && !weatherData && courseLocation) {
      loadWeatherData();
    }
  }, [visible, courseLocation]);

  async function loadWeatherData() {
    setWeatherLoading(true);
    try {
      const weather = await weatherService.getCourseWeather(courseLocation);
      setWeatherData(weather);
    } catch (error) {
      console.error('Failed to load weather data:', error);
      // Use demo data as fallback
      const demoWeather = await weatherService.getCurrentWeather(courseLocation?.latitude || 40.7128, courseLocation?.longitude || -74.0060);
      setWeatherData(demoWeather);
    } finally {
      setWeatherLoading(false);
    }
  }

  async function refreshWeatherData() {
    if (courseLocation) {
      await loadWeatherData();
    }
  }

  async function loadUserClubs() {
    const clubs = await getUserClubs();
    setUserClubs(clubs.length > 0 ? clubs : ['Driver', '7 Iron', 'Pitching Wedge', 'Putter']);
  }

  function handleVoiceResult(result: VoiceInputResult) {
    // Map voice recognition results to form fields
    const { parsedData } = result;
    
    // Set club if recognized
    if (parsedData.club) {
      setClub(parsedData.club);
    }
    
    // Set distances
    if (parsedData.distance) {
      if (parsedData.distanceUnit === 'feet') {
        // Likely a putt - set end distance in feet
        setEndDistance(parsedData.distance);
        if (parsedData.distance > 3) {
          // Long putt, probably start distance
          setStartDistance(Math.round(parsedData.distance / 3)); // Convert feet to approximate yards for display
        }
      } else {
        // Yards - set as start distance
        setStartDistance(parsedData.distance);
      }
    }
    
    // Set shot shape if recognized
    if (parsedData.shotShape) {
      const shapeMapping: { [key: string]: ShotShape } = {
        'draw': 'Intended draw',
        'fade': 'Intended fade',
        'straight': 'Straight',
        'hook': 'Hook',
        'slice': 'Slice',
        'pull': 'Pull',
        'push': 'Push'
      };
      const mappedShape = shapeMapping[parsedData.shotShape];
      if (mappedShape) {
        setShotShape(mappedShape);
      }
    }
    
    // Set trajectory
    if (parsedData.trajectory) {
      const trajectoryMapping: { [key: string]: Trajectory } = {
        'low': 'Low',
        'normal': 'Normal',
        'high': 'High'
      };
      const mappedTrajectory = trajectoryMapping[parsedData.trajectory];
      if (mappedTrajectory) {
        setTrajectory(mappedTrajectory);
      }
    }
    
    // Set result zone
    if (parsedData.result) {
      const resultMapping: { [key: string]: ResultZone } = {
        'good': 'Good',
        'acceptable': 'Acceptable',
        'poor': 'Poor',
        'ob': 'OB',
        'hazard': 'Hazard',
        'lost': 'Lost Ball'
      };
      const mappedResult = resultMapping[parsedData.result];
      if (mappedResult) {
        setResultZone(mappedResult);
        
        // Auto-set penalties for certain results
        if (mappedResult === 'OB' || mappedResult === 'Lost Ball') {
          setHasPenalty(true);
          setPenaltyStrokes(2);
          setPenaltyType('Stroke and Distance');
        } else if (mappedResult === 'Hazard') {
          setHasPenalty(true);
          setPenaltyStrokes(1);
          setPenaltyType('Hazard');
        }
      }
    }
    
    // Set lie information
    if (parsedData.lie) {
      const lieMapping: { [key: string]: LieType } = {
        'tee': 'Tee box',
        'fairway': 'Fairway',
        'rough': 'Light rough',
        'bunker': 'Fairway bunker',
        'green': 'Green'
      };
      const mappedLie = lieMapping[parsedData.lie];
      if (mappedLie) {
        // Set as start lie for new shots, or end lie if it makes more sense
        if (nextShotNumber === 1) {
          setStartLie(mappedLie);
        } else {
          setEndLie(mappedLie);
        }
      }
    }
    
    // Set category based on club
    if (parsedData.club) {
      const club = parsedData.club.toLowerCase();
      if (club.includes('putter')) {
        setCategory('putt');
      } else if (nextShotNumber === 1 || club.includes('driver')) {
        setCategory('tee');
      } else if (club.includes('wedge') || endDistance < 30) {
        setCategory('around_green');
      } else {
        setCategory('approach');
      }
    }
  }

  function saveShot() {
    const shotData: Partial<Shot> = {
      shot_category: category,
      start_lie: startLie,
      club,
      start_distance_to_hole: startDistance,
      end_lie: endLie,
      end_distance_to_hole: endDistance,
      result_zone: resultZone,
      penalty_strokes: hasPenalty ? penaltyStrokes : null,
      penalty_type: hasPenalty ? penaltyType : null,
      holed,
    };
    
    // Only include hole_number and shot_number for new shots
    if (!editingShot) {
      shotData.hole_number = holeNumber;
      shotData.shot_number = nextShotNumber;
    }

    // Add advanced fields if set
    if (contactQuality) shotData.contact_quality = contactQuality;
    if (shotShape) shotData.shot_shape = shotShape;
    if (trajectory) shotData.trajectory = trajectory;
    if (distanceError) shotData.distance_error = distanceError;
    if (lateralError) shotData.lateral_error = lateralError;
    if (difficultyRating) shotData.difficulty_rating = difficultyRating;
    if (decisionQuality) shotData.decision_quality = decisionQuality;
    if (mentalTag) shotData.mental_tag = mentalTag;
    
    // Putting details
    if (category === 'putt') {
      if (puttBreak) shotData.putt_break = puttBreak;
      if (puttSlope) shotData.putt_slope = puttSlope;
      if (puttMissSide && !holed) shotData.putt_miss_side = puttMissSide;
      if (greenSurface) shotData.green_surface = greenSurface;
    }
    
    // Conditions
    if (lieSeverity) shotData.lie_severity = lieSeverity;

    onSave(shotData);
    // Don't close immediately - let parent handle it after processing
    // This allows parent to check if holed and auto-advance hole
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide">
      <ScrollView style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {editingShot ? `Edit Shot #${editingShot.shot_number} — Hole ${holeNumber}` : `Shot ${nextShotNumber} — Hole ${holeNumber}`}
          </Text>
          
          <View style={styles.headerButtons}>
            {/* Course Coach Button */}
            <TouchableOpacity 
              style={styles.coachButton}
              onPress={() => setShowCourseCoach(true)}
            >
              <Text style={styles.coachButtonIcon}>🧠</Text>
            </TouchableOpacity>
            
            {/* Voice Input Button */}
            <TouchableOpacity 
              style={styles.voiceButton}
              onPress={() => setShowVoiceModal(true)}
            >
              <Text style={styles.voiceButtonIcon}>🎤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Shot Category */}
        <Text style={styles.label}>Shot Category</Text>
        <View style={styles.buttonRow}>
          {(['tee', 'approach', 'around_green', 'putt'] as ShotCategory[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryButton, category === cat && styles.categoryButtonSelected]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryButtonText, category === cat && styles.categoryButtonTextSelected]}>
                {cat === 'around_green' ? 'Around Green' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Start Lie */}
        <Text style={styles.label}>Start Lie</Text>
        <View style={styles.chipGrid}>
          {category === 'putt' ? (
            // Putts: Only Green or Fringe
            ['Green', 'Fringe'].map((lie) => (
              <TouchableOpacity
                key={lie}
                style={[styles.chip, startLie === lie && styles.chipSelected]}
                onPress={() => setStartLie(lie as LieType)}
              >
                <Text style={[styles.chipText, startLie === lie && styles.chipTextSelected]}>{lie}</Text>
              </TouchableOpacity>
            ))
          ) : (
            // Non-putts: All lie types
            (['Tee box', 'Fairway', 'First cut', 'Light rough', 'Heavy rough', 'Fairway bunker', 'Greenside bunker', 'Fringe', 'Green', 'Recovery'] as LieType[]).map((lie) => (
              <TouchableOpacity
                key={lie}
                style={[styles.chip, startLie === lie && styles.chipSelected]}
                onPress={() => setStartLie(lie)}
              >
                <Text style={[styles.chipText, startLie === lie && styles.chipTextSelected]}>{lie}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Club */}
        {category !== 'putt' && (
          <>
            <Text style={styles.label}>Club</Text>
            
            {/* Smart Club Suggestions */}
            <ClubSuggestions
              context={{
                distanceToPin: startDistance,
                lie: startLie,
                shotCategory: category,
                windConditions: weatherData ? {
                  speed: weatherData.windSpeed,
                  direction: weatherData.windSpeed < 3 ? 'calm' : 
                           weatherData.windDirection >= 315 || weatherData.windDirection < 45 ? 'into' :
                           weatherData.windDirection >= 135 && weatherData.windDirection < 225 ? 'down' : 'cross'
                } : undefined
              } as SuggestionContext}
              onClubSelect={(selectedClub) => setClub(selectedClub)}
              selectedClub={club}
              visible={startDistance > 0}
            />
            
            <View style={styles.chipGrid}>
              {userClubs.map((clubName) => (
                <TouchableOpacity
                  key={clubName}
                  style={[styles.chip, club === clubName && styles.chipSelected]}
                  onPress={() => setClub(clubName)}
                >
                  <Text style={[styles.chipText, club === clubName && styles.chipTextSelected]}>{clubName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Start Distance */}
        <Text style={styles.label}>Start Distance to Hole (yards)</Text>
        <TextInput
          style={styles.input}
          value={String(startDistance)}
          keyboardType="numeric"
          onChangeText={(t) => setStartDistance(Number(t) || 0)}
        />

        {/* End Lie */}
        {category !== 'putt' && (
          <>
            <Text style={styles.label}>End Lie</Text>
            <View style={styles.chipGrid}>
              {(['Fairway', 'First cut', 'Light rough', 'Heavy rough', 'Fairway bunker', 'Greenside bunker', 'Fringe', 'Green', 'Recovery'] as LieType[]).map((lie) => (
                <TouchableOpacity
                  key={lie}
                  style={[styles.chip, endLie === lie && styles.chipSelected]}
                  onPress={() => setEndLie(lie)}
                >
                  <Text style={[styles.chipText, endLie === lie && styles.chipTextSelected]}>{lie}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* End Distance */}
        <Text style={styles.label}>End Distance to Hole ({category === 'putt' ? 'feet' : 'yards'})</Text>
        <TextInput
          style={styles.input}
          value={String(endDistance)}
          keyboardType="numeric"
          onChangeText={(t) => setEndDistance(Number(t) || 0)}
          editable={!holed}
        />

        {/* Result Zone */}
        <Text style={styles.label}>Shot Result</Text>
        <View style={styles.chipGrid}>
          {category === 'putt' ? (
            // Putts: Only Good/Acceptable/Poor
            ['Good', 'Acceptable', 'Poor'].map((zone) => (
              <TouchableOpacity
                key={zone}
                style={[styles.chip, resultZone === zone && styles.chipSelected]}
                onPress={() => setResultZone(zone as ResultZone)}
              >
                <Text style={[styles.chipText, resultZone === zone && styles.chipTextSelected]}>{zone}</Text>
              </TouchableOpacity>
            ))
          ) : (
            // Non-putts: All result options including penalties
            (['Good', 'Acceptable', 'Poor', 'OB', 'Hazard', 'Lost Ball'] as ResultZone[]).map((zone) => (
              <TouchableOpacity
                key={zone}
                style={[styles.chip, resultZone === zone && styles.chipSelected]}
                onPress={() => {
                  setResultZone(zone);
                  // Auto-set penalties for OB/Lost Ball (stroke + distance)
                  if (zone === 'OB' || zone === 'Lost Ball') {
                    setHasPenalty(true);
                    setPenaltyStrokes(2);
                    setPenaltyType('Stroke and Distance');
                  }
                  // Auto-set penalty for Hazard (1 stroke)
                  else if (zone === 'Hazard') {
                    setHasPenalty(true);
                    setPenaltyStrokes(1);
                    setPenaltyType('Hazard');
                  }
                  // Clear penalty for good shots
                  else {
                    setHasPenalty(false);
                  }
                }}
              >
                <Text style={[styles.chipText, resultZone === zone && styles.chipTextSelected]}>{zone}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Penalty */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Penalty on this shot?</Text>
          <Switch value={hasPenalty} onValueChange={setHasPenalty} />
        </View>
        {hasPenalty && (
          <View>
            <Text style={styles.label}>Penalty Strokes</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.categoryButton, penaltyStrokes === 1 && styles.categoryButtonSelected]}
                onPress={() => setPenaltyStrokes(1)}
              >
                <Text style={[styles.categoryButtonText, penaltyStrokes === 1 && styles.categoryButtonTextSelected]}>1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryButton, penaltyStrokes === 2 && styles.categoryButtonSelected]}
                onPress={() => setPenaltyStrokes(2)}
              >
                <Text style={[styles.categoryButtonText, penaltyStrokes === 2 && styles.categoryButtonTextSelected]}>2</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Penalty Type</Text>
            <View style={styles.chipGrid}>
              {(['OB', 'Lost ball', 'Water', 'Unplayable', 'Other']).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, penaltyType === type && styles.chipSelected]}
                  onPress={() => setPenaltyType(type)}
                >
                  <Text style={[styles.chipText, penaltyType === type && styles.chipTextSelected]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Holed */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Ball holed on this shot</Text>
          <Switch value={holed} onValueChange={(value) => {
            setHoled(value);
            if (value) {
              setEndDistance(0);
            }
          }} />
        </View>

        {/* Advanced Section */}
        <View style={styles.advancedSection}>
          {category !== 'putt' && (
            <>
              <Text style={styles.sectionTitle}>Strike & Shape</Text>
            
            <Text style={styles.label}>Contact Quality</Text>
            <View style={styles.chipGrid}>
              {(['Pure', 'Slightly thin', 'Slightly fat', 'Heavy', 'Topped', 'Shank'] as ContactQuality[]).map((quality) => (
                <TouchableOpacity
                  key={quality}
                  style={[styles.chip, contactQuality === quality && styles.chipSelected]}
                  onPress={() => setContactQuality(quality)}
                >
                  <Text style={[styles.chipText, contactQuality === quality && styles.chipTextSelected]}>{quality}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Shot Shape</Text>
            <Text style={styles.sublabel}>Select the ball flight pattern</Text>
            <View style={styles.shotShapeGrid}>
              {/* Top row: Pull, Straight, Push */}
              <View style={styles.shotShapeRow}>
                <TouchableOpacity 
                  style={[styles.shotShapeCell, shotShape === 'Pull' && styles.shotShapeCellSelected]} 
                  onPress={() => setShotShape('Pull')}
                >
                  <Text style={styles.shotShapeIcon}>↖</Text>
                  <Text style={styles.shotShapeLabel}>Pull</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.shotShapeCell, shotShape === 'Straight' && styles.shotShapeCellSelected]} 
                  onPress={() => setShotShape('Straight')}
                >
                  <Text style={styles.shotShapeIcon}>↑</Text>
                  <Text style={styles.shotShapeLabel}>Straight</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.shotShapeCell, shotShape === 'Push' && styles.shotShapeCellSelected]} 
                  onPress={() => setShotShape('Push')}
                >
                  <Text style={styles.shotShapeIcon}>↗</Text>
                  <Text style={styles.shotShapeLabel}>Push</Text>
                </TouchableOpacity>
              </View>
              
              {/* Bottom row: Hook, Draw/Fade, Slice */}
              <View style={styles.shotShapeRow}>
                <TouchableOpacity 
                  style={[styles.shotShapeCell, shotShape === 'Hook' && styles.shotShapeCellSelected]} 
                  onPress={() => setShotShape('Hook')}
                >
                  <Text style={styles.shotShapeIcon}>↰</Text>
                  <Text style={styles.shotShapeLabel}>Hook</Text>
                </TouchableOpacity>
                <View style={styles.shotShapeDualCell}>
                  <TouchableOpacity 
                    style={[styles.shotShapeMini, shotShape === 'Intended draw' && styles.shotShapeCellSelected]} 
                    onPress={() => setShotShape('Intended draw')}
                  >
                    <Text style={styles.shotShapeIconSmall}>↶</Text>
                    <Text style={styles.shotShapeLabelSmall}>Draw</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.shotShapeMini, shotShape === 'Intended fade' && styles.shotShapeCellSelected]} 
                    onPress={() => setShotShape('Intended fade')}
                  >
                    <Text style={styles.shotShapeIconSmall}>↷</Text>
                    <Text style={styles.shotShapeLabelSmall}>Fade</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={[styles.shotShapeCell, shotShape === 'Slice' && styles.shotShapeCellSelected]} 
                  onPress={() => setShotShape('Slice')}
                >
                  <Text style={styles.shotShapeIcon}>↱</Text>
                  <Text style={styles.shotShapeLabel}>Slice</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.label}>Trajectory</Text>
            <Text style={styles.sublabel}>Select the ball flight height</Text>
            <View style={styles.trajectoryRow}>
              <TouchableOpacity 
                style={[styles.trajectoryCell, trajectory === 'Low' && styles.trajectoryCellSelected]} 
                onPress={() => setTrajectory('Low')}
              >
                <Text style={styles.trajectoryArc}>⌒</Text>
                <Text style={styles.trajectoryLabel}>Low</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.trajectoryCell, trajectory === 'Normal' && styles.trajectoryCellSelected]} 
                onPress={() => setTrajectory('Normal')}
              >
                <Text style={styles.trajectoryArc}>⌢</Text>
                <Text style={styles.trajectoryLabel}>Normal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.trajectoryCell, trajectory === 'High' && styles.trajectoryCellSelected]} 
                onPress={() => setTrajectory('High')}
              >
                <Text style={styles.trajectoryArc}>⌣</Text>
                <Text style={styles.trajectoryLabel}>High</Text>
              </TouchableOpacity>
            </View>
            </>
          )}

          {category !== 'putt' && (
            <>
              <Text style={styles.sectionTitle}>Error vs Target</Text>
            <Text style={styles.label}>Tap where the ball went relative to your target</Text>
            
            <View style={styles.targetGrid}>
              {/* Row 1: Very Long */}
              <View style={styles.targetRow}>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very long' && lateralError === 'Far left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very long'); setLateralError('Far left'); }}><Text style={styles.targetCellText}>↖</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very long' && lateralError === 'Left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very long'); setLateralError('Left'); }}><Text style={styles.targetCellText}>↑</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, styles.targetCellCenter, distanceError === 'Very long' && lateralError === 'On line' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very long'); setLateralError('On line'); }}><Text style={styles.targetCellText}>VL</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very long' && lateralError === 'Right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very long'); setLateralError('Right'); }}><Text style={styles.targetCellText}>↑</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very long' && lateralError === 'Far right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very long'); setLateralError('Far right'); }}><Text style={styles.targetCellText}>↗</Text></TouchableOpacity>
              </View>
              
              {/* Row 2: Slightly Long */}
              <View style={styles.targetRow}>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly long' && lateralError === 'Far left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly long'); setLateralError('Far left'); }}><Text style={styles.targetCellText}>←</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly long' && lateralError === 'Left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly long'); setLateralError('Left'); }}><Text style={styles.targetCellText}>↖</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, styles.targetCellCenter, distanceError === 'Slightly long' && lateralError === 'On line' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly long'); setLateralError('On line'); }}><Text style={styles.targetCellText}>SL</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly long' && lateralError === 'Right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly long'); setLateralError('Right'); }}><Text style={styles.targetCellText}>↗</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly long' && lateralError === 'Far right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly long'); setLateralError('Far right'); }}><Text style={styles.targetCellText}>→</Text></TouchableOpacity>
              </View>
              
              {/* Row 3: On Distance (Center) */}
              <View style={styles.targetRow}>
                <TouchableOpacity style={[styles.targetCell, styles.targetCellCenter, distanceError === 'On distance' && lateralError === 'Far left' && styles.targetCellSelected]} onPress={() => { setDistanceError('On distance'); setLateralError('Far left'); }}><Text style={styles.targetCellText}>FL</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'On distance' && lateralError === 'Left' && styles.targetCellSelected]} onPress={() => { setDistanceError('On distance'); setLateralError('Left'); }}><Text style={styles.targetCellText}>←</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, styles.targetCellBullseye, distanceError === 'On distance' && lateralError === 'On line' && styles.targetCellSelected]} onPress={() => { setDistanceError('On distance'); setLateralError('On line'); }}><Text style={[styles.targetCellText, styles.bullseyeText]}>🎯</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'On distance' && lateralError === 'Right' && styles.targetCellSelected]} onPress={() => { setDistanceError('On distance'); setLateralError('Right'); }}><Text style={styles.targetCellText}>→</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, styles.targetCellCenter, distanceError === 'On distance' && lateralError === 'Far right' && styles.targetCellSelected]} onPress={() => { setDistanceError('On distance'); setLateralError('Far right'); }}><Text style={styles.targetCellText}>FR</Text></TouchableOpacity>
              </View>
              
              {/* Row 4: Slightly Short */}
              <View style={styles.targetRow}>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly short' && lateralError === 'Far left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly short'); setLateralError('Far left'); }}><Text style={styles.targetCellText}>←</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly short' && lateralError === 'Left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly short'); setLateralError('Left'); }}><Text style={styles.targetCellText}>↙</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, styles.targetCellCenter, distanceError === 'Slightly short' && lateralError === 'On line' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly short'); setLateralError('On line'); }}><Text style={styles.targetCellText}>SS</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly short' && lateralError === 'Right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly short'); setLateralError('Right'); }}><Text style={styles.targetCellText}>↘</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Slightly short' && lateralError === 'Far right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Slightly short'); setLateralError('Far right'); }}><Text style={styles.targetCellText}>→</Text></TouchableOpacity>
              </View>
              
              {/* Row 5: Very Short */}
              <View style={styles.targetRow}>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very short' && lateralError === 'Far left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very short'); setLateralError('Far left'); }}><Text style={styles.targetCellText}>↙</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very short' && lateralError === 'Left' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very short'); setLateralError('Left'); }}><Text style={styles.targetCellText}>↓</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, styles.targetCellCenter, distanceError === 'Very short' && lateralError === 'On line' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very short'); setLateralError('On line'); }}><Text style={styles.targetCellText}>VS</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very short' && lateralError === 'Right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very short'); setLateralError('Right'); }}><Text style={styles.targetCellText}>↓</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.targetCell, distanceError === 'Very short' && lateralError === 'Far right' && styles.targetCellSelected]} onPress={() => { setDistanceError('Very short'); setLateralError('Far right'); }}><Text style={styles.targetCellText}>↘</Text></TouchableOpacity>
              </View>
            </View>
            </>
          )}

            <Text style={styles.sectionTitle}>Difficulty & Mental State</Text>
            
            <Text style={styles.label}>Difficulty Rating (1-5)</Text>
            <View style={styles.buttonRow}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={[styles.categoryButton, difficultyRating === rating && styles.categoryButtonSelected]}
                  onPress={() => setDifficultyRating(rating)}
                >
                  <Text style={[styles.categoryButtonText, difficultyRating === rating && styles.categoryButtonTextSelected]}>{rating}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {category !== 'putt' && (
              <>
                <Text style={styles.label}>Decision Quality</Text>
                <View style={styles.chipGrid}>
                  {(['Good', 'Aggressive but OK', 'Poor'] as DecisionQuality[]).map((quality) => (
                    <TouchableOpacity
                      key={quality}
                      style={[styles.chip, decisionQuality === quality && styles.chipSelected]}
                      onPress={() => setDecisionQuality(quality)}
                    >
                      <Text style={[styles.chipText, decisionQuality === quality && styles.chipTextSelected]}>{quality}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Mental Tag</Text>
            <View style={styles.chipGrid}>
              {(['Calm', 'Rushed', 'Distracted', 'Nervous', 'Other'] as MentalTag[]).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, mentalTag === tag && styles.chipSelected]}
                  onPress={() => setMentalTag(tag)}
                >
                  <Text style={[styles.chipText, mentalTag === tag && styles.chipTextSelected]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Putting Details - only show for putts */}
            {category === 'putt' && (
              <>
                <Text style={styles.sectionTitle}>Putting Details</Text>
                
                <Text style={styles.label}>Break</Text>
                <View style={styles.chipGrid}>
                  {(['Left-to-right', 'Right-to-left', 'Straight'] as PuttBreak[]).map((brk) => (
                    <TouchableOpacity
                      key={brk}
                      style={[styles.chip, puttBreak === brk && styles.chipSelected]}
                      onPress={() => setPuttBreak(brk)}
                    >
                      <Text style={[styles.chipText, puttBreak === brk && styles.chipTextSelected]}>{brk}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Slope</Text>
                <View style={styles.buttonRow}>
                  {(['Uphill', 'Downhill', 'Flat'] as PuttSlope[]).map((slope) => (
                    <TouchableOpacity
                      key={slope}
                      style={[styles.categoryButton, puttSlope === slope && styles.categoryButtonSelected]}
                      onPress={() => setPuttSlope(slope)}
                    >
                      <Text style={[styles.categoryButtonText, puttSlope === slope && styles.categoryButtonTextSelected]}>{slope}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!holed && (
                  <>
                    <Text style={styles.label}>Miss Side</Text>
                    <View style={styles.chipGrid}>
                      {(['Short', 'Long', 'Low side', 'High side'] as PuttMissSide[]).map((side) => (
                        <TouchableOpacity
                          key={side}
                          style={[styles.chip, puttMissSide === side && styles.chipSelected]}
                          onPress={() => setPuttMissSide(side)}
                        >
                          <Text style={[styles.chipText, puttMissSide === side && styles.chipTextSelected]}>{side}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.label}>Green Surface</Text>
                <View style={styles.chipGrid}>
                  {(['Normal', 'Smooth', 'Bumpy', 'Very fast', 'Very slow'] as GreenSurface[]).map((surface) => (
                    <TouchableOpacity
                      key={surface}
                      style={[styles.chip, greenSurface === surface && styles.chipSelected]}
                      onPress={() => setGreenSurface(surface)}
                    >
                      <Text style={[styles.chipText, greenSurface === surface && styles.chipTextSelected]}>{surface}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Weather Conditions</Text>
            {weatherLoading ? (
              <Text style={styles.loadingText}>Loading weather...</Text>
            ) : weatherData ? (
              <View style={styles.weatherContainer}>
                <View style={styles.weatherRow}>
                  <Text style={styles.weatherLabel}>Temperature:</Text>
                  <Text style={styles.weatherValue}>{weatherData.temperature}°F (feels like {weatherData.feelsLike}°F)</Text>
                </View>
                <View style={styles.weatherRow}>
                  <Text style={styles.weatherLabel}>Conditions:</Text>
                  <Text style={styles.weatherValue}>{weatherData.description}</Text>
                </View>
                <View style={styles.weatherRow}>
                  <Text style={styles.weatherLabel}>Wind:</Text>
                  <Text style={styles.weatherValue}>
                    {weatherData.windSpeed} mph {weatherService.getWindDirection(weatherData.windDirection)}
                    {weatherData.windGust ? ` (gusts ${weatherData.windGust} mph)` : ''}
                  </Text>
                </View>
                <View style={styles.weatherRow}>
                  <Text style={styles.weatherLabel}>Humidity:</Text>
                  <Text style={styles.weatherValue}>{weatherData.humidity}%</Text>
                </View>
                
                {/* Golf Impact Analysis */}
                {(() => {
                  const analysis = weatherService.getGolfConditionsAnalysis(weatherData);
                  return (
                    <View style={styles.weatherAnalysis}>
                      <Text style={[styles.weatherImpact, 
                        analysis.impact === 'excellent' && styles.impactExcellent,
                        analysis.impact === 'good' && styles.impactGood,
                        analysis.impact === 'challenging' && styles.impactChallenging,
                        analysis.impact === 'difficult' && styles.impactDifficult
                      ]}>
                        Conditions: {analysis.impact.charAt(0).toUpperCase() + analysis.impact.slice(1)}
                      </Text>
                      {analysis.recommendations.length > 0 && (
                        <Text style={styles.weatherTip}>
                          💡 {analysis.recommendations[0]}
                        </Text>
                      )}
                    </View>
                  );
                })()}
                
                <TouchableOpacity 
                  style={styles.refreshWeatherButton} 
                  onPress={refreshWeatherData}
                  disabled={weatherLoading}
                >
                  <Text style={styles.refreshWeatherText}>🔄 Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.weatherContainer}>
                <Text style={styles.weatherUnavailable}>Weather data unavailable</Text>
                <TouchableOpacity style={styles.refreshWeatherButton} onPress={refreshWeatherData}>
                  <Text style={styles.refreshWeatherText}>🔄 Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.sectionTitle}>Shot Conditions</Text>
            
            {category !== 'tee' && (
              <>
                <Text style={styles.label}>Lie Severity</Text>
                <View style={styles.buttonRow}>
                  {(['Perfect', 'OK', 'Poor'] as LieSeverity[]).map((severity) => (
                    <TouchableOpacity
                      key={severity}
                      style={[styles.categoryButton, lieSeverity === severity && styles.categoryButtonSelected]}
                      onPress={() => setLieSeverity(severity)}
                    >
                      <Text style={[styles.categoryButtonText, lieSeverity === severity && styles.categoryButtonTextSelected]}>{severity}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.saveButton} onPress={saveShot} disabled={saving}>
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : (editingShot ? 'Update Shot' : 'Save Shot')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        {lastSavedAt && (
          <Text style={styles.savedText}>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</Text>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
      
      {/* Voice Input Modal */}
      <VoiceInputModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onResult={handleVoiceResult}
      />
      
      {/* Course Management Coach */}
      <CourseManagementCoach
        isVisible={showCourseCoach}
        shotContext={{
          category: category,
          club: club,
          lie: startLie,
          distanceToPin: startDistance,
          holeNumber: holeNumber,
          shotNumber: nextShotNumber,
          roundScore: undefined, // Could be passed from parent if available
          parValue: 4, // Could be passed from parent if available
          weather: weatherData ? {
            windSpeed: weatherData.windSpeed,
            windDirection: weatherData.windDirection.toString(),
            temperature: weatherData.temperature,
            conditions: weatherData.description || 'normal'
          } : undefined,
          previousShots: previousShots?.map(shot => ({
            result: shot.result_zone || 'Acceptable',
            category: shot.shot_category || 'approach',
            club: shot.club || ''
          }))
        }}
        onStrategySelected={(strategy) => {
          // Could update UI based on selected strategy
          console.log('Strategy selected:', strategy);
          setShowCourseCoach(false);
        }}
      />
      
      {/* Overlay to close coach when clicking outside */}
      {showCourseCoach && (
        <TouchableOpacity 
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowCourseCoach(false)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  coachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  coachButtonIcon: {
    fontSize: 20,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  voiceButtonIcon: {
    fontSize: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    color: '#000',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 13,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  advancedButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  advancedButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  targetGrid: {
    alignSelf: 'center',
    gap: 4,
    marginVertical: 8,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 4,
  },
  targetCell: {
    width: 60,
    height: 60,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCellCenter: {
    backgroundColor: '#e8f4f8',
    borderColor: '#007AFF',
  },
  targetCellBullseye: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  targetCellSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#005bb5',
  },
  targetCellText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  bullseyeText: {
    fontSize: 24,
  },
  shotShapeGrid: {
    alignSelf: 'center',
    gap: 8,
    marginVertical: 8,
  },
  shotShapeRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  shotShapeCell: {
    width: 100,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  shotShapeDualCell: {
    width: 100,
    height: 80,
    flexDirection: 'column',
    gap: 4,
  },
  shotShapeMini: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotShapeCellSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#005bb5',
  },
  shotShapeIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  shotShapeIconSmall: {
    fontSize: 20,
    marginBottom: 2,
  },
  shotShapeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  shotShapeLabelSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  sublabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  trajectoryRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginVertical: 8,
  },
  trajectoryCell: {
    width: 100,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  trajectoryCellSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#005bb5',
  },
  trajectoryArc: {
    fontSize: 40,
    marginBottom: 4,
    color: '#333',
  },
  trajectoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  advancedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  savedText: {
    marginTop: 12,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  
  // Weather styles
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  weatherContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weatherLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  weatherValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  weatherAnalysis: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  weatherImpact: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  impactExcellent: {
    color: '#28a745',
  },
  impactGood: {
    color: '#6f42c1',
  },
  impactChallenging: {
    color: '#fd7e14',
  },
  impactDifficult: {
    color: '#dc3545',
  },
  weatherTip: {
    fontSize: 12,
    color: '#495057',
    fontStyle: 'italic',
  },
  refreshWeatherButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 6,
    alignItems: 'center',
  },
  refreshWeatherText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  weatherUnavailable: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ShotEntryModal;
