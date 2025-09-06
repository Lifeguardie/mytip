import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
// הסרתי StatusBar - גורם לקריסה
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
// הסרתי NotificationService - גורם לקריסה

const TipEntryScreen = ({ route }) => {
  const { user } = route.params;
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [selectedWaiter, setSelectedWaiter] = useState(null);

  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingWaiters, setLoadingWaiters] = useState(true);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadWaiters();
  }, []);

  const loadWaiters = async () => {
    try {
      setLoadingWaiters(true);
      const result = await ApiService.getWaiters();
      
      if (result.success && result.waiters) {
        // Add current user to the list if they're a waiter
        const waitersList = [...result.waiters];
        const currentUserExists = waitersList.find(w => w.id === user.id);
        
        if (!currentUserExists && (user.jobrole === 'waiter' || user.jobrole === 'both')) {
          waitersList.unshift({
            id: user.id,
            username: user.username,
            wname: user.wname,
            realname: user.realname,
            hisid: user.hisid
          });
        }
        
        setWaiters(waitersList);
      }
    } catch (error) {
      console.error('Error loading waiters:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת רשימת מלצרים');
    } finally {
      setLoadingWaiters(false);
    }
  };

  const filteredWaiters = waiters.filter(waiter =>
    (waiter.realname || waiter.wname).toLowerCase().includes(searchText.toLowerCase()) ||
    waiter.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSubmit = async () => {
    // Validation
    if (!amount.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס סכום');
      return;
    }

    if (!selectedWaiter) {
      Alert.alert('שגיאה', 'אנא בחר מלצר');
      return;
    }



    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('שגיאה', 'אנא הכנס סכום תקין');
      return;
    }

    setLoading(true);

    try {
      // חישוב תאריך עם לוגיקה של משמרות: מעטפות בין 00:00-13:00 = יום קודם
      const now = new Date();
      const currentHour = now.getHours();
      
      let shiftDate = now;
      // אם השעה בין 0:00 ל-13:00, התאריך הוא של היום הקודם
      if (currentHour >= 0 && currentHour < 13) {
        shiftDate = new Date(now);
        shiftDate.setDate(shiftDate.getDate() - 1);
      }
      
      const mydate = shiftDate.toISOString().split('T')[0]; // פורמט YYYY-MM-DD לשרת
      const isForSelf = selectedWaiter.id === user.id;
      
      // השרת מצפה לפורמט ספציפי: amount, waiterId, makerId, giver, makerName, waiterName
      const envelopeData = {
        amount: Number(numericAmount),
        waiterId: Number(selectedWaiter.id),
        makerId: Number(user.id),
        giver: isForSelf ? 'self' : 'emp',
        makerName: String(user.realname || user.wname),
        waiterName: String(selectedWaiter.realname || selectedWaiter.wname)
      };
      
      // וידוא שכל הערכים תקינים
      console.log('💰 TipEntry: Envelope data validation:');
      console.log('  amount:', typeof envelopeData.amount, '=', envelopeData.amount);
      console.log('  waiterId:', typeof envelopeData.waiterId, '=', envelopeData.waiterId);
      console.log('  makerId:', typeof envelopeData.makerId, '=', envelopeData.makerId);
      console.log('  giver:', envelopeData.giver);
      console.log('  makerName:', envelopeData.makerName);
      console.log('  waiterName:', envelopeData.waiterName);
      console.log('  isForSelf:', isForSelf);

      console.log('💰 TipEntry: Submitting envelope data:', envelopeData);
      console.log('💰 TipEntry: User data:', user);
      console.log('💰 TipEntry: Selected waiter:', selectedWaiter);

      const result = await ApiService.createEnvelope(
        envelopeData.amount,
        String(selectedWaiter.id), // שלח id כ-string כמו שהשרת מצפה
        envelopeData.makerName,
        envelopeData.giver,
        envelopeData.waiterName,
        isForSelf, // האם זה המשתמש הנוכחי
        user.id, // makerId
        mydate // 🕒 שלח התאריך עם לוגיקת משמרות
      );
      
      console.log('💰 TipEntry: Full result from server:', result);
      console.log('💰 TipEntry: result.success type:', typeof result.success);
      console.log('💰 TipEntry: result.success value:', result.success);
      console.log('💰 TipEntry: result object keys:', Object.keys(result || {}));

      // בדיקה מפורטת יותר של התגובה
      const isSuccess = result && (result.success === true || result.success === 'true');
      const hasEnvelopeId = result && (result.envelopeId || result.id);
      
      // אם השרת החיצוני לא עובד, הצג הודעה ברורה למשתמש
      if (!isSuccess && result && result.message) {
        setShowSuccessModal(false);
        setShowCustomAlert(true);
        setCustomAlertMessage(result.message); // השתמש בהודעה המפורטת מ-api.js
        setLoading(false);
        return;
      }
      
      console.log('💰 TipEntry: isSuccess:', isSuccess);
      console.log('💰 TipEntry: hasEnvelopeId:', hasEnvelopeId);
      console.log('💰 TipEntry: result.message:', result?.message);

      // אם יש הודעת שגיאה אבל יש envelope ID, זה בעצם הצלחה
      if (isSuccess || hasEnvelopeId || (result && result.envelopeId && result.message && result.message.includes('הצלחה'))) {
        console.log('✅ TipEntry: Success confirmed, showing success modal');
        // Removed notification for new envelope
        
        // הכנת הודעת הצלחה
        const message = `מעטפה נוצרה בהצלחה! 🎉\n\nעבור: ${selectedWaiter.realname || selectedWaiter.wname}\nסכום: ${numericAmount} ₪\nמספר מעטפה: ${result.envelopeId || 'לא זמין'}\n\n${selectedWaiter.id !== user.id ? '✅ מעטפה נוצרה במערכת' : '✅ המעטפה נמסרה אוטומטית'}`;
        
        // שימוש ב-Modal מותאם אישית במקום Alert.alert שלא עובד ב-Web
        setSuccessMessage(message);
        setShowSuccessModal(true);
      } else {
        // שימוש ב-Modal לשגיאה גם
        setSuccessMessage(`שגיאה: ${result.message || 'שגיאה ביצירת מעטפה'}`);
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Error creating envelope:', error);
      setSuccessMessage('שגיאה: שגיאה ביצירת מעטפה');
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
    }
  };

  const selectWaiter = (waiter) => {
    setSelectedWaiter(waiter);
    setShowWaiterModal(false);
    setSearchText('');
  };

  const renderWaiterItem = ({ item }) => (
    <TouchableOpacity
      style={styles.waiterItem}
      onPress={() => selectWaiter(item)}
      activeOpacity={0.7}
    >
      <View style={styles.waiterItemContent}>
        <View style={styles.waiterAvatar}>
          <Text style={styles.waiterAvatarText}>
            {(item.realname || item.wname).charAt(0)}
          </Text>
        </View>
        <View style={styles.waiterDetails}>
          <Text style={styles.waiterName}>{item.realname || item.wname}</Text>
          <Text style={styles.waiterUsername}>מספר: {item.username}</Text>
        </View>
        <Text style={styles.waiterChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>💰 הכנסת טיפים</Text>
          <Text style={styles.headerSubtitle}>צור מעטפת טיפ חדשה</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {/* Creator Info Card */}
        <View style={styles.creatorCard}>
          <View style={styles.creatorIcon}>
            <Text style={styles.creatorIconText}>👤</Text>
          </View>
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorLabel}>יוצר המעטפה</Text>
            <Text style={styles.creatorName}>{user.realname || user.wname}</Text>
          </View>
        </View>

        {/* Main Form Card */}
        <View style={styles.formCard}>
          {/* Amount Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>💸</Text>
              <Text style={styles.sectionTitle}>סכום הטיפ</Text>
            </View>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₪</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#B0BEC5"
                keyboardType="numeric"
                textAlign="center"
              />
            </View>
            <Text style={styles.inputHint}>הכנס את סכום הטיפ בשקלים</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Waiter Selection Section */}
          <View style={styles.inputSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🍽️</Text>
              <Text style={styles.sectionTitle}>בחירת מלצר</Text>
            </View>
            <TouchableOpacity
              style={[styles.waiterSelector, selectedWaiter && styles.waiterSelectorSelected]}
              onPress={() => setShowWaiterModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.waiterSelectorContent}>
                {selectedWaiter ? (
                  <>
                    <View style={styles.selectedWaiterIcon}>
                      <Text style={styles.selectedWaiterIconText}>✓</Text>
                    </View>
                    <View style={styles.selectedWaiterInfo}>
                      <Text style={styles.selectedWaiterName}>
                        {selectedWaiter.realname || selectedWaiter.wname}
                      </Text>
                      <Text style={styles.selectedWaiterUsername}>
                        {selectedWaiter.username}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.placeholderIcon}>
                      <Text style={styles.placeholderIconText}>👥</Text>
                    </View>
                    <View style={styles.placeholderInfo}>
                      <Text style={styles.placeholderText}>לחץ לבחירת מלצר</Text>
                      <Text style={styles.placeholderSubtext}>בחר מהרשימה</Text>
                    </View>
                  </>
                )}
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loadingText}>יוצר מעטפה...</Text>
              </View>
            ) : (
              <View style={styles.submitContent}>
                <Text style={styles.submitIcon}>✨</Text>
                <Text style={styles.submitButtonText}>צור מעטפה</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Waiter Selection Modal */}
      <Modal
        visible={showWaiterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWaiterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🍽️ בחירת מלצר</Text>
              <TouchableOpacity
                style={styles.modalCloseIcon}
                onPress={() => {
                  setShowWaiterModal(false);
                  setSearchText('');
                }}
              >
                <Text style={styles.modalCloseIconText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="חפש לפי שם או מספר..."
                placeholderTextColor="#B0BEC5"
                textAlign="right"
              />
            </View>

            {/* Waiters List */}
            <View style={styles.waitersContainer}>
              {loadingWaiters ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2E7D32" />
                  <Text style={styles.loadingText}>טוען מלצרים...</Text>
                </View>
              ) : filteredWaiters.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🤷‍♂️</Text>
                  <Text style={styles.emptyText}>לא נמצאו מלצרים</Text>
                  <Text style={styles.emptySubtext}>נסה חיפוש אחר</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredWaiters}
                  renderItem={renderWaiterItem}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.waitersList}
                  showsVerticalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={styles.waiterSeparator} />}
                />
              )}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowWaiterModal(false);
                setSearchText('');
              }}
            >
              <Text style={styles.modalCancelButtonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success/Error Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <Text style={styles.successModalTitle}>
              {successMessage.includes('שגיאה') ? '⚠️ שגיאה' : '✅ הצלחה!'}
            </Text>
            <Text style={styles.successModalText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                if (!successMessage.includes('שגיאה')) {
                  // Reset form only on success
                  setAmount('');
                  setSelectedWaiter(null);
                  console.log('✅ TipEntry: Form reset after success');
                }
              }}
            >
              <Text style={styles.successModalButtonText}>אישור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#2E7D32',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#C8E6C9',
    opacity: 0.9,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  creatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  creatorIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  creatorIconText: {
    fontSize: 24,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    textAlign: 'right',
  },
  creatorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'right',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  inputSection: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    justifyContent: 'flex-end',
  },
  sectionIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    paddingHorizontal: 20,
    paddingVertical: 15,
    minHeight: 70,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginLeft: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    paddingVertical: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
    minHeight: 50,
  },
  inputHint: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  waiterSelector: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    padding: 20,
  },
  waiterSelectorSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E8',
  },
  waiterSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedWaiterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  selectedWaiterIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedWaiterInfo: {
    flex: 1,
  },
  selectedWaiterName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'right',
    marginBottom: 2,
  },
  selectedWaiterUsername: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
  },
  placeholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  placeholderIconText: {
    fontSize: 18,
  },
  placeholderInfo: {
    flex: 1,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'right',
    marginBottom: 2,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'right',
  },
  chevron: {
    fontSize: 20,
    color: '#CCCCCC',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 10,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    maxHeight: '85%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    flex: 1,
    textAlign: 'right',
  },
  modalCloseIcon: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseIconText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  searchIcon: {
    fontSize: 16,
    marginLeft: 10,
  },
  searchInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    textAlign: 'right',
    color: '#333333',
  },
  waitersContainer: {
    flex: 1,
    marginBottom: 20,
  },
  waitersList: {
    flex: 1,
  },
  waiterItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 2,
  },
  waiterItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  waiterAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  waiterAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  waiterDetails: {
    flex: 1,
  },
  waiterName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 2,
  },
  waiterUsername: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
  },
  waiterChevron: {
    fontSize: 18,
    color: '#CCCCCC',
    fontWeight: 'bold',
  },
  waiterSeparator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
    textAlign: 'center',
  },
  successModalText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  successModalButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
  },
  successModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  successModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  successModalButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 100,
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default TipEntryScreen;