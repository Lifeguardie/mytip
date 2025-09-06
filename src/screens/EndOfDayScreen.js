import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';
import { StatusBar } from 'react-native';

const EndOfDayScreen = ({ route, navigation }) => {
  const { user } = route.params;
  const [loading, setLoading] = useState(false);
  
  // Initialize with default manager to prevent undefined errors
  const defaultManager = {
    id: user?.id || 'default',
    wname: user?.wname || 'מנהל ברירת מחדל',
    job: 'manager'
  };
  const [managers, setManagers] = useState([defaultManager]);
  
  // Form states
  const [managerName, setManagerName] = useState(user?.realname || user?.wname || ''); // Always use current logged in user
  const [shiftManager, setShiftManager] = useState('');
  // חישוב תאריך עם לוגיקה של משמרות: אם הדוח נשלח בין 00:00-14:00, התאריך הוא של היום הקודם
  const getShiftDate = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // אם השעה בין 0:00 ל-14:00, התאריך הוא של היום הקודם
    if (currentHour >= 0 && currentHour < 14) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toLocaleDateString('he-IL');
    }
    
    // אחרת, התאריך הוא של היום הנוכחי
    return now.toLocaleDateString('he-IL');
  };
  
  const [date, setDate] = useState(getShiftDate());
  const [cashTipsSummary, setCashTipsSummary] = useState('');
  const [woltTips, setWoltTips] = useState('');
  const [procedures, setProcedures] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [morningTips, setMorningTips] = useState('');
  const [eveningTips, setEveningTips] = useState('');
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadManagers();
  }, []);

  const loadManagers = async () => {
    try {
      console.log('📋 EndOfDay: Loading managers...');
      
      // First try to get managers from the dedicated API endpoint
      try {
        const managerResponse = await api.getManagers();
        console.log('📋 EndOfDay: Manager API response:', managerResponse?.success, 'Managers count:', managerResponse?.managers?.length);
        
        if (managerResponse?.success && Array.isArray(managerResponse.managers) && managerResponse.managers.length > 0) {
          // Always include current user as first option
          const currentUserManager = {
            id: user?.id || 'current',
            wname: user?.realname || user?.wname || 'משתמש נוכחי',
            job: user?.jobrole || 'manager'
          };
          
          const uniqueManagers = [currentUserManager];
          managerResponse.managers.forEach(manager => {
            if (manager?.id !== user?.id && manager?.wname !== user?.wname) {
              uniqueManagers.push({
                ...manager,
                wname: manager.realname || manager.wname // Use realname for display
              });
            }
          });
          
          setManagers(uniqueManagers);
          console.log('📋 EndOfDay: Found managers from API:', uniqueManagers.map(m => m.wname));
          return; // Success, exit the function
        }
      } catch (managerError) {
        console.log('📋 EndOfDay: Manager API not available, falling back to waiters...');
      }
      
      // Fallback: use waiters API and filter by known manager names
      const response = await api.getWaiters();
      console.log('📋 EndOfDay: Waiters API response:', response?.success, 'Waiters count:', response?.waiters?.length);
      
      if (response?.success && Array.isArray(response.waiters)) {
        const allUsers = response.waiters;
        console.log('📋 EndOfDay: Got users:', allUsers.length);
        
        // Include known manager names
        const knownManagerNames = [
          'מירבי שמואלי', 'אביתר כהן', 'דני לוי', 'רונן אברהם', 'יוסי ישראלי'
        ];
        
        // Create manager list from all users, prioritizing known managers
        const managerUsers = allUsers.filter(u => 
          knownManagerNames.includes(u.wname) || u.wname === user?.wname
        );
        
        // Always include current user as an option
        const currentUserManager = {
          id: user?.id || 'current',
          wname: user?.realname || user?.wname || 'משתמש נוכחי',
          job: user?.jobrole || 'manager'
        };
        
        // Remove duplicates and combine lists
        const uniqueManagers = [currentUserManager];
        managerUsers.forEach(manager => {
          if (manager?.id !== user?.id && manager?.wname !== user?.wname) {
            uniqueManagers.push({
              ...manager,
              wname: manager.realname || manager.wname, // Use realname for display
              job: 'manager'
            });
          }
        });
        
        setManagers(uniqueManagers);
        console.log('📋 EndOfDay: Using fallback managers list:', uniqueManagers.map(m => m.wname));
      } else {
        console.log('📋 EndOfDay: Invalid response from waiters API, keeping default manager');
      }
    } catch (error) {
      console.error('📋 EndOfDay: Error loading managers:', error);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!managerName.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם המנהל');
      return;
    }

    if (!shiftManager) {
      Alert.alert('שגיאה', 'נא לבחור מנהל בוקר');
      return;
    }

    // Validate numeric fields
    if (cashTipsSummary && isNaN(Number(cashTipsSummary))) {
      Alert.alert('שגיאה', 'סיום משמרת Z חייב להיות מספר');
      return;
    }

    if (woltTips && isNaN(Number(woltTips))) {
      Alert.alert('שגיאה', 'Wolt Z חייב להיות מספר');
      return;
    }

    if (morningTips && isNaN(Number(morningTips))) {
      Alert.alert('שגיאה', 'טיפ בוקר חייב להיות מספר');
      return;
    }

    if (eveningTips && isNaN(Number(eveningTips))) {
      Alert.alert('שגיאה', 'טיפ ערב חייב להיות מספר');
      return;
    }

    // Validate procedures minimum length
    if (procedures.trim().length < 10) {
      Alert.alert('שגיאה', 'התנהלות שוטפת חייבת להכיל לפחות 10 תווים');
      return;
    }

    try {
      setLoading(true);
      
      const now = new Date();
      
      // Parse date correctly - handle both DD/MM/YYYY and DD.MM.YYYY formats
      const dateStr = date.replace(/\./g, '/'); // Convert dots to slashes
      const dateParts = dateStr.split('/');
      let day, month, year;
      
      if (dateParts.length === 3) {
        day = parseInt(dateParts[0], 10);
        month = parseInt(dateParts[1], 10); 
        year = parseInt(dateParts[2], 10);
      } else {
        // Fallback to shift-aware date
        const currentHour = now.getHours();
        let shiftDate = now;
        
        // אם השעה בין 0:00 ל-14:00, התאריך הוא של היום הקודם
        if (currentHour >= 0 && currentHour < 14) {
          shiftDate = new Date(now);
          shiftDate.setDate(shiftDate.getDate() - 1);
        }
        
        day = shiftDate.getDate();
        month = shiftDate.getMonth() + 1;
        year = shiftDate.getFullYear();
      }
      
      const timeEnd = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      
      // Calculate total Z amount (myz + hmp)
      const myzValue = Number(cashTipsSummary) || 0;
      const hmpValue = Number(woltTips) || 0;
      const totalZ = myzValue + hmpValue;
      
      // Get day name in English (abbreviated) for dayname field
      // יום השבוע צריך להתאים לתאריך שנבחר (לא בהכרח לתאריך הנוכחי)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      let dateForDayName = now;
      const currentHour = now.getHours();
      
      // אם השעה בין 0:00 ל-14:00, יום השבוע הוא של היום הקודם
      if (currentHour >= 0 && currentHour < 14) {
        dateForDayName = new Date(now);
        dateForDayName.setDate(dateForDayName.getDate() - 1);
      }
      
      const dayname = dayNames[dateForDayName.getDay()];
      
      const reportData = {
        manager: managerName.trim() || 'לא צוין',
        myz: myzValue, // Cash tips Z
        hmp: hmpValue, // Wolt Z
        datel: totalZ, // Total amount (myz + hmp)
        shift: procedures.trim() || 'לא צוין',
        shift_pro: additionalNotes.trim() || '',
        tipmb: Number(morningTips) || 0,
        tipme: Number(eveningTips) || 0,
        day_d: String(day).padStart(2, '0'),
        month_d: String(month).padStart(2, '0'),
        year_d: year,
        dayname: dayname,
        manb: shiftManager.trim() || 'לא צוין',
        time_end: timeEnd
      };

      const response = await api.saveEndOfDayReport(reportData);
      
      if (response && response.success) {
        setSuccessMessage(`דוח סוף היום נשמר בהצלחה במסד הנתונים\nמזהה דוח: ${response.reportId || 'לא זמין'}`);
        setShowSuccessModal(true);
      } else if (response && response.isDuplicate) {
        // Handle duplicate report
        setSuccessMessage(`⚠️ דוח כפול זוהה!\n\n${response.message}\n\nבדוק את הפרטים ונסה שוב עם נתונים שונים.`);
        setShowSuccessModal(true);
      } else if (response && !response.success && response.message) {
        // Handle case where server endpoint is not implemented
        setSuccessMessage(response.message);
        setShowSuccessModal(true);
      } else {
        throw new Error(response?.message || 'Failed to save report');
      }

    } catch (error) {
      console.error('Error saving end of day report:', error);
      Alert.alert('שגיאה', 'שגיאה בשמירת הדוח');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    Alert.alert(
      'נקה טופס',
      'האם אתה בטוח שברצונך לנקות את כל השדות?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'נקה',
          style: 'destructive',
          onPress: () => {
            setManagerName(user?.realname || user?.wname || '');
            setShiftManager('');
            setCashTipsSummary('');
            setWoltTips('');
            setProcedures('');
            setAdditionalNotes('');
            setMorningTips('');
            setEveningTips('');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" backgroundColor="#795548" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← חזור</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>דוח סוף יום</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.formContainer}>
        {/* Manager Name - Read Only */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>שם המנהל:</Text>
          <View style={styles.readOnlyContainer}>
            <Text style={styles.readOnlyText}>{managerName || 'לא מוגדר'}</Text>
          </View>
        </View>

        {/* Shift Manager */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>מנהל בוקר:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={shiftManager}
              style={styles.picker}
              onValueChange={(itemValue) => setShiftManager(itemValue)}
            >
              <Picker.Item label="בחר מנהל בוקר..." value="" />
              {Array.isArray(managers) && managers.map((manager, index) => (
                <Picker.Item
                  key={manager?.id || `manager-${index}`}
                  label={manager?.wname || `מנהל ${index + 1}`}
                  value={manager?.wname || `מנהל ${index + 1}`}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>תאריך:</Text>
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#999"
          />
        </View>

        {/* Cash Tips Summary */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Z סיום משמרת:</Text>
          <TextInput
            style={styles.input}
            value={cashTipsSummary}
            onChangeText={setCashTipsSummary}
            placeholder="ערך מספרי בלבד"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Wolt Tips */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wolt Z:</Text>
          <TextInput
            style={styles.input}
            value={woltTips}
            onChangeText={setWoltTips}
            placeholder="ערך מספרי בלבד"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Procedures */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>התנהלות שוטפת:</Text>
          <TextInput
            style={styles.textArea}
            value={procedures}
            onChangeText={setProcedures}
            placeholder="פירוט התנהלות שוטפת (לפחות 10 תווים)"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Additional Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>מנות שחזרו:</Text>
          <TextInput
            style={styles.textArea}
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            placeholder="פירוט מנות שחזרו"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Morning Tips */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>טיפ בוקר:</Text>
          <TextInput
            style={styles.input}
            value={morningTips}
            onChangeText={setMorningTips}
            placeholder="ערך מספרי בלבד"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Evening Tips */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>טיפ ערב:</Text>
          <TextInput
            style={styles.input}
            value={eveningTips}
            onChangeText={setEveningTips}
            placeholder="ערך מספרי בלבד"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>סיום משמרת</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearForm}
            disabled={loading}
          >
            <Text style={styles.clearButtonText}>נקה טופס</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✅ הודעה</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>{successMessage}</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  navigation.goBack();
                }}
              >
                <Text style={styles.modalButtonText}>אישור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#795548',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'right',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateInput: {
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'right',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonContainer: {
    marginTop: 30,
    gap: 15,
  },
  submitButton: {
    backgroundColor: '#795548',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#795548',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#f44336',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  picker: {
    height: 50,
    textAlign: 'right',
  },
  readOnlyContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  modalHeader: {
    backgroundColor: '#4CAF50',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
    alignItems: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EndOfDayScreen;