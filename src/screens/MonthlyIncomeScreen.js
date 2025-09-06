import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal
} from 'react-native';
import { StatusBar } from 'react-native';
import ApiService from '../services/api';

// Month names in Hebrew
const monthNames = [
  '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const MonthlyIncomeScreen = ({ route }) => {
  const { user, viewAllWaiters = false } = route.params;
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEnvelope, setSelectedEnvelope] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [waiters, setWaiters] = useState([]);
  const [selectedWaiter, setSelectedWaiter] = useState(null);

  useEffect(() => {
    // בדיקה מיוחדת למשתמש 0507164318
    if (user.username === '0507164318' || user.id === '0507164318') {
      console.log('🔍 SPECIAL DEBUG FOR USER 0507164318');
    }
    
    if (viewAllWaiters) {
      loadWaiters();
    }
    loadAvailableMonths();
  }, []);

  useEffect(() => {
    if (availableMonths.length > 0) {
      loadMonthlyIncome();
    }
  }, [availableMonths, selectedMonthIndex, selectedWaiter]);

  const loadAvailableMonths = async () => {
    try {
      setLoading(true);
      const userId = user.username || user.id;
      console.log('📅 Loading available months for user:', userId);
      
      // Generate months for current year and last year
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const months = [];
      
      // Add last 18 months (current year + previous year)
      for (let year = currentYear; year >= currentYear - 1; year--) {
        for (let month = 12; month >= 1; month--) {
          // Don't add future months
          if (year === currentYear && month > currentDate.getMonth() + 1) {
            continue;
          }
          
          months.push({
            key: `${month}/${year}`,
            month: month,
            year: year,
            display: `${monthNames[month]} ${year}`
          });
        }
      }
      
      console.log('📅 Generated months:', months.map(m => m.display));
      setAvailableMonths(months);
      setSelectedMonthIndex(0);
      
    } catch (error) {
      console.error('📅 Error loading available months:', error);
      setAvailableMonths([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWaiters = async () => {
    try {
      console.log('👥 Loading waiters for monthly income view...');
      const result = await ApiService.getEmployees();
      console.log('👥 Raw API result:', result);
      if (result && result.success && result.employees) {
        // Filter for active waiters and "both" role employees only
        const waitersList = result.employees.filter(emp => 
          (emp.job === 'waiter' || emp.job === 'both') && emp.working === 'yes'
        );
        setWaiters(waitersList);
        console.log('👥 Loaded active waiters:', waitersList.length);
      } else {
        console.log('👥 No employees data in result:', result);
      }
    } catch (error) {
      console.error('👥 Error loading waiters:', error);
    }
  };

  const loadMonthlyIncome = async () => {
    if (availableMonths.length === 0 || selectedMonthIndex >= availableMonths.length) {
      console.log('📊 No months available or invalid index');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const selectedMonth = availableMonths[selectedMonthIndex];
      console.log('📊 Loading monthly income for:', selectedMonth.display);

      // If viewing all waiters and no specific waiter selected, don't load data yet
      if (viewAllWaiters && !selectedWaiter) {
        console.log('📊 No waiter selected in view all mode');
        setMonthlyData(null);
        setError('בחר מלצר לצפייה בנתונים');
        return;
      }

      const userId = viewAllWaiters && selectedWaiter ? selectedWaiter.username : (user.username || user.id);
      console.log('📊 Loading for userId:', userId, viewAllWaiters ? '(selected waiter)' : '(current user)');
      const result = await ApiService.getMonthlyIncome(userId, selectedMonth.month, selectedMonth.year);

      console.log('📊 Result received:', result);

      if (result && result.success && result.data) {
        console.log('📊 Setting monthly data');
        setMonthlyData(result.data);
      } else if (result && result.data) {
        console.log('📊 Setting data without success flag');
        setMonthlyData(result.data);
      } else {
        console.log('📊 No data found');
        setMonthlyData(null);
        setError('לא נמצאו נתונים לחודש הנבחר');
      }

    } catch (error) {
      console.error('🔥 FETCH ERROR:', error);
      setError(error.message);
      setMonthlyData(null);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAvailableMonths();
    setRefreshing(false);
  };

  const handleEnvelopePress = (envelope) => {
    setSelectedEnvelope(envelope);
    setModalVisible(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'לא צוין';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const formatDateTime24 = (dateTimeString) => {
    if (!dateTimeString) return 'לא צוין';
    
    try {
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) {
        return dateTimeString;
      }
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return dateTimeString;
    }
  };

  const renderEnvelope = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.envelopeCard,
        (item.goit === 'yes' || item.goit === 'Yes') ? styles.receivedEnvelope : styles.pendingEnvelope
      ]}
      onPress={() => handleEnvelopePress(item)}
    >
      <View style={styles.envelopeHeader}>
        <Text style={styles.envelopeAmount}>{item.sumin}₪</Text>
        <View style={[
          styles.statusBadge,
          (item.goit === 'yes' || item.goit === 'Yes') ? styles.receivedBadge : styles.pendingBadge
        ]}>
          <Text style={[
            styles.statusText,
            (item.goit === 'yes' || item.goit === 'Yes') ? styles.receivedText : styles.pendingText
          ]}>
            {(item.goit === 'yes' || item.goit === 'Yes') ? 'התקבל' : 'ממתין'}
          </Text>
        </View>
      </View>

      <View style={styles.envelopeDetails}>
        <Text style={styles.dateText}>תאריך: {formatDate(item.mydate)}</Text>
        {(item.goit === 'yes' || item.goit === 'Yes') && item.timegive && item.timegive !== '0' && (
          <Text style={styles.deliveryText}>
            נמסר: {formatDateTime24(item.timegive)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#4A90E2" />
      
      {/* Month Navigation */}
      {availableMonths.length > 0 && (
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            style={[
              styles.navButton,
              selectedMonthIndex >= availableMonths.length - 1 && styles.navButtonDisabled
            ]}
            onPress={() => {
              if (selectedMonthIndex < availableMonths.length - 1) {
                setSelectedMonthIndex(selectedMonthIndex + 1);
              }
            }}
            disabled={selectedMonthIndex >= availableMonths.length - 1}
          >
            <Text style={[
              styles.navButtonText,
              selectedMonthIndex >= availableMonths.length - 1 && styles.navButtonTextDisabled
            ]}>‹</Text>
          </TouchableOpacity>

          <View style={styles.monthDisplay}>
            <Text style={styles.monthText}>
              {availableMonths[selectedMonthIndex]?.display}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.navButton,
              selectedMonthIndex <= 0 && styles.navButtonDisabled
            ]}
            onPress={() => {
              if (selectedMonthIndex > 0) {
                setSelectedMonthIndex(selectedMonthIndex - 1);
              }
            }}
            disabled={selectedMonthIndex <= 0}
          >
            <Text style={[
              styles.navButtonText,
              selectedMonthIndex <= 0 && styles.navButtonTextDisabled
            ]}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Waiter Selection for Manager View */}
      {viewAllWaiters && (
        <View style={styles.waiterSelection}>
          <Text style={styles.sectionTitle}>בחר מלצר לצפייה בנתונים:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.waiterScrollView}>
            {waiters.map((waiter) => (
              <TouchableOpacity
                key={waiter.id}
                style={[
                  styles.waiterCard,
                  selectedWaiter?.id === waiter.id && styles.selectedWaiterCard
                ]}
                onPress={() => setSelectedWaiter(waiter)}
              >
                <View style={styles.waiterAvatar}>
                  <Text style={styles.waiterInitials}>
                    {waiter.realname ? waiter.realname.split(' ').map(n => n[0]).join('').substring(0, 2) : 'NN'}
                  </Text>
                </View>
                <Text style={styles.waiterName} numberOfLines={1}>
                  {waiter.realname || 'שם לא זמין'}
                </Text>
                <Text style={styles.waiterRole}>
                  {waiter.job === 'waiter' ? 'מלצר' : waiter.job === 'both' ? 'מלצר ומנהל' : waiter.job}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Summary Header */}
      {monthlyData && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>ממתינות</Text>
              <Text style={[styles.summaryValue, styles.pendingValue]}>
                {monthlyData.envelopes ? 
                  monthlyData.envelopes.filter(env => env.goit === 'no' || env.goit === 'No').length : 0}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>סיכום חודשי</Text>
              <Text style={[styles.summaryValue, styles.totalValue]}>
                {monthlyData.envelopes ? 
                  monthlyData.envelopes.reduce((sum, env) => sum + parseInt(env.sumin || 0), 0) : 0}₪
              </Text>
            </View>
          </View>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>טוען נתוני הכנסה...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMonthlyIncome}>
            <Text style={styles.retryButtonText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && monthlyData && monthlyData.envelopes && (
        <FlatList
          data={monthlyData.envelopes}
          renderItem={renderEnvelope}
          keyExtractor={(item, index) => `${item.mydate}-${item.sumin}-${index}`}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {!loading && !error && (!monthlyData || !monthlyData.envelopes || monthlyData.envelopes.length === 0) && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>אין מעטפות לחודש זה</Text>
        </View>
      )}

      {/* Modal for envelope details */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedEnvelope && (
              <>
                <Text style={styles.modalTitle}>פרטי מעטפה</Text>
                
                <View style={styles.modalRow}>
                  <Text style={styles.modalValue}>₪{selectedEnvelope.sumin}</Text>
                  <Text style={styles.modalLabel}>:סכום</Text>
                </View>
                
                <View style={styles.modalRow}>
                  <Text style={styles.modalValue}>{selectedEnvelope.timem ? formatDateTime24(selectedEnvelope.timem) : formatDate(selectedEnvelope.mydate)}</Text>
                  <Text style={styles.modalLabel}>:תאריך</Text>
                </View>
                
                <View style={styles.modalRow}>
                  <Text style={styles.modalValue}>
                    {selectedEnvelope.giver === 'self' ? 'עצמי' : selectedEnvelope.giver}
                  </Text>
                  <Text style={styles.modalLabel}>:מוסר</Text>
                </View>
                
                <View style={styles.modalRow}>
                  <Text style={[
                    styles.modalValue,
                    (selectedEnvelope.goit === 'yes' || selectedEnvelope.goit === 'Yes') ? styles.receivedText : styles.pendingText
                  ]}>
                    {(selectedEnvelope.goit === 'yes' || selectedEnvelope.goit === 'Yes') ? 'התקבל' : 'ממתין'}
                  </Text>
                  <Text style={styles.modalLabel}>:סטטוס</Text>
                </View>
                
                {selectedEnvelope.makerName && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalValue}>{selectedEnvelope.makerName}</Text>
                    <Text style={styles.modalLabel}>:נוצר ע"י</Text>
                  </View>
                )}
                
                {(selectedEnvelope.goit === 'yes' || selectedEnvelope.goit === 'Yes') && selectedEnvelope.timegive && selectedEnvelope.timegive !== '0' && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalValue}>{formatDateTime24(selectedEnvelope.timegive)}</Text>
                    <Text style={styles.modalLabel}>:תאריך מסירה</Text>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>סגור</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  navButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  receivedValue: {
    color: '#4CAF50',
  },
  pendingValue: {
    color: '#FF9800',
  },
  totalValue: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 15,
  },
  envelopeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  receivedEnvelope: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  pendingEnvelope: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  envelopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  envelopeAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  receivedBadge: {
    backgroundColor: '#E8F5E8',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  receivedText: {
    color: '#4CAF50',
  },
  pendingText: {
    color: '#FF9800',
  },
  envelopeDetails: {
    marginVertical: 5,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  deliveryText: {
    fontSize: 14,
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    margin: 20,
    minWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  waiterSelection: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
    textAlign: 'center',
  },
  waiterScrollView: {
    maxHeight: 120,
  },
  waiterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    width: 90,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedWaiterCard: {
    borderColor: '#4A90E2',
    backgroundColor: '#EBF3FD',
  },
  waiterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  waiterInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  waiterName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 2,
  },
  waiterRole: {
    fontSize: 10,
    color: '#6C757D',
    textAlign: 'center',
  },
});

export default MonthlyIncomeScreen;