import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

/** Gently scales its children in a loop — used to make buzzers feel alive. */
export default function PulseView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 550, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
