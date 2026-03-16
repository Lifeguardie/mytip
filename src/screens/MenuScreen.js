import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'react-native';
import ApiService from '../services/api';
import PermissionService from '../services/PermissionService.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MenuScreen = ({ navigation, route }) => {
  const [user, setUser] = useState(route.params?.user || null);
  const [envelopeCount, setEnvelopeCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isManagerMode, setIsManagerMode] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);

  useEffect(() => {
    if (!user) {
      checkSavedUser();
    } else {
      loadEnvelopeSummary();
      loadUserPermissions();
    }
  }, [user]);

  // Debug הרשאות בעת רינדור
  useEffect(() => {
    console.log('🔒 MenuScreen: userPermissions state changed:', userPermissions);
  }, [userPermissions]);

  const loadUserPermissions = async (userData = user) => {
    if (!userData) return;
    try {
      console.log('🔒 MenuScreen: Loading permissions for user:', userData.id);
      const permissions = await PermissionService.loadUserPermissions(userData.id);
      console.log('🔒 MenuScreen: Loaded permissions:', permissions);
      setUserPermissions(permissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const checkSavedUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('currentUser');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        await loadEnvelopeSummary(userData);
      } else {
        navigation.replace('Login');
      }
    } catch (error) {
      console.error('Error loading user:', error);
      navigation.replace('Login');
    }
  };

  const loadEnvelopeSummary = async (userData = user) => {
    if (!userData) return;
    
    try {
      setLoading(true);
      const result = await ApiService.getEnvelopes(userData.username);
      
      if (result.success && result.envelopes) {
        // Count only open envelopes (goit = 'No')
        const openEnvelopes = result.envelopes.filter(env => env.goit === 'No');
        setEnvelopeCount(openEnvelopes.length);
        const total = openEnvelopes.reduce((sum, env) => sum + parseFloat(env.sumin || 0), 0);
        setTotalAmount(total);
      }
    } catch (error) {
      console.error('Error loading envelope summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEnvelopeSummary();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'התנתק',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('currentUser');
            await PermissionService.clearPermissions();
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  const setupManagerPermissions = async () => {
    console.log('🎯 Setup button pressed!');
    
    try {
      setLoading(true);
      console.log('🔧 Starting manager permissions setup...');
      const result = await ApiService.setupManagerPermissions();
      console.log('🔧 Setup result:', result);
      
      if (result && result.success) {
        Alert.alert(
          'הצלחה!', 
          `טבלת הרשאות מנהלים הוקמה בהצלחה!\n\nנמצאו: ${result.managersFound} מנהלים\nנוספו: ${result.added} חדשים\nקיימים: ${result.skipped}`,
          [{ text: 'אישור', onPress: () => loadUserPermissions() }]
        );
      } else {
        Alert.alert('שגיאה', result?.message || 'שגיאה בהקמת טבלת ההרשאות');
      }
    } catch (error) {
      console.error('Error setting up manager permissions:', error);
      Alert.alert('שגיאה', 'שגיאה בהקמת טבלת הרשאות מנהלים: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMenuItemsByRole = (userJob) => {
    const baseItems = [];

    // תפריט עבור בעלים (owner)
    if (userJob === 'owner') {
      return [
        {
          id: 'dashboard',
          title: '📊 דוח מסעדה מרוכז',
          description: 'נתוני הכנסות וביצועי המסעדה',
          icon: '🏪',
          color: ['#4A90E2', '#357ABD'],
          onPress: () => navigation.navigate('MobileDashboard', { user })
        },
        {
          id: 'waiter-monthly',
          title: '👨‍🍳 הכנסות חודשיות מלצרים',
          description: 'הכנסות כל המלצרים לפי חודש',
          icon: '💼',
          color: ['#FF9800', '#F57C00'],
          onPress: () => navigation.navigate('WaiterMonthlyIncome', { user })
        },
        {
          id: 'auto-envelope',
          title: '🤖 יצירת מעטפות ממוחשב',
          description: 'יצירת מעטפות מרובות עם חלוקה לפי שעות',
          icon: '🤖',
          color: ['#9C27B0', '#7B1FA2'],
          onPress: () => navigation.navigate('AutoEnvelope', { user })
        },
        // מסכי ניהול בעלים - רק אם יש הרשאה
        ...(userPermissions?.envelope_management ? [{
          id: 'envelope-management',
          title: '📂 ניהול מעטפות',
          description: 'מידע, עדכון ומחיקה של מעטפות',
          icon: '📂',
          color: ['#FF6B6B', '#EE5A52'],
          onPress: () => navigation.navigate('EnvelopeManagement', { user })
        }] : []),
        ...(userPermissions?.report_management ? [{
          id: 'report-management',
          title: '📊 ניהול דוחות',
          description: 'עדכון ומחיקה של רשומות דוח סוף יום',
          icon: '📊',
          color: ['#4ECDC4', '#26D0CE'],
          onPress: () => navigation.navigate('ReportManagement', { user })
        }] : []),
        ...(userPermissions?.manager_performance ? [{
          id: 'manager-performance',
          title: '🎯 ביצועי מנהלים',
          description: 'דוחות ביצועי צוות הניהול',
          icon: '🎯',
          color: ['#45B7D1', '#3A9BC1'],
          onPress: () => navigation.navigate('ManagerPerformance', { user })
        }] : []),
        ...(userPermissions?.statistics_screen ? [{
          id: 'statistics',
          title: '📈 סטטיסטיקה',
          description: 'נתונים סטטיסטיים והיסטורה',
          icon: '📈',
          color: ['#96CEB4', '#85C1A3'],
          onPress: () => navigation.navigate('Statistics', { user })
        }] : []),
        {
          id: 'employees',
          title: '👥 ניהול והקמת עובדים',
          description: 'ניהול עובדים קיימים והוספת עובדים חדשים',
          icon: '👨‍💼',
          color: ['#FF5722', '#D84315'],
          onPress: () => navigation.navigate('UserManagement', { user })
        },
        {
          id: 'setup-permissions',
          title: '⚙️ הקמת מערכת הרשאות',
          description: 'הקמה ראשונית של טבלת הרשאות מנהלים (חד פעמי)',
          icon: '⚙️',
          color: ['#FFA726', '#FB8C00'],
          onPress: setupManagerPermissions
        },
        {
          id: 'permission-management',
          title: '🔐 ניהול הרשאות',
          description: 'ניהול הרשאות למנהלים ומלצר-מנהלים',
          icon: '🔐',
          color: ['#9C27B0', '#7B1FA2'],
          onPress: () => navigation.navigate('PermissionManagement', { user })
        },
        {
          id: 'end-of-day',
          title: '🌅 דוח סוף יום',
          description: 'דוח סיכום יומי של הטיפים והמעטפות',
          icon: '📋',
          color: ['#795548', '#5D4037'],
          onPress: () => navigation.navigate('EndOfDay', { user })
        }
      ];
    }

    // תפריט עבור מנהל (manager)
    if (userJob === 'manager') {
      return [
        {
          id: 'tips',
          title: 'הכנס טיפים',
          description: 'רישום מעטפות טיפים לעובדים',
          icon: '💵',
          color: ['#4CAF50', '#45a049'],
          onPress: () => navigation.navigate('TipEntry', { user })
        },
        {
          id: 'auto-envelope',
          title: 'יצירת מעטפות ממוחשב',
          description: 'יצירת מעטפות מרובות עם חלוקה לפי שעות',
          icon: '🤖',
          color: ['#9C27B0', '#7B1FA2'],
          onPress: () => navigation.navigate('AutoEnvelope', { user })
        },
        {
          id: 'deliver-envelopes',
          title: 'מסור מעטפות',
          description: 'מסירת מעטפות לעובדים',
          icon: '📦',
          color: ['#FF9800', '#F57C00'],
          onPress: () => navigation.navigate('DeliverEnvelopes', { user })
        },
        {
          id: 'end-of-day',
          title: '🌅 דוח סוף יום',
          description: 'דוח סיכום יומי של הטיפים והמעטפות',
          icon: '📋',
          color: ['#795548', '#5D4037'],
          onPress: () => navigation.navigate('EndOfDay', { user })
        },
        // מסכי ניהול בעלים - רק אם יש הרשאה
        ...(userPermissions?.envelope_management ? [{
          id: 'envelope-management',
          title: '📂 ניהול מעטפות',
          description: 'מידע, עדכון ומחיקה של מעטפות',
          icon: '📂',
          color: ['#FF6B6B', '#EE5A52'],
          onPress: () => navigation.navigate('EnvelopeManagement', { user })
        }] : []),
        ...(userPermissions?.report_management ? [{
          id: 'report-management',
          title: '📊 ניהול דוחות',
          description: 'עדכון ומחיקה של רשומות דוח סוף יום',
          icon: '📊',
          color: ['#4ECDC4', '#26D0CE'],
          onPress: () => navigation.navigate('ReportManagement', { user })
        }] : []),
        {
          id: 'manager-performance-screen',
          title: '🎯 ביצועי מנהלים',
          description: 'דוחות ביצועי צוות הניהול',
          icon: '🎯',
          color: ['#45B7D1', '#3A9BC1'],
          onPress: () => navigation.navigate('ManagerPerformance', { user })
        },
        ...(userPermissions?.restaurant_dashboard ? [{
          id: 'restaurant-dashboard',
          title: '🏪 דוח מסעדה מרוכז',
          description: 'סקירה כללית של נתוני המסעדה',
          icon: '🏪',
          color: ['#6B5B95', '#5A4A85'],
          onPress: () => navigation.navigate('MobileDashboard', { user })
        }] : []),
        ...(userPermissions?.statistics_screen ? [{
          id: 'statistics-screen',
          title: '📈 סטטיסטיקה',
          description: 'נתונים סטטיסטיים והיסטורה',
          icon: '📈',
          color: ['#96CEB4', '#85C1A3'],
          onPress: () => navigation.navigate('Statistics', { user })
        }] : []),
        ...(userPermissions?.manage_employees ? [{
          id: 'manage-employees',
          title: '👥 ניהול עובדים',
          description: 'הוספה, עדכון ומחיקה של עובדים',
          icon: '👥',
          color: ['#FF9800', '#F57C00'],
          onPress: () => navigation.navigate('UserManagement', { user })
        }] : []),
        ...(userPermissions?.monthly_income ? [{
          id: 'monthly-income-waiters',
          title: '💰 הכנסות חודשיות מלצרים',
          description: 'דוח הכנסות חודשיות לפי מלצר',
          icon: '💰',
          color: ['#8BC34A', '#689F38'],
          onPress: () => navigation.navigate('MonthlyIncome', { user, viewAllWaiters: true })
        }] : [])
      ];
    }

    // תפריט עבור מלצר-מנהל (both)
    if (userJob === 'both') {
      if (isManagerMode) {
        // תפריט מנהלים
        return [
          {
            id: 'tips',
            title: 'הכנס טיפים',
            description: 'רישום מעטפות טיפים לעובדים',
            icon: '💵',
            color: ['#4CAF50', '#45a049'],
            onPress: () => navigation.navigate('TipEntry', { user })
          },
          {
            id: 'auto-envelope',
            title: 'יצירת מעטפות ממוחשב',
            description: 'יצירת מעטפות מרובות עם חלוקה לפי שעות',
            icon: '🤖',
            color: ['#9C27B0', '#7B1FA2'],
            onPress: () => navigation.navigate('AutoEnvelope', { user })
          },
          {
            id: 'deliver-envelopes',
            title: 'מסור מעטפות',
            description: 'מסירת מעטפות לעובדים',
            icon: '📦',
            color: ['#FF9800', '#F57C00'],
            onPress: () => navigation.navigate('DeliverEnvelopes', { user })
          },
          {
            id: 'manager-performance',
            title: 'ביצועי מנהלים',
            description: 'דוחות ביצועי צוות הניהול',
            icon: '📊',
            color: ['#2196F3', '#1976D2'],
            onPress: () => Alert.alert('בקרוב', 'תכונה זו תהיה זמינה בקרוב')
          },
          // כפתור "הקם עובד" מוצג רק אם אין הרשאה לניהול עובדים מלא
          ...(userPermissions?.manage_employees ? [] : [{
            id: 'setup-employee',
            title: 'הקם עובד',
            description: 'הוספת עובד חדש למערכת',
            icon: '👤',
            color: ['#9C27B0', '#7B1FA2'],
            onPress: () => navigation.navigate('UserManagement', { user })
          }]),
          {
            id: 'manager-messages',
            title: 'הודעות בין מנהלים',
            description: 'מערכת הודעות פנימית לניהול',
            icon: '💬',
            color: ['#607D8B', '#455A64'],
            onPress: () => Alert.alert('בקרוב', 'תכונה זו תהיה זמינה בקרוב')
          },
          {
            id: 'end-of-day',
            title: '🌅 דוח סוף יום',
            description: 'דוח סיכום יומי של הטיפים והמעטפות',
            icon: '📋',
            color: ['#795548', '#5D4037'],
            onPress: () => navigation.navigate('EndOfDay', { user })
          },
          // מסכי ניהול בעלים - רק אם יש הרשאה
          ...(userPermissions?.envelope_management ? [{
            id: 'envelope-management',
            title: '📂 ניהול מעטפות',
            description: 'מידע, עדכון ומחיקה של מעטפות',
            icon: '📂',
            color: ['#FF6B6B', '#EE5A52'],
            onPress: () => navigation.navigate('EnvelopeManagement', { user })
          }] : []),
          ...(userPermissions?.report_management ? [{
            id: 'report-management',
            title: '📊 ניהול דוחות',
            description: 'עדכון ומחיקה של רשומות דוח סוף יום',
            icon: '📊',
            color: ['#4ECDC4', '#26D0CE'],
            onPress: () => navigation.navigate('ReportManagement', { user })
          }] : []),
          {
            id: 'manager-performance-screen',
            title: '🎯 ביצועי מנהלים',
            description: 'דוחות ביצועי צוות הניהול',
            icon: '🎯',
            color: ['#45B7D1', '#3A9BC1'],
            onPress: () => navigation.navigate('ManagerPerformance', { user })
          },
          ...(userPermissions?.restaurant_dashboard ? [{
            id: 'restaurant-dashboard',
            title: '🏪 דוח מסעדה מרוכז',
            description: 'סקירה כללית של נתוני המסעדה',
            icon: '🏪',
            color: ['#6B5B95', '#5A4A85'],
            onPress: () => navigation.navigate('MobileDashboard', { user })
          }] : []),
          ...(userPermissions?.statistics_screen ? [{
            id: 'statistics-screen',
            title: '📈 סטטיסטיקה',
            description: 'נתונים סטטיסטיים והיסטורה',
            icon: '📈',
            color: ['#96CEB4', '#85C1A3'],
            onPress: () => navigation.navigate('Statistics', { user })
          }] : []),
          ...(userPermissions?.manage_employees ? [{
            id: 'manage-employees',
            title: '👥 ניהול עובדים',
            description: 'הוספה, עדכון ומחיקה של עובדים',
            icon: '👥',
            color: ['#FF9800', '#F57C00'],
            onPress: () => navigation.navigate('UserManagement', { user })
          }] : []),
          ...(userPermissions?.monthly_income ? [{
            id: 'monthly-income-waiters',
            title: '💰 הכנסות חודשיות מלצרים',
            description: 'דוח הכנסות חודשיות לפי מלצר',
            icon: '💰',
            color: ['#8BC34A', '#689F38'],
            onPress: () => navigation.navigate('MonthlyIncome', { user, viewAllWaiters: true })
          }] : [])
        ];
      } else {
        // תפריט מלצרים
        return [
          {
            id: 'tips',
            title: 'הכנס טיפים',
            description: 'הכנסת מעטפות טיפים למערכת',
            icon: '💵',
            color: ['#4CAF50', '#45a049'],
            onPress: () => navigation.navigate('TipEntry', { user })
          },
          {
            id: 'auto-envelope',
            title: 'יצירת מעטפות ממוחשב',
            description: 'יצירת מעטפות מרובות עם חלוקה לפי שעות',
            icon: '🤖',
            color: ['#9C27B0', '#7B1FA2'],
            onPress: () => navigation.navigate('AutoEnvelope', { user })
          },
          {
            id: 'envelopes',
            title: 'מעטפות פתוחות',
            description: 'צפה במעטפות שממתינות לך',
            icon: '📨',
            color: ['#00BCD4', '#0097A7'],
            onPress: () => navigation.navigate('Envelopes', { user })
          },
          {
            id: 'monthly',
            title: 'ההכנסה החודשית',
            description: 'צפה בהכנסה שלך לפי חודשים',
            icon: '📊',
            color: ['#8BC34A', '#689F38'],
            onPress: () => navigation.navigate('MonthlyIncome', { user })
          },
          {
            id: 'morning-checklist',
            title: 'צ׳קליסט בוקר',
            description: 'רשימת משימות לתחילת המשמרת',
            icon: '🌅',
            color: ['#FFC107', '#FF8F00'],
            onPress: () => navigation.navigate('MorningChecklist', { user })
          },
          {
            id: 'evening-checklist',
            title: 'צ׳קליסט ערב',
            description: 'רשימת משימות לסיום המשמרת',
            icon: '🌆',
            color: ['#673AB7', '#512DA8'],
            onPress: () => navigation.navigate('EveningChecklist', { user })
          },
          {
            id: 'shift-change',
            title: 'החלפת משמרת',
            description: 'העברת נתונים בין משמרות',
            icon: '🔄',
            color: ['#795548', '#5D4037'],
            onPress: () => Alert.alert('בקרוב', 'תכונה זו תהיה זמינה בקרוב')
          }
        ];
      }
    }

    // תפריט עבור מלצר רגיל (waiter או ברירת מחדל)
    return [
      {
        id: 'tips',
        title: '💰 הכנס טיפים',
        description: 'הכנסת מעטפות טיפים למערכת',
        icon: '💵',
        color: ['#4CAF50', '#45a049'],
        onPress: () => navigation.navigate('TipEntry', { user })
      },
      {
        id: 'auto-envelope',
        title: '🤖 יצירת מעטפות ממוחשב',
        description: 'יצירת מעטפות מרובות עם חלוקה לפי שעות',
        icon: '🤖',
        color: ['#9C27B0', '#7B1FA2'],
        onPress: () => navigation.navigate('AutoEnvelope', { user })
      },
      {
        id: 'envelopes',
        title: '📧 מעטפות פתוחות',
        description: 'צפה במעטפות שממתינות לך',
        icon: '📨',
        color: ['#00BCD4', '#0097A7'],
        onPress: () => navigation.navigate('Envelopes', { user })
      },
      {
        id: 'monthly',
        title: '💰 ההכנסה החודשית',
        description: 'צפה בהכנסה שלך לפי חודשים',
        icon: '📊',
        color: ['#8BC34A', '#689F38'],
        onPress: () => navigation.navigate('MonthlyIncome', { user })
      },
      {
        id: 'morning-checklist',
        title: '☀️ צ׳ק ליסט בוקר',
        description: 'רשימת בדיקות למשמרת הבוקר',
        icon: '📝',
        color: ['#FF9800', '#F57C00'],
        onPress: () => navigation.navigate('MorningChecklist', { user })
      },
      {
        id: 'evening-checklist',
        title: '🌙 צ׳ק ליסט ערב',
        description: 'רשימת בדיקות למשמרת הערב',
        icon: '📋',
        color: ['#673AB7', '#512DA8'],
        onPress: () => navigation.navigate('EveningChecklist', { user })
      },
      {
        id: 'shift-change',
        title: '🔄 החלפת משמרת',
        description: 'העברת נתונים בין משמרות',
        icon: '⚡',
        color: ['#9C27B0', '#7B1FA2'],
        onPress: () => Alert.alert('החלפת משמרת', 'תכונה זו תהיה זמינה בקרוב')
      }
    ];
  };

  const menuItems = getMenuItemsByRole(user?.jobrole || user?.job || 'waiter');

  if (!user || !userPermissions) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>טוען הרשאות...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar style="light" backgroundColor="#4A90E2" />
      
      {/* User Info Card */}
      <View style={styles.userInfoCard}>
        <Text style={styles.welcomeText}>שלום {(user.realname && user.realname.trim() !== '') ? user.realname : user.wname}!</Text>
        <Text style={styles.userDetailsText}>
          תפקיד: {user.jobrole === 'waiter' ? 'מלצר' : user.jobrole === 'manager' ? 'מנהל' : user.jobrole === 'both' ? (isManagerMode ? 'מנהל' : 'מלצר') : user.jobrole}
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>התנתק</Text>
        </TouchableOpacity>
      </View>

      {/* Envelope Summary - Only show for non-owners */}
      {(user?.jobrole === 'waiter' || user?.jobrole === 'both') && (
        <View style={styles.envelopeSummaryCard}>
          <Text style={styles.summaryTitle}>מעטפות פתוחות</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#4A90E2" />
          ) : (
            <>
              <Text style={styles.summaryText}>מספר מעטפות: {envelopeCount}</Text>
              <Text style={styles.summaryAmount}>סכום כולל: ₪{totalAmount.toFixed(2)}</Text>
            </>
          )}
        </View>
      )}

      {/* Manager Mode Toggle for 'both' role */}
      {user?.jobrole === 'both' && (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !isManagerMode && styles.toggleButtonActive
            ]}
            onPress={() => setIsManagerMode(false)}
          >
            <Text style={[
              styles.toggleButtonText,
              !isManagerMode && styles.toggleButtonTextActive
            ]}>
              מלצר
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isManagerMode && styles.toggleButtonActive
            ]}
            onPress={() => setIsManagerMode(true)}
          >
            <Text style={[
              styles.toggleButtonText,
              isManagerMode && styles.toggleButtonTextActive
            ]}>
              מנהל
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu Grid */}
      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.menuItem,
              { 
                backgroundColor: item.color[0],
                shadowColor: item.color[0] 
              }
            ]}
            onPress={item.onPress}
            activeOpacity={0.8}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuItemTitle}>{item.title}</Text>
            <Text style={styles.menuItemDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100, // Extra padding for safety
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Arial',
    textAlign: 'center',
  },
  userInfoCard: {
    backgroundColor: '#4A90E2',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 5,
    fontFamily: 'Arial',
  },
  userDetailsText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'Arial',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Arial',
  },
  envelopeSummaryCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'Arial',
  },
  summaryText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
    fontFamily: 'Arial',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    fontFamily: 'Arial',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 5,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  toggleButtonActive: {
    backgroundColor: '#4A90E2',
  },
  toggleButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    fontFamily: 'Arial',
  },
  toggleButtonTextActive: {
    color: 'white',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '48%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  menuIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  menuItemDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default MenuScreen;