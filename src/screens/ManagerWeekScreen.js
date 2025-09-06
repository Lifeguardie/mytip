// ===== src/screens/ManagerWeekScreen.js =====
import React, { useState } from 'react';
import { View, Button, Alert } from 'react-native';
import { autoAssign } from '../services/scheduler';
import { fetchInstances, fetchAvailabilities, fetchStats, saveAutoAssignments } from '../services/api';

export default function ManagerWeekScreen() {
  const [loading, setLoading] = useState(false);

  async function handleAutoAssign() {
    try {
      setLoading(true);
      const instances = await fetchInstances('2025-09-01', '2025-09-07');
      const slots = instances.slots;
      const avail = await fetchAvailabilities('2025-09-01');
      const stats = await fetchStats();

      const assignments = autoAssign({
        instances,
        slots,
        templates: [],
        avail,
        constraints: {
          minShiftsPerUser: 2,
          maxShiftsPerUser: 5,
          minHours: 12,
          maxHours: 35,
          allowDoubleShift: true
        },
        stats,
      });

      await saveAutoAssignments(assignments);
      Alert.alert('✅ השיבוץ האוטומטי נשמר בהצלחה');
    } catch (err) {
      console.error(err);
      Alert.alert('❌ שגיאה בשיבוץ האוטומטי');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ padding: 20 }}>
      <Button
        title={loading ? 'מבצע שיבוץ...' : 'שבץ אוטומטית'}
        onPress={handleAutoAssign}
        disabled={loading}
      />
    </View>
  );
}
