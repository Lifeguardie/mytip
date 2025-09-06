import React, { useState, useEffect, useRef, Component } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// Screen imports with safe defaults
import LoginScreen from './src/screens/LoginScreen';
import MenuScreen from './src/screens/MenuScreen';
import TipEntryScreen from './src/screens/TipEntryScreen';
import EnvelopesScreen from './src/screens/EnvelopesScreen';
// Import the updated MonthlyIncomeScreen - now with direct API calls and test data
import MonthlyIncomeScreen from './src/screens/MonthlyIncomeScreen';
import MobileDashboardScreen from './src/screens/MobileDashboardScreen';
import DeliverEnvelopesScreen from './src/screens/DeliverEnvelopesScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import EndOfDayScreen from './src/screens/EndOfDayScreen';
import WorkAgreementScreen from './src/screens/WorkAgreementScreen';
import MorningChecklistScreen from './src/screens/MorningChecklistScreen';
import ManageChecklistScreen from './src/screens/ManageChecklistScreen';
import EveningChecklistScreen from './src/screens/EveningChecklistScreen';
import ManageEveningChecklistScreen from './src/screens/ManageEveningChecklistScreen';
import AutoEnvelopeScreen from './src/screens/AutoEnvelopeScreen';
import ReportManagementScreen from './src/screens/ReportManagementScreen';
import PermissionManagementScreen from './src/screens/PermissionManagementScreen';
import EnvelopeManagementScreen from './src/screens/EnvelopeManagementScreen';
import WaiterMonthlyIncomeScreen from './src/screens/WaiterMonthlyIncomeScreen';
import ManagerPerformanceScreen from './src/screens/ManagerPerformanceScreen';

// No expo-notifications - removed for compatibility

const Stack = createNativeStackNavigator();

// Error Boundary Component - Enhanced
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    console.error('ErrorBoundary caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Details:', error, errorInfo);
    console.error('Error Stack:', error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>שגיאה באפליקציה</Text>
          <Text style={errorStyles.message}>אנא רענן את האפליקציה</Text>
          <Text style={errorStyles.error}>{this.state.error?.message}</Text>
          <Text style={errorStyles.stack}>{this.state.error?.stack?.substring(0, 200)}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    console.log('🚀 MyTip App Starting...');
    console.log('📱 Running without expo-notifications');
  }, []);

  return (
    <ErrorBoundary>
      <NavigationContainer>
        {/* הסרתי StatusBar - גורם לקריסה ב-Android */}
        <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { 
            backgroundColor: '#4A90E2' 
          },
          headerTintColor: '#fff',
          headerTitleStyle: { 
            fontWeight: 'bold',
            fontSize: 18 
          },
          headerTitleAlign: 'center',
          headerBackTitleVisible: false
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="Menu" 
          component={MenuScreen} 
          options={{ 
            title: 'מערכת ניהול טיפים',
            headerLeft: () => null,
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="TipEntry" 
          component={TipEntryScreen} 
          options={{ 
            title: 'הכנס טיפים' 
          }} 
        />
        <Stack.Screen 
          name="Envelopes" 
          component={EnvelopesScreen} 
          options={{ 
            title: 'המעטפות שלי' 
          }} 
        />
        <Stack.Screen 
          name="MonthlyIncome" 
          component={MonthlyIncomeScreen} 
          options={{ 
            title: 'ההכנסה החודשית שלי' 
          }} 
        />
        <Stack.Screen 
          name="MobileDashboard" 
          component={MobileDashboardScreen} 
          options={{ 
            title: 'דוח כספי' 
          }} 
        />
        <Stack.Screen 
          name="DeliverEnvelopes" 
          component={DeliverEnvelopesScreen} 
          options={{ 
            title: 'מסירת מעטפות' 
          }} 
        />
        <Stack.Screen 
          name="UserManagement" 
          component={UserManagementScreen} 
          options={{ 
            title: 'הקמת עובד חדש' 
          }} 
        />
        <Stack.Screen 
          name="EndOfDay" 
          component={EndOfDayScreen} 
          options={{ 
            title: 'דוח סוף יום',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="WorkAgreement" 
          component={WorkAgreementScreen} 
          options={{ 
            title: 'הסכם עבודה',
            headerShown: false,
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="MorningChecklist" 
          component={MorningChecklistScreen} 
          options={{ 
            title: 'צ\'קליסט בוקר',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="ManageChecklist" 
          component={ManageChecklistScreen} 
          options={{ 
            title: 'ניהול צ\'קליסט בוקר',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="EveningChecklist" 
          component={EveningChecklistScreen} 
          options={{ 
            title: 'צ\'קליסט ערב',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="ManageEveningChecklist" 
          component={ManageEveningChecklistScreen} 
          options={{ 
            title: 'ניהול צ\'קליסט ערב',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="AutoEnvelope" 
          component={AutoEnvelopeScreen} 
          options={{ 
            title: 'יצירת מעטפות ממוחשב',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="ReportManagement" 
          component={ReportManagementScreen} 
          options={{ 
            title: 'ניהול דוחות',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="PermissionManagement" 
          component={PermissionManagementScreen} 
          options={{ 
            title: 'ניהול הרשאות',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="EnvelopeManagement" 
          component={EnvelopeManagementScreen} 
          options={{ 
            title: 'ניהול מעטפות',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="WaiterMonthlyIncome" 
          component={WaiterMonthlyIncomeScreen} 
          options={{ 
            title: 'הכנסות חודשיות מלצרים',
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="ManagerPerformance" 
          component={ManagerPerformanceScreen} 
          options={{ 
            title: 'ביצועי מנהלים',
            headerShown: false
          }} 
        />

      </Stack.Navigator>
    </NavigationContainer>
    </ErrorBoundary>
  );
}

// Removed registerForPushNotificationsAsync - no expo-notifications

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  error: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  stack: {
    fontSize: 10,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 10,
  },
});