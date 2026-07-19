import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

/** Fades and slides its children in when mounted — used on result screens. */
export default function FadeIn({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [opacity, translate]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: translate }] }]}>
      {children}
    </Animated.View>
  );
}
