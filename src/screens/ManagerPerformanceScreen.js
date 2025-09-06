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

const ManagerPerformanceScreen = ({ navigation, route }) => {
  const [user] = useState(route.params?.user);
  const [managerStats, setManagerStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // week, month, year

  useEffect(() => {
    loadManagerPerformance();
  }, [selectedPeriod]);

  const loadManagerPerformance = async () => {
    try {
      setLoading(true);
      const result = await ApiService.getManagerPerformance(selectedPeriod);
      if (result.success && result.managers) {
        setManagerStats(result.managers);
      }
    } catch (error) {
      console.error('Error loading manager performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodText = () => {
    switch (selectedPeriod) {
      case 'week': return 'השבוע';
      case 'month': return 'החודש';
      case 'year': return 'השנה';
      default: return 'החודש';
    }
  };

  const getPerformanceColor = (score) => {
    if (score >= 90) return '#4CAF50'; // מעולה
    if (score >= 75) return '#8BC34A'; // טוב
    if (score >= 60) return '#FF9800'; // בינוני
    return '#F44336'; // נמוך
  };

  const getPerformanceText = (score) => {
    if (score >= 90) return 'מעולה';
    if (score >= 75) return 'טוב';
    if (score >= 60) return 'בינוני';
    return 'נמוך';
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
        <Text style={styles.headerTitle}>ביצועי מנהלים</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'week' && styles.activePeriod]}
          onPress={() => setSelectedPeriod('week')}
        >
          <Text style={[styles.periodText, selectedPeriod === 'week' && styles.activePeriodText]}>
            השבוע
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'month' && styles.activePeriod]}
          onPress={() => setSelectedPeriod('month')}
        >
          <Text style={[styles.periodText, selectedPeriod === 'month' && styles.activePeriodText]}>
            החודש
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'year' && styles.activePeriod]}
          onPress={() => setSelectedPeriod('year')}
        >
          <Text style={[styles.periodText, selectedPeriod === 'year' && styles.activePeriodText]}>
            השנה
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>ביצועי מנהלים - {getPeriodText()}</Text>

          {managerStats.map((manager, index) => (
            <View key={manager.id || index} style={styles.managerCard}>
              <View style={styles.managerHeader}>
                <View style={styles.managerInfo}>
                  <Text style={styles.managerName}>{manager.realname || manager.wname}</Text>
                  <Text style={styles.managerRole}>{manager.jobrole === 'manager' ? 'מנהל' : 'בעלים'}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: getPerformanceColor(manager.performance_score || 0) }]}>
                  <Text style={styles.scoreText}>{manager.performance_score || 0}%</Text>
                  <Text style={styles.scoreLabel}>{getPerformanceText(manager.performance_score || 0)}</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{manager.envelopes_created || 0}</Text>
                  <Text style={styles.statLabel}>מעטפות שנוצרו</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>₪{manager.total_amount || 0}</Text>
                  <Text style={styles.statLabel}>סכום כולל</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{manager.reports_submitted || 0}</Text>
                  <Text style={styles.statLabel}>דוחות הוגשו</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{manager.work_days || 0}</Text>
                  <Text style={styles.statLabel}>ימי עבודה</Text>
                </View>
              </View>

              <View style={styles.detailsSection}>
                <Text style={styles.detailsTitle}>פרטים נוספים:</Text>
                <Text style={styles.detailText}>• זמן תגובה ממוצע: {manager.avg_response_time || 'לא זמין'}</Text>
                <Text style={styles.detailText}>• דיוק דוחות: {manager.report_accuracy ? Math.round(manager.report_accuracy) + '%' : 'לא זמין'}</Text>
                <Text style={styles.detailText}>• שביעות רצון עובדים: {manager.employee_satisfaction ? Math.round(manager.employee_satisfaction) + '%' : 'לא זמין'}</Text>
              </View>
            </View>
          ))}

          {managerStats.length === 0 && (
            <Text style={styles.noDataText}>אין נתוני ביצועים זמינים לתקופה זו</Text>
          )}

          {/* Summary Stats */}
          {managerStats.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>סיכום כללי</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {managerStats.reduce((sum, m) => sum + (m.envelopes_created || 0), 0)}
                  </Text>
                  <Text style={styles.summaryLabel}>סה"כ מעטפות</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    ₪{managerStats.reduce((sum, m) => sum + (m.total_amount || 0), 0)}
                  </Text>
                  <Text style={styles.summaryLabel}>סה"כ סכום</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {Math.round(managerStats.reduce((sum, m) => sum + (m.performance_score || 0), 0) / managerStats.length)}%
                  </Text>
                  <Text style={styles.summaryLabel}>ביצועים ממוצעים</Text>
                </View>
              </View>
            </View>
          )}
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
  periodSelector: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 10,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  activePeriod: {
    backgroundColor: '#2196F3',
  },
  periodText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  activePeriodText: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 20,
  },
  managerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  managerHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  managerInfo: {
    flex: 1,
  },
  managerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
  },
  managerRole: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
    marginTop: 2,
  },
  scoreBadge: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 5,
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 15,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
    marginBottom: 5,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666666',
    marginTop: 50,
  },
  summaryCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'right',
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#1976D2',
    textAlign: 'center',
    marginTop: 5,
  },
});

export default ManagerPerformanceScreen;