import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/api';

// RTL layout handled by CSS for web compatibility

const AutoEnvelopeScreen = ({ navigation }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [totalAmount, setTotalAmount] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdEnvelopes, setCreatedEnvelopes] = useState([]);
  const [calculationMode, setCalculationMode] = useState('percentage'); // Always use weighted distribution with database percentages // 'hours' or 'percentage'

  // No mode switching needed - always use weighted distribution
  // Removed handleCalculationModeChange function

  useEffect(() => {
    loadCurrentUser();
    loadEmployees();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await apiService.getWaiters();
      if (response.success && response.waiters) {
        // Show all employees (don't filter by working status for envelope creation)
        console.log('📋 Loaded employees for envelope creation:', response.waiters.length);
        setEmployees(response.waiters);
      } else {
        Alert.alert('שגיאה', 'שגיאה בטעינת רשימת עובדים');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת רשימת עובדים');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const toggleEmployeeSelection = (employee) => {
    // Use wname as unique identifier since hisid might be undefined
    const employeeId = employee.hisid || employee.wname;
    const isSelected = selectedEmployees.find(emp => 
      (emp.hisid && emp.hisid === employee.hisid) || emp.wname === employee.wname
    );
    
    if (isSelected) {
      // Remove employee
      setSelectedEmployees(prev => prev.filter(emp => 
        !((emp.hisid && emp.hisid === employee.hisid) || emp.wname === employee.wname)
      ));
    } else {
      // Add employee with default values - tip percentage comes from database
      const defaultValues = {
        hours: '8'
        // No percentage field needed - we use tip_percentage from database
      };
      setSelectedEmployees(prev => [...prev, { 
        ...employee, 
        ...defaultValues
      }]);
    }
  };

  const updateEmployeeHours = (employee, hours) => {
    console.log('Updating hours for employee:', employee.wname, 'to:', hours);
    setSelectedEmployees(prev => {
      const updated = prev.map(emp => {
        if ((emp.hisid && emp.hisid === employee.hisid) || emp.wname === employee.wname) {
          console.log('Found employee to update:', emp.wname);
          return { ...emp, hours: hours };
        }
        return emp;
      });
      console.log('Updated selected employees:', updated);
      return updated;
    });
  };

  // Removed updateEmployeePercentage - now using predefined tip percentages from database

  const calculateDistribution = () => {
    if (!totalAmount || selectedEmployees.length === 0) {
      return [];
    }

    const amount = parseFloat(totalAmount);
    
    if (calculationMode === 'percentage') {
      // חישוב נכון: חישוב "שעות משוקללות" לפי אחוזים
      
      // חישוב סה"כ שעות משוקללות (שעות × אחוז מהמאגר)
      const weightedTotalHours = selectedEmployees.reduce((sum, emp) => {
        const hours = parseFloat(emp.hours || 0);
        const tipPercentage = parseFloat(emp.tip_percentage || 100);
        return sum + (hours * tipPercentage / 100);
      }, 0);
      
      if (weightedTotalHours === 0) {
        return [];
      }

      // תעריף לשעה משוקללת = סכום כולל ÷ סה"כ שעות משוקללות
      const weightedHourlyRate = amount / weightedTotalHours;
      
      return selectedEmployees.map(emp => {
        const employeeHours = parseFloat(emp.hours || 0);
        const employeeTipPercentage = parseFloat(emp.tip_percentage || 100);
        
        // שעות משוקללות של העובד = שעות × אחוז טיפים מהמאגר
        const employeeWeightedHours = employeeHours * (employeeTipPercentage / 100);
        
        // סכום לעובד = שעות משוקללות × תעריף לשעה משוקללת
        const baseAmount = employeeWeightedHours * weightedHourlyRate;
        
        // חישוב הפרשה דינמית: מינימום 54 שח לשעה
        const hourlyRateBeforeDeduction = baseAmount / employeeHours;
        let deduction;
        if (hourlyRateBeforeDeduction > 54) {
          // הפרשה מקסימלית של 9 שח לשעה, אבל לא יותר מהנדרש כדי להגיע ל-54
          const maxDeduction = employeeHours * 9;
          const neededDeduction = baseAmount - (employeeHours * 54);
          deduction = Math.min(maxDeduction, Math.max(0, neededDeduction));
        } else {
          deduction = 0; // אין הפרשה אם הסכום כבר 54 או פחות
        }
        
        const finalAmount = Math.max(0, Math.round(baseAmount - deduction));
        
        return {
          ...emp,
          calculatedAmount: finalAmount,
          baseAmount: Math.round(baseAmount),
          deduction: deduction,
          calculationDetails: `${employeeHours} שעות × ${employeeTipPercentage}% = ${employeeWeightedHours.toFixed(1)} שעות משוקללות × ₪${Math.round(weightedHourlyRate)}`
        };
      });
    } else {
      // חישוב לפי שעות (הקוד הקיים) - כולם 100%
      const totalHours = selectedEmployees.reduce((sum, emp) => sum + parseFloat(emp.hours || 0), 0);
      
      if (totalHours === 0) {
        return [];
      }

      const hourlyRate = amount / totalHours;
      
      return selectedEmployees.map(emp => {
        const employeeHours = parseFloat(emp.hours || 0);
        const baseAmount = hourlyRate * employeeHours;
        
        // חישוב הפרשה דינמית: מינימום 54 שח לשעה
        const hourlyRateBeforeDeduction = baseAmount / employeeHours;
        let deduction;
        if (hourlyRateBeforeDeduction > 54) {
          // הפרשה מקסימלית של 9 שח לשעה, אבל לא יותר מהנדרש כדי להגיע ל-54
          const maxDeduction = employeeHours * 9;
          const neededDeduction = baseAmount - (employeeHours * 54);
          deduction = Math.min(maxDeduction, Math.max(0, neededDeduction));
        } else {
          deduction = 0; // אין הפרשה אם הסכום כבר 54 או פחות
        }
        
        const finalAmount = Math.max(0, Math.round(baseAmount - deduction));
        
        return {
          ...emp,
          calculatedAmount: finalAmount,
          baseAmount: Math.round(baseAmount),
          deduction: deduction,
          calculationDetails: `${employeeHours} שעות × ₪${Math.round(hourlyRate)}`
        };
      });
    }
  };

  const createEnvelopes = async () => {
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      Alert.alert('שגיאה', 'אנא הזן סכום תקין');
      return;
    }

    if (selectedEmployees.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות עובד אחד');
      return;
    }

    if (calculationMode === 'hours') {
      const hasInvalidHours = selectedEmployees.some(emp => 
        !emp.hours || parseFloat(emp.hours) <= 0
      );

      if (hasInvalidHours) {
        Alert.alert('שגיאה', 'אנא הזן מספר שעות תקין לכל עובד');
        return;
      }
    } else {
      const hasInvalidPercentages = selectedEmployees.some(emp => 
        (!emp.percentage && !emp.tip_percentage) || 
        (emp.percentage && parseFloat(emp.percentage) <= 0) ||
        (emp.tip_percentage && parseFloat(emp.tip_percentage) <= 0)
      );

      if (hasInvalidPercentages) {
        Alert.alert('שגיאה', 'אנא הזן אחוז תקין לכל עובד');
        return;
      }

      // בחישוב משולב, לא צריך לבדוק שסכום האחוזים לא עולה על 100%
      // כי כל עובד מקבל אחוז מהתעריף הבסיסי, לא מהסכום הכולל
    }

    if (!currentUser) {
      Alert.alert('שגיאה', 'משתמש לא מחובר');
      return;
    }

    setLoading(true);
    
    try {
      const distribution = calculateDistribution();
      const results = [];
      
      for (const emp of distribution) {
        try {
          // בדיקה אם זה המשתמש הנוכחי שיוצר מעטפה לעצמו
          const isCreatorSelf = emp.id === currentUser.id;
          
          const response = await apiService.createEnvelope(
            emp.calculatedAmount,
            String(emp.id), // waiterId - id של העובד כ-string כמו שהשרת מצפה
            currentUser.realname || currentUser.wname, // maker - מי שיוצר את המעטפה
            currentUser.realname || currentUser.wname, // giver - יהיה מעודכן בAPI לפי הלוגיקה
            emp.realname || emp.wname, // waiterName - שם העובד שמקבל
            isCreatorSelf, // פרמטר נוסף לזיהוי אם זה יוצר המעטפה
            currentUser.id // makerId - מספר ID של היוצר במסד הנתונים
          );

          if (response.success) {
            results.push({
              employee: emp.realname || emp.wname,
              amount: emp.calculatedAmount,
              hours: emp.hours,
              success: true,
              envelopeId: response.envelopeId
            });
          } else {
            results.push({
              employee: emp.realname || emp.wname,
              amount: emp.calculatedAmount,
              hours: emp.hours,
              success: false,
              error: response.message || 'שגיאה ביצירת מעטפה'
            });
          }
        } catch (error) {
          console.error('Error creating envelope for employee:', emp.wname, error);
          results.push({
            employee: emp.realname || emp.wname,
            amount: emp.calculatedAmount,
            hours: emp.hours,
            success: false,
            error: 'שגיאה ביצירת מעטפה'
          });
        }
      }

      setCreatedEnvelopes(results);
      setShowSuccessModal(true);
      
      // Reset form
      setTotalAmount('');
      setSelectedEmployees([]);

    } catch (error) {
      console.error('Error in createEnvelopes:', error);
      Alert.alert('שגיאה', 'שגיאה ביצירת המעטפות');
    } finally {
      setLoading(false);
    }
  };

  const SuccessModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showSuccessModal}
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>תוצאות יצירת מעטפות</Text>
          
          <ScrollView style={styles.resultsScroll}>
            {createdEnvelopes.map((result, index) => (
              <View 
                key={index} 
                style={[
                  styles.resultItem,
                  result.success ? styles.successItem : styles.errorItem
                ]}
              >
                <Text style={styles.resultEmployee}>{result.employee}</Text>
                <Text style={styles.resultDetails}>
                  {result.hours} שעות • ₪{result.amount}
                </Text>
                {result.success ? (
                  <Text style={styles.successText}>✓ נוצרה בהצלחה</Text>
                ) : (
                  <Text style={styles.errorText}>✗ {result.error}</Text>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const distribution = calculateDistribution();
  const totalHours = selectedEmployees.reduce((sum, emp) => sum + parseFloat(emp.hours || 0), 0);
  const totalPercentage = selectedEmployees.reduce((sum, emp) => sum + parseFloat(emp.tip_percentage || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🤖 מעטפות אוטומטיות</Text>
          <Text style={styles.headerSubtitle}>חלוקה חכמה וצודקת</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Total Amount Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>💰</Text>
            <Text style={styles.cardTitle}>סכום כולל לחלוקה</Text>
          </View>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>₪</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="numeric"
              textAlign="center"
              placeholderTextColor="#B0BEC5"
            />
          </View>
          <Text style={styles.inputHint}>הכנס את הסכום הכולל שיחולק בין העובדים</Text>
        </View>

        {/* Calculation Mode Info Card */}
        <View style={styles.inputCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🎯</Text>
            <Text style={styles.cardTitle}>חלוקה משוקללת אוטומטית</Text>
          </View>
          <View style={styles.modeExplanation}>
            <Text style={styles.explanationIcon}>ℹ️</Text>
            <Text style={styles.modeDescription}>
              המערכת משתמשת באחוזי הטיפים המוגדרים לכל עובד במאגר הנתונים לחישוב חלוקה משוקללת וצודקת
            </Text>
          </View>
        </View>

        {/* Employee Selection Card - Simple Grid */}
        <View style={styles.inputCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>👥</Text>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>בחירת עובדים</Text>
              <View style={styles.selectedCounter}>
                <Text style={styles.selectedCounterText}>{selectedEmployees.length}</Text>
              </View>
            </View>
          </View>
          
          {loadingEmployees ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>טוען עובדים...</Text>
            </View>
          ) : employees.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🤷‍♂️</Text>
              <Text style={styles.emptyText}>לא נמצאו עובדים</Text>
            </View>
          ) : (
            <>
              {/* Quick Select All/None */}
              <View style={styles.quickSelectRow}>
                <TouchableOpacity
                  style={styles.quickSelectButton}
                  onPress={() => setSelectedEmployees([])}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickSelectText}>נקה הכל</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickSelectButton}
                  onPress={() => {
                    const defaultValues = {
                      hours: '8',
                      percentage: calculationMode === 'percentage' ? '70' : '100'
                    };
                    const allSelected = employees.map(emp => ({
                      ...emp,
                      ...defaultValues
                    }));
                    setSelectedEmployees(allSelected);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickSelectText}>בחר הכל</Text>
                </TouchableOpacity>
              </View>

              {/* Simple Employee Grid */}
              <View style={styles.employeeGrid}>
                {employees.map((employee, index) => {
                  const isSelected = selectedEmployees.find(emp => 
                    (emp.hisid && emp.hisid === employee.hisid) || emp.wname === employee.wname
                  );
                  return (
                    <TouchableOpacity
                      key={`employee_${index}`}
                      style={[
                        styles.employeeChip,
                        isSelected && styles.employeeChipSelected
                      ]}
                      onPress={() => toggleEmployeeSelection(employee)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.employeeChipText,
                        isSelected && styles.employeeChipTextSelected
                      ]}>
                        {employee.realname || employee.wname}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* Individual Adjustment - Only for Selected */}
        {selectedEmployees.length > 0 && (
          <View style={styles.inputCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>✏️</Text>
              <Text style={styles.cardTitle}>הגדרות עובדים</Text>
            </View>
            
            {/* Individual Adjustment - Compact List */}
            <View style={styles.selectedEmployeesList}>
              {selectedEmployees.map((employee, index) => (
                <View key={`selected_${index}`} style={styles.compactEmployeeRow}>
                  <Text style={styles.compactEmployeeName}>
                    {employee.realname || employee.wname}
                  </Text>
                  <View style={styles.compactInputs}>
                    <View style={styles.compactInputGroup}>
                      <TextInput
                        style={styles.compactInput}
                        placeholder="8"
                        value={employee.hours || ''}
                        onChangeText={(hours) => updateEmployeeHours(employee, hours)}
                        keyboardType="numeric"
                        textAlign="center"
                        selectTextOnFocus={true}
                        placeholderTextColor="#B0BEC5"
                      />
                      <Text style={styles.compactInputLabel}>שעות</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Distribution Preview */}
        {distribution.length > 0 && (
          <View style={styles.previewCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>📊</Text>
              <Text style={styles.cardTitle}>תצוגה מקדימה</Text>
            </View>
            
            {/* Main Summary - Total Amount */}
            <View style={styles.totalAmountSummary}>
              <Text style={styles.totalAmountLabel}>סכום כולל לחלוקה</Text>
              <Text style={styles.totalAmountValue}>₪{totalAmount}</Text>
            </View>

            {/* Summary Stats */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>סה"כ שעות</Text>
                <Text style={styles.summaryValue}>{totalHours}</Text>
              </View>
            </View>
            
            {/* הפרשות סה"כ */}
            <View style={styles.additionalInfoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>הפרשות סה"כ:</Text>
                <Text style={styles.infoValue}>₪{distribution.reduce((sum, emp) => sum + emp.deduction, 0)}</Text>
              </View>
            </View>
            
            <View style={styles.distributionList}>
              {distribution.map((emp, index) => (
                <View key={`dist_${emp.hisid}_${index}`} style={styles.distributionItem}>
                  <Text style={styles.distributionName}>
                    {emp.realname || emp.wname}
                  </Text>
                  <View style={styles.distributionDetailsContainer}>
                    <Text style={styles.distributionDetails}>
                      {emp.hours} שעות: 
                    </Text>
                    <Text style={styles.distributionAmount}>
                      ₪{emp.calculatedAmount}
                    </Text>
                    <Text style={styles.envelopeInstruction}>
                      {' '}לשים במעטפה
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Create Button */}
        {selectedEmployees.length > 0 && (
          <View style={styles.createButtonContainer}>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={createEnvelopes}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingButtonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.loadingButtonText}>יוצר מעטפות...</Text>
                </View>
              ) : (
                <View style={styles.createButtonContent}>
                  <Text style={styles.createButtonIcon}>✨</Text>
                  <Text style={styles.createButtonText}>
                    צור {selectedEmployees.length} מעטפות
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <SuccessModal />
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#C8E6C9',
    opacity: 0.9,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'flex-end',
  },
  cardIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  cardTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  selectedCounter: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
  },
  selectedCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    height: 70,
    maxHeight: 70,
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
    paddingVertical: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
    minHeight: 50,
  },
  inputHint: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
  },
  modeSelector: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  modeButtonActive: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E8',
  },
  modeButtonContent: {
    alignItems: 'center',
  },
  modeButtonIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 4,
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: '#2E7D32',
  },
  modeButtonDesc: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
  },
  modeButtonDescActive: {
    color: '#2E7D32',
  },
  modeExplanation: {
    flexDirection: 'row',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 15,
    alignItems: 'flex-start',
  },
  explanationIcon: {
    fontSize: 16,
    marginLeft: 8,
    marginTop: 2,
  },
  modeDescription: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
    textAlign: 'right',
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 10,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
  },
  quickSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  quickSelectButton: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  quickSelectText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565C0',
    textAlign: 'center',
  },
  employeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  employeeChip: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    margin: 2,
  },
  employeeChipSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  employeeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
  employeeChipTextSelected: {
    color: '#FFFFFF',
  },
  batchInputSection: {
    marginBottom: 20,
  },
  batchInputRow: {
    marginBottom: 15,
  },
  batchInputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 10,
  },
  batchInputButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  quickInputButton: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  quickInputButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
  },
  selectedEmployeesList: {
    marginTop: 10,
  },
  adjustmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 15,
  },
  compactEmployeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 8,
  },
  compactEmployeeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
    textAlign: 'right',
  },
  compactInputs: {
    flexDirection: 'row',
    gap: 15,
  },
  compactInputGroup: {
    alignItems: 'center',
    minWidth: 60,
  },
  compactInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: 50,
    height: 50,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    paddingVertical: 0,
  },
  compactInputLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontWeight: '600',
  },
  inputContainer: {
    paddingTop: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  inputSection: {
    padding: 16,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  inputIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  numberInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    paddingVertical: 0,
    minHeight: 50,
  },
  inputUnit: {
    fontSize: 14,
    color: '#666666',
    fontWeight: 'bold',
    marginRight: 5,
  },
  inputHelp: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  totalAmountSummary: {
    backgroundColor: '#E8F5E8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  totalAmountLabel: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 8,
  },
  totalAmountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
  },
  additionalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 10,
  },
  infoItem: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: '#1565C0',
    marginBottom: 5,
    textAlign: 'center',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    textAlign: 'center',
  },
  createButtonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createButtonIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 10,
  },
  
  // Distribution styles
  distributionList: {
    marginTop: 15,
  },
  distributionItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 8,
  },
  distributionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeDistAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  employeeDistAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  employeeDistDetails: {
    flex: 1,
  },
  distributionName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 2,
  },
  distributionHours: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'right',
  },
  amountContainer: {
    alignItems: 'flex-start',
  },
  finalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  deductionText: {
    fontSize: 12,
    color: '#FF5722',
    marginTop: 2,
  },
  calculationBreakdown: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  calculationDetails: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
    marginBottom: 4,
  },
  deductionDetails: {
    fontSize: 12,
    color: '#FF5722',
    textAlign: 'right',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultsScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  resultItem: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  successItem: {
    backgroundColor: '#E8F5E8',
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  errorItem: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  resultEmployee: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 5,
  },
  resultDetails: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
    marginBottom: 5,
  },
  successText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  modalButtons: {
    alignItems: 'center',
  },
  modalButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
    textAlign: 'right',
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    paddingVertical: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
    minHeight: 50,
    maxHeight: 50,
  },
  loader: {
    marginVertical: 20,
  },
  employeeList: {
    gap: 10,
  },
  employeeItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  selectedEmployeeItem: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
  },
  employeeRole: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
    textAlign: 'right',
  },
  employeeSelectArea: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionIndicator: {
    marginLeft: 10,
  },
  checkboxText: {
    fontSize: 20,
    color: '#CCCCCC',
  },
  checkboxSelected: {
    color: '#4CAF50',
  },
  hoursInputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  hoursLabel: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  hoursInput: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 6,
    padding: 12,
    width: 80,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontWeight: 'bold',
  },
  hoursHelp: {
    fontSize: 12,
    color: '#666666',
    marginRight: 8,
  },
  noEmployeesText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666666',
    marginVertical: 20,
  },
  distributionSummary: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'right',
    marginBottom: 5,
  },
  distributionList: {
    gap: 10,
  },
  distributionItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 6,
  },
  distributionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  distributionDetailsContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    textAlign: 'right',
  },
  distributionDetails: {
    fontSize: 14,
    color: '#666666',
  },
  distributionAmount: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  envelopeInstruction: {
    fontSize: 14,
    color: '#333333',
    fontWeight: 'bold',
  },
  deductionNote: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'right',
    fontStyle: 'italic',
    marginTop: 2,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 20,
    color: '#333333',
  },
  resultsScroll: {
    maxHeight: 400,
  },
  resultItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  successItem: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  errorItem: {
    borderColor: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  resultEmployee: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 5,
  },
  resultDetails: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
    marginBottom: 5,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // New styles for percentage mode
  modeSelector: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#2196F3',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
    textAlign: 'right',
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 6,
    padding: 10,
    width: 80,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  inputHelp: {
    fontSize: 12,
    color: '#666666',
    width: 60,
    textAlign: 'left',
  },
  modeDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
    marginTop: 10,
    fontStyle: 'italic',
  },
  readOnlyPercentage: {
    backgroundColor: '#F0F8F0',
    borderColor: '#A5D6A7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  readOnlyPercentageText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
});

export default AutoEnvelopeScreen;