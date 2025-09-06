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

const MorningChecklistScreen = ({ navigation }) => {
  const [checklistItems, setChecklistItems] = useState([]);
  
  // Default checklist items
  const defaultItems = [
    '   להוריד כיסאות בכל אזורי המסעדה',
    '   לנגב את כל השולחנות במסעדה',
    '   פיזור מלח פלפל וסוכרים בכל אזורי המסעדה',
    '   לערוך את פנים המסעדה (בסגירת חורף יש לערוך גם את הדק)',
    '   הוצאת עמדת המלצרים לחוץ',
    '   לעבור על הסגירה של אתמול (במידה ולא בוצעה כמו שצריך יש לעדכן אחמש)',
    '   למלא קרח',
    '   בקיץ – להוציא את כריות הישיבה ועמדת מארחת',
    '   להכניס עיתונים',
    '   לפלש כוסות מים',
    '   בקיץ להוציא דיספנסר מים החוצה',
    '   להפעיל מחדש מסופונים של האשראי'
  ];

  useEffect(() => {
    loadChecklist();
  }, []);

  const loadChecklist = async () => {
    try {
      const response = await ApiService.getChecklist('morning');
      if (response.success && response.items) {
        setChecklistItems(response.items);
      } else {
        // Fallback to default items
        setChecklistItems(defaultItems);
      }
    } catch (error) {
      console.error('Error loading morning checklist:', error);
      setChecklistItems(defaultItems);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" backgroundColor="#FFC107" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🌅 צ'קליסט בוקר</Text>
        <Text style={styles.subtitle}>רשימת משימות לתחילת המשמרת</Text>
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
    backgroundColor: '#FFF8E1',
  },
  header: {
    backgroundColor: '#FFC107',
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
    backgroundColor: '#FFC107',
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

export default MorningChecklistScreen;