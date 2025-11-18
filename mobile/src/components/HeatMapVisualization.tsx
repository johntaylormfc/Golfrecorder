import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { HeatMapPoint } from '../services/shotAnalytics';

interface Props {
  data: HeatMapPoint[];
  title?: string;
  width?: number;
  height?: number;
}

const HeatMapVisualization: React.FC<Props> = ({ 
  data, 
  title = "Shot Pattern Heat Map",
  width = Dimensions.get('window').width - 40,
  height = 200
}) => {
  // Group points by proximity for better visualization
  const gridSize = 10; // 10x10 grid
  const heatGrid = createHeatGrid(data, gridSize);

  function createHeatGrid(points: HeatMapPoint[], size: number): number[][] {
    const grid: number[][] = Array(size).fill(null).map(() => Array(size).fill(0));
    
    points.forEach(point => {
      // Convert x,y coordinates (-100 to 100) to grid indices (0 to size-1)
      const gridX = Math.max(0, Math.min(size - 1, Math.floor(((point.x + 100) / 200) * size)));
      const gridY = Math.max(0, Math.min(size - 1, Math.floor(((100 - point.y) / 100) * size))); // Flip Y for display
      
      grid[gridY][gridX]++;
    });
    
    return grid;
  }

  function getHeatColor(intensity: number, maxIntensity: number): string {
    if (intensity === 0) return 'transparent';
    
    const ratio = intensity / maxIntensity;
    
    if (ratio < 0.2) return 'rgba(66, 165, 245, 0.3)'; // Light blue
    if (ratio < 0.4) return 'rgba(66, 165, 245, 0.5)'; // Medium blue  
    if (ratio < 0.6) return 'rgba(255, 193, 7, 0.6)';  // Yellow
    if (ratio < 0.8) return 'rgba(255, 152, 0, 0.7)';  // Orange
    return 'rgba(244, 67, 54, 0.8)';                   // Red
  }

  const maxIntensity = Math.max(...heatGrid.flat());
  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Fewer shots</Text>
        <View style={styles.legendGradient}>
          <View style={[styles.legendColor, { backgroundColor: 'rgba(66, 165, 245, 0.3)' }]} />
          <View style={[styles.legendColor, { backgroundColor: 'rgba(66, 165, 245, 0.5)' }]} />
          <View style={[styles.legendColor, { backgroundColor: 'rgba(255, 193, 7, 0.6)' }]} />
          <View style={[styles.legendColor, { backgroundColor: 'rgba(255, 152, 0, 0.7)' }]} />
          <View style={[styles.legendColor, { backgroundColor: 'rgba(244, 67, 54, 0.8)' }]} />
        </View>
        <Text style={styles.legendLabel}>More shots</Text>
      </View>

      {/* Heat Map */}
      <View style={[styles.heatMap, { width, height }]}>
        {/* Course outline */}
        <View style={[styles.courseOutline, { width, height }]}>
          {/* Target/Pin indicator */}
          <View style={[styles.target, { 
            left: width / 2 - 5, 
            top: height - 15
          }]} />
          
          {/* Tee area indicator */}
          <View style={[styles.teeArea, { 
            left: width / 2 - 15, 
            top: 5
          }]} />
        </View>

        {/* Heat map cells */}
        {heatGrid.map((row, rowIndex) => 
          row.map((intensity, colIndex) => (
            <View
              key={`${rowIndex}-${colIndex}`}
              style={[
                styles.heatCell,
                {
                  left: colIndex * cellWidth,
                  top: rowIndex * cellHeight,
                  width: cellWidth,
                  height: cellHeight,
                  backgroundColor: getHeatColor(intensity, maxIntensity)
                }
              ]}
            />
          ))
        )}
      </View>

      {/* Axis labels */}
      <View style={styles.axisLabels}>
        <View style={styles.horizontalAxis}>
          <Text style={styles.axisLabel}>Left</Text>
          <Text style={styles.axisLabel}>Center</Text>
          <Text style={styles.axisLabel}>Right</Text>
        </View>
      </View>

      {/* Stats summary */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.length}</Text>
          <Text style={styles.statLabel}>Total Shots</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {Math.round(data.filter(p => p.result === 'Good').length / data.length * 100)}%
          </Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {new Set(data.map(p => p.category)).size}
          </Text>
          <Text style={styles.statLabel}>Shot Types</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  legendLabel: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
  },
  legendGradient: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  legendColor: {
    width: 20,
    height: 12,
  },
  heatMap: {
    position: 'relative',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
  },
  courseOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  target: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  teeArea: {
    position: 'absolute',
    width: 30,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  heatCell: {
    position: 'absolute',
    borderRadius: 1,
  },
  axisLabels: {
    marginTop: 8,
  },
  horizontalAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  axisLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default HeatMapVisualization;