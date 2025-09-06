import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList
} from 'react-native';
import { StatusBar } from 'react-native';
import { api } from '../services/api';

const ManageEveningChecklistScreen = ({ navigation }) => {
  const [checklistItems, setChecklistItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editingText, setEditingText] = useState('');

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
      const response = await api.getChecklist('evening');
      if (response.success && response.items) {
        setChecklistItems(response.items);
      } else {
        // First time - use default items
        setChecklistItems(defaultItems);
        await saveChecklist(defaultItems);
      }
    } catch (error) {
      console.error('Error loading evening checklist:', error);
      setChecklistItems(defaultItems);
    }
  };

  const saveChecklist = async (items) => {
    try {
      await api.saveChecklist('evening', items);
    } catch (error) {
      console.error('Error saving evening checklist:', error);
      Alert.alert('שגיאה', 'שגיאה בשמירת הרשימה בשרת');
    }
  };

  const addItem = () => {
    if (!newItemText.trim()) {
      Alert.alert('שגיאה', 'נא להזין טקסט למשימה');
      return;
    }

    const updatedItems = [...checklistItems, newItemText.trim()];
    setChecklistItems(updatedItems);
    saveChecklist(updatedItems);
    setNewItemText('');
    Alert.alert('נוסף', 'המשימה נוספה בהצלחה');
  };

  const removeItem = (index) => {
    Alert.alert(
      'מחק משימה',
      'האם אתה בטוח שברצונך למחוק משימה זו?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            const updatedItems = checklistItems.filter((_, i) => i !== index);
            setChecklistItems(updatedItems);
            saveChecklist(updatedItems);
          }
        }
      ]
    );
  };

  const editItem = (index) => {
    setEditingIndex(index);
    setEditingText(checklistItems[index]);
    setEditModalVisible(true);
  };

  const saveEdit = () => {
    if (!editingText.trim()) {
      Alert.alert('שגיאה', 'נא להזין טקסט למשימה');
      return;
    }

    const updatedItems = [...checklistItems];
    updatedItems[editingIndex] = editingText.trim();
    setChecklistItems(updatedItems);
    saveChecklist(updatedItems);
    setEditModalVisible(false);
    setEditingIndex(-1);
    setEditingText('');
  };

  const resetToDefault = () => {
    Alert.alert(
      'איפוס לברירת מחדל',
      'האם אתה בטוח שברצונך לאפס את הרשימה לברירת המחדל? פעולה זו תמחק את כל השינויים שעשית.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'איפוס',
          style: 'destructive',
          onPress: () => {
            setChecklistItems(defaultItems);
            saveChecklist(defaultItems);
            Alert.alert('הושלם', 'הרשימה אופסה לברירת המחדל');
          }
        }
      ]
    );
  };

  const moveItem = (fromIndex, direction) => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    
    if (toIndex < 0 || toIndex >= checklistItems.length) return;
    
    const updatedItems = [...checklistItems];
    const item = updatedItems.splice(fromIndex, 1)[0];
    updatedItems.splice(toIndex, 0, item);
    
    setChecklistItems(updatedItems);
    saveChecklist(updatedItems);
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        <View style={styles.itemNumber}>
          <Text style={styles.itemNumberText}>{index + 1}</Text>
        </View>
        <Text style={styles.itemText}>{item}</Text>
      </View>
      
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.moveButton]}
          onPress={() => moveItem(index, 'up')}
          disabled={index === 0}
        >
          <Text style={[styles.actionButtonText, index === 0 && styles.disabledText]}>↑</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.moveButton]}
          onPress={() => moveItem(index, 'down')}
          disabled={index === checklistItems.length - 1}
        >
          <Text style={[styles.actionButtonText, index === checklistItems.length - 1 && styles.disabledText]}>↓</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => editItem(index)}
        >
          <Text style={styles.actionButtonText}>✏️</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => removeItem(index)}
        >
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#673AB7" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ניהול צ'קליסט ערב</Text>
        <TouchableOpacity 
          style={styles.resetButton} 
          onPress={resetToDefault}
        >
          <Text style={styles.resetButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Add new item section */}
        <View style={styles.addSection}>
          <Text style={styles.sectionTitle}>הוסף משימה חדשה</Text>
          <View style={styles.addInputContainer}>
            <TextInput
              style={styles.addInput}
              value={newItemText}
              onChangeText={setNewItemText}
              placeholder="הזן את המשימה החדשה..."
              placeholderTextColor="#999"
              multiline
              textAlign="right"
            />
            <TouchableOpacity style={styles.addButton} onPress={addItem}>
              <Text style={styles.addButtonText}>הוסף</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Checklist items */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>רשימת משימות ({checklistItems.length})</Text>
          <FlatList
            data={checklistItems}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ערוך משימה</Text>
            
            <TextInput
              style={styles.editInput}
              value={editingText}
              onChangeText={setEditingText}
              placeholder="ערוך את המשימה..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlign="right"
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>ביטול</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveEdit}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>שמור</Text>
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
    backgroundColor: '#F3E5F5',
  },
  header: {
    backgroundColor: '#673AB7',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    padding: 10,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  addSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  addInputContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  addInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderRightWidth: 4,
    borderRightColor: '#673AB7',
  },
  itemHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemNumber: {
    backgroundColor: '#673AB7',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  itemNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    textAlign: 'right',
    marginLeft: 8,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 5,
  },
  actionButton: {
    borderRadius: 6,
    padding: 8,
    minWidth: 35,
    alignItems: 'center',
  },
  moveButton: {
    backgroundColor: '#2196F3',
  },
  editButton: {
    backgroundColor: '#673AB7',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledText: {
    color: 'rgba(255,255,255,0.5)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  saveButtonText: {
    color: '#fff',
  },
});

export default ManageEveningChecklistScreen;