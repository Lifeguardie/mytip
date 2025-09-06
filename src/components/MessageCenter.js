import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

const MessageCenter = ({ user, visible, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'sent', 'received'
  const [composeVisible, setComposeVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageDetailVisible, setMessageDetailVisible] = useState(false);

  // Compose message state
  const [newMessage, setNewMessage] = useState({
    receiver_id: '',
    subject: '',
    content: '',
    priority: 'normal'
  });

  useEffect(() => {
    if (visible && user?.id) {
      loadMessages();
      loadManagers();
    }
  }, [visible, user, selectedFilter]);

  const loadMessages = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.dubnov8.com/api-simple.php?endpoint=messages&userId=${user.id}&type=${selectedFilter}`
      );
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages || []);
      } else {
        Alert.alert('שגיאה', data.message || 'שגיאה בטעינת הודעות');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת הודעות');
    } finally {
      setLoading(false);
    }
  };

  const loadManagers = async () => {
    try {
      const response = await fetch(
        `https://api.dubnov8.com/api-simple.php?endpoint=managers`
      );
      const data = await response.json();
      
      if (data.success) {
        setManagers(data.managers || []);
      }
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const sendMessage = async () => {
    if (!newMessage.receiver_id || !newMessage.subject.trim() || !newMessage.content.trim()) {
      Alert.alert('שגיאה', 'נא למלא את כל השדות');
      return;
    }

    try {
      const response = await fetch(
        `https://api.dubnov8.com/api-simple.php?endpoint=messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender_id: user.id,
            receiver_id: newMessage.receiver_id,
            subject: newMessage.subject,
            content: newMessage.content,
            message_type: 'regular',
            priority: newMessage.priority
          })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        Alert.alert('הצלחה', 'הודעה נשלחה בהצלחה');
        setComposeVisible(false);
        setNewMessage({
          receiver_id: '',
          subject: '',
          content: '',
          priority: 'normal'
        });
        loadMessages();
      } else {
        Alert.alert('שגיאה', data.message || 'שגיאה בשליחת הודעה');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('שגיאה', 'שגיאה בשליחת הודעה');
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await fetch(
        `https://api.dubnov8.com/api-simple.php?endpoint=messages/${messageId}/read`,
        { method: 'POST' }
      );
      loadMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const openMessage = (message) => {
    setSelectedMessage(message);
    setMessageDetailVisible(true);
    if (!message.is_read && message.receiver_id === user.id) {
      markAsRead(message.id);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return dateString;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'low': return '#4caf50';
      default: return '#2196f3';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'low': return '🟢';
      default: return '🔵';
    }
  };

  const renderMessageItem = ({ item }) => {
    const isReceived = item.receiver_id === user.id;
    const isUnread = !item.is_read && isReceived;
    
    return (
      <TouchableOpacity
        style={[
          styles.messageItem,
          isUnread && styles.unreadMessage
        ]}
        onPress={() => openMessage(item)}
        activeOpacity={0.7}
      >
        <View style={styles.messageHeader}>
          <View style={styles.messageInfo}>
            <Text style={[styles.messageContact, isUnread && styles.unreadText]}>
              {isReceived ? `מאת: ${item.sender_name}` : `אל: ${item.receiver_name}`}
            </Text>
            <Text style={styles.messageDate}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <View style={styles.messagePriority}>
            <Text style={styles.priorityIcon}>
              {getPriorityIcon(item.priority)}
            </Text>
          </View>
        </View>
        
        <Text style={[styles.messageSubject, isUnread && styles.unreadText]}>
          {item.subject}
        </Text>
        
        <Text style={styles.messagePreview} numberOfLines={2}>
          {item.content}
        </Text>
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageStatus,
            { color: getPriorityColor(item.priority) }
          ]}>
            {item.priority === 'high' ? 'דחוף' : 
             item.priority === 'low' ? 'רגיל' : 'נורמלי'}
          </Text>
          {isUnread && (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>●</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>מרכז הודעות</Text>
          <TouchableOpacity 
            style={styles.composeButton} 
            onPress={() => setComposeVisible(true)}
          >
            <Text style={styles.composeButtonText}>✏️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'all' && styles.activeFilterButton
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'all' && styles.activeFilterButtonText
            ]}>
              הכל
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'received' && styles.activeFilterButton
            ]}
            onPress={() => setSelectedFilter('received')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'received' && styles.activeFilterButtonText
            ]}>
              נתקבל
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'sent' && styles.activeFilterButton
            ]}
            onPress={() => setSelectedFilter('sent')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'sent' && styles.activeFilterButtonText
            ]}>
              נשלח
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>טוען הודעות...</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>אין הודעות להצגה</Text>
              </View>
            }
            contentContainerStyle={messages.length === 0 ? styles.emptyList : undefined}
          />
        )}

        {/* Compose Message Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={composeVisible}
          onRequestClose={() => setComposeVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.composeModal}>
              <View style={styles.composeHeader}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setComposeVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>ביטול</Text>
                </TouchableOpacity>
                <Text style={styles.composeTitle}>הודעה חדשה</Text>
                <TouchableOpacity 
                  style={styles.sendButton}
                  onPress={sendMessage}
                >
                  <Text style={styles.sendButtonText}>שלח</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.composeContent}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>נמען:</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={newMessage.receiver_id}
                      onValueChange={(value) => 
                        setNewMessage({...newMessage, receiver_id: value})
                      }
                      style={styles.picker}
                    >
                      <Picker.Item label="בחר נמען" value="" />
                      {managers.map((manager) => (
                        <Picker.Item 
                          key={manager.id}
                          label={`${manager.wname} (${manager.job})`}
                          value={manager.id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>נושא:</Text>
                  <TextInput
                    style={styles.subjectInput}
                    value={newMessage.subject}
                    onChangeText={(text) => 
                      setNewMessage({...newMessage, subject: text})
                    }
                    placeholder="הכנס נושא ההודעה"
                    textAlign="right"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>חשיבות:</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={newMessage.priority}
                      onValueChange={(value) => 
                        setNewMessage({...newMessage, priority: value})
                      }
                      style={styles.picker}
                    >
                      <Picker.Item label="🟢 נמוך" value="low" />
                      <Picker.Item label="🔵 רגיל" value="normal" />
                      <Picker.Item label="🔴 דחוף" value="high" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>תוכן ההודעה:</Text>
                  <TextInput
                    style={styles.contentInput}
                    value={newMessage.content}
                    onChangeText={(text) => 
                      setNewMessage({...newMessage, content: text})
                    }
                    placeholder="הכנס את תוכן ההודעה כאן..."
                    multiline
                    numberOfLines={6}
                    textAlign="right"
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Message Detail Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={messageDetailVisible}
          onRequestClose={() => setMessageDetailVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.detailModal}>
              <View style={styles.detailHeader}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setMessageDetailVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>סגור</Text>
                </TouchableOpacity>
                <Text style={styles.detailTitle}>פרטי הודעה</Text>
                <View style={styles.placeholder} />
              </View>

              {selectedMessage && (
                <ScrollView style={styles.detailContent}>
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailInfoText}>
                      מאת: {selectedMessage.sender_name}
                    </Text>
                    <Text style={styles.detailInfoText}>
                      אל: {selectedMessage.receiver_name}
                    </Text>
                    <Text style={styles.detailInfoText}>
                      תאריך: {formatDate(selectedMessage.created_at)}
                    </Text>
                    <Text style={[
                      styles.detailInfoText,
                      { color: getPriorityColor(selectedMessage.priority) }
                    ]}>
                      חשיבות: {selectedMessage.priority === 'high' ? 'דחוף' : 
                                selectedMessage.priority === 'low' ? 'נמוך' : 'רגיל'}
                    </Text>
                  </View>

                  <View style={styles.subjectContainer}>
                    <Text style={styles.detailSubject}>
                      {selectedMessage.subject}
                    </Text>
                  </View>

                  <View style={styles.contentContainer}>
                    <Text style={styles.detailContent}>
                      {selectedMessage.content}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  composeButton: {
    padding: 10,
  },
  composeButtonText: {
    fontSize: 18,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeFilterButton: {
    backgroundColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  messageItem: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadMessage: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  messageInfo: {
    flex: 1,
  },
  messageContact: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  messageDate: {
    fontSize: 12,
    color: '#999',
  },
  messagePriority: {
    marginLeft: 10,
  },
  priorityIcon: {
    fontSize: 12,
  },
  messageSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'right',
  },
  messagePreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'right',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  messageStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#333',
  },
  unreadDot: {
    marginLeft: 5,
  },
  unreadDotText: {
    color: '#4CAF50',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  emptyList: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeModal: {
    backgroundColor: '#fff',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 15,
    overflow: 'hidden',
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 15,
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  cancelButton: {
    padding: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#fff',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  sendButtonText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  composeContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
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
  subjectInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 120,
  },
  detailModal: {
    backgroundColor: '#fff',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 15,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 15,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  detailContent: {
    padding: 20,
  },
  detailInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  detailInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    textAlign: 'right',
  },
  subjectContainer: {
    marginBottom: 15,
  },
  detailSubject: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  contentContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
  },
  detailContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'right',
  },
});

export default MessageCenter;