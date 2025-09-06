import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
  Modal,
  Animated,
  Dimensions
} from 'react-native';
// הסרתי StatusBar - גורם לקריסה
import ApiService from '../services/api';
// הסרתי NotificationService - גורם לקריסה

const { width } = Dimensions.get('window');

const DeliverEnvelopesScreen = ({ route }) => {
  const { user } = route.params;
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeEnvelopes, setEmployeeEnvelopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deliveryCode, setDeliveryCode] = useState('');
  const [selectedEnvelope, setSelectedEnvelope] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));

  const role = (user?.jobrole || user?.job || '').toLowerCase();
  const isManagerish = ['owner', 'manager', 'both'].includes(role);

  useEffect(() => {
    (async () => {
      await loadEmployeesWithEnvelopes();
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 800, useNativeDriver: true,
      }).start();
    })();
  }, []);

// החלף את כל הפונקציה loadEmployeesWithEnvelopes בזו
const loadEmployeesWithEnvelopes = async () => {
  try {
    setLoading(true);
    const role = (user?.jobrole || user?.job || '').toLowerCase();
    const isManagerial = ['owner', 'manager', 'both'].includes(role);

    // 1) מלצרים פעילים
    let waiters = [];
    try {
      const waitersRes = await ApiService.getWaiters();
      waiters = (waitersRes?.success && Array.isArray(waitersRes.waiters)) ? waitersRes.waiters : [];
    } catch {}

    // 2) משיכת מעטפות
    let envelopesPayload = null;
    if (isManagerial) {
      try {
        const resp = await ApiService.api.get('/api/management/all-envelopes');
        envelopesPayload = resp?.data || null;
      } catch {}
    }
    if (!envelopesPayload) {
      // פולבק למעטפות של המשתמש (עובד רגיל או אם הראוט הניהולי לא זמין)
      envelopesPayload = await ApiService.getEnvelopes(user?.username || user?.id || '');
    }

    const raw = (envelopesPayload?.success && Array.isArray(envelopesPayload.envelopes))
      ? envelopesPayload.envelopes
      : [];

    // 3) נרמול שדות – כולל טיפול ב-status כתחליף ל-goit
    const normalized = raw.map(env => {
      const idNum      = env.id_num ?? env.id;
      const wtId       = env.wt_id ?? env.employee_id ?? env.wtid;
      const waiterName = env.waiter_name ?? env.employee_name ?? env.wname ?? env.makerName ?? '';
      const amount     = env.sumin ?? env.amount ?? 0;
      const mydate     = env.mydate ?? env.date ?? '';
      const timem      = env.timem ?? env.time ?? '';
      const maker      = env.maker ?? env.creator_name ?? '';
      const rand       = env.rand ?? env.code ?? '';

      // 👇 הקריטי: אם אין goit אבל יש status – נשתמש בו
      const rawStatus  = (env.goit ?? env.status ?? '').toString();

      return {
        ...env,
        id_num: idNum,
        wt_id: wtId,
        waiter_name: waiterName,
        sumin: amount,
        mydate,
        timem,
        maker,
        rand,
        goit: rawStatus.trim() // ננקה רווחים
      };
    });

    // 4) סינון מעטפות פתוחות (מזהה גם 'No', 'no', ריק, null, '0', 'false')
    const openEnvelopes = normalized.filter(env => {
      const g = (env.goit || '').trim().toLowerCase();
      return g === '' || g === 'no' || g === '0' || g === 'false';
    });

    // 5) קיבוץ לפי עובד
    const grouped = new Map();
    for (const env of openEnvelopes) {
      const key = env.wt_id ?? `unknown-${env.id_num}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(env);
    }

    // 6) בניית רשימת עובדים עם מעטפות
    let employeesWithOpen = [];
    if (waiters.length > 0) {
      for (const w of waiters) {
        const list = grouped.get(w.id) || [];
        if (list.length > 0) {
          employeesWithOpen.push({
            id: w.id,
            username: w.username,
            name: w.realname || w.wname || w.username,
            count: list.length,
            envelopes: list.sort((a, b) => (b.id_num || 0) - (a.id_num || 0)),
          });
        }
      }
    }
    if (employeesWithOpen.length === 0 && openEnvelopes.length > 0) {
      employeesWithOpen = Array.from(grouped.entries()).map(([key, list]) => {
        const sample = list[0] || {};
        return {
          id: isNaN(Number(key)) ? key : Number(key),
          username: sample.username || '',
          name: sample.wname || sample.waiter_name || 'לא ידוע',
          count: list.length,
          envelopes: list.sort((a, b) => (b.id_num || 0) - (a.id_num || 0)),
        };
      });
    }

    // מיון: כמות מעטפות ↓ ואז id_num של העליונה ↓
    employeesWithOpen.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const bTop = b.envelopes?.[0]?.id_num || 0;
      const aTop = a.envelopes?.[0]?.id_num || 0;
      return bTop - aTop;
    });

    setEmployees(employeesWithOpen);
    return employeesWithOpen; // Return the list for use in other functions
  } catch (err) {
    console.error('❌ loadEmployeesWithEnvelopes error:', err);
    Alert.alert('שגיאה', 'שגיאה בטעינת נתונים: ' + (err?.message || 'לא ידוע'));
    setEmployees([]);
    return []; // Return empty array on error
  } finally {
    setLoading(false);
  }
};

  const loadEmployeeEnvelopes = async (employee) => {
    setSelectedEmployee(employee);
    setEmployeeEnvelopes(employee.envelopes || []);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const list = await loadEmployeesWithEnvelopes();
      if (selectedEmployee) {
        const updated = list.find(e => e.id === selectedEmployee.id);
        if (updated) {
          setSelectedEmployee(updated);
          setEmployeeEnvelopes(updated.envelopes || []);
        } else {
          // אם לעובד אין יותר מעטפות, חזור לרשימה הראשית
          setSelectedEmployee(null);
          setEmployeeEnvelopes([]);
        }
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeliverEnvelope = (envelope) => {
    setSelectedEnvelope(envelope);
    setDeliveryCode('');
    setErrorMessage('');
    setSuccessMessage('');
    setModalVisible(true);
  };

  const confirmDelivery = async () => {
    if (!deliveryCode.trim()) {
      setErrorMessage('יש להזין קוד מעטפה');
      return;
    }
    const entered = deliveryCode.trim();
    const code = String(selectedEnvelope?.rand || '').trim();
    if (entered !== code) {
      setErrorMessage('קוד המעטפה שגוי');
      return;
    }

    try {
      const deliveredBy = user?.wname || user?.realname || user?.username || 'Manager';
      const result = await ApiService.deliverEnvelope(selectedEnvelope.id_num, entered, deliveredBy);

      if (result?.success) {
        // הסרתי notification - גורם לקריסה
        
        // Show success alert with React Native Web compatibility
        Alert.alert('הצלחה', 'המעטפה נמסרה בהצלחה!');
        
        setModalVisible(false);
        setDeliveryCode('');
        setSelectedEnvelope(null);
        setSuccessMessage('המעטפה נמסרה בהצלחה!');
        
        // רענון הנתונים
        const list = await loadEmployeesWithEnvelopes();
        if (selectedEmployee) {
          const updated = list.find(e => e.id === selectedEmployee.id);
          if (updated) {
            setSelectedEmployee(updated);
            setEmployeeEnvelopes(updated.envelopes || []);
          } else {
            // אם לעובד אין יותר מעטפות, חזור לרשימה הראשית
            setSelectedEmployee(null);
            setEmployeeEnvelopes([]);
          }
        }
      } else {
        setErrorMessage(result?.message || 'שגיאה במסירת המעטפה');
      }
    } catch (err) {
      console.error('deliver error', err);
      setErrorMessage('שגיאה במסירת המעטפה');
    }
  };

  const formatDate = (d, t) => {
    if (!d) return '';
    try {
      const date = new Date(`${d} ${t || '00:00:00'}`);
      return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return d; }
  };

  const renderEmployeeItem = ({ item }) => (
    <Animated.View
      style={[
        styles.employeeCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0,1], outputRange: [50,0] }) }]
        }
      ]}
    >
      <TouchableOpacity style={styles.employeeCardInner} onPress={() => loadEmployeeEnvelopes(item)} activeOpacity={0.9}>
        <View style={styles.employeeHeader}>
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName}>{item.name}</Text>
            <Text style={styles.employeeSubtitle}>{item.count} מעטפות ממתינות</Text>
          </View>
          <View style={styles.envelopeCountContainer}>
            <View style={styles.envelopeCount}><Text style={styles.countText}>{item.count}</Text></View>
            <Text style={styles.arrowText}>←</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEnvelopeItem = ({ item }) => (
    <Animated.View
      style={[
        styles.envelopeCard,
        {
          opacity: fadeAnim,
          transform: [{ translateX: fadeAnim.interpolate({ inputRange: [0,1], outputRange: [100,0] }) }]
        }
      ]}
    >
      <View style={styles.envelopeHeader2}>
        <View style={styles.amountContainer}>
          <Text style={styles.envelopeAmount}>{item.sumin}</Text>
          <Text style={styles.currencySymbol}>₪</Text>
        </View>
        <View style={styles.dateContainer}>
          <Text style={styles.envelopeDate}>{formatDate(item.mydate, item.timem)}</Text>
        </View>
      </View>

      <View style={styles.envelopeDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>👤</Text>
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>נוצר על ידי</Text>
            <Text style={styles.detailValue}>{item.maker || item.makerName || 'מערכת'}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.deliverButton} onPress={() => handleDeliverEnvelope(item)} activeOpacity={0.9}>
        <View style={styles.deliverButtonContent}>
          <Text style={styles.deliverButtonIcon}>🔐</Text>
          <Text style={styles.deliverButtonText}>בקש קוד ומסור</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {!selectedEmployee ? (
        <>
          <Animated.View style={[styles.headerCard, { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }]}>
            <Text style={styles.headerIcon}>💌</Text>
            <Text style={styles.headerTitle}>מסירת מעטפות</Text>
            <Text style={styles.headerSubtitle}>בחר עובד לצפייה במעטפות הפתוחות שלו</Text>
            <View style={styles.headerDivider} />
          </Animated.View>

          {employees.length === 0 ? (
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }]}>
              <Text style={styles.emptyIcon}>💌</Text>
              <Text style={styles.emptyTitle}>אין מעטפות למסירה</Text>
              <Text style={styles.emptyText}>כרגע אין עובדים עם מעטפות ממתינות למסירה</Text>
            </Animated.View>
          ) : (
            <FlatList
              data={employees}
              renderItem={renderEmployeeItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContainer}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : (
        <>
          <View style={styles.headerCard}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setSelectedEmployee(null);
                setEmployeeEnvelopes([]);
                onRefresh();
              }}
            >
              <Text style={styles.backButtonText}>← חזור</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>מעטפות של {selectedEmployee.name}</Text>
            <Text style={styles.headerSubtitle}>{employeeEnvelopes.length} מעטפות ממתינות למסירה</Text>
          </View>

          {employeeEnvelopes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>כל המעטפות נמסרו</Text>
              <Text style={styles.emptyText}>אין מעטפות פתוחות למסירה עבור עובד זה</Text>
            </View>
          ) : (
            <FlatList
              data={employeeEnvelopes}
              renderItem={renderEnvelopeItem}
              keyExtractor={(item) => (item.id_num || item.id).toString()}
              contentContainerStyle={styles.listContainer}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* Modal for delivery code */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>מסירת מעטפה</Text>
            <View style={styles.modalAmountCard}>
              <Text style={styles.modalAmountLabel}>סכום</Text>
              <Text style={styles.modalAmount}>{selectedEnvelope?.sumin} ₪</Text>
            </View>
            <TextInput
              style={styles.codeInput}
              placeholder="קוד מעטפה..."
              value={deliveryCode}
              onChangeText={(t) => { setDeliveryCode(t); if (errorMessage) setErrorMessage(''); }}
              autoFocus
              returnKeyType="done"
              textAlign="center"
            />
            {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancel]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirm]} onPress={confirmDelivery}>
                <Text style={styles.modalBtnText}>מסור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal animationType="fade" transparent visible={!!successMessage} onRequestClose={() => setSuccessMessage('')}>
        <View style={styles.modalOverlay}>
          <View style={styles.successContent}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>מעטפה נמסרה!</Text>
            <Text style={styles.successMsg}>{successMessage}</Text>
            <TouchableOpacity style={styles.successBtn} onPress={() => setSuccessMessage('')}>
              <Text style={styles.successBtnText}>אישור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#f1f5f9' },
  loadingContainer:{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f8f9fa' },
  loadingText:{ marginTop:20, fontSize:16, color:'#666' },
  headerCard:{ backgroundColor:'white', margin:20, marginBottom:10, padding:18, borderRadius:20,
    shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.12, shadowRadius:20, elevation:8 },
  headerIcon:{ fontSize:36, textAlign:'center', marginBottom:6 },
  headerTitle:{ fontSize:22, fontWeight:'800', color:'#1e293b', textAlign:'center', marginBottom:6 },
  headerSubtitle:{ fontSize:14, color:'#64748b', textAlign:'center' },
  headerDivider:{ height:3, backgroundColor:'#e2e8f0', borderRadius:2, marginTop:12, width:'25%', alignSelf:'center' },
  backButton:{ alignSelf:'flex-start', marginBottom:10, padding:8 },
  backButtonText:{ fontSize:16, color:'#4A90E2', fontWeight:'bold' },
  listContainer:{ padding:20, paddingTop:0 },

  employeeCard:{ marginHorizontal:16, marginBottom:16 },
  employeeCardInner:{ backgroundColor:'white', borderRadius:18, padding:22, shadowColor:'#000',
    shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:6, borderWidth:1, borderColor:'#f1f5f9' },
  employeeHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  employeeInfo:{ flex:1 },
  employeeName:{ fontSize:20, fontWeight:'700', color:'#1e293b', marginBottom:4 },
  employeeSubtitle:{ fontSize:14, color:'#64748b', fontWeight:'500' },
  envelopeCountContainer:{ flexDirection:'row', alignItems:'center' },
  envelopeCount:{ backgroundColor:'#3b82f6', borderRadius:16, paddingHorizontal:12, paddingVertical:8, marginLeft:8 },
  countText:{ color:'#fff', fontSize:16, fontWeight:'700', textAlign:'center' },
  arrowText:{ fontSize:20, color:'#94a3b8', fontWeight:'bold', marginLeft:8 },

  envelopeCard:{ backgroundColor:'white', borderRadius:18, padding:20, marginHorizontal:20, marginBottom:16,
    shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.1, shadowRadius:15, elevation:8, borderLeftWidth:5, borderLeftColor:'#10b981' },
  envelopeHeader2:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
  amountContainer:{ flexDirection:'row', alignItems:'baseline' },
  envelopeAmount:{ fontSize:32, fontWeight:'800', color:'#059669' },
  currencySymbol:{ fontSize:20, fontWeight:'600', color:'#059669', marginLeft:4 },
  dateContainer:{ backgroundColor:'#f8fafc', paddingHorizontal:12, paddingVertical:6, borderRadius:12 },
  envelopeDate:{ fontSize:13, color:'#64748b', fontWeight:'600' },
  envelopeDetails:{ marginBottom:20 },
  detailRow:{ flexDirection:'row', alignItems:'center', backgroundColor:'#f8fafc', paddingHorizontal:16, paddingVertical:12, borderRadius:12 },
  detailIcon:{ fontSize:18, marginRight:8 },
  detailTextContainer:{ flex:1 },
  detailLabel:{ fontSize:12, color:'#64748b', fontWeight:'600', marginBottom:2 },
  detailValue:{ fontSize:15, color:'#1e293b', fontWeight:'600' },
  deliverButton:{ backgroundColor:'#3b82f6', paddingVertical:16, paddingHorizontal:24, borderRadius:14, alignItems:'center', marginTop:16,
    shadowColor:'#3b82f6', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:6 },
  deliverButtonContent:{ flexDirection:'row', alignItems:'center' },
  deliverButtonIcon:{ fontSize:18, marginLeft:8 },
  deliverButtonText:{ color:'#fff', fontSize:16, fontWeight:'700' },

  emptyContainer:{ flex:1, justifyContent:'center', alignItems:'center', padding:50 },
  emptyIcon:{ fontSize:72, textAlign:'center' },
  emptyTitle:{ fontSize:22, fontWeight:'700', color:'#1e293b', marginBottom:12, textAlign:'center' },
  emptyText:{ fontSize:16, color:'#64748b', textAlign:'center', lineHeight:24, maxWidth:280 },

  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:20 },
  modalContent:{ backgroundColor:'#fff', borderRadius:24, padding:30, width: width - 40, maxWidth:400, shadowColor:'#000',
    shadowOffset:{width:0,height:20}, shadowOpacity:0.25, shadowRadius:25, elevation:15 },
  modalTitle:{ fontSize:24, fontWeight:'800', color:'#1e293b', textAlign:'center', marginBottom:16 },
  modalAmountCard:{ backgroundColor:'#f0fdf4', borderRadius:16, padding:20, alignItems:'center', marginBottom:24, borderWidth:1, borderColor:'#bbf7d0' },
  modalAmountLabel:{ fontSize:14, color:'#065f46', fontWeight:'600', marginBottom:8 },
  modalAmount:{ fontSize:28, color:'#059669', fontWeight:'800' },
  codeInput:{ borderWidth:2, borderColor:'#3b82f6', backgroundColor:'#fff', borderRadius:16, padding:20, fontSize:20, marginBottom:16, textAlign:'center', fontWeight:'700' },
  errorText:{ color:'#dc2626', textAlign:'center', marginBottom:10, fontWeight:'600' },
  modalButtonsRow:{ flexDirection:'row', justifyContent:'space-between', gap:12 },
  modalBtn:{ flex:1, paddingVertical:14, borderRadius:14, alignItems:'center' },
  cancel:{ backgroundColor:'#f1f5f9', borderWidth:2, borderColor:'#e2e8f0' },
  confirm:{ backgroundColor:'#10b981' },
  modalBtnText:{ color:'#111827', fontWeight:'700' },

  successContent:{ backgroundColor:'#fff', borderRadius:24, padding:30, width: width - 60, maxWidth:350, alignItems:'center',
    shadowColor:'#000', shadowOffset:{width:0,height:20}, shadowOpacity:0.25, shadowRadius:25, elevation:15 },
  successIcon:{ fontSize:50, marginBottom:16 },
  successTitle:{ fontSize:22, fontWeight:'800', color:'#059669', textAlign:'center' },
  successMsg:{ fontSize:16, color:'#374151', textAlign:'center', lineHeight:24, marginBottom:20 },
  successBtn:{ backgroundColor:'#10b981', paddingHorizontal:40, paddingVertical:14, borderRadius:14 },
  successBtnText:{ color:'#fff', fontWeight:'700' },
});

export default DeliverEnvelopesScreen;