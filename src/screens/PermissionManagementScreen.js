import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/api';
import PermissionService from '../services/PermissionService';

// RTL layout handled by CSS for web compatibility

const PermissionManagementScreen = ({ navigation, route }) => {
  const [user] = useState(route.params?.user);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      console.log('🔧 Loading employees for permission management...');
      const result = await ApiService.getEmployees();
      console.log('🔧 Employees result:', result);
      
      if (result && result.success && Array.isArray(result.employees)) {
        console.log('👥 Employees loaded:', result.employees.length);
        // כל העובדים חוץ מבעלים (בעלים מקבלים הכל אוטומטית)
        const managementEmployees = result.employees.filter(emp => {
          const isNotOwner = emp.job !== 'owner';
          console.log(`Employee ${emp.wname}: job=${emp.job}, included=${isNotOwner}`);
          return isNotOwner;
        });
        console.log('👥 Employees found for permissions:', managementEmployees.length);
        setEmployees(managementEmployees);
      } else {
        console.error('Invalid employees response:', result);
        Alert.alert('שגיאה', 'תגובה לא תקינה מהשרת');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת העובדים: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeePermissions = async (employeeId) => {
    try {
      console.log('📋 Loading permissions for employee:', employeeId);
      const result = await PermissionService.loadEmployeePermissions(employeeId);
      console.log('📋 Loaded employee permissions:', result);
      setPermissions(result || {});
    } catch (error) {
      console.error('Error loading permissions:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון הרשאות העובד');
    }
  };

  const handleEmployeeSelect = async (employee) => {
    setSelectedEmployee(employee);
    await loadEmployeePermissions(employee.id);
  };

  const updatePermission = (permissionKey, value) => {
    setPermissions(prev => ({
      ...prev,
      [permissionKey]: value
    }));
  };

  const savePermissions = async () => {
    if (!selectedEmployee) return;

    try {
      setSaving(true);
      const success = await PermissionService.updateUserPermissions(
        selectedEmployee.id, 
        permissions
      );
      
      if (success) {
        Alert.alert('הצלחה', 'ההרשאות עודכנו בהצלחה');
      } else {
        Alert.alert('שגיאה', 'שגיאה בעדכון ההרשאות');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      Alert.alert('שגיאה', 'שגיאה בשמירת ההרשאות');
    } finally {
      setSaving(false);
    }
  };

  const setupManagerPermissions = async () => {
    try {
      setSaving(true);
      console.log('🔧 Starting manager permissions setup...');
      const result = await ApiService.setupManagerPermissions();
      
      if (result.success) {
        Alert.alert(
          'הצלחה!', 
          `טבלת הרשאות מנהלים הוקמה בהצלחה!\n\nנמצאו: ${result.managersFound} מנהלים\nנוספו: ${result.added} חדשים\nקיימים: ${result.skipped}`
        );
        // טען מחדש את רשימת העובדים
        await loadEmployees();
      } else {
        Alert.alert('שגיאה', result.message || 'שגיאה בהקמת טבלת ההרשאות');
      }
    } catch (error) {
      console.error('Error setting up manager permissions:', error);
      Alert.alert('שגיאה', 'שגיאה בהקמת טבלת הרשאות מנהלים');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    Alert.alert(
      'איפוס הרשאות',
      'האם אתה בטוח שברצונך לאפס את ההרשאות לברירת המחדל?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס',
          style: 'destructive',
          onPress: () => {
            if (selectedEmployee) {
              const defaultPerms = PermissionService.getDefaultPermissionsByRole(
                selectedEmployee.job
              );
              setPermissions(defaultPerms);
            }
          }
        }
      ]
    );
  };

  const filteredEmployees = employees ? employees.filter(emp => 
    roleFilter === 'all' || emp.job === roleFilter
  ) : [];

  const availablePermissions = PermissionService.getAllAvailablePermissions() || {};

  // 7 ההרשאות הרלוונטיות בלבד
  const permissionGroups = {
    core_permissions: {
      title: 'הרשאות מנהל',
      permissions: [
        'envelope_management',
        'manage_employees',
        'report_management',
        'monthly_income',
        'restaurant_dashboard',
        'statistics_screen',
        'manager_performance'
      ]
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ניהול הרשאות</Text>
      </View>

      {/* Temporary Setup Button */}
      <View style={styles.setupButtonContainer}>
        <TouchableOpacity
          style={styles.setupButton}
          onPress={setupManagerPermissions}
          disabled={saving}
        >
          <Text style={styles.setupButtonText}>
            {saving ? 'מקים טבלה...' : '🔧 הקם טבלת הרשאות מנהלים'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      ) : (
        <View style={styles.content}>
          {/* Employee Selection */}
          <View style={styles.selectionSection}>
            <Text style={styles.sectionTitle}>בחר עובד לניהול הרשאות:</Text>
            
            {/* Role Filter */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterButton, roleFilter === 'all' && styles.filterActive]}
                onPress={() => setRoleFilter('all')}
              >
                <Text style={[styles.filterText, roleFilter === 'all' && styles.filterTextActive]}>
                  הכל
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, roleFilter === 'manager' && styles.filterActive]}
                onPress={() => setRoleFilter('manager')}
              >
                <Text style={[styles.filterText, roleFilter === 'manager' && styles.filterTextActive]}>
                  מנהלים
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, roleFilter === 'both' && styles.filterActive]}
                onPress={() => setRoleFilter('both')}
              >
                <Text style={[styles.filterText, roleFilter === 'both' && styles.filterTextActive]}>
                  מנהל+מלצר
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, roleFilter === 'waiter' && styles.filterActive]}
                onPress={() => setRoleFilter('waiter')}
              >
                <Text style={[styles.filterText, roleFilter === 'waiter' && styles.filterTextActive]}>
                  מלצרים
                </Text>
              </TouchableOpacity>
            </View>

            {/* Employee List */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.employeeList}>
              {filteredEmployees.map(employee => (
                <TouchableOpacity
                  key={employee.id}
                  style={[
                    styles.employeeCard,
                    selectedEmployee?.id === employee.id && styles.employeeCardSelected
                  ]}
                  onPress={() => handleEmployeeSelect(employee)}
                >
                  <Text style={styles.employeeName}>{employee.realname || employee.wname}</Text>
                  <Text style={styles.employeeRole}>
                    {employee.job === 'manager' ? 'מנהל' : employee.job === 'both' ? 'מנהל+מלצר' : 'מלצר'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Permissions Management */}
          {selectedEmployee && (
            <ScrollView style={styles.permissionsSection}>
              <View style={styles.permissionsHeader}>
                <Text style={styles.permissionsTitle}>
                  הרשאות עבור: {selectedEmployee.realname || selectedEmployee.wname}
                </Text>
                <View style={styles.permissionActions}>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={resetToDefault}
                  >
                    <Text style={styles.resetButtonText}>אפס</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={savePermissions}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>שמור</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {Object.entries(permissionGroups).map(([groupKey, group]) => (
                <View key={groupKey} style={styles.permissionGroup}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.permissions.map(permKey => (
                    <View key={permKey} style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={styles.permissionName}>
                          {availablePermissions[permKey]?.name || permKey}
                        </Text>
                      </View>
                      <Switch
                        value={permissions[permKey] === true}
                        onValueChange={(value) => updatePermission(permKey, value)}
                        thumbColor={permissions[permKey] ? '#4CAF50' : '#F44336'}
                        trackColor={{ false: '#FFCDD2', true: '#C8E6C9' }}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

          {!selectedEmployee && (
            <View style={styles.noSelectionContainer}>
              <Text style={styles.noSelectionText}>בחר עובד כדי לנהל את ההרשאות שלו</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    flex: 1,
    marginRight: 20,
  },
  content: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  selectionSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 15,
  },
  filterContainer: {
    flexDirection: 'row-reverse',
    marginBottom: 15,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  filterActive: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 14,
    color: '#666666',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  employeeList: {
    maxHeight: 120,
  },
  employeeCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginLeft: 10,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  employeeCardSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  employeeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 5,
  },
  employeeRole: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  permissionsSection: {
    flex: 1,
    padding: 20,
  },
  permissionsHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'right',
  },
  permissionActions: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  resetButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#FF5722',
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  permissionGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 5,
  },
  permissionItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  permissionInfo: {
    flex: 1,
    marginLeft: 15,
  },
  permissionName: {
    fontSize: 14,
    color: '#333333',
    textAlign: 'right',
    marginBottom: 2,
  },
  permissionWarning: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'right',
  },
  noSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noSelectionText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  setupButtonContainer: {
    padding: 15,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  setupButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default PermissionManagementScreen;