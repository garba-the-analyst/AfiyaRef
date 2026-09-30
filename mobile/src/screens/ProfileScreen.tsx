import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import { api, clearToken } from '../api/client';

export default function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [blood, setBlood] = useState('');
  const [genotype, setGenotype] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergency, setEmergency] = useState('');
  const [nhia, setNhia] = useState('');
  const [treatingId, setTreatingId] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const p = await api.healthProfile();
      setBlood(p?.bloodGroup ?? '');
      setGenotype(p?.genotype ?? '');
      setAllergies((p?.allergies ?? []).join(', '));
      setEmergency(p?.emergencyContactPhone ?? '');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      await api.saveProfile({
        blood_group: blood,
        genotype,
        allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
        emergency_contact_phone: emergency,
      });
      setMsg('Saved ✅');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function checkin() {
    try {
      const r = await api.transferCheckin({ treating_facility_id: treatingId, nhia_number_used: nhia || undefined });
      setMsg(`Checked in ✅ Tracking: ${r.id}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <ScrollView style={s.wrap}>
      <Text style={s.h}>Medical passport (EHR-Lite)</Text>
      <TextInput style={s.input} placeholder="Blood group e.g. O+" value={blood} onChangeText={setBlood} />
      <TextInput style={s.input} placeholder="Genotype e.g. AA" value={genotype} onChangeText={setGenotype} />
      <TextInput style={s.input} placeholder="Allergies, comma-separated" value={allergies} onChangeText={setAllergies} />
      <TextInput style={s.input} placeholder="Emergency contact phone" value={emergency} onChangeText={setEmergency} keyboardType="phone-pad" />
      <Button title="Save profile" onPress={save} />

      <Text style={s.h}>Emergency inter-hospital check-in</Text>
      <TextInput style={s.input} placeholder="NHIA policy number" value={nhia} onChangeText={setNhia} />
      <TextInput style={s.input} placeholder="Treating facility ID" value={treatingId} onChangeText={setTreatingId} />
      <Button title="Check in with NHIA" onPress={checkin} />

      {!!msg && <Text style={s.msg}>{msg}</Text>}
      <View style={{ height: 12 }} />
      <Button title="Logout" onPress={async () => { await clearToken(); onLogout(); }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h: { fontWeight: 'bold', fontSize: 16, marginVertical: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  msg: { marginVertical: 8 },
});
