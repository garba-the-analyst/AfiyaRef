import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, TextInput, StyleSheet } from 'react-native';
import { api } from '../api/client';

export default function BookingsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [date, setDate] = useState('2026-10-01T09:00:00Z');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      setItems(await api.myBookings());
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function book() {
    try {
      await api.createBooking({
        facility_id: facilityId,
        booking_type: 'DOCTOR_APPOINTMENT',
        scheduled_time: date,
      });
      setMsg('Booked ✅');
      setFacilityId('');
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.h}>New booking</Text>
      <TextInput style={s.input} placeholder="Facility ID (copy from Finder test or seed)" value={facilityId} onChangeText={setFacilityId} />
      <TextInput style={s.input} placeholder="ISO datetime" value={date} onChangeText={setDate} />
      <Button title="Book doctor appointment" onPress={book} />
      {!!msg && <Text style={s.msg}>{msg}</Text>}
      <Text style={s.h}>My bookings</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.name}>{item.facility?.name ?? item.facilityId}</Text>
            <Text>{item.bookingType} • {item.status}</Text>
            <Text>{new Date(item.scheduledTime).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h: { fontWeight: 'bold', fontSize: 16, marginVertical: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  msg: { marginVertical: 8 },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 10 },
  name: { fontWeight: 'bold' },
});
