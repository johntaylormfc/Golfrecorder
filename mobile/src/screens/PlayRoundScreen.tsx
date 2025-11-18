import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, Alert, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { supabase } from '../services/supabase';
import ShotEntryModal from './ShotEntryModal';

export default function PlayRoundScreen({ route, navigation }: any) {
  const { roundId, initialHole } = route.params;
  const [round, setRound] = useState<any>(null);
  const [roundHoles, setRoundHoles] = useState<any[]>([]);
  const [shots, setShots] = useState<any[]>([]);
  const [holeNumber, setHoleNumber] = useState(initialHole || 1);
  const [modalVisible, setModalVisible] = useState(false);
  const [savingShot, setSavingShot] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [editingShot, setEditingShot] = useState<any | null>(null);
  const [courseTee, setCourseTee] = useState<any | null>(null);
  const [scorecardVisible, setScorecardVisible] = useState(false);

  async function loadRound() {
    const { data: r } = await supabase.from('rounds').select('*').eq('id', roundId).single();
    setRound(r);
    const { data: s } = await supabase.from('shots').select('*').eq('round_id', roundId).order('shot_number');
    setShots(s || []);
    const { data: rh } = await supabase.from('round_holes').select('*').eq('round_id', roundId);
    setRoundHoles(rh || []);
    
    // Load course tee with hole information
    if (r?.tee_id) {
      const { data: tee } = await supabase
        .from('course_tees')
        .select('*')
        .eq('id', r.tee_id)
        .single();
      setCourseTee(tee);
    }
  }

  useEffect(() => {
    loadRound();
  }, []);

  function getHoleYardage(holeNum: number): number | null {
    if (!courseTee?.metadata?.holes) return null;
    const hole = courseTee.metadata.holes.find((h: any) => h.hole_number === holeNum || h.number === holeNum);
    return hole?.yardage || hole?.distance || null;
  }

  function getHolePar(holeNum: number): number | null {
    if (!courseTee?.metadata?.holes) return null;
    const hole = courseTee.metadata.holes.find((h: any) => h.hole_number === holeNum || h.number === holeNum);
    return hole?.par || null;
  }

  function openAddShot() {
    setEditingShot(null);
    setModalVisible(true);
  }

  function openEditShot(shot: any) {
    setEditingShot(shot);
    setModalVisible(true);
  }

  async function onSaveShot(partialShot: any) {
    setSavingShot(true);
    
    try {
      if (editingShot) {
        // Update existing shot
        const { error } = await supabase
          .from('shots')
          .update(partialShot)
          .eq('id', editingShot.id);
        
        if (error) {
          console.error('Error updating shot:', error);
          Alert.alert('Error', 'Failed to update shot');
        }
      } else {
        // Insert new shot
        const shot_num = (shots.filter((s) => s.hole_number === holeNumber).length || 0) + 1;
        const newShot = { round_id: roundId, hole_number: holeNumber, shot_number: shot_num, ...partialShot };
        const { error } = await supabase.from('shots').insert(newShot).select().single();
        
        if (error) {
          console.error('Error inserting shot:', error);
          Alert.alert('Error', 'Failed to save shot');
        }
      }
      
      await loadRound();
      setLastSavedAt(new Date().toISOString());
      
      // If ball was holed, automatically finish hole and advance (only for new shots)
      if (!editingShot && partialShot.holed) {
        await finishHole();
      }
    } finally {
      setSavingShot(false);
      setEditingShot(null);
    }
  }

  async function deleteShot(shotId: string, shotNumber: number) {
    Alert.alert(
      'Delete Shot',
      `Are you sure you want to delete shot #${shotNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('shots').delete().eq('id', shotId);
              if (error) {
                console.error('Failed to delete shot', error);
                Alert.alert('Error', 'Failed to delete shot');
              } else {
                await loadRound();
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to delete shot');
            }
          },
        },
      ]
    );
  }

  async function undoLastShot() {
    const holeShots = shots.filter((s) => s.hole_number === holeNumber);
    if (!holeShots.length) return;
    const last = holeShots.reduce((a, b) => (a.shot_number > b.shot_number ? a : b));
    await deleteShot(last.id, last.shot_number);
  }

  function nextHole() {
    setHoleNumber((h) => Math.min(h + 1, 18));
  }

  function prevHole() {
    setHoleNumber((h) => Math.max(h - 1, 1));
  }

  async function finishHole() {
    if (!round) return;
    try {
      // call DB function to refresh aggregates for this hole
      const { data, error } = await supabase.rpc('refresh_round_hole_aggregates', { p_round_id: roundId, p_hole_number: holeNumber });
      if ((error as any)) {
        console.error('Failed to refresh hole aggregates', error);
      }
      await loadRound();
      // If not last hole, advance, else navigate to summary
      if (holeNumber < 18) {
        setHoleNumber((h) => Math.min(h + 1, 18));
      } else {
        await endRound();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function confirmEndRound() {
    Alert.alert('End round', 'Are you sure you want to end this round?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End round', style: 'destructive', onPress: endRound },
    ]);
  }

  async function endRound() {
    if (!round) return;
    try {
      const { data, error } = await supabase.from('rounds').update({ status: 'completed', finished_at: new Date().toISOString(), holes_played: holeNumber }).eq('id', roundId).select().single();
      if (error) {
        console.error('Failed to end round', error);
      } else {
        await loadRound();
        
        // Auto-generate AI summary in the background
        try {
          const { generateRoundSummary } = await import('../services/api');
          await generateRoundSummary(roundId);
        } catch (summaryError) {
          console.log('AI summary generation failed:', summaryError);
          // Continue navigation even if summary fails
        }
        
        navigation.navigate('RoundSummary', { roundId });
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Hole Navigation Grid */}
      <View style={styles.holeNavigationContainer}>
        <Text style={styles.holeNavigationTitle}>Quick Hole Navigation</Text>
        
        {/* Front 9 */}
        <View style={styles.holeRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((hole) => {
            const holeData = roundHoles.find((rh) => rh.hole_number === hole);
            const isCurrentHole = hole === holeNumber;
            const score = holeData?.gross_score;
            const par = getHolePar(hole) || holeData?.par;
            
            return (
              <TouchableOpacity
                key={hole}
                style={[
                  styles.holeButton,
                  isCurrentHole && styles.currentHoleButton,
                  score != null && styles.completedHoleButton
                ]}
                onPress={() => setHoleNumber(hole)}
              >
                <Text style={[
                  styles.holeButtonNumber,
                  isCurrentHole && styles.currentHoleText
                ]}>
                  {hole}
                </Text>
                <Text style={[
                  styles.holeButtonScore,
                  isCurrentHole && styles.currentHoleText
                ]}>
                  {score ?? '-'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Back 9 */}
        <View style={styles.holeRow}>
          {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((hole) => {
            const holeData = roundHoles.find((rh) => rh.hole_number === hole);
            const isCurrentHole = hole === holeNumber;
            const score = holeData?.gross_score;
            const par = getHolePar(hole) || holeData?.par;
            
            return (
              <TouchableOpacity
                key={hole}
                style={[
                  styles.holeButton,
                  isCurrentHole && styles.currentHoleButton,
                  score != null && styles.completedHoleButton
                ]}
                onPress={() => setHoleNumber(hole)}
              >
                <Text style={[
                  styles.holeButtonNumber,
                  isCurrentHole && styles.currentHoleText
                ]}>
                  {hole}
                </Text>
                <Text style={[
                  styles.holeButtonScore,
                  isCurrentHole && styles.currentHoleText
                ]}>
                  {score ?? '-'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text>Playing round: {round?.id}</Text>
      <Text>Hole: {holeNumber}</Text>
      <View style={{ marginVertical: 10 }}>
        <Text style={{ fontWeight: '700' }}>Hole summary</Text>
        {(() => {
          const h = roundHoles.find((rh) => rh.hole_number === holeNumber);
          if (!h) return <Text>No summary yet</Text>;
          const scoreToPar = (h.gross_score != null && h.par != null) ? (h.gross_score - h.par) : null;
          let badge = null;
          if (scoreToPar != null) {
            if (scoreToPar < 0) badge = { label: `${scoreToPar}`, color: '#2ecc71' }; // birdie etc.
            else if (scoreToPar === 0) badge = { label: 'E', color: '#95a5a6' };
            else badge = { label: `+${scoreToPar}`, color: '#e74c3c' };
          }
          return (
            <View style={{ marginTop: 4 }}>
              <Text>Par: {h.par}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text>Gross Score: {h.gross_score ?? '-'}</Text>
                {badge && (
                  <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: badge.color }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{badge.label}</Text>
                  </View>
                )}
              </View>
              <Text>Putts: {h.putts ?? '-'}</Text>
              <Text>FIR: {h.fir ? 'Yes' : 'No'}</Text>
              <Text>GIR: {h.gir ? 'Yes' : 'No'}</Text>
              <Text>Penalties: {h.penalties ?? 0}</Text>
              <Text>Status: {h.gross_score != null ? 'Complete' : 'In progress'}</Text>
            </View>
          );
        })()}
      </View>

      <FlatList 
        data={shots.filter((s) => s.hole_number === holeNumber)} 
        keyExtractor={(item) => item.id} 
        renderItem={({ item }) => (
          <View style={styles.shotItem}>
            <View style={styles.shotInfo}>
              <Text style={styles.shotNumber}>#{item.shot_number}</Text>
              <View style={styles.shotDetails}>
                <Text style={styles.shotText}>{item.club}</Text>
                <Text style={styles.shotText}>{item.shot_category}</Text>
                <Text style={styles.shotText}>{item.end_lie}</Text>
                <Text style={styles.shotText}>{item.end_distance_to_hole} yds</Text>
                {item.holed && <Text style={styles.holedBadge}>⛳ Holed</Text>}
              </View>
            </View>
            <View style={styles.shotActions}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => openEditShot(item)}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => deleteShot(item.id, item.shot_number)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )} 
      />

      <Button title="Add shot" onPress={openAddShot} />
      <Button title="Undo last shot" onPress={undoLastShot} disabled={shots.filter((s) => s.hole_number === holeNumber).length === 0} />
      <Button title="View Scorecard" onPress={() => setScorecardVisible(true)} />
      <Button title="Prev hole" onPress={prevHole} disabled={holeNumber === 1} />
      <Button title="Next hole" onPress={nextHole} disabled={holeNumber >= 18} />
      <Button title="Finish hole" onPress={finishHole} disabled={shots.filter((s) => s.hole_number === holeNumber).length === 0} />
      <Button title="End round" onPress={confirmEndRound} />

      <ShotEntryModal 
        visible={modalVisible} 
        onClose={() => {
          setModalVisible(false);
          setEditingShot(null);
        }} 
        onSave={onSaveShot} 
        holeNumber={holeNumber} 
        nextShotNumber={(shots.filter((s) => s.hole_number === holeNumber).length || 0) + 1}
        previousShots={shots.filter((s) => s.hole_number === holeNumber)}
        saving={savingShot} 
        lastSavedAt={lastSavedAt}
        editingShot={editingShot}
        holeYardage={getHoleYardage(holeNumber)}
        courseLocation={round?.course_location || null}
      />

      {/* Scorecard Modal */}
      <Modal
        visible={scorecardVisible}
        animationType="slide"
        onRequestClose={() => setScorecardVisible(false)}
      >
        <View style={styles.scorecardContainer}>
          <View style={styles.scorecardHeader}>
            <Text style={styles.scorecardTitle}>Scorecard</Text>
            <TouchableOpacity onPress={() => setScorecardVisible(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal>
            <View>
              {/* Header Row */}
              <View style={styles.scorecardRow}>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.holeCell]}>Hole</Text>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.parCell]}>Par</Text>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.yardageCell]}>Yds</Text>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.scoreCell]}>Score</Text>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.puttsCell]}>Putts</Text>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.firCell]}>FIR</Text>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.girCell]}>GIR</Text>
                <Text style={[styles.scorecardCell, styles.headerCell, styles.penCell]}>Pen</Text>
              </View>

              {/* Front 9 */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((hole) => {
                const holeData = roundHoles.find((rh) => rh.hole_number === hole);
                const par = getHolePar(hole) || holeData?.par;
                const score = holeData?.gross_score;
                const scoreToPar = score != null && par != null ? score - par : null;
                
                return (
                  <TouchableOpacity 
                    key={hole}
                    style={styles.scorecardRow}
                    onPress={() => {
                      setScorecardVisible(false);
                      setHoleNumber(hole);
                    }}
                  >
                    <Text style={[styles.scorecardCell, styles.holeCell]}>{hole}</Text>
                    <Text style={[styles.scorecardCell, styles.parCell]}>{par || '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.yardageCell]}>{getHoleYardage(hole) || '-'}</Text>
                    <Text style={[
                      styles.scorecardCell, 
                      styles.scoreCell,
                      scoreToPar != null && scoreToPar < 0 && styles.underPar,
                      scoreToPar != null && scoreToPar > 0 && styles.overPar,
                    ]}>
                      {score ?? '-'}
                    </Text>
                    <Text style={[styles.scorecardCell, styles.puttsCell]}>{holeData?.putts ?? '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.firCell]}>{holeData?.fir ? '✓' : holeData?.gross_score ? '✗' : '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.girCell]}>{holeData?.gir ? '✓' : holeData?.gross_score ? '✗' : '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.penCell]}>{holeData?.penalties || '-'}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Front 9 Totals */}
              <View style={[styles.scorecardRow, styles.totalRow]}>
                <Text style={[styles.scorecardCell, styles.holeCell, styles.totalCell]}>Out</Text>
                <Text style={[styles.scorecardCell, styles.parCell, styles.totalCell]}>
                  {[1,2,3,4,5,6,7,8,9].reduce((sum, h) => sum + (getHolePar(h) || 0), 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.yardageCell, styles.totalCell]}>
                  {[1,2,3,4,5,6,7,8,9].reduce((sum, h) => sum + (getHoleYardage(h) || 0), 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.scoreCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number <= 9 && rh.gross_score != null)
                    .reduce((sum, rh) => sum + rh.gross_score, 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.puttsCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number <= 9 && rh.putts != null)
                    .reduce((sum, rh) => sum + rh.putts, 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.firCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number <= 9 && rh.fir).length}
                </Text>
                <Text style={[styles.scorecardCell, styles.girCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number <= 9 && rh.gir).length}
                </Text>
                <Text style={[styles.scorecardCell, styles.penCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number <= 9).reduce((sum, rh) => sum + (rh.penalties || 0), 0)}
                </Text>
              </View>

              {/* Back 9 */}
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map((hole) => {
                const holeData = roundHoles.find((rh) => rh.hole_number === hole);
                const par = getHolePar(hole) || holeData?.par;
                const score = holeData?.gross_score;
                const scoreToPar = score != null && par != null ? score - par : null;
                
                return (
                  <TouchableOpacity 
                    key={hole}
                    style={styles.scorecardRow}
                    onPress={() => {
                      setScorecardVisible(false);
                      setHoleNumber(hole);
                    }}
                  >
                    <Text style={[styles.scorecardCell, styles.holeCell]}>{hole}</Text>
                    <Text style={[styles.scorecardCell, styles.parCell]}>{par || '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.yardageCell]}>{getHoleYardage(hole) || '-'}</Text>
                    <Text style={[
                      styles.scorecardCell, 
                      styles.scoreCell,
                      scoreToPar != null && scoreToPar < 0 && styles.underPar,
                      scoreToPar != null && scoreToPar > 0 && styles.overPar,
                    ]}>
                      {score ?? '-'}
                    </Text>
                    <Text style={[styles.scorecardCell, styles.puttsCell]}>{holeData?.putts ?? '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.firCell]}>{holeData?.fir ? '✓' : holeData?.gross_score ? '✗' : '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.girCell]}>{holeData?.gir ? '✓' : holeData?.gross_score ? '✗' : '-'}</Text>
                    <Text style={[styles.scorecardCell, styles.penCell]}>{holeData?.penalties || '-'}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Back 9 Totals */}
              <View style={[styles.scorecardRow, styles.totalRow]}>
                <Text style={[styles.scorecardCell, styles.holeCell, styles.totalCell]}>In</Text>
                <Text style={[styles.scorecardCell, styles.parCell, styles.totalCell]}>
                  {[10,11,12,13,14,15,16,17,18].reduce((sum, h) => sum + (getHolePar(h) || 0), 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.yardageCell, styles.totalCell]}>
                  {[10,11,12,13,14,15,16,17,18].reduce((sum, h) => sum + (getHoleYardage(h) || 0), 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.scoreCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number > 9 && rh.gross_score != null)
                    .reduce((sum, rh) => sum + rh.gross_score, 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.puttsCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number > 9 && rh.putts != null)
                    .reduce((sum, rh) => sum + rh.putts, 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.firCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number > 9 && rh.fir).length}
                </Text>
                <Text style={[styles.scorecardCell, styles.girCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number > 9 && rh.gir).length}
                </Text>
                <Text style={[styles.scorecardCell, styles.penCell, styles.totalCell]}>
                  {roundHoles.filter(rh => rh.hole_number > 9).reduce((sum, rh) => sum + (rh.penalties || 0), 0)}
                </Text>
              </View>

              {/* Total Row */}
              <View style={[styles.scorecardRow, styles.totalRow, styles.grandTotalRow]}>
                <Text style={[styles.scorecardCell, styles.holeCell, styles.totalCell, styles.grandTotal]}>Total</Text>
                <Text style={[styles.scorecardCell, styles.parCell, styles.totalCell, styles.grandTotal]}>
                  {[...Array(18)].reduce((sum, _, i) => sum + (getHolePar(i + 1) || 0), 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.yardageCell, styles.totalCell, styles.grandTotal]}>
                  {[...Array(18)].reduce((sum, _, i) => sum + (getHoleYardage(i + 1) || 0), 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.scoreCell, styles.totalCell, styles.grandTotal]}>
                  {roundHoles.filter(rh => rh.gross_score != null).reduce((sum, rh) => sum + rh.gross_score, 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.puttsCell, styles.totalCell, styles.grandTotal]}>
                  {roundHoles.filter(rh => rh.putts != null).reduce((sum, rh) => sum + rh.putts, 0) || '-'}
                </Text>
                <Text style={[styles.scorecardCell, styles.firCell, styles.totalCell, styles.grandTotal]}>
                  {roundHoles.filter(rh => rh.fir).length}
                </Text>
                <Text style={[styles.scorecardCell, styles.girCell, styles.totalCell, styles.grandTotal]}>
                  {roundHoles.filter(rh => rh.gir).length}
                </Text>
                <Text style={[styles.scorecardCell, styles.penCell, styles.totalCell, styles.grandTotal]}>
                  {roundHoles.reduce((sum, rh) => sum + (rh.penalties || 0), 0)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  holeNavigationContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  holeNavigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  holeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  holeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    minWidth: 38,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  currentHoleButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  completedHoleButton: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  holeButtonNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
    lineHeight: 14,
  },
  holeButtonScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    lineHeight: 16,
  },
  currentHoleText: {
    color: '#fff',
  },
  shotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  shotInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shotNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginRight: 12,
    minWidth: 30,
  },
  shotDetails: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shotText: {
    fontSize: 14,
    color: '#333',
  },
  holedBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4caf50',
  },
  shotActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  deleteButtonText: {
    color: '#dc3545',
    fontSize: 13,
    fontWeight: '600',
  },
  scorecardContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scorecardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scorecardTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  scorecardRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scorecardCell: {
    padding: 12,
    textAlign: 'center',
    fontSize: 14,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  headerCell: {
    backgroundColor: '#f5f5f5',
    fontWeight: '700',
  },
  holeCell: {
    width: 50,
  },
  parCell: {
    width: 50,
  },
  yardageCell: {
    width: 60,
  },
  scoreCell: {
    width: 60,
    fontWeight: '600',
  },
  puttsCell: {
    width: 60,
  },
  firCell: {
    width: 50,
  },
  girCell: {
    width: 50,
  },
  penCell: {
    width: 50,
  },
  totalRow: {
    backgroundColor: '#f8f9fa',
  },
  totalCell: {
    fontWeight: '700',
  },
  grandTotalRow: {
    backgroundColor: '#e8f5e9',
  },
  grandTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2e7d32',
  },
  underPar: {
    color: '#2ecc71',
    fontWeight: '700',
  },
  overPar: {
    color: '#e74c3c',
    fontWeight: '700',
  },
});
