import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/api';

const WaiterMonthlyIncomeScreen = ({ navigation }) => {
  const [waiters, setWaiters] = useState([]);
  const [waiterIncomes, setWaiterIncomes] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loadingIncomes, setLoadingIncomes] = useState(false);

  // רשימת חודשים בעברית
  const months = [
    { value: 1, label: 'ינואר' },
    { value: 2, label: 'פברואר' },
    { value: 3, label: 'מרץ' },
    { value: 4, label: 'אפריל' },
    { value: 5, label: 'מאי' },
    { value: 6, label: 'יוני' },
    { value: 7, label: 'יולי' },
    { value: 8, label: 'אוגוסט' },
    { value: 9, label: 'ספטמבר' },
    { value: 10, label: 'אוקטובר' },
    { value: 11, label: 'נובמבר' },
    { value: 12, label: 'דצמבר' }
  ];

  // רשימת שנים
  const years = [2023, 2024, 2025].map(year => ({
    value: year,
    label: year.toString()
  }));

  useEffect(() => {
    loadWaiters();
  }, []);

  useEffect(() => {
    if (waiters.length > 0) {
      loadAllWaiterIncomes();
    }
  }, [selectedMonth, selectedYear, waiters]);

  const loadWaiters = async () => {
    setLoading(true);
    try {
      console.log('👥 Loading waiters list...');
      const response = await ApiService.getWaiters();
      
      if (response.success && response.waiters) {
        console.log('👥 Loaded waiters:', response.waiters.length);
        console.log('👥 First waiter sample:', {
          username: response.waiters[0]?.username,
          wname: response.waiters[0]?.wname,
          realname: response.waiters[0]?.realname
        });
        setWaiters(response.waiters);
      } else {
        Alert.alert('שגיאה', 'שגיאה בטעינת רשימת מלצרים');
      }
    } catch (error) {
      console.error('Error loading waiters:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת רשימת מלצרים');
    } finally {
      setLoading(false);
    }
  };

  const loadAllWaiterIncomes = async () => {
    setLoadingIncomes(true);
    const incomes = {};
    
    try {
      console.log(`💰 Loading incomes for ${waiters.length} waiters for ${selectedMonth}/${selectedYear}`);
      
      // טוען הכנסות עבור כל מלצר במקביל
      const incomePromises = waiters.map(async (waiter) => {
        try {
          console.log(`💰 Loading income for waiter: ${waiter.wname} (${waiter.username})`);
          const response = await ApiService.getMonthlyIncome(waiter.username, selectedMonth, selectedYear);
          console.log(`💰 Income response for ${waiter.wname}:`, response);
          return {
            waiterId: waiter.username,
            data: response
          };
        } catch (error) {
          console.error(`Error loading income for waiter ${waiter.wname}:`, error);
          return {
            waiterId: waiter.username,
            data: { success: false, totalIncome: 0, envelopeCount: 0 }
          };
        }
      });

      const results = await Promise.all(incomePromises);
      
      // מארגן את התוצאות
      results.forEach(result => {
        incomes[result.waiterId] = result.data;
      });

      setWaiterIncomes(incomes);
      console.log('💰 Loaded incomes for all waiters:', Object.keys(incomes).length);
      
    } catch (error) {
      console.error('Error loading waiter incomes:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת הכנסות מלצרים');
    } finally {
      setLoadingIncomes(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWaiters();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount || 0);
  };

  const getIncomeData = (waiterUsername) => {
    const incomeData = waiterIncomes[waiterUsername];
    if (!incomeData || !incomeData.success) {
      return { totalIncome: 0, envelopeCount: 0 };
    }
    
    // ✅ תיקון: קריאת השדות הנכונים מה-API
    const totalIncome = parseFloat(incomeData.data?.total || incomeData.totalIncome || 0);
    const envelopeCount = parseInt(incomeData.envelopeCount || incomeData.data?.envelopes?.length || 0);
    
    return {
      totalIncome: totalIncome,
      envelopeCount: envelopeCount
    };
  };

  const getWaitersWithIncome = () => {
    return waiters.filter((waiter) => {
      const { totalIncome } = getIncomeData(waiter.username);
      return totalIncome > 0;
    });
  };

  const getTotalIncome = () => {
    return getWaitersWithIncome().reduce((total, waiter) => {
      const { totalIncome } = getIncomeData(waiter.username);
      return total + totalIncome;
    }, 0);
  };

  const getTotalEnvelopes = () => {
    return getWaitersWithIncome().reduce((total, waiter) => {
      const { envelopeCount } = getIncomeData(waiter.username);
      return total + envelopeCount;
    }, 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>טוען רשימת מלצרים...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← חזור</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💰 הכנסות חודשיות מלצרים</Text>
      </View>

      {/* בחירת חודש ושנה */}
      <View style={styles.filtersContainer}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>חודש:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedMonth}
              onValueChange={setSelectedMonth}
              style={styles.picker}
            >
              {months.map(month => (
                <Picker.Item key={month.value} label={month.label} value={month.value} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>שנה:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedYear}
              onValueChange={setSelectedYear}
              style={styles.picker}
            >
              {years.map(year => (
                <Picker.Item key={year.value} label={year.label} value={year.value} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      {/* סיכום כללי */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>
          📊 סיכום {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
        </Text>
        
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>מלצרים עם הכנסות</Text>
            <Text style={styles.summaryValue}>{getWaitersWithIncome().length}</Text>
          </View>
          
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>סה"כ מעטפות</Text>
            <Text style={styles.summaryValue}>{getTotalEnvelopes()}</Text>
          </View>
          
          <View style={[styles.summaryCard, styles.summaryTotal]}>
            <Text style={styles.summaryLabel}>סה"כ הכנסות</Text>
            <Text style={[styles.summaryValue, styles.totalValue]}>
              {formatCurrency(getTotalIncome())}
            </Text>
          </View>
        </View>
      </View>

      {loadingIncomes && (
        <View style={styles.loadingIncomes}>
          <ActivityIndicator size="small" color="#007bff" />
          <Text style={styles.loadingIncomesText}>טוען הכנסות...</Text>
        </View>
      )}

      {/* רשימת מלצרים */}
      <ScrollView 
        style={styles.waitersList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {waiters.filter((waiter) => {
          const { totalIncome } = getIncomeData(waiter.username);
          return totalIncome > 0; // ✅ מציג רק מלצרים עם הכנסות > 0
        }).map((waiter) => {
          const { totalIncome, envelopeCount } = getIncomeData(waiter.username);
          const avgPerEnvelope = envelopeCount > 0 ? totalIncome / envelopeCount : 0;
          
          return (
            <View key={waiter.username} style={styles.waiterCard}>
              <View style={styles.waiterHeader}>
                <Text style={styles.waiterName}>{waiter.realname || waiter.wname}</Text>
                <Text style={styles.waiterPhone}>📞 {waiter.username}</Text>
              </View>
              
              <View style={styles.waiterStats}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>💰 הכנסה חודשית:</Text>
                  <Text style={styles.statValue}>{formatCurrency(totalIncome)}</Text>
                </View>
                
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>📦 מספר מעטפות:</Text>
                  <Text style={styles.statValue}>{envelopeCount}</Text>
                </View>
                
                {envelopeCount > 0 && (
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>📈 ממוצע למעטפה:</Text>
                    <Text style={styles.statValue}>{formatCurrency(avgPerEnvelope)}</Text>
                  </View>
                )}
                
                {totalIncome === 0 && envelopeCount === 0 && (
                  <View style={styles.noData}>
                    <Text style={styles.noDataText}>🚫 אין נתונים לחודש זה</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#007bff',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  filtersContainer: {
    backgroundColor: 'white',
    padding: 15,
    flexDirection: 'row',
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50,
  },
  summaryContainer: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryTotal: {
    backgroundColor: '#e8f5e8',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  totalValue: {
    color: '#28a745',
    fontSize: 14,
  },
  loadingIncomes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3cd',
    padding: 10,
    marginHorizontal: 15,
    borderRadius: 8,
  },
  loadingIncomesText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#856404',
  },
  waitersList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  waiterCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  waiterHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  waiterName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  waiterPhone: {
    fontSize: 12,
    color: '#666',
  },
  waiterStats: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
  },
  noData: {
    alignItems: 'center',
    padding: 10,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default WaiterMonthlyIncomeScreen;