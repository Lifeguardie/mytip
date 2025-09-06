import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import ApiService from '../services/api';

// RTL layout handled by CSS for web compatibility

const StatisticsScreen = ({ navigation, route }) => {
  const [user] = useState(route.params?.user);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('overview'); // overview, envelopes, reports, employees

  useEffect(() => {
    loadStatistics();
  }, [selectedCategory]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const result = await ApiService.getStatistics(selectedCategory);
      if (result.success) {
        setStatistics(result.data || {});
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return num.toLocaleString('he-IL');
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₪0';
    return `₪${amount.toLocaleString('he-IL')}`;
  };

  const categories = [
    { id: 'overview', title: 'סקירה כללית', icon: '📊' },
    { id: 'envelopes', title: 'מעטפות', icon: '📦' },
    { id: 'reports', title: 'דוחות', icon: '📋' },
    { id: 'employees', title: 'עובדים', icon: '👥' },
  ];

  const renderOverviewStats = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.total_envelopes || 0)}</Text>
          <Text style={styles.statLabel}>סה"כ מעטפות</Text>
          <Text style={styles.statSubtext}>מתחילת השנה</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatCurrency(statistics.total_amount || 0)}</Text>
          <Text style={styles.statLabel}>סה"כ טיפים</Text>
          <Text style={styles.statSubtext}>מתחילת השנה</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.active_employees || 0)}</Text>
          <Text style={styles.statLabel}>עובדים פעילים</Text>
          <Text style={styles.statSubtext}>כרגע במערכת</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.total_reports || 0)}</Text>
          <Text style={styles.statLabel}>דוחות סוף יום</Text>
          <Text style={styles.statSubtext}>החודש</Text>
        </View>
      </View>

      <View style={styles.trendCard}>
        <Text style={styles.trendTitle}>מגמות החודש</Text>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>ממוצע יומי של מעטפות:</Text>
          <Text style={styles.trendValue}>{formatNumber(statistics.daily_avg_envelopes || 0)}</Text>
        </View>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>ממוצע יומי של טיפים:</Text>
          <Text style={styles.trendValue}>{formatCurrency(statistics.daily_avg_amount || 0)}</Text>
        </View>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>יום השיא השבוע:</Text>
          <Text style={styles.trendValue}>{statistics.peak_day || 'לא זמין'}</Text>
        </View>
      </View>
    </>
  );

  const renderEnvelopeStats = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.pending_envelopes || 0)}</Text>
          <Text style={styles.statLabel}>מעטפות ממתינות</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.delivered_envelopes || 0)}</Text>
          <Text style={styles.statLabel}>מעטפות נמסרו</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.taken_envelopes || 0)}</Text>
          <Text style={styles.statLabel}>מעטפות נלקחו</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatCurrency(statistics.avg_envelope_amount || 0)}</Text>
          <Text style={styles.statLabel}>ממוצע למעטפה</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>התפלגות מעטפות לפי סטטוס</Text>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>ממתינות ({statistics.pending_envelopes || 0})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>נמסרו ({statistics.delivered_envelopes || 0})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>נלקחו ({statistics.taken_envelopes || 0})</Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderReportsStats = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.reports_this_month || 0)}</Text>
          <Text style={styles.statLabel}>דוחות החודש</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatCurrency(statistics.avg_daily_cash || 0)}</Text>
          <Text style={styles.statLabel}>ממוצע מזומן יומי</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatCurrency(statistics.avg_daily_checks || 0)}</Text>
          <Text style={styles.statLabel}>ממוצע המחאות יומי</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.on_time_reports || 0}%</Text>
          <Text style={styles.statLabel}>דוחות בזמן</Text>
        </View>
      </View>

      <View style={styles.trendCard}>
        <Text style={styles.trendTitle}>נתוני דוחות</Text>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>יום עם הכי הרבה מזומן:</Text>
          <Text style={styles.trendValue}>{statistics.peak_cash_day || 'לא זמין'}</Text>
        </View>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>יום עם הכי הרבה המחאות:</Text>
          <Text style={styles.trendValue}>{statistics.peak_checks_day || 'לא זמין'}</Text>
        </View>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>מנהל עם הכי הרבה דוחות:</Text>
          <Text style={styles.trendValue}>{statistics.top_reporter || 'לא זמין'}</Text>
        </View>
      </View>
    </>
  );

  const renderEmployeeStats = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.total_employees || 0)}</Text>
          <Text style={styles.statLabel}>סה"כ עובדים</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.waiters || 0)}</Text>
          <Text style={styles.statLabel}>מלצרים</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatNumber(statistics.managers || 0)}</Text>
          <Text style={styles.statLabel}>מנהלים</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatCurrency(statistics.avg_employee_tips || 0)}</Text>
          <Text style={styles.statLabel}>ממוצע טיפים לעובד</Text>
        </View>
      </View>

      <View style={styles.trendCard}>
        <Text style={styles.trendTitle}>סטטיסטיקות עובדים</Text>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>עובד עם הכי הרבה מעטפות:</Text>
          <Text style={styles.trendValue}>{statistics.top_envelope_receiver || 'לא זמין'}</Text>
        </View>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>עובד עם הכי הרבה טיפים:</Text>
          <Text style={styles.trendValue}>{statistics.top_tip_receiver || 'לא זמין'}</Text>
        </View>
        <View style={styles.trendItem}>
          <Text style={styles.trendLabel}>עובדים חדשים החודש:</Text>
          <Text style={styles.trendValue}>{formatNumber(statistics.new_employees_month || 0)}</Text>
        </View>
      </View>
    </>
  );

  const renderContent = () => {
    switch (selectedCategory) {
      case 'envelopes': return renderEnvelopeStats();
      case 'reports': return renderReportsStats();
      case 'employees': return renderEmployeeStats();
      default: return renderOverviewStats();
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
        <Text style={styles.headerTitle}>סטטיסטיקה</Text>
      </View>

      {/* Category Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
        <View style={styles.categoryContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryButton, selectedCategory === category.id && styles.activeCategoryButton]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[styles.categoryText, selectedCategory === category.id && styles.activeCategoryText]}>
                {category.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      ) : (
        <ScrollView style={styles.content}>
          {renderContent()}
        </ScrollView>
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
  categorySelector: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    maxHeight: 80,
  },
  categoryContainer: {
    flexDirection: 'row-reverse',
    padding: 15,
    gap: 10,
  },
  categoryButton: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    minWidth: 80,
  },
  activeCategoryButton: {
    backgroundColor: '#2196F3',
  },
  categoryIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  categoryText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  activeCategoryText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 3,
  },
  statSubtext: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
  },
  trendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trendTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 15,
  },
  trendItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  trendLabel: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
    textAlign: 'right',
  },
  trendValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 15,
  },
  chartLegend: {
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#666666',
  },
});

export default StatisticsScreen;