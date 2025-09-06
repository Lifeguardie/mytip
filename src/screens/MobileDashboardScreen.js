import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { StatusBar } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/api';
import PermissionService from '../services/PermissionService';

const MobileDashboardScreen = ({ route }) => {
  const { user } = route.params;
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);

  const months = [
    { label: 'כל השנה', value: '' },
    { label: 'ינואר', value: '1' },
    { label: 'פברואר', value: '2' },
    { label: 'מרץ', value: '3' },
    { label: 'אפריל', value: '4' },
    { label: 'מאי', value: '5' },
    { label: 'יוני', value: '6' },
    { label: 'יולי', value: '7' },
    { label: 'אוגוסט', value: '8' },
    { label: 'ספטמבר', value: '9' },
    { label: 'אוקטובר', value: '10' },
    { label: 'נובמבר', value: '11' },
    { label: 'דצמבר', value: '12' }
  ];

  useEffect(() => {
    loadPermissionsAndData();
  }, []);

  const loadPermissionsAndData = async () => {
    try {
      console.log('🔒 Loading permissions for dashboard user:', user.id || user.username);
      const permissions = await PermissionService.loadUserPermissions(user.id || user.username);
      setUserPermissions(permissions);
      console.log('🔒 Dashboard permissions loaded:', permissions);
      
      // Load dashboard data after permissions are loaded
      loadDashboardData(permissions);
    } catch (error) {
      console.error('🔒 Error loading permissions:', error);
      // If permission loading fails, continue with owner-only access
      loadDashboardData(null);
    }
  };

  const loadDashboardData = async (permissions = userPermissions) => {
    try {
      setLoading(true);
      
      const params = {
        year: selectedYear,
        month: selectedMonth || undefined,
        userId: user.username || user.id
      };

      const userRole = user?.jobrole || user?.job;
      console.log('📊 Loading dashboard data for user role:', userRole);
      console.log('🔒 Checking permissions:', permissions);
      
      let result;
      
      // Allow access for owners OR managers with restaurant_dashboard permission
      if (userRole === 'owner' || permissions?.restaurant_dashboard) {
        console.log('🏪 Loading restaurant summary for authorized user');
        result = await ApiService.getRestaurantSummary(params.month, params.year);
        
        // טעינת צפי הכנסות חכם - רק לחודש הנוכחי
        let forecastData = null;
        const currentDate = new Date();
        const isCurrentMonth = (currentDate.getMonth() + 1 == params.month) && (currentDate.getFullYear() == params.year);
        
        if (isCurrentMonth) {
          try {
            console.log('🔮 Loading smart income forecast for current month');
            const forecastResult = await ApiService.getIncomeForecast(params.month, params.year);
            if (forecastResult.success) {
              forecastData = forecastResult.data;
              console.log('🔮 Forecast data loaded:', forecastData);
            }
          } catch (forecastError) {
            console.error('🔮 Forecast loading failed:', forecastError);
          }
        }
        
        if (result.success) {
          // חישוב חכם של ממוצעים יומיים - משתמשים בזיהוי ימי סגירה מהצפי החכם
          const restaurantRevenue = result.data.restaurantRevenue || 0;
          const deliveryRevenue = result.data.deliveryRevenue || 0;
          const morningTips = result.data.morningTips || 0;
          const eveningTips = result.data.eveningTips || 0;
          const daysInMonth = result.data.daysInMonth || 30;
          
          // חישוב ממוצעים יומיים רגיל (על בסיס דוחות בפועל)
          const totalReports = result.data.totalReports || 0;
          const closedDays = forecastData?.closedDays || 0; // רק למידע, לא לחישוב הממוצע
          const effectiveDays = Math.max(1, totalReports); // מספר הדוחות בפועל
          
          console.log(`🧮 Daily averages calculation: Based on ${totalReports} actual reports, ${effectiveDays} effective days`);
          
          const dashboardData = {
            restaurantRevenue: restaurantRevenue,     // הכנסות מסעדה (myz)
            deliveryRevenue: deliveryRevenue,         // הכנסות משלוחים (hmp)
            totalRevenue: result.data.totalRevenue || 0,             // הכנסות כוללת (myz+hmp)
            morningTips: morningTips,                 // טיפים בוקר
            eveningTips: eveningTips,                 // טיפים ערב
            totalTips: result.data.envelopesTotal || 0,              // סכום מעטפות
            totalEnvelopes: result.data.totalEnvelopes || 0,         // מספר מעטפות
            totalReports: result.data.totalReports || 0,             // מספר דוחות
            daysInMonth: daysInMonth,                 // ימים בחודש
            closedDays: closedDays,                   // ימי סגירה מזוהים
            effectiveDays: effectiveDays,             // ימים אפקטיביים לחישוב
            dailyRestaurantAvg: Math.round(restaurantRevenue / effectiveDays), // ממוצע חכם על בסיס ימים אפקטיביים
            dailyDeliveryAvg: Math.round(deliveryRevenue / effectiveDays),     // ממוצע חכם על בסיס ימים אפקטיביים
            dailyMorningTipsAvg: Math.round(morningTips / effectiveDays),      // ממוצע חכם על בסיס ימים אפקטיביים
            dailyEveningTipsAvg: Math.round(eveningTips / effectiveDays),      // ממוצע חכם על בסיס ימים אפקטיביים
            
            // נתוני צפי הכנסות חכם
            forecast: forecastData,
            isCurrentMonth: isCurrentMonth,
            
            userType: userRole === 'owner' ? 'owner' : 'manager',
            hasPermission: true,
            period: `${params.month}/${params.year}`
          };
          setDashboardData(dashboardData);
        }
      } else {
        // מלצרים/מנהלים - נתונים אישיים
        console.log('👨‍🍳 Loading personal monthly income');
        
        // בדיקה שיש userId תקין
        if (!params.userId || params.userId.trim() === '') {
          console.error('❌ Invalid userId for monthly income:', params.userId);
          setDashboardData(null);
          return;
        }
        
        result = await ApiService.getMonthlyIncome(params.userId, params.month, params.year);
        
        if (result.success) {
          const dashboardData = {
            totalTips: parseFloat(result.totalIncome) || 0,
            totalRevenue: parseFloat(result.totalIncome) || 0,
            totalEnvelopes: result.envelopeCount || 0,
            userType: user?.jobrole || user?.job || 'waiter',
            period: `${params.month}/${params.year}`
          };
          setDashboardData(dashboardData);
        }
      }
      
      if (!result.success) {
        setDashboardData(null);
        Alert.alert('שגיאה', result.message || 'שגיאה בטעינת נתונים');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setDashboardData(null);
      Alert.alert('שגיאה', 'שגיאה בחיבור לשרת');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData(userPermissions);
    setRefreshing(false);
  };

  const handleSearch = () => {
    loadDashboardData(userPermissions);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const getRoleTitle = (userJob) => {
    switch (userJob) {
      case 'owner':
        return '🏪 דוח מסעדה - בעלים';
      case 'manager':
        return '📋 דוח ניהולי - מנהל';
      case 'both':
        return '📊 דוח משולב - מלצר ומנהל';
      case 'waiter':
      default:
        return '👨‍🍳 דוח אישי - מלצר';
    }
  };

  const getStatsConfig = (userJob) => {
    switch (userJob) {
      case 'owner':
        return {
          showRestaurantData: true,
          showPersonalTips: false,
          title: 'נתוני המסעדה'
        };
      case 'manager':
        return {
          showRestaurantData: true,
          showPersonalTips: true,
          title: 'נתונים מנהליים'
        };
      case 'both':
        return {
          showRestaurantData: true,
          showPersonalTips: true,
          title: 'נתונים משולבים'
        };
      case 'waiter':
      default:
        return {
          showRestaurantData: false,
          showPersonalTips: true,
          title: 'הנתונים שלי'
        };
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar style="light" backgroundColor="#4A90E2" />
      
      {/* Date Selection */}
      <View style={styles.dateSelectionCard}>
        <Text style={styles.cardTitle}>
          {getRoleTitle(user?.jobrole || user?.job)}
        </Text>
        
        <View style={styles.selectorsRow}>
          <View style={styles.selectorContainer}>
            <Text style={styles.selectorLabel}>שנה:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedYear}
                onValueChange={setSelectedYear}
                style={styles.picker}
              >
                <Picker.Item label="2025" value="2025" />
                <Picker.Item label="2024" value="2024" />
              </Picker>
            </View>
          </View>
          
          <View style={styles.selectorContainer}>
            <Text style={styles.selectorLabel}>חודש:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedMonth}
                onValueChange={setSelectedMonth}
                style={styles.picker}
              >
                {months.map((month) => (
                  <Picker.Item key={month.value} label={month.label} value={month.value} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>חפש נתונים</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Statistics Overview */}
      {dashboardData && (
        <>
          <View style={styles.statsGrid}>
            {getStatsConfig(user?.jobrole || user?.job).showRestaurantData && (
              <>
                <View style={[styles.statCard, styles.revenueCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.totalRevenue)}
                  </Text>
                  <Text style={styles.statLabel}>הכנסות כוללת</Text>
                </View>
                
                <View style={[styles.statCard, styles.restaurantCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.restaurantRevenue || 0)}
                  </Text>
                  <Text style={styles.statLabel}>הכנסות מסעדה</Text>
                </View>
                
                <View style={[styles.statCard, styles.woltCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.deliveryRevenue || 0)}
                  </Text>
                  <Text style={styles.statLabel}>הכנסות משלוחים</Text>
                </View>
                
                <View style={[styles.statCard, styles.ordersCard]}>
                  <Text style={styles.statValue}>
                    {dashboardData.totalReports || 0}
                  </Text>
                  <Text style={styles.statLabel}>מספר דוחות</Text>
                </View>
              </>
            )}
            
            {getStatsConfig(user?.jobrole || user?.job).showPersonalTips && (
              <>
                <View style={[styles.statCard, styles.tipsCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.totalTips || dashboardData.totalRevenue || 0)}
                  </Text>
                  <Text style={styles.statLabel}>
                    {dashboardData.hasPermission ? 'טיפים כלליים' : 'הטיפים שלי'}
                  </Text>
                </View>
                
                {!dashboardData.hasPermission && (
                  <View style={[styles.statCard, styles.envelopesCard]}>
                    <Text style={styles.statValue}>
                      {dashboardData.totalEnvelopes || 0}
                    </Text>
                    <Text style={styles.statLabel}>מעטפות השנה</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Daily Averages Section - for authorized users */}
          {dashboardData.hasPermission && (
            <View style={styles.dailyAveragesSection}>
              <Text style={styles.sectionTitle}>ממוצעים יומיים - {dashboardData.daysInMonth} ימים</Text>
              
              <View style={styles.averagesGrid}>
                <View style={[styles.statCard, styles.avgRestaurantCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.dailyRestaurantAvg || 0)}
                  </Text>
                  <Text style={styles.statLabel}>ממוצע יומי מסעדה</Text>
                </View>
                
                <View style={[styles.statCard, styles.avgDeliveryCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.dailyDeliveryAvg || 0)}
                  </Text>
                  <Text style={styles.statLabel}>ממוצע יומי משלוחים</Text>
                </View>
                
                <View style={[styles.statCard, styles.avgMorningCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.dailyMorningTipsAvg || 0)}
                  </Text>
                  <Text style={styles.statLabel}>ממוצע יומי טיפ בוקר</Text>
                </View>
                
                <View style={[styles.statCard, styles.avgEveningCard]}>
                  <Text style={styles.statValue}>
                    {formatCurrency(dashboardData.dailyEveningTipsAvg || 0)}
                  </Text>
                  <Text style={styles.statLabel}>ממוצע יומי טיפ ערב</Text>
                </View>
              </View>
            </View>
          )}

          {/* Smart Income Forecast Section - for current month only */}
          {dashboardData.hasPermission && dashboardData.isCurrentMonth && dashboardData.forecast && (
            <View style={styles.forecastSection}>
              <Text style={styles.sectionTitle}>🔮 צפי הכנסות חכם - מבוסס על 4 שבועות</Text>
              
              {/* Progress and Status */}
              <View style={styles.progressContainer}>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    יום {dashboardData.forecast.daysPassed} מתוך {dashboardData.forecast.daysInMonth}
                  </Text>
                  <Text style={styles.progressText}>
                    נותרו {dashboardData.forecast.daysRemaining} ימים
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${(dashboardData.forecast.daysPassed / dashboardData.forecast.daysInMonth) * 100}%` }
                    ]} 
                  />
                </View>
              </View>

              {/* Current vs Forecast */}
              <View style={styles.forecastGrid}>
                {/* Current Month Summary */}
                <View style={[styles.forecastCard, styles.currentCard]}>
                  <Text style={styles.forecastCardTitle}>עד כה החודש</Text>
                  <Text style={styles.forecastMainValue}>
                    {formatCurrency(dashboardData.forecast.currentTotal)}
                  </Text>
                  <View style={styles.forecastDetails}>
                    <Text style={styles.forecastDetailText}>
                      מסעדה: {formatCurrency(dashboardData.forecast.currentRestaurant)}
                    </Text>
                    <Text style={styles.forecastDetailText}>
                      משלוחים: {formatCurrency(dashboardData.forecast.currentDelivery)}
                    </Text>
                  </View>
                </View>

                {/* Forecast for Remaining Days */}
                <View style={[styles.forecastCard, styles.forecastRemainingCard]}>
                  <Text style={styles.forecastCardTitle}>צפי לימים שנותרו</Text>
                  <Text style={styles.forecastMainValue}>
                    {formatCurrency(dashboardData.forecast.forecastTotal)}
                  </Text>
                  <View style={styles.forecastDetails}>
                    <Text style={styles.forecastDetailText}>
                      מסעדה: {formatCurrency(dashboardData.forecast.forecastRestaurant)}
                    </Text>
                    <Text style={styles.forecastDetailText}>
                      משלוחים: {formatCurrency(dashboardData.forecast.forecastDelivery)}
                    </Text>
                  </View>
                </View>

                {/* Total Month Forecast */}
                <View style={[styles.forecastCard, styles.totalForecastCard]}>
                  <Text style={styles.forecastCardTitle}>צפי כולל לחודש</Text>
                  <Text style={[styles.forecastMainValue, styles.totalForecastValue]}>
                    {formatCurrency(dashboardData.forecast.totalForecastRevenue)}
                  </Text>
                  <View style={styles.forecastDetails}>
                    <Text style={styles.forecastDetailText}>
                      מסעדה: {formatCurrency(dashboardData.forecast.totalForecastRestaurant)}
                    </Text>
                    <Text style={styles.forecastDetailText}>
                      משלוחים: {formatCurrency(dashboardData.forecast.totalForecastDelivery)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Forecast Info */}
              <View style={styles.forecastInfo}>
                <Text style={styles.forecastInfoText}>
                  📊 הצפי מבוסס על ניתוח {dashboardData.forecast.basedOnDays} ימי עבודה מהחודש האחרון
                </Text>
                <Text style={styles.forecastInfoText}>
                  📈 חישוב ממוצע נפרד לכל יום בשבוע לדיוק מקסימלי
                </Text>
              </View>

              {/* Simple Daily Average Forecast */}
              {dashboardData.dailyRestaurantAvg && dashboardData.daysInMonth && (
              <View style={styles.simpleForecastSection}>
                <Text style={styles.sectionTitle}>📈 צפי הכנסות לפי ממוצע יומי</Text>
                
                <View style={styles.simpleForecastGrid}>
                  <View style={styles.simpleForecastCard}>
                    <View style={styles.simpleForecastHeader}>
                      <Text style={styles.simpleForecastTitle}>🍽️ מסעדה</Text>
                    </View>
                    <View style={styles.simpleForecastBody}>
                      <Text style={styles.simpleForecastLabel}>ממוצע יומי:</Text>
                      <Text style={styles.simpleForecastValue}>
                        {formatCurrency(dashboardData.dailyRestaurantAvg)}
                      </Text>
                      <Text style={styles.simpleForecastLabel}>× {dashboardData.daysInMonth - dashboardData.closedDays} ימים:</Text>
                      <Text style={styles.simpleForecastTotal}>
                        {formatCurrency(dashboardData.dailyRestaurantAvg * (dashboardData.daysInMonth - dashboardData.closedDays))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.simpleForecastCard}>
                    <View style={styles.simpleForecastHeader}>
                      <Text style={styles.simpleForecastTitle}>🚗 משלוחים</Text>
                    </View>
                    <View style={styles.simpleForecastBody}>
                      <Text style={styles.simpleForecastLabel}>ממוצע יומי:</Text>
                      <Text style={styles.simpleForecastValue}>
                        {formatCurrency(dashboardData.dailyDeliveryAvg)}
                      </Text>
                      <Text style={styles.simpleForecastLabel}>× {dashboardData.daysInMonth - dashboardData.closedDays} ימים:</Text>
                      <Text style={styles.simpleForecastTotal}>
                        {formatCurrency(dashboardData.dailyDeliveryAvg * (dashboardData.daysInMonth - dashboardData.closedDays))}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.simpleForecastCard, styles.simpleForecastTotalCard]}>
                    <View style={styles.simpleForecastHeader}>
                      <Text style={[styles.simpleForecastTitle, styles.totalCardTitle]}>💰 סך הכל</Text>
                    </View>
                    <View style={styles.simpleForecastBody}>
                      <Text style={styles.simpleForecastLabel}>צפי כולל:</Text>
                      <Text style={[styles.simpleForecastTotal, styles.grandTotal]}>
                        {formatCurrency(
                          (dashboardData.dailyRestaurantAvg + dashboardData.dailyDeliveryAvg) * 
                          (dashboardData.daysInMonth - dashboardData.closedDays)
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              )}

              {/* Daily Breakdown */}
              {dashboardData.forecast.weekdayBreakdown && dashboardData.forecast.weekdayBreakdown.length > 0 && (
                <View style={styles.dailyBreakdownSection}>
                  <Text style={styles.sectionTitle}>📅 פירוט ממוצעים לפי ימי שבוע</Text>
                  
                  <View style={styles.dailyBreakdownGrid}>
                    {dashboardData.forecast.weekdayBreakdown.map((day, index) => {
                      const dayNames = {
                        'Sunday': 'ראשון',
                        'Monday': 'שני', 
                        'Tuesday': 'שלישי',
                        'Wednesday': 'רביעי',
                        'Thursday': 'חמישי',
                        'Friday': 'שישי',
                        'Saturday': 'שבת'
                      };
                      
                      return (
                        <View key={index} style={styles.dailyBreakdownCard}>
                          <View style={styles.dailyBreakdownHeader}>
                            <Text style={styles.dailyBreakdownDayName}>
                              {dayNames[day.dayName] || day.dayName}
                            </Text>
                            <Text style={styles.dailyBreakdownSamples}>
                              {day.samples} דגימות
                            </Text>
                          </View>
                          
                          <View style={styles.dailyBreakdownData}>
                            <View style={styles.dailyBreakdownRow}>
                              <Text style={styles.dailyBreakdownLabel}>מסעדה:</Text>
                              <Text style={styles.dailyBreakdownValue}>
                                {formatCurrency(day.avgRestaurant)}
                              </Text>
                            </View>
                            
                            <View style={styles.dailyBreakdownRow}>
                              <Text style={styles.dailyBreakdownLabel}>משלוחים:</Text>
                              <Text style={styles.dailyBreakdownValue}>
                                {formatCurrency(day.avgDelivery)}
                              </Text>
                            </View>
                            
                            <View style={[styles.dailyBreakdownRow, styles.dailyBreakdownTotal]}>
                              <Text style={[styles.dailyBreakdownLabel, styles.totalLabel]}>סך הכל:</Text>
                              <Text style={[styles.dailyBreakdownValue, styles.totalValue]}>
                                {formatCurrency(day.avgTotal)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Daily Data */}
          {dashboardData.dailyData && dashboardData.dailyData.length > 0 && (
            <View style={styles.dailyDataSection}>
              <Text style={styles.sectionTitle}>פירוט יומי</Text>
              
              {dashboardData.dailyData.map((day, index) => (
                <View key={index} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayDate}>
                      {formatDate(day.date)}
                    </Text>
                    <Text style={styles.dayTotal}>
                      {formatCurrency(day.totalRevenue)}
                    </Text>
                  </View>
                  
                  <View style={styles.dayDetails}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailValue}>
                        {formatCurrency(day.restaurantRevenue)}
                      </Text>
                      <Text style={styles.detailLabel}>מסעדה</Text>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <Text style={styles.detailValue}>
                        {formatCurrency(day.deliveryRevenue)}
                      </Text>
                      <Text style={styles.detailLabel}>משלוחים</Text>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <Text style={styles.detailValue}>
                        {formatCurrency(day.tips)}
                      </Text>
                      <Text style={styles.detailLabel}>טיפים</Text>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <Text style={styles.detailValue}>
                        {day.envelopesCount || 0}
                      </Text>
                      <Text style={styles.detailLabel}>מעטפות</Text>
                    </View>
                  </View>
                  
                  {day.managerName && (
                    <View style={styles.managerInfo}>
                      <Text style={styles.managerText}>
                        מנהל: {day.managerName}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {!loading && !dashboardData && (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataIcon}>📊</Text>
          <Text style={styles.noDataTitle}>אין נתונים</Text>
          <Text style={styles.noDataText}>
            לא נמצאו נתונים לתקופה שנבחרה
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  dateSelectionCard: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  selectorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  selectorContainer: {
    flex: 1,
    marginHorizontal: 5,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  searchButton: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueCard: {
    backgroundColor: '#667eea',
  },
  restaurantCard: {
    backgroundColor: '#f093fb',
  },
  woltCard: {
    backgroundColor: '#4facfe',
  },
  tipsCard: {
    backgroundColor: '#43e97b',
  },
  
  ordersCard: {
    backgroundColor: '#9C27B0',
  },
  
  envelopesCard: {
    backgroundColor: '#FF5722',
  },
  
  // Daily Averages Section Styles
  dailyAveragesSection: {
    padding: 15,
    marginTop: 10,
  },
  averagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  avgRestaurantCard: {
    backgroundColor: '#20bf6b',
  },
  avgDeliveryCard: {
    backgroundColor: '#eb4d4b',
  },
  avgMorningCard: {
    backgroundColor: '#f0932b',
  },
  avgEveningCard: {
    backgroundColor: '#3742fa',
  },
  
  // Smart Forecast Section Styles
  forecastSection: {
    padding: 15,
    marginTop: 10,
  },
  progressContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 4,
  },
  forecastGrid: {
    gap: 12,
  },
  forecastCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  forecastRemainingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  totalForecastCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  forecastCardTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  forecastMainValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  totalForecastValue: {
    fontSize: 24,
    color: '#28a745',
  },
  forecastDetails: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  forecastDetailText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
  forecastInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  forecastInfoText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 4,
  },
  
  // Simple Forecast Section Styles
  simpleForecastSection: {
    padding: 15,
    marginTop: 10,
  },
  simpleForecastGrid: {
    gap: 10,
  },
  simpleForecastCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  simpleForecastTotalCard: {
    borderLeftColor: '#28a745',
    backgroundColor: '#f8fff9',
  },
  simpleForecastHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
    marginBottom: 12,
  },
  simpleForecastTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  totalCardTitle: {
    color: '#28a745',
  },
  simpleForecastBody: {
    gap: 6,
  },
  simpleForecastLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  simpleForecastValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007bff',
    textAlign: 'center',
    marginBottom: 4,
  },
  simpleForecastTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
  },
  grandTotal: {
    fontSize: 18,
    color: '#28a745',
    backgroundColor: '#e8f5e8',
  },
  
  // Daily Breakdown Section Styles
  dailyBreakdownSection: {
    padding: 15,
    marginTop: 10,
  },
  dailyBreakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  dailyBreakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
  dailyBreakdownHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
    marginBottom: 8,
  },
  dailyBreakdownDayName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  dailyBreakdownSamples: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  dailyBreakdownData: {
    gap: 4,
  },
  dailyBreakdownRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  dailyBreakdownLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  dailyBreakdownValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
  },
  dailyBreakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 6,
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#28a745',
    fontSize: 13,
  },
  
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  dailyDataSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dayDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dayTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
    backgroundColor: '#d4edda',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  managerInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  managerText: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: '#6c757d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 16,
  },
  noDataIcon: {
    fontSize: 50,
    marginBottom: 20,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default MobileDashboardScreen;