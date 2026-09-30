import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api/client';

interface Msg {
  id: string;
  from: 'user' | 'titi';
  text: string;
}

export default function NurseScreen() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    api.nurseStatus().then((s) => setLive(s.live)).catch(() => setLive(false));
  }, []);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMsgs((m) => [...m, { id: `${Date.now()}-u`, from: 'user', text }]);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getLastKnownPositionAsync({});
        lat = pos?.coords.latitude;
        lng = pos?.coords.longitude;
      }
      const res = await api.nurseChat({ message: text, lat, lng });
      let reply: string = res.reply;
      if (res.emergency && res.facilities?.length) {
        reply += `\n\nNearest emergency care: ${res.facilities.map((f: any) => f.name).join(', ')}`;
      }
      setMsgs((m) => [...m, { id: `${Date.now()}-t`, from: 'titi', text: reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: `${Date.now()}-e`, from: 'titi', text: `Error: ${(e as Error).message}` }]);
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.badge}>
        Nurse Titi {live === null ? '…' : live ? '🟢 Online' : '⚪ Offline mode'}
      </Text>
      <FlatList
        data={msgs}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={item.from === 'user' ? s.user : s.titi}>
            <Text>{item.text}</Text>
          </View>
        )}
      />
      <View style={s.row}>
        <TextInput style={s.input} placeholder="Describe symptoms…" value={input} onChangeText={setInput} />
        <Button title="Send" onPress={send} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  badge: { fontWeight: 'bold', marginBottom: 8 },
  user: { alignSelf: 'flex-end', backgroundColor: '#dcf8c6', borderRadius: 8, padding: 8, marginBottom: 6, maxWidth: '85%' },
  titi: { alignSelf: 'flex-start', backgroundColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 6, maxWidth: '85%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
});
