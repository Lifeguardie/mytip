import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/api';
import PermissionService from '../services/PermissionService';

const UserManagementScreen = ({ navigation, route }) => {
  const { user } = route.params;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [selectedRole, setSelectedRole] = useState('waiter');
  const [realName, setRealName] = useState('');
  const [working, setWorking] = useState('yes');
  const [aprove, setAprove] = useState('no');
  const [employees, setEmployees] = useState([]);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [jobFilter, setJobFilter] = useState('all');
  const [userPermissions, setUserPermissions] = useState(null);
  const [tipPercentage, setTipPercentage] = useState('100');

  // Load user permissions on component mount
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const permissions = await PermissionService.loadUserPermissions(user.id || user.username);
        setUserPermissions(permissions);
        
        // Show employee list if user is owner or has manage_employees permission
        const canManageEmployees = user.jobrole === 'owner' || permissions?.manage_employees;
        setShowEmployeeList(canManageEmployees);
        
        // Load employees if user can manage them
        if (canManageEmployees) {
          loadEmployees();
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        // Default to owner-only access if permission loading fails
        const isOwner = user.jobrole === 'owner';
        setShowEmployeeList(isOwner);
        if (isOwner) {
          loadEmployees();
        }
      }
    };
    
    loadPermissions();
  }, []);

  // Fix Hebrew encoding function
  const fixHebrewEncoding = (text) => {
    if (!text || typeof text !== 'string') return text;
    if (text.includes('×')) {
      try { 
        return decodeURIComponent(escape(text)); 
      } catch (e) { 
        return text; 
      }
    }
    return text;
  };

  // Edit employee function
  const editEmployee = (employee) => {
    console.log('editEmployee called with:', employee);
    try {
      // Fix Hebrew encoding before using the name
      const fixedWname = fixHebrewEncoding(employee.wname || '');
      const fixedRealname = fixHebrewEncoding(employee.realname || '');
      
      const nameParts = fixedWname.split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
      setSelectedRole(employee.job);
      setRealName(fixedRealname);
      setWorking(employee.working || 'yes');
      setAprove(employee.aprove || 'no');
      // Set tip percentage - default to 100% if not set for existing employees
      setTipPercentage(employee.tip_percentage ? employee.tip_percentage.toString() : '100');
      setEditingEmployee(employee);
      setShowEmployeeList(false);
      console.log('Edit employee form data set successfully - Hebrew encoding fixed');
    } catch (error) {
      console.error('Error in editEmployee:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת נתוני העובד לעריכה');
    }
  };

  // Delete employee function
  const deleteEmployee = (employee) => {
    console.log('deleteEmployee called with:', employee);
    Alert.alert(
      'מחק עובד',
      `האם אתה בטוח שברצונך להסיר את ${employee.wname || 'העובד'}?\n\nמזהה: ${employee.id}\nתפקיד: ${employee.job || 'לא ידוע'}`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => handleDeleteEmployee(employee)
        }
      ]
    );
  };

  // Handle actual deletion
  const handleDeleteEmployee = async (employee) => {
    try {
      console.log('🗑️ Starting deletion process for:', employee.wname);
      const result = await ApiService.deleteEmployee(employee.id);
      console.log('🗑️ Delete result:', result);
      
      if (result.success) {
        Alert.alert('הצלחה', `העובד ${employee.wname} נמחק לצמיתות מהמערכת`);
        loadEmployees();
      } else {
        Alert.alert('שגיאה', result.message || 'שגיאה במחיקת העובד');
      }
    } catch (error) {
      console.error('🗑️ Delete error:', error);
      Alert.alert('שגיאה', 'שגיאה בחיבור לשרת');
    }
  };

  // Load employees function - FIXED: Better error handling
  const loadEmployees = async () => {
    try {
      console.log('👥 Loading employees...');
      const result = await ApiService.getEmployees();
      console.log('👥 Employees result:', result);
      if (result.success && result.employees) {
        console.log('👥 Employees loaded:', result.employees.length);
        setEmployees(result.employees);
      } else {
        console.log('👥 No employees data received');
        setEmployees([]);
      }
    } catch (error) {
      console.error('👥 Error loading employees:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת רשימת עובדים: ' + error.message);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות הנדרשים');
      return;
    }

    // For new employees, validate phone and ID number
    if (!editingEmployee) {
      if (!phoneNumber.trim() || !idNumber.trim()) {
        Alert.alert('שגיאה', 'מספר טלפון ותעודת זהות נדרשים ליצירת עובד חדש');
        return;
      }
    }

    setLoading(true);

    try {
      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: selectedRole,
        realName: realName.trim(),
        working: working,
        aprove: aprove,
        tipPercentage: selectedRole === 'waiter' || selectedRole === 'both' 
          ? parseFloat(tipPercentage) || 100 
          : 100 // Default 100% for managers and owners
      };

      // For new employees, add phone and ID number
      if (!editingEmployee) {
        userData.phoneNumber = phoneNumber.trim();
        userData.idNumber = idNumber.trim();
      }

      let result;
      if (editingEmployee) {
        const updateData = {
          employeeId: editingEmployee.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: selectedRole,
          realName: realName.trim(),
          working: working,
          aprove: aprove,
          tipPercentage: selectedRole === 'waiter' || selectedRole === 'both' 
            ? parseFloat(tipPercentage) || 100 
            : 100, // Default 100% for managers and owners
          // Keep existing phone and ID
          username: editingEmployee.username,
          hisid: editingEmployee.hisid
        };
        console.log('Updating employee with data:', updateData);
        result = await ApiService.updateEmployee(updateData);
        console.log('Update employee result:', result);
      } else {
        console.log('Creating new user with data:', userData);
        result = await ApiService.createUser(userData);
        console.log('Create user result:', result);
      }

      if (result && result.success) {
        // יצירת הרשאות ברירת מחדל לעובד חדש
        if (!editingEmployee && result.newUserId) {
          try {
            await ApiService.createUserPermissions(
              result.newUserId, 
              selectedRole, 
              {} // הרשאות ברירת מחדל לפי התפקיד
            );
            console.log('🔒 Created default permissions for new user:', result.newUserId, selectedRole);
          } catch (permError) {
            console.error('🔒 Error creating permissions (non-critical):', permError);
          }
        }

        Alert.alert('הצלחה', editingEmployee ? 'העובד עודכן בהצלחה' : 'העובד נוצר בהצלחה');
        // Clear form
        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        setIdNumber('');
        setSelectedRole('waiter');
        setRealName('');
        setWorking('yes');
        setAprove('no');
        setTipPercentage('100');
        setEditingEmployee(null);
        // Reload employees if user has permission
        const canManageEmployees = user.jobrole === 'owner' || userPermissions?.manage_employees;
        if (canManageEmployees) {
          setShowEmployeeList(true);
          loadEmployees();
        }
      } else {
        console.error('Server returned error result:', result);
        Alert.alert('שגיאה', result?.message || 'שגיאה בעדכון - אנא בדוק את הנתונים');
      }
    } catch (error) {
      console.error('Employee update error:', error);
      Alert.alert('שגיאה', `שגיאה בעדכון עובד: ${error.message || 'בעיה בשרת'}`);
    } finally {
      setLoading(false);
    }
  };

  // This useEffect is no longer needed - employee loading is handled in the permissions useEffect

  console.log('Render check - showEmployeeList:', showEmployeeList, 'user.jobrole:', user.jobrole, 'userPermissions:', userPermissions);

  // If user can manage employees, show employee list
  if (showEmployeeList) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>ניהול והקמת עובדים</Text>
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => setShowEmployeeList(false)}
            >
              <Text style={styles.toggleButtonText}>הוסף עובד חדש</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                👥 רשימת עובדים
              </Text>
              <View style={styles.employeeCounter}>
                <Text style={styles.counterText}>{employees.filter(emp => jobFilter === 'all' || emp.job === jobFilter).length}</Text>
              </View>
            </View>
            
            {/* Job Filter */}
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>סינון לפי תפקיד:</Text>
              <View style={styles.filterButtons}>
                <TouchableOpacity 
                  style={[styles.filterButton, jobFilter === 'all' && styles.filterButtonActive]}
                  onPress={() => setJobFilter('all')}
                >
                  <Text style={[styles.filterButtonText, jobFilter === 'all' && styles.filterButtonTextActive]}>
                    הכל
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.filterButton, jobFilter === 'waiter' && styles.filterButtonActive]}
                  onPress={() => setJobFilter('waiter')}
                >
                  <Text style={[styles.filterButtonText, jobFilter === 'waiter' && styles.filterButtonTextActive]}>
                    🍽️ מלצרים
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.filterButton, jobFilter === 'manager' && styles.filterButtonActive]}
                  onPress={() => setJobFilter('manager')}
                >
                  <Text style={[styles.filterButtonText, jobFilter === 'manager' && styles.filterButtonTextActive]}>
                    👔 מנהלים
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.filterButton, jobFilter === 'both' && styles.filterButtonActive]}
                  onPress={() => setJobFilter('both')}
                >
                  <Text style={[styles.filterButtonText, jobFilter === 'both' && styles.filterButtonTextActive]}>
                    👔🍽️ מנהל+מלצר
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.filterButton, jobFilter === 'owner' && styles.filterButtonActive]}
                  onPress={() => setJobFilter('owner')}
                >
                  <Text style={[styles.filterButtonText, jobFilter === 'owner' && styles.filterButtonTextActive]}>
                    👑 בעלים
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {employees.filter(emp => jobFilter === 'all' || emp.job === jobFilter).length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateIcon}>👥</Text>
                <Text style={styles.emptyStateTitle}>
                  {jobFilter === 'all' ? 'אין עובדים במערכת' : `אין עובדים בתפקיד ${
                    jobFilter === 'waiter' ? 'מלצר' :
                    jobFilter === 'manager' ? 'מנהל' :
                    jobFilter === 'both' ? 'מנהל+מלצר' :
                    jobFilter === 'owner' ? 'בעלים' : jobFilter
                  }`}
                </Text>
                <Text style={styles.emptyStateSubtitle}>
                  {jobFilter === 'all' ? 'התחל על ידי הוספת העובד הראשון' : 'נסה לבחור סינון אחר או הוסף עובד חדש'}
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.employeeScrollView} 
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={false}
                initialNumToRender={employees.length}
                maxToRenderPerBatch={employees.length}
                windowSize={10}
              >
                {employees
                  .filter(emp => jobFilter === 'all' || emp.job === jobFilter)
                  .map((employee, index) => (
                  <View key={`employee-${employee.id}-${index}`} style={styles.employeeCard}>
                    <View style={styles.employeeHeader}>
                      <View style={styles.employeeAvatar}>
                        <Text style={styles.employeeInitials}>
                          {employee.wname ? employee.wname.split(' ').map(n => n[0]).join('').substring(0, 2) : 'NN'}
                        </Text>
                      </View>
                      <View style={styles.employeeMainInfo}>
                        <Text style={styles.employeeName} numberOfLines={1}>
                          {employee.wname || 'שם לא זמין'}
                        </Text>
                        <View style={styles.employeeStatusContainer}>
                          <View style={[
                            styles.statusBadge, 
                            employee.aprove === 'Yes' || employee.aprove === 'yes' 
                              ? styles.statusApproved 
                              : styles.statusPending
                          ]}>
                            <Text style={styles.statusText}>
                              {employee.aprove === 'Yes' || employee.aprove === 'yes' ? '✓ מאושר' : '⏳ ממתין'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.employeeDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>תפקיד:</Text>
                        <Text style={styles.detailValue}>
                          {employee.job === 'waiter' ? '🍽️ מלצר' : 
                           employee.job === 'manager' ? '👔 מנהל' : 
                           employee.job === 'both' ? '👔🍽️ מלצר ומנהל' : 
                           employee.job === 'owner' ? '👑 בעלים' : '❓ לא מוגדר'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>טלפון:</Text>
                        <Text style={styles.detailValue}>{employee.username || 'לא זמין'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>תעודת זהות:</Text>
                        <Text style={[styles.detailValue, !employee.hisid && styles.notAvailableText]}>
                          {employee.hisid || 'לא נשמר במערכת'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>שם אמיתי:</Text>
                        <Text style={styles.detailValue}>{employee.realname || 'לא הוזן'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>סטטוס עבודה:</Text>
                        <Text style={styles.detailValue}>
                          {employee.working === 'yes' ? '✅ עובד' : '❌ לא עובד'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.employeeActions}>
                      <TouchableOpacity 
                        style={styles.editButton}
                        onPress={() => editEmployee(employee)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.editButtonText}>✏️ עדכן</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => {
                          console.log('Delete button pressed for:', employee.wname);
                          deleteEmployee(employee);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteButtonText}>🗑️ הסר עובד</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                <View style={styles.listFooter}>
                  <Text style={styles.footerText}>
                    📊 סה"כ {employees.length} עובדים במערכת
                  </Text>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>חזור</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Show form for creating/editing employee
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {user.jobrole === 'owner' 
              ? 'הוספת עובד חדש'
              : (editingEmployee ? 'עדכון עובד' : 'הקמת עובד חדש')
            }
          </Text>
          {user.jobrole === 'owner' && (
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => {
                setShowEmployeeList(true);
                loadEmployees();
              }}
            >
              <Text style={styles.toggleButtonText}>עבור לניהול עובדים</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם פרטי</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="הזן שם פרטי"
              textAlign="right"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם משפחה</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="הזן שם משפחה"
              textAlign="right"
            />
          </View>

          {/* Phone Number - Only for new employees */}
          {!editingEmployee && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>מספר טלפון</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="הזן מספר טלפון"
                keyboardType="phone-pad"
                textAlign="right"
              />
            </View>
          )}

          {/* ID Number - Only for new employees */}
          {!editingEmployee && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>תעודת זהות</Text>
              <TextInput
                style={styles.input}
                value={idNumber}
                onChangeText={setIdNumber}
                placeholder="הזן תעודת זהות"
                keyboardType="numeric"
                textAlign="right"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>תפקיד</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedRole}
                style={styles.picker}
                onValueChange={(itemValue) => {
                  setSelectedRole(itemValue);
                  // Reset tip percentage when changing role
                  if (itemValue === 'manager' || itemValue === 'owner') {
                    setTipPercentage('100');
                  }
                }}
              >
                <Picker.Item label="מלצר" value="waiter" />
                <Picker.Item label="מנהל" value="manager" />
                <Picker.Item label="מלצר ומנהל" value="both" />
                {user.jobrole === 'owner' && (
                  <Picker.Item label="בעלים" value="owner" />
                )}
              </Picker>
            </View>
          </View>

          {/* Real Name Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם אמיתי:</Text>
            <TextInput
              style={styles.input}
              value={realName}
              onChangeText={setRealName}
              placeholder="הכנס שם אמיתי"
              placeholderTextColor="#A0AEC0"
              textAlign="right"
            />
          </View>

          {/* Working Status Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>סטטוס עבודה:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={working}
                style={styles.picker}
                onValueChange={(itemValue) => setWorking(itemValue)}
              >
                <Picker.Item label="עובד" value="yes" />
                <Picker.Item label="לא עובד" value="no" />
              </Picker>
            </View>
          </View>

          {/* Approval Status Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>סטטוס אישור:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={aprove}
                style={styles.picker}
                onValueChange={(itemValue) => setAprove(itemValue)}
              >
                <Picker.Item label="לא מאושר" value="no" />
                <Picker.Item label="מאושר" value="yes" />
              </Picker>
            </View>
          </View>

          {/* Tip Percentage Field - Only for waiters and both */}
          {(selectedRole === 'waiter' || selectedRole === 'both') && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>אחוז טיפים:</Text>
              <TextInput
                style={styles.input}
                value={tipPercentage}
                onChangeText={setTipPercentage}
                placeholder="100"
                keyboardType="numeric"
                textAlign="right"
              />
              <Text style={styles.inputHint}>
                100% = תעריף בסיסי, 120% = +20% יותר, 85% = 15% פחות
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.createButton,
              loading || !firstName.trim() || !lastName.trim() ? styles.buttonDisabled : null
            ]}
            onPress={handleSubmit}
            disabled={loading || !firstName.trim() || !lastName.trim()}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'מעבד...' : (editingEmployee ? 'עדכן עובד' : 'צור עובד')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>חזור</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default UserManagementScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E3F2FD',
    textAlign: 'center',
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
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D5DBDB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#2C3E50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D5DBDB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  picker: {
    height: 50,
    color: '#2C3E50',
  },
  toggleButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginLeft: 8,
  },
  employeeCounter: {
    backgroundColor: '#3498DB',
    borderRadius: 15,
    minWidth: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  employeeScrollView: {
    flex: 1,
    paddingHorizontal: 4,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  employeeAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  employeeInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  employeeMainInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 6,
    textAlign: 'right',
  },
  employeeStatusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusApproved: {
    backgroundColor: '#2ECC71',
  },
  statusPending: {
    backgroundColor: '#F39C12',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  employeeDetails: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  detailValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  employeeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3498DB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#3498DB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#E74C3C',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  listFooter: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
    marginTop: 16,
  },
  footerText: {
    fontSize: 16,
    color: '#3498DB',
    fontWeight: '600',
  },
  notAvailableText: {
    color: '#95A5A6',
    fontStyle: 'italic',
    fontSize: 13,
  },
  filterContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'right',
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BDC3C7',
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7F8C8D',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#28A745',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#95A5A6',
  },
  backButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

});