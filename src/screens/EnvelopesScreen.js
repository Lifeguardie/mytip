import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList
} from 'react-native';
import { StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';

const EnvelopesScreen = ({ route }) => {
  const { user } = route.params;
  const [envelopes, setEnvelopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [openEnvelopes, setOpenEnvelopes] = useState(0);

  useEffect(() => {
    loadEnvelopes();
  }, []);

  // Keep data fresh when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('Screen focused, keeping envelopes data');
      // Only reload if we don't have data or if user specifically refreshes
      if (envelopes.length === 0) {
        loadEnvelopes();
      }
    }, [envelopes.length])
  );

  const loadEnvelopes = async () => {
    try {
      setLoading(true);
      console.log('Loading envelopes for user:', user.username || user.id);
      console.log('User object:', user);
      // Force using username, not ID
      const userId = user.username; // שימוש ב-username בלבד
      console.log('🔍 Using userId for envelopes:', userId);
      const result = await ApiService.getEnvelopes(userId);
      
      console.log('API result success:', result.success);
      console.log('Raw envelopes data:', result.envelopes);
      console.log('Envelopes count:', result.envelopes ? result.envelopes.length : 0);
      
      // Debug first envelope fields - detailed logging
      if (result.envelopes && result.envelopes.length > 0) {
        const firstEnvelope = result.envelopes[0];
        console.log('🔍 Debugging envelope maker field:');
        console.log('  maker ID:', firstEnvelope.maker);
        console.log('  makerName:', firstEnvelope.makerName);
        console.log('  All keys in envelope:', Object.keys(firstEnvelope));
        console.log('  Full envelope object:', firstEnvelope);
      }
      
      if (result.success && result.envelopes && Array.isArray(result.envelopes)) {
        console.log('Setting envelopes - valid array with', result.envelopes.length, 'items');
        
        // Normalize envelopes data - handle both 'took' and 'goit' fields + clean status values
        const normalizedEnvelopes = result.envelopes.map(env => {
          let status = env.goit || env.took || '';
          // Clean up status values - remove whitespace and normalize case
          status = status.toString().trim().toLowerCase();
          // Normalize to standard values - "no" means not taken (open envelope)
          if (status === 'yes' || status === 'true' || status === '1') {
            status = 'Yes';  // Envelope was taken/delivered
          } else {
            // All other cases (no, false, 0, empty, null) = envelope is still open
            status = 'No';   // Envelope is open/pending
          }
          
          return {
            ...env,
            goit: status
          };
        });
        setEnvelopes(normalizedEnvelopes);

        // Calculate open envelopes with normalized status
        console.log('🔍 All envelope status values (normalized):', normalizedEnvelopes.map(env => env.goit));
        const openEnvelopesCount = normalizedEnvelopes.filter(env => env.goit === 'No').length;
        
        console.log('🔍 Filtering logic test (after normalization):');
        console.log('  Open envelopes (normalized No):', openEnvelopesCount);
        console.log('  All envelopes:', normalizedEnvelopes.length);
        console.log('  Sample status values for debugging:', normalizedEnvelopes.slice(0, 10).map(e => `"${e.goit}"`));
        console.log('🔍 Raw vs normalized first 10:');
        result.envelopes.slice(0, 10).forEach((env, i) => {
          console.log(`  ${i}: raw="${env.goit || env.took}" -> normalized="${normalizedEnvelopes[i].goit}"`);
        });
        const openEnvelopesTotal = normalizedEnvelopes
          .filter(env => env.goit === 'No')
          .reduce((sum, env) => sum + parseFloat(env.sumin || 0), 0);
        
        console.log('🔍 Envelope status breakdown:');
        normalizedEnvelopes.forEach((env, index) => {
          if (index < 5) { // Log first 5 envelopes
            console.log(`  Envelope ${env.id}: status="${env.goit}", amount=${env.sumin}`);
          }
        });
        
        setOpenEnvelopes(openEnvelopesCount);
        setTotalAmount(openEnvelopesTotal);
        console.log('Successfully set', result.envelopes.length, 'total envelopes,', openEnvelopesCount, 'open envelopes with total:', openEnvelopesTotal);
      } else {
        console.warn('Invalid envelope data received:', result);
        // Don't clear existing data on error - keep what we have
        if (envelopes.length === 0) {
          setEnvelopes([]);
          setTotalAmount(0);
          setOpenEnvelopes(0);
        }
      }
    } catch (error) {
      console.error('Error loading envelopes:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת מעטפות - ' + error.message);
      // Don't clear existing data on network error
      if (envelopes.length === 0) {
        setEnvelopes([]);
        setTotalAmount(0);
        setOpenEnvelopes(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEnvelopes();
    setRefreshing(false);
  };



  const formatDate = (dateString) => {
    if (!dateString) return 'לא זמין';
    
    try {
      // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      let date;
      if (typeof dateString === 'string') {
        // Convert MySQL datetime to JavaScript Date
        if (dateString.includes(' ')) {
          // Format: "2025-08-10 10:30:00"
          date = new Date(dateString.replace(' ', 'T'));
        } else if (dateString.includes('-')) {
          // Format: "2025-08-10"
          date = new Date(dateString);
        } else {
          // Try to parse as is
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'תאריך לא תקין';
      }
      
      return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.log('Date parsing error:', error, 'for date:', dateString);
      return 'תאריך לא תקין';
    }
  };

  const renderEnvelopeItem = ({ item }) => (
    <View style={styles.envelopeCard}>
      <View style={styles.cardHeader}>
        <View style={styles.amountContainer}>
          <Text style={styles.currencySymbol}>₪</Text>
          <Text style={styles.envelopeAmount}>{item.sumin}</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, item.goit === 'Yes' ? styles.collectedBadge : styles.waitingBadge]}>
            <Text style={styles.statusIcon}>{item.goit === 'Yes' ? '✅' : '⏳'}</Text>
            <Text style={styles.statusText}>{item.goit === 'Yes' ? 'נאסף' : 'ממתין'}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.cardDivider} />
      
      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoLabel}>תאריך יצירה:</Text>
          <Text style={styles.infoValue}>{item.timem || item.mydate || 'לא ידוע'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>👤</Text>
          <Text style={styles.infoLabel}>מי יצר:</Text>
          <Text style={styles.infoValue}>{item.makerName || item.maker || 'לא ידוע'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>🤝</Text>
          <Text style={styles.infoLabel}>מי מסר:</Text>
          <Text style={styles.infoValue}>{item.giver || 'לא ידוע'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📤</Text>
          <Text style={styles.infoLabel}>תאריך מסירה:</Text>
          <Text style={styles.infoValue}>
            {item.timegive && item.timegive !== '' && item.timegive !== '0'
              ? formatDate(item.timegive)
              : 'עדיין לא נמסר'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>🔢</Text>
          <Text style={styles.infoLabel}>קוד מעטפה:</Text>
          <Text style={styles.codeValue}>{item.rand}</Text>
        </View>
      </View>
      
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>הצג קוד זה למנהל בעת המסירה</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#4A90E2" />
      
      {/* Enhanced Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Text style={styles.iconText}>📬</Text>
        </View>
        <Text style={styles.summaryTitle}>מעטפות פתוחות</Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{openEnvelopes}</Text>
            <Text style={styles.statLabel}>מעטפות פתוחות</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statAmount}>{totalAmount.toFixed(2)} ₪</Text>
            <Text style={styles.statLabel}>סה"כ ממתין</Text>
          </View>
        </View>
        <Text style={styles.summarySubtitle}>
          מעטפות שעדיין לא נמסרו וממתינות לאיסוף
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>טוען מעטפות...</Text>
        </View>
      ) : envelopes.filter(env => 
          env.goit === 'No' || env.goit === 'no' || env.goit === 'NO' || env.goit === '' || env.goit === null
        ).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>אין מעטפות פתוחות</Text>
          <Text style={styles.emptyText}>
            כל המעטפות שלך נאספו כבר
          </Text>
        </View>
      ) : (
        <FlatList
          data={envelopes.filter(env => 
            env.goit === 'No' || env.goit === 'no' || env.goit === 'NO' || env.goit === '' || env.goit === null
          )}
          renderItem={renderEnvelopeItem}
          keyExtractor={(item, index) => `envelope-${item.id_num || item.id || index}`}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9800',
    shadowColor: '#FF9800',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  summaryIcon: {
    backgroundColor: '#FFF3E0',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconText: {
    fontSize: 28,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  statAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  envelopeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#FF9800',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
    backgroundColor: '#fafafa',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginRight: 4,
  },
  envelopeAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F57C00',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  cardContent: {
    padding: 20,
    paddingTop: 15,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'flex-end',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
    width: 20,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginRight: 8,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  codeValue: {
    fontSize: 16,
    color: '#FF9800',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    flex: 1,
  },
  cardFooter: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  waitingBadge: {
    backgroundColor: '#FFE0B2',
  },
  collectedBadge: {
    backgroundColor: '#C8E6C9',
  },

});

export default EnvelopesScreen;