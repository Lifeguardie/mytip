import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { StatusBar } from 'react-native';
import ApiService from '../services/api';

const EveningChecklistScreen = ({ navigation }) => {
  const [checklistItems, setChecklistItems] = useState([]);
  
  // Default evening checklist items
  const defaultItems = [
    'לסגור את כל המכונות והציוד בבר',
    'לוודא שכל הכסף במקום ובטוח',
    'לנקות ולסדר את אזור הבר',
    'לכבות את כל האורות במסעדה',
    'לוודא שכל החלונות והדלתות נעולים',
    'לבדוק שהמקרר והפריזר עובדים תקין',
    'לנקות את כל השולחנות',
    'לוודא שכל הפחים מרוקנים',
    'להעלות כיסאות על השולחנות',
    'לבדוק שמערכת האזעקה פעילה',
    'לסגור את הגז הראשי',
    'לוודא שכל הברזים סגורים'
  ];

  useEffect(() => {
    loadChecklist();
  }, []);

  const loadChecklist = async () => {
    try {
      const response = await ApiService.getChecklist('evening');
      if (response.success && response.items) {
        setChecklistItems(response.items);
      } else {
        // Fallback to default items
        setChecklistItems(defaultItems);
      }
    } catch (error) {
      console.error('Error loading evening checklist:', error);
      setChecklistItems(defaultItems);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" backgroundColor="#673AB7" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🌆 צ'קליסט ערב</Text>
        <Text style={styles.subtitle}>רשימת משימות לסיום המשמרת</Text>
      </View>

      <View style={styles.content}>
        {checklistItems.map((item, index) => (
          <View key={index} style={styles.checklistItem}>
            <View style={styles.numberContainer}>
              <Text style={styles.itemNumber}>{index + 1}</Text>
            </View>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneButtonText}>הבנתי ✓</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3E5F5',
  },
  header: {
    backgroundColor: '#673AB7',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 50,
    padding: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  checklistItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  numberContainer: {
    backgroundColor: '#673AB7',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  itemNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'right',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  doneButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default EveningChecklistScreen;