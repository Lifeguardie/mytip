import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import ApiService from '../services/api';

// RTL layout handled by CSS for web compatibility

const EnvelopeManagementScreen = ({ navigation, route }) => {
  const [user] = useState(route.params?.user);
  const [envelopes, setEnvelopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedEnvelope, setSelectedEnvelope] = useState(null);
  const [editForm, setEditForm] = useState({
    waiter_name: '',
    sumin: '',
    monthcheck: '',
    yearcheck: ''
  });

  useEffect(() => {
    loadEnvelopes();
  }, []);

  const loadEnvelopes = async () => {
    try {
      setLoading(true);
      console.log('💼 EnvelopeManagement: Loading envelopes...');
      let result;

      // נסה נקודת קצה ניהול; אם לא קיים—פולבק לרגיל
      try {
        const resp = await ApiService.api.get('/api/management/all-envelopes');
        result = resp?.data;
      } catch (managementError) {
        console.log('💼 Management endpoint not available, trying regular envelopes...');
        result = await ApiService.getEnvelopes(user.username || user.id);
      }

      if (result?.success && Array.isArray(result.envelopes)) {
        // למקרה שהשרת כבר מחזיר ממוין — עדיין נמיין על בסיס mydate+timem
        const sortedEnvelopes = result.envelopes
          .sort((a, b) => new Date(`${b.mydate} ${b.timem || '00:00:00'}`) - new Date(`${a.mydate} ${a.timem || '00:00:00'}`))
          .slice(0, 50);

        setEnvelopes(sortedEnvelopes);
      } else {
        setEnvelopes([]);
        Alert.alert('אין מעטפות', 'לא נמצאו מעטפות במערכת.');
      }
    } catch (error) {
      console.error('💼 EnvelopeManagement: Error loading envelopes:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את המעטפות.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEnvelopes = envelopes.filter(envelope =>
    (envelope.waiter_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(envelope.sumin ?? envelope.amount ?? '').includes(searchQuery)
  );

  const formatDate = (dateString, timeString) => {
    if (!dateString) return 'לא ידוע';
    
    // Just return the mydate value as is
    return dateString;
  };

  const openEditModal = (envelope) => {
    setSelectedEnvelope(envelope);
    setEditForm({
      waiter_name: envelope.waiter_name || '',
      sumin: (envelope.sumin ?? envelope.amount ?? '').toString(),
      monthcheck: (envelope.monthcheck ?? '').toString(),
      yearcheck: (envelope.yearcheck ?? '').toString()
    });
    setEditModalVisible(true);
  };

  const updateEnvelope = async () => {
    try {
      setLoading(true);
      const id = selectedEnvelope?.id ?? selectedEnvelope?.id_num;
      if (!id) {
        Alert.alert('שגיאה', 'חסר מזהה מעטפה');
        return;
      }

      // שולחים רק את 3 השדות שנדרש לעדכן
      const payload = {
        sumin:      editForm.sumin      !== '' ? Number(editForm.sumin) : undefined,
        monthcheck: editForm.monthcheck !== '' ? parseInt(editForm.monthcheck, 10) : undefined,
        yearcheck:  editForm.yearcheck  !== '' ? parseInt(editForm.yearcheck, 10)  : undefined,
      };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      const res = await ApiService.updateEnvelope(id, payload);

      if (res?.success) {
        Alert.alert('הצלחה', 'המעטפה עודכנה בהצלחה');
        setEditModalVisible(false);
        loadEnvelopes();
      } else {
        Alert.alert('שגיאה', res?.message || 'שגיאה בעדכון המעטפה');
      }
    } catch (error) {
      console.error('Error updating envelope:', error);
      Alert.alert('שגיאה', 'שגיאה בעדכון המעטפה');
    } finally {
      setLoading(false);
    }
  };

  const deleteEnvelope = (envelope) => {
    console.log('🗑️ Delete button clicked for envelope:', envelope?.id_num ?? envelope?.id);
    Alert.alert(
      'מחק מעטפה',
      `האם אתה בטוח שברצונך למחוק את המעטפה של ${envelope.waiter_name || 'עובד'}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const id = envelope?.id ?? envelope?.id_num;
              if (!id) {
                Alert.alert('שגיאה', 'חסר מזהה מעטפה');
                return;
              }

              // קריאה לפונקציית מחיקה מיוחדת
              const res = await ApiService.deleteEnvelope(id);

              if (res?.success) {
                Alert.alert('הצלחה', 'המעטפה נמחקה בהצלחה');
                loadEnvelopes();
              } else {
                Alert.alert('שגיאה', res?.message || 'שגיאה במחיקת המעטפה');
              }
            } catch (error) {
              console.error('Error deleting envelope:', error);
              Alert.alert('שגיאה', 'שגיאה במחיקת המעטפה');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ניהול מעטפות</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לפי שם עובד או סכום..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          textAlign="right"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <Text style={styles.statsText}>
            נמצאו {filteredEnvelopes.length} מעטפות
          </Text>

          {filteredEnvelopes.map((envelope, index) => (
            <View key={`envelope-${envelope.id_num ?? envelope.id ?? index}-${envelope.mydate ?? ''}-${envelope.waiter_name ?? ''}`} style={styles.envelopeCard}>
              <View style={styles.envelopeHeader}>
                <View style={styles.envelopeInfo}>
                  <Text style={styles.employeeName}>
                    {envelope.waiter_name || 'לא מצוין'}
                  </Text>
                  <Text style={styles.envelopeId}>מעטפה #{envelope.id ?? envelope.id_num}</Text>
                  <Text style={styles.envelopeDate}>
                    {formatDate(envelope.mydate, envelope.timem)}
                  </Text>
                  {(envelope.monthcheck || envelope.yearcheck) ? (
                    <Text style={styles.envelopeDate}>
                      חודש/שנה: {String(envelope.monthcheck || '').padStart(2, '0')}/{envelope.yearcheck || ''}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.amountContainer}>
                  <Text style={styles.amount}>₪{envelope.sumin ?? envelope.amount ?? 0}</Text>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => {
                    console.log('✏️ Edit button pressed');
                    openEditModal(envelope);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>ערוך</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteEnvelope(envelope)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>מחק</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filteredEnvelopes.length === 0 && !loading && (
            <Text style={styles.noDataText}>אין מעטפות להציג</Text>
          )}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>עריכת מעטפה</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="שם עובד"
              value={editForm.waiter_name}
              onChangeText={(text) => setEditForm({ ...editForm, waiter_name: text })}
              textAlign="right"
              editable={false} // רק לתצוגה — לא קיים בשדה emvnew
            />

            <TextInput
              style={styles.modalInput}
              placeholder="סכום (sumin)"
              value={editForm.sumin}
              onChangeText={(text) => setEditForm({ ...editForm, sumin: text })}
              keyboardType="numeric"
              textAlign="right"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="חודש (monthcheck)"
              value={editForm.monthcheck}
              onChangeText={(text) => setEditForm({ ...editForm, monthcheck: text })}
              textAlign="right"
              keyboardType="numeric"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="שנה (yearcheck)"
              value={editForm.yearcheck}
              onChangeText={(text) => setEditForm({ ...editForm, yearcheck: text })}
              textAlign="right"
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={updateEnvelope}
              >
                <Text style={styles.modalButtonText}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: { padding: 10, marginLeft: 10 },
  backButtonText: { fontSize: 24, color: '#2196F3', fontWeight: 'bold' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', textAlign: 'right', color: '#333' },
  searchContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, padding: 15, fontSize: 16, backgroundColor: '#F9F9F9',
  },
  loader: { flex: 1, justifyContent: 'center' },
  scrollView: { flex: 1, padding: 20 },
  statsText: { fontSize: 16, fontWeight: 'bold', color: '#333', textAlign: 'right', marginBottom: 15 },
  envelopeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, marginBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  envelopeHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  envelopeInfo: { flex: 1 },
  employeeName: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'right' },
  envelopeId: { fontSize: 14, color: '#666', textAlign: 'right', marginTop: 2 },
  envelopeDate: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 2 },
  amountContainer: { alignItems: 'center' },
  amount: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
  actionButtons: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  actionButton: { 
    flex: 1, 
    paddingVertical: 12, 
    paddingHorizontal: 16,
    borderRadius: 8, 
    alignItems: 'center', 
    marginHorizontal: 5,
    minHeight: 44
  },
  editButton: { backgroundColor: '#2196F3' },
  deleteButton: { backgroundColor: '#F44336' },
  actionButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  noDataText: { textAlign: 'center', fontSize: 16, color: '#666', marginTop: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'right', marginBottom: 20, color: '#333' },
  modalInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 15, fontSize: 16, marginBottom: 15, backgroundColor: '#F9F9F9' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#757575' },
  saveButton: { backgroundColor: '#4CAF50' },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

export default EnvelopeManagementScreen;