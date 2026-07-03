import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function HeaderLogo() {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={styles.logo}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    height: 32,
    width: 120,
    resizeMode: 'contain',
  },
});
