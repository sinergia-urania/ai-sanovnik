import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import InterpretationScreen from '../screens/InterpretationScreen';
import JournalListScreen from '../screens/JournalListScreen';
import JournalEditScreen from '../screens/JournalEditScreen';
import LucidLessonsScreen from '../screens/LucidLessonsScreen';
import LessonDetailScreen from '../screens/LessonDetailScreen';
import MediaScreen from '../screens/MediaScreen';
import PlansScreen from '../screens/PlansScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'AI Sanovnik' }} />
      <Stack.Screen name="Interpretation" component={InterpretationScreen} options={{ title: 'Tumačenje snova' }} />
      <Stack.Screen name="JournalList" component={JournalListScreen} options={{ title: 'Dnevnik snova' }} />
      <Stack.Screen name="JournalEdit" component={JournalEditScreen} options={{ title: 'Novi unos' }} />
      <Stack.Screen name="LucidLessons" component={LucidLessonsScreen} options={{ title: 'Trening lucidnog' }} />
      <Stack.Screen name="LessonDetail" component={LessonDetailScreen} options={{ title: 'Lekcija' }} />
      <Stack.Screen name="Media" component={MediaScreen} options={{ title: 'Multimedija' }} />
      <Stack.Screen name="Plans" component={PlansScreen} options={{ title: 'Pristup / Planovi' }} />
    </Stack.Navigator>
  );
}
