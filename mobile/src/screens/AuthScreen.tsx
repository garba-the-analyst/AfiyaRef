import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { api, setToken } from '../api/client';

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  async function submit() {
    try {
      setErr('');
      const res =
        mode === 'login'
          ? await api.login({ phone_number: phone, password })
          : await api.register({ phone_number: phone, password, full_name: name });
      await setToken(res.token);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>AfiyaRef 🏥</Text>
      {mode === 'register' && (
        <TextInput style={s.input} placeholder="Full name" value={name} onChangeText={setName} />
      )}
      <TextInput style={s.input} placeholder="Phone e.g. 08012345678" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Button title={mode === 'login' ? 'Login' : 'Register'} onPress={submit} />
      <View style={{ height: 8 }} />
      <Button
        title={mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  err: { color: 'red', marginBottom: 8 },
});
