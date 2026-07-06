import React, { useState } from 'react';
import { Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InicioScreen          from '../screens/InicioScreen';
import AnimalesScreen        from '../screens/AnimalesScreen';
import RegistroAnimalScreen  from '../screens/RegistroAnimalScreen';
import DetalleAnimalScreen   from '../screens/DetalleAnimalScreen';
import EstablecimientosScreen from '../screens/EstablecimientosScreen';
import ExportarScreen        from '../screens/ExportarScreen';
import DispositivosScreen    from '../screens/DispositivosScreen';
import MenuModal             from '../components/MenuModal';
import { Colors }            from '../utils/colors';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const LOGO = require('../../assets/logo.png');

function HeaderLogo() {
  return <Image source={LOGO} style={styles.logo} />;
}

function HamburgerBtn({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.hamburger} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={styles.hamburgerIcon}>☰</Text>
    </TouchableOpacity>
  );
}

const TAB_ICONS = {
  Inicio: '🏠', Animales: '🐄', Establecimientos: '🚜', Exportar: '📤', Dispositivos: '📡',
};

export default function AppNavigator() {
  const [menuOpen, setMenuOpen] = useState(false);

  function headerOptions(overrides = {}) {
    return {
      headerStyle:      { backgroundColor: Colors.header },
      headerTintColor:  Colors.headerTint,
      headerTitleStyle: { fontWeight: '700', color: Colors.headerTint },
      headerTitle:      () => <HeaderLogo />,
      headerRight:      () => <HamburgerBtn onPress={() => setMenuOpen(true)} />,
      headerBackTitle:  'Volver',
      ...overrides,
    };
  }

  function AnimalesStack() {
    return (
      <Stack.Navigator screenOptions={headerOptions()}>
        <Stack.Screen name="ListaAnimales"  component={AnimalesScreen} />
        <Stack.Screen
          name="RegistroAnimal"
          component={RegistroAnimalScreen}
          options={({ route }) => headerOptions({
            headerTitle: route.params?.id ? 'Editar animal' : 'Registrar animal',
            headerTitleStyle: { fontWeight: '700', color: Colors.headerTint },
          })}
        />
        <Stack.Screen
          name="DetalleAnimal"
          component={DetalleAnimalScreen}
          options={headerOptions({ headerTitle: 'Detalle', headerTitleStyle: { fontWeight: '700', color: Colors.headerTint } })}
        />
      </Stack.Navigator>
    );
  }

  const tabScreenOptions = ({ route }) => ({
    tabBarIcon: ({ focused }) => (
      <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
        {TAB_ICONS[route.name] ?? '●'}
      </Text>
    ),
    tabBarActiveTintColor:   Colors.tabBarActive,
    tabBarInactiveTintColor: Colors.tabBarInactive,
    tabBarStyle: {
      backgroundColor: Colors.tabBar,
      borderTopColor:  Colors.border,
      paddingBottom:   4,
      height:          60,
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    ...headerOptions(),
  });

  return (
    <>
      <NavigationContainer>
        <Tab.Navigator screenOptions={tabScreenOptions}>
          <Tab.Screen name="Inicio"           component={InicioScreen} />
          <Tab.Screen name="Animales"         component={AnimalesStack} options={{ headerShown: false }} />
          <Tab.Screen name="Establecimientos" component={EstablecimientosScreen} options={{ tabBarLabel: 'Campo' }} />
          <Tab.Screen name="Exportar"         component={ExportarScreen} />
          <Tab.Screen name="Dispositivos"     component={DispositivosScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      <MenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  logo:          { height: 32, width: 120, resizeMode: 'contain' },
  hamburger:     { marginRight: 16, padding: 4 },
  hamburgerIcon: { fontSize: 22, color: Colors.headerTint },
});
