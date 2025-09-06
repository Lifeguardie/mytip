import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import ApiService from '../services/api';

// RTL layout handled by CSS for web compatibility

const ReportManagementScreen = ({ navigation, route }) => {
  const [user] = useState(route.params?.user);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedReport, setSelectedReport] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    myz: '',
    hmp: '',
    datel: '',
    mname: '',
    comment: '',
    tipmb: '',
    tipme: '',
    manb: '',
    id_num: '',
    dayname: '',
    day_d: '',
    month_d: '',
    year_d: ''
  });

  useEffect(() => {
    loadAllReports();
  }, []);

  const loadAllReports = async () => {
    try {
      setLoading(true);
      console.log('📋 ReportManagement: Loading all reports...');
      
      // נטען את כל דוחות סוף היום
      const result = await ApiService.getAllEndOfDayReports();
      console.log('📋 ReportManagement: Got result:', result);
      
      if (result.success && result.reports) {
        // אוסף את כל השנים הייחודיות מהדוחות
        const uniqueYears = [...new Set(result.reports.map(r => r.year_d))]
          .filter(year => year && year.trim() !== '')
          .sort((a, b) => b.localeCompare(a)); // ממיין מהחדש לישן
        
        console.log(`📋 ReportManagement: Found ${result.reports.length} total reports:`);
        uniqueYears.forEach(year => {
          const count = result.reports.filter(r => r.year_d === year).length;
          console.log(`📋   - ${year}: ${count} reports`);
        });
        
        // מעדכן את השנה הנבחרת לשנה האחרונה אם עדיין לא נבחרה
        if (!selectedYear && uniqueYears.length > 0) {
          setSelectedYear(uniqueYears[0]);
        }
        
        setReports(result.reports);
      } else {
        console.log('📋 ReportManagement: No reports found in result');
      }
    } catch (error) {
      console.error('📋 ReportManagement: Error loading reports:', error);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('שגיאה: לא ניתן לטעון את הדוחות');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    // פילטר לפי שנה וחודש נבחרים
    // התמודדות עם פורמט חודש "08" במקום "8"
    const reportMonth = report.month_d?.padStart(2, '0'); // להבטיח פורמט 2 ספרות
    const selectedMonthPadded = selectedMonth.padStart(2, '0'); // להבטיח פורמט 2 ספרות
    
    // אם לא נבחרה שנה עדיין, לא מציג כלום
    if (!selectedYear) return false;
    
    const matchesYearMonth = report.year_d === selectedYear && reportMonth === selectedMonthPadded;
    
    // פילטר לפי חיפוש
    const matchesSearch = searchQuery === '' || 
      report.mname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.manager?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.id_num?.toString().includes(searchQuery) ||
      report.datel?.toString().includes(searchQuery);
    
    return matchesYearMonth && matchesSearch;
  });

  // הוספת דיבוג להבנת הפילטר
  console.log(`📋 Filter Debug: Looking for year=${selectedYear}, month=${selectedMonth.padStart(2, '0')}`);
  console.log(`📋 Filter Debug: Found ${filteredReports.length} matching reports out of ${reports.length} total`);

  // Sort reports by date (newest first)
  const sortedReports = [...filteredReports].sort((a, b) => {
    if (a.year_d !== b.year_d) {
      return Number(b.year_d) - Number(a.year_d);
    }
    if (a.month_d !== b.month_d) {
      return Number(b.month_d) - Number(a.month_d);
    }
    return Number(b.day_d) - Number(a.day_d);
  });

  const openEditModal = (report) => {
    setSelectedReport(report);
    setEditForm({
      id_num: report.id_num?.toString() || '',  // מספר דוח
      myz: report.myz?.toString() || '',
      hmp: report.hmp?.toString() || '',
      datel: report.datel?.toString() || '',
      mname: report.manager || report.mname || '',
      comment: report.shift || '',  // הערות כלליות
      tipmb: report.tipmb?.toString() || '',  // טיפים בוקר
      tipme: report.tipme?.toString() || '',   // טיפים ערב
      manb: report.manb || '',  // מנהל בוקר
      dayname: report.dayname || '',  // שם יום
      day_d: report.day_d?.toString() || '',  // יום
      month_d: report.month_d?.toString() || '',  // חודש
      year_d: report.year_d?.toString() || ''  // שנה
    });
    setEditModalVisible(true);
  };

  const updateReport = async () => {
    try {
      // הכנת האובייקט עבור השרת - כל השדות כולל id_num ותאריכים
      const updateData = {
        id_num: editForm.id_num, // מזהה דוח
        manager: editForm.mname, // שם מנהל משמרת
        myz: editForm.myz,      // מזומן בקופה
        hmp: editForm.hmp,      // הכנסות וולט/אשראי
        datel: editForm.datel,  // סה"כ הכנסות יומיות
        tipmb: editForm.tipmb,  // טיפים בוקר
        tipme: editForm.tipme,  // טיפים ערב
        day_d: editForm.day_d,  // יום
        month_d: editForm.month_d, // חודש
        year_d: editForm.year_d,   // שנה
        dayname: editForm.dayname  // שם יום
      };
      
      console.log('✏️ ReportManagement: Updating report with data:', updateData);
      const result = await ApiService.updateEndOfDayReport(selectedReport.id_num, updateData);
      if (result.success) {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('הצלחה: הדוח עודכן בהצלחה');
        }
        setEditModalVisible(false);
        loadAllReports();
      } else {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('שגיאה: ' + (result.error || 'שגיאה בעדכון הדוח'));
        }
      }
    } catch (error) {
      console.error('Error updating report:', error);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('שגיאה: שגיאה בעדכון הדוח');
      }
    }
  };

  const deleteReport = async (report) => {
    const confirmed = typeof window !== 'undefined' && window.confirm ? 
      window.confirm(`האם אתה בטוח שברצונך למחוק את הדוח של ${report.manager || report.mname}?`) : true;
    
    if (!confirmed) return;

    try {
      const result = await ApiService.deleteEndOfDayReport(report.id_num);
      if (result.success) {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('הצלחה: הדוח נמחק בהצלחה');
        }
        loadAllReports();
      } else {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('שגיאה: ' + (result.error || 'שגיאה במחיקת הדוח'));
        }
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('שגיאה: שגיאה במחיקת הדוח');
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
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
        <Text style={styles.headerTitle}>ניהול דוחות סוף יום</Text>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="חפש לפי שם מנהל, מספר דוח או סכום..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          textAlign="right"
        />
        
        <View style={styles.filtersContainer}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>שנה:</Text>
            <View style={styles.filterButtonsRow}>
              {(() => {
                const uniqueYears = [...new Set(reports.map(r => r.year_d))]
                  .filter(year => year && year.trim() !== '')
                  .sort((a, b) => b.localeCompare(a)); // ממיין מהחדש לישן
                return uniqueYears;
              })().map(year => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.filterButton,
                    selectedYear === year && styles.activeFilterButton
                  ]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedYear === year && styles.activeFilterButtonText
                  ]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>חודש:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthsScroll}>
              <View style={styles.filterButtonsRow}>
                {[
                  {num: '1', name: 'ינואר'}, {num: '2', name: 'פברואר'}, {num: '3', name: 'מרץ'},
                  {num: '4', name: 'אפריל'}, {num: '5', name: 'מאי'}, {num: '6', name: 'יוני'},
                  {num: '7', name: 'יולי'}, {num: '8', name: 'אוגוסט'}, {num: '9', name: 'ספטמבר'},
                  {num: '10', name: 'אוקטובר'}, {num: '11', name: 'נובמבר'}, {num: '12', name: 'דצמבר'}
                ].map(month => (
                  <TouchableOpacity
                    key={month.num}
                    style={[
                      styles.filterButton,
                      selectedMonth === month.num && styles.activeFilterButton
                    ]}
                    onPress={() => setSelectedMonth(month.num)}
                  >
                    <Text style={[
                      styles.filterButtonText,
                      selectedMonth === month.num && styles.activeFilterButtonText
                    ]}>
                      {month.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              📊 נתונים זמינים מכל השנים הרשומות במערכת. הנתונים נטענים מכל החודשים הזמינים.
            </Text>
          </View>
          
          <Text style={styles.statsText}>
            {(() => {
              const monthNames = {
                '1': 'ינואר', '2': 'פברואר', '3': 'מרץ', '4': 'אפריל',
                '5': 'מאי', '6': 'יוני', '7': 'יולי', '8': 'אוגוסט',
                '9': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר'
              };
              return `${monthNames[selectedMonth]} ${selectedYear}: ${filteredReports.length} דוחות`;
            })()}
          </Text>

          {sortedReports.map((report, index) => {
            // יצירת מפתח ייחודי שמשלב כמה שדות למניעת כפילויות
            const uniqueKey = `${report.id_num}-${report.year_d}-${report.month_d}-${report.day_d}-${index}`;
            
            return (
              <View key={uniqueKey} style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <View style={styles.reportInfo}>
                        <Text style={styles.reportManager}>{report.manager || report.mname || 'לא מצוין'}</Text>
                        <Text style={styles.reportId}>דוח #{report.id_num || 'לא ידוע'}</Text>
                        <Text style={styles.reportDate}>
                          {report.day_d && report.month_d && report.year_d 
                            ? `${report.day_d}/${report.month_d}/${report.year_d}`
                            : 'לא ידוע'
                          }
                        </Text>
                        {report.dayname && (
                          <Text style={styles.reportDayName}>יום {
                            {
                              'Sunday': 'ראשון',
                              'Monday': 'שני', 
                              'Tuesday': 'שלישי',
                              'Wednesday': 'רביעי',
                              'Thursday': 'חמישי',
                              'Friday': 'שישי',
                              'Saturday': 'שבת',
                              'Sun': 'ראשון',
                              'Mon': 'שני',
                              'Tue': 'שלישי', 
                              'Wed': 'רביעי',
                              'Thu': 'חמישי',
                              'Fri': 'שישי',
                              'Sat': 'שבת'
                            }[report.dayname] || report.dayname
                          }</Text>
                        )}
                      </View>
                      <View style={styles.amountContainer}>
                        <Text style={styles.totalAmount}>₪{(parseInt(report.myz || 0) + parseInt(report.hmp || 0))}</Text>
                        <Text style={styles.amountLabel}>סה"כ</Text>
                      </View>
                    </View>

                    <View style={styles.reportDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>מסעדה (מזומן):</Text>
                        <Text style={styles.detailValue}>₪{report.myz || 0}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>משלוחים (וולט):</Text>
                        <Text style={styles.detailValue}>₪{report.hmp || 0}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>טיפים בוקר:</Text>
                        <Text style={styles.detailValue}>₪{report.tipmb || 0}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>טיפים ערב:</Text>
                        <Text style={styles.detailValue}>₪{report.tipme || 0}</Text>
                      </View>
                      {report.manb && report.manb.trim() && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>מנהל בוקר:</Text>
                          <Text style={styles.detailValue}>{report.manb}</Text>
                        </View>
                      )}
                      {report.shift && report.shift.trim() && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>משמרת:</Text>
                          <Text style={styles.detailValue}>{report.shift}</Text>
                        </View>
                      )}
                      {report.shift_pro && report.shift_pro.trim() && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>משמרת פרו:</Text>
                          <Text style={styles.detailValue}>{report.shift_pro}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => openEditModal(report)}
                      >
                        <Text style={styles.actionButtonText}>ערוך</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => deleteReport(report)}
                      >
                        <Text style={styles.actionButtonText}>מחק</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
            );
          })}

          {filteredReports.length === 0 && !loading && (
            <Text style={styles.noDataText}>אין דוחות להציג</Text>
          )}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>עריכת דוח סוף יום</Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>מזומן בקופה (₪)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הזן כמות מזומן בשקלים"
                value={editForm.myz}
                onChangeText={(text) => setEditForm({...editForm, myz: text})}
                keyboardType="numeric"
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>הכנסות וולט/אשראי (₪)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הזן הכנסות מכרטיסי אשראי"
                value={editForm.hmp}
                onChangeText={(text) => setEditForm({...editForm, hmp: text})}
                keyboardType="numeric"
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>סה"כ הכנסות יומיות (₪)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הזן סה״כ הכנסות היום"
                value={editForm.datel}
                onChangeText={(text) => setEditForm({...editForm, datel: text})}
                keyboardType="numeric"
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>שם מנהל משמרת</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הזן שם המנהל"
                value={editForm.mname}
                onChangeText={(text) => setEditForm({...editForm, mname: text})}
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>טיפים משמרת בוקר (₪)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הזן טיפים של הבוקר"
                value={editForm.tipmb}
                onChangeText={(text) => setEditForm({...editForm, tipmb: text})}
                keyboardType="numeric"
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>טיפים משמרת ערב (₪)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הזן טיפים של הערב"
                value={editForm.tipme}
                onChangeText={(text) => setEditForm({...editForm, tipme: text})}
                keyboardType="numeric"
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>מנהל בוקר</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הזן שם מנהל הבוקר"
                value={editForm.manb}
                onChangeText={(text) => setEditForm({...editForm, manb: text})}
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>מספר דוח (ID)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="מספר זהות הדוח"
                value={editForm.id_num}
                onChangeText={(text) => setEditForm({...editForm, id_num: text})}
                keyboardType="numeric"
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>שם יום</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="שם היום (כמו יום ראשון, יום שני...)"
                value={editForm.dayname}
                onChangeText={(text) => setEditForm({...editForm, dayname: text})}
                textAlign="right"
              />
              
              <Text style={styles.fieldLabel}>תאריך</Text>
              <View style={styles.dateInputsContainer}>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateLabel}>יום</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="יום"
                    value={editForm.day_d}
                    onChangeText={(text) => setEditForm({...editForm, day_d: text})}
                    keyboardType="numeric"
                    textAlign="center"
                    maxLength={2}
                  />
                </View>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateLabel}>חודש</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="חודש"
                    value={editForm.month_d}
                    onChangeText={(text) => setEditForm({...editForm, month_d: text})}
                    keyboardType="numeric"
                    textAlign="center"
                    maxLength={2}
                  />
                </View>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateLabel}>שנה</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="שנה"
                    value={editForm.year_d}
                    onChangeText={(text) => setEditForm({...editForm, year_d: text})}
                    keyboardType="numeric"
                    textAlign="center"
                    maxLength={4}
                  />
                </View>
              </View>
              
              <Text style={styles.fieldLabel}>הערות כלליות</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="הערות כלליות ופרטים נוספים"
                value={editForm.comment}
                onChangeText={(text) => setEditForm({...editForm, comment: text})}
                textAlign="right"
                multiline={true}
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={updateReport}
              >
                <Text style={styles.modalButtonText}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  statsText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'right',
    marginBottom: 20,
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#E3F2FD',
    marginHorizontal: 0,
    marginBottom: 15,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'right',
    lineHeight: 20,
  },
  reportCard: {
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
  reportHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  reportInfo: {
    flex: 1,
  },
  reportManager: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
  },
  reportId: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
    marginTop: 2,
  },
  reportDate: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 2,
  },
  reportDayName: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'right',
    marginTop: 2,
    fontWeight: '500',
  },
  amountContainer: {
    alignItems: 'center',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  amountLabel: {
    fontSize: 12,
    color: '#666666',
  },
  reportDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#333333',
  },
  actionButtons: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  monthSection: {
    marginBottom: 25,
  },
  monthHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'right',
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E3F2FD',
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666666',
    marginTop: 50,
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
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 20,
    color: '#333333',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
  },
  modalScrollView: {
    flex: 1,
    maxHeight: 400,
    paddingBottom: 10,
  },
  dateInputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  dateInputWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 5,
    textAlign: 'center',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#F9F9F9',
    minWidth: 50,
    width: 50,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 5,
    marginTop: 10,
  },
  // Filter Styles
  filtersContainer: {
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'right',
    marginBottom: 5,
  },
  filterButtonsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 5,
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  monthsScroll: {
    maxHeight: 80,
  },
});

export default ReportManagementScreen;