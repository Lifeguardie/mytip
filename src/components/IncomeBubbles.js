import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  ScrollView
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const IncomeBubbles = ({ envelopes = [], totalIncome = 0, onBubblePress }) => {
  const [bubbles, setBubbles] = useState([]);
  const [animatedValues, setAnimatedValues] = useState([]);

  useEffect(() => {
    if (envelopes.length > 0) {
      generateBubbles();
    }
  }, [envelopes]);

  const generateBubbles = () => {
    const maxAmount = Math.max(...envelopes.map(env => parseFloat(env.sumin || 0)));
    const minSize = 30;
    const maxSize = 80;
    
    const newBubbles = envelopes.map((envelope, index) => {
      const amount = parseFloat(envelope.sumin || 0);
      const size = amount > 0 ? minSize + (amount / maxAmount) * (maxSize - minSize) : minSize;
      
      // Generate random position within safe bounds
      const x = Math.random() * (screenWidth - size - 40) + 20;
      const y = Math.random() * (300 - size - 40) + 20;
      
      // Color based on amount and status
      const getColor = () => {
        if (envelope.took === 'Yes') {
          return amount > maxAmount * 0.7 ? '#4CAF50' : '#81C784'; // Green shades for received
        } else {
          return amount > maxAmount * 0.7 ? '#FF9800' : '#FFB74D'; // Orange shades for pending
        }
      };

      return {
        id: envelope.id || index,
        amount,
        size,
        x,
        y,
        color: getColor(),
        envelope,
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0),
        floatY: new Animated.Value(0)
      };
    });

    setBubbles(newBubbles);
    animateBubblesIn(newBubbles);
  };

  const animateBubblesIn = (newBubbles) => {
    // Animate bubbles appearing
    newBubbles.forEach((bubble, index) => {
      Animated.sequence([
        Animated.delay(index * 100),
        Animated.parallel([
          Animated.spring(bubble.opacity, {
            toValue: 0.8,
            useNativeDriver: true,
            tension: 50,
            friction: 8
          }),
          Animated.spring(bubble.scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 8
          })
        ])
      ]).start();

      // Start floating animation
      const startFloating = () => {
        Animated.sequence([
          Animated.timing(bubble.floatY, {
            toValue: -10,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true
          }),
          Animated.timing(bubble.floatY, {
            toValue: 10,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true
          })
        ]).start(() => startFloating());
      };

      setTimeout(() => startFloating(), index * 100 + 1000);
    });
  };

  const handleBubblePress = (bubble) => {
    // Bubble tap animation
    Animated.sequence([
      Animated.timing(bubble.scale, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(bubble.scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      })
    ]).start();

    if (onBubblePress) {
      onBubblePress(bubble.envelope);
    }
  };

  const formatAmount = (amount) => {
    return `₪${amount}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (bubbles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>אין מעטפות להצגה</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.titleText}>הכנסות חודשיות</Text>
        <Text style={styles.totalText}>סה"כ: ₪{totalIncome}</Text>
      </View>
      
      <View style={styles.bubblesContainer}>
        {bubbles.map((bubble) => (
          <Animated.View
            key={bubble.id}
            style={[
              styles.bubble,
              {
                width: bubble.size,
                height: bubble.size,
                left: bubble.x,
                top: bubble.y,
                backgroundColor: bubble.color,
                opacity: bubble.opacity,
                transform: [
                  { scale: bubble.scale },
                  { translateY: bubble.floatY }
                ]
              }
            ]}
          >
            <TouchableOpacity
              style={styles.bubbleContent}
              onPress={() => handleBubblePress(bubble)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.amountText,
                { fontSize: Math.min(bubble.size / 4, 12) }
              ]}>
                {formatAmount(bubble.amount)}
              </Text>
              {bubble.size > 50 && (
                <Text style={[
                  styles.dateText,
                  { fontSize: Math.min(bubble.size / 6, 8) }
                ]}>
                  {formatDate(bubble.envelope.mydate)}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>נתקבל</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>ממתין</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 10,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8
  },
  totalText: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600'
  },
  bubblesContainer: {
    height: 350,
    margin: 10,
    backgroundColor: '#fff',
    borderRadius: 15,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  bubble: {
    position: 'absolute',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  },
  bubbleContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%'
  },
  amountText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  dateText: {
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15
  },
  legendColor: {
    width: 15,
    height: 15,
    borderRadius: 8,
    marginRight: 8
  },
  legendText: {
    fontSize: 14,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center'
  }
});

export default IncomeBubbles;