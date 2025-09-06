import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
// StatusBar removed to prevent conflicts
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
// הסרתי NotificationService - גורם לקריסה

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(true);
  const [hasStoredUser, setHasStoredUser] = useState(false);

  useEffect(() => {
    testDatabaseConnection();
    checkExistingLogin();
    // הסרתי NotificationService - גורם לקריסה ב-Android
  }, []);

  const testDatabaseConnection = async () => {
    // Removed connection test since it's not needed and causes misleading warnings
    // The API will work properly when needed
    setTestingConnection(false);
  };

  const checkExistingLogin = async () => {
    try {
      // Don't auto-navigate to prevent getting stuck - user needs to manually login
      const savedUser = await AsyncStorage.getItem('currentUser');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        console.log('🔐 Found existing user:', userData.wname);
        // Set username to help user but don't auto-navigate
        if (userData.username) {
          setUsername(userData.username);
        }
        setHasStoredUser(true);
      }
    } catch (error) {
      console.error('Error checking saved user:', error);
      // אל תיתן לשגיאה לקרוס את האפליקציה
      setHasStoredUser(false);
    }
  };

  const showLoginHelp = () => {
    Alert.alert(
      'עזרה בהתחברות',
      'עבור המשתמש יוס יוס:\n\nשם משתמש: 0000000000\nסיסמה: 0000000000\n\n(אותו מספר לשם משתמש ולסיסמה)',
      [{ text: 'הבנתי' }]
    );
  };

  const clearStoredData = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert('הצלחה', 'המידע המאוחסן נוקה בהצלחה');
      setUsername('');
      setPassword('');
      setHasStoredUser(false);
    } catch (error) {
      Alert.alert('שגיאה', 'בעיה בניקוי המידע');
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס שם משתמש וסיסמה');
      return;
    }

    setLoading(true);
    
    try {
      const result = await ApiService.login(username.trim(), password.trim());
      
      if (result.success) {
        // בדוק אם יש הסכם עבודה שנחתם מקומית
        const localAgreementKey = `work_agreement_${result.user.id}`;
        const localAgreementSigned = await AsyncStorage.getItem(localAgreementKey);
        
        // Check if user needs approval - only for waiter and both roles
        if (result.user && 
            (result.user.jobrole === "waiter" || result.user.jobrole === "both") && 
            (result.user.aprove === "no" || result.user.aprove === "No") &&
            !localAgreementSigned) {
          console.log('🔐 User needs work agreement approval:', result.user.wname);
          console.log('🔐 Navigating directly to WorkAgreement screen...');
          // Save user data before navigating
          await AsyncStorage.setItem('currentUser', JSON.stringify(result.user));
          // Navigate directly to WorkAgreement screen (Alert doesn't work well in web)
          navigation.navigate('WorkAgreement', { user: result.user });
          return;
        }
        
        // משתמש מאושר או חתם על הסכם מקומית - המשך למערכת
        if (localAgreementSigned && (result.user.aprove === "no" || result.user.aprove === "No")) {
          console.log('🔐 User has local work agreement signed, treating as approved');
          result.user.aprove = 'yes'; // עדכן מקומית
        }
        
        // User is approved or doesn't need approval check - proceed to main menu
        await AsyncStorage.setItem('currentUser', JSON.stringify(result.user));
        console.log('🔐 User data saved, navigating to Menu...');
        // Navigate directly without Alert (Alert doesn't work well in React Native Web)
        navigation.replace('Menu', { user: result.user });
      } else if (result.needsWorkAgreement) {
        Alert.alert(
          'נדרש חתימה על הסכם עבודה',
          result.message || 'יש לחתום על הסכם עבודה לפני תחילת העבודה',
          [
            {
              text: 'חתום על ההסכם',
              onPress: () => navigation.navigate('WorkAgreement', { user: result.user })
            },
            {
              text: 'ביטול',
              style: 'cancel'
            }
          ]
        );
      } else if (result.needsApproval) {
        Alert.alert(
          'ממתין לאישור',
          result.message || 'המשתמש ממתין לאישור מנהל',
          [{ text: 'אישור' }]
        );
      } else {
        Alert.alert(
          'שגיאת התחברות',
          result.message || 'שם משתמש או סיסמה שגויים',
          [{ text: 'אישור' }]
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'שגיאה',
        'שגיאה לא צפויה בהתחברות. אנא נסה שוב.',
        [{ text: 'אישור' }]
      );
    } finally {
      setLoading(false);
    }
  };

  if (testingConnection) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>בודק חיבור לשרת...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.title}>מערכת ניהול</Text>
          <Text style={styles.subtitle}>התחברות למערכת</Text>
          
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>שם משתמש:</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="הכנס שם משתמש"
              placeholderTextColor="#999"
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>סיסמה:</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="הכנס סיסמה"
              placeholderTextColor="#999"
              textAlign="right"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>התחבר</Text>
            )}
          </TouchableOpacity>


        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loginCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 15,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    textAlign: 'right',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4A90E2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  warningSubText: {
    color: '#856404',
    fontSize: 12,
    textAlign: 'center',
  },
  helpButton: {
    backgroundColor: '#17a2b8',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#138496',
  },
  helpButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;