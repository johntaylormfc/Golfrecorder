import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from './src/screens/ProfileScreen';
import StartRoundScreen from './src/screens/StartRoundScreen';
import PlayRoundScreen from './src/screens/PlayRoundScreen';
import RoundSummaryScreen from './src/screens/RoundSummaryScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Profile">
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="StartRound" component={StartRoundScreen} />
        <Stack.Screen name="PlayRound" component={PlayRoundScreen} />
        <Stack.Screen name="RoundSummary" component={RoundSummaryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
