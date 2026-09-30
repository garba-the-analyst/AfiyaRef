import React, { useEffect, useState } from 'react';
import { View, Button, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getToken } from './src/api/client';
import AuthScreen from './src/screens/AuthScreen';
import FinderScreen from './src/screens/FinderScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import NurseScreen from './src/screens/NurseScreen';
import ProfileScreen from './src/screens/ProfileScreen';

type Tab = 'finder' | 'nurse' | 'bookings' | 'profile';

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('finder');

  useEffect(() => {
    getToken().then((t) => setAuthed(!!t));
  }, []);

  if (authed === null) return <View style={s.wrap} />;
  const content = !authed ? (
    <AuthScreen onDone={() => setAuthed(true)} />
  ) : (
    <SafeAreaView style={s.wrap}>
      <StatusBar style="auto" />
      <View style={s.body}>
        {tab === 'finder' && <FinderScreen />}
        {tab === 'nurse' && <NurseScreen />}
        {tab === 'bookings' && <BookingsScreen />}
        {tab === 'profile' && <ProfileScreen onLogout={() => setAuthed(false)} />}
      </View>
      <View style={s.tabs}>
        {(['finder', 'nurse', 'bookings', 'profile'] as Tab[]).map((t) => (
          <View key={t} style={s.tabBtn}>
            <Button title={t} onPress={() => setTab(t)} color={tab === t ? '#0066cc' : '#888'} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );

  // On web, constrain to a phone-width column centered on desktop.
  if (Platform.OS === 'web') {
    return (
      <View style={s.webOuter}>
        <View style={s.webFrame}>{content}</View>
      </View>
    );
  }
  return content;
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  body: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#ddd' },
  tabBtn: { flex: 1 },
  webOuter: { flex: 1, alignItems: 'center', backgroundColor: '#e9edf1' },
  webFrame: {
    width: '100%',
    maxWidth: 480,
    height: '100%',
    backgroundColor: '#fff',
    // @ts-expect-error boxShadow is web-only
    boxShadow: '0 0 24px rgba(0,0,0,0.12)',
  },
});
